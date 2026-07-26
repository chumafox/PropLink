// Public webhook endpoints for external messengers.
// One callback URL handles the whole Meta family — Meta distinguishes
// products via body.object: "page" (FB Messenger), "instagram" (IG DM),
// "whatsapp_business_account" (WhatsApp Cloud API).
import { Hono } from "hono";
import {
  isValidMetaSignature,
  processMetaWebhook,
  processWhatsAppWebhook,
  verifyMetaHandshake,
} from "./meta";
import {
  connectionAppSecret,
  findConnectionByExternalId,
} from "../queries/channels";
import type { ChannelKind } from "@db/schema";

export const channelWebhooks = new Hono();

// GET — Meta webhook handshake (hub.challenge)
channelWebhooks.get("/meta", async (c) => {
  const challenge = await verifyMetaHandshake(c.req.query());
  if (!challenge) return c.text("Forbidden", 403);
  return c.text(challenge, 200);
});

// POST — incoming events
channelWebhooks.post("/meta", async (c) => {
  const raw = await c.req.text();
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return c.text("Bad Request", 400);
  }

  const object: string = body?.object ?? "";
  const channel: ChannelKind | null =
    object === "page"
      ? "facebook"
      : object === "instagram"
        ? "instagram"
        : object === "whatsapp_business_account"
          ? "whatsapp"
          : null;
  if (!channel) return c.text("EVENT_IGNORED", 200);

  // Signature check: find the connection this payload targets; if the owner
  // stored their Meta app secret, X-Hub-Signature-256 must validate.
  const extId = extractExternalAccountId(body, channel);
  if (extId) {
    const conn = await findConnectionByExternalId(channel, extId);
    const secret = conn ? connectionAppSecret(conn) : null;
    if (secret) {
      const sig = c.req.header("x-hub-signature-256");
      if (!isValidMetaSignature(raw, sig, secret)) {
        return c.text("Invalid signature", 401);
      }
    }
  }

  try {
    if (channel === "whatsapp") {
      await processWhatsAppWebhook(body);
    } else {
      await processMetaWebhook(body);
    }
  } catch (e) {
    console.error(`[channels] ${channel} webhook error:`, e);
    // Still 200 — Meta retries on non-200 and we'd get duplicates
  }
  return c.text("EVENT_RECEIVED", 200);
});

function extractExternalAccountId(body: any, channel: ChannelKind): string | null {
  try {
    if (channel === "whatsapp") {
      return String(
        body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? "",
      ) || null;
    }
    // page / instagram: recipient.id of the first messaging event, else entry id
    const entry = body?.entry?.[0];
    const ev = entry?.messaging?.[0];
    return String(ev?.recipient?.id ?? entry?.id ?? "") || null;
  } catch {
    return null;
  }
}
