// Meta webhooks (Facebook Messenger + Instagram DM) and WhatsApp Cloud API.
// One Meta app can serve all three: FB (object=page), IG (object=instagram),
// WhatsApp (object=whatsapp_business_account).
import { createHmac, timingSafeEqual } from "crypto";
import {
  connectionAccessToken,
  ensureChannelConversation,
  ensureShadowUser,
  findConnectionByExternalId,
  findConnectionByVerifyToken,
  ingestExternalMessage,
  touchConnection,
} from "../queries/channels";
import { createNotification } from "../queries/notifications";
import type { Attachment, ChannelKind } from "@db/schema";

const GRAPH = "https://graph.facebook.com/v21.0";

// ---------- Webhook verification (GET handshake) ----------

export function verifyMetaHandshake(query: Record<string, string | undefined>) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (mode !== "subscribe" || !token || !challenge) return null;
  // The verify token is user-chosen and stored on the connection row, so a
  // single PropLink deployment can host many independent Meta apps.
  return findConnectionByVerifyToken(token).then((conn) =>
    conn ? challenge : null,
  );
}

// ---------- Signature validation ----------

export function isValidMetaSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected =
    "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- Senders ----------

async function graphPost(path: string, token: string, body: unknown) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Meta API ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as any;
}

export async function sendMetaText(
  conn: Parameters<typeof connectionAccessToken>[0],
  recipientPsid: string,
  text: string,
): Promise<string | null> {
  const token = connectionAccessToken(conn);
  if (!token || !conn.externalAccountId) return null;
  const data = await graphPost(`/${conn.externalAccountId}/messages`, token, {
    recipient: { id: recipientPsid },
    message: { text },
    messaging_type: "RESPONSE",
  });
  return data?.message_id ?? null;
}

export async function sendWhatsAppText(
  conn: Parameters<typeof connectionAccessToken>[0],
  toPhone: string,
  text: string,
): Promise<string | null> {
  const token = connectionAccessToken(conn);
  if (!token || !conn.externalAccountId) return null;
  const data = await graphPost(`/${conn.externalAccountId}/messages`, token, {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "text",
    text: { body: text },
  });
  return data?.messages?.[0]?.id ?? null;
}

// ---------- Ingest helpers ----------

function metaAttachments(msg: any): Attachment[] | null {
  if (!Array.isArray(msg?.attachments)) return null;
  const out: Attachment[] = [];
  for (const a of msg.attachments) {
    const url = a?.payload?.url;
    if (!url) continue;
    out.push({
      url,
      name: a?.payload?.title || a?.type || "attachment",
      kind: a.type === "image" ? "image" : "document",
    });
  }
  return out.length ? out : null;
}

async function ingestIntoConversation(args: {
  channel: ChannelKind;
  externalAccountId: string;
  externalUserId: string;
  externalName?: string | null;
  body: string | null;
  attachments?: Attachment[] | null;
  externalId?: string | null;
}) {
  const conn = await findConnectionByExternalId(
    args.channel,
    args.externalAccountId,
  );
  if (!conn) return { ok: false, reason: "no connection" };

  const shadow = await ensureShadowUser(
    args.channel,
    args.externalUserId,
    args.externalName,
  );
  const conv = await ensureChannelConversation(
    conn.id,
    args.channel,
    args.externalUserId,
    conn.userId,
    shadow.id,
  );
  const res = await ingestExternalMessage({
    conversationId: conv.id,
    senderUserId: shadow.id,
    body: args.body,
    attachments: args.attachments ?? undefined,
    externalId: args.externalId,
  });
  await touchConnection(conn.id);
  if (!res.duplicate) {
    void createNotification(conn.userId, {
      type: "new_message",
      title: `${args.channel} message from ${shadow.name ?? "contact"}`,
      body: (args.body ?? "Attachment").slice(0, 140),
      link: `/messages/${conv.id}`,
    }).catch(() => {});
  }
  return { ok: true };
}

// ---------- Webhook event processing ----------

// Facebook Messenger (object=page) and Instagram (object=instagram)
export async function processMetaWebhook(body: any) {
  const channel: ChannelKind = body?.object === "instagram" ? "instagram" : "facebook";
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  let handled = 0;
  for (const entry of entries) {
    const pageId = String(entry?.id ?? "");
    for (const ev of entry?.messaging ?? []) {
      // Skip echoes of messages we sent ourselves
      if (ev?.message?.is_echo) continue;
      const senderId = ev?.sender?.id ? String(ev.sender.id) : null;
      const recipientId = ev?.recipient?.id ? String(ev.recipient.id) : pageId;
      if (!senderId) continue;
      const text = ev?.message?.text ?? null;
      const atts = metaAttachments(ev?.message);
      if (!text && !atts) continue; // delivery/read receipts etc.
      await ingestIntoConversation({
        channel,
        externalAccountId: recipientId,
        externalUserId: senderId,
        body: text,
        attachments: atts,
        externalId: ev?.message?.mid ?? null,
      });
      handled++;
    }
  }
  return handled;
}

// WhatsApp Business Cloud API (object=whatsapp_business_account)
export async function processWhatsAppWebhook(body: any) {
  let handled = 0;
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (!value?.messages) continue;
      const phoneNumberId = String(value?.metadata?.phone_number_id ?? "");
      const names = new Map<string, string>();
      for (const c of value?.contacts ?? []) {
        if (c?.wa_id) names.set(String(c.wa_id), c?.profile?.name);
      }
      for (const msg of value.messages) {
        const from = String(msg?.from ?? "");
        if (!from) continue;
        let text: string | null = null;
        let atts: Attachment[] | null = null;
        if (msg?.type === "text") text = msg?.text?.body ?? null;
        else if (msg?.type === "image")
          atts = [{ url: `wa-media:${msg.image?.id}`, name: "photo", kind: "image" }];
        else if (msg?.type === "document")
          atts = [{ url: `wa-media:${msg.document?.id}`, name: msg.document?.filename ?? "document", kind: "document" }];
        else if (msg?.type === "audio" || msg?.type === "video")
          atts = [{ url: `wa-media:${msg[msg.type]?.id}`, name: msg.type, kind: "document" }];
        else text = `[${msg?.type ?? "unknown"} message]`;
        await ingestIntoConversation({
          channel: "whatsapp",
          externalAccountId: phoneNumberId,
          externalUserId: from,
          externalName: names.get(from) ?? null,
          body: text,
          attachments: atts,
          externalId: msg?.id ?? null,
        });
        handled++;
      }
    }
  }
  return handled;
}
