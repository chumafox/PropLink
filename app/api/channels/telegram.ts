import {
  connectionAccessToken,
  ensureChannelConversation,
  ensureShadowUser,
  findConnectionByVerifyToken,
  ingestExternalMessage,
  touchConnection,
} from "../queries/channels";
import { createNotification } from "../queries/notifications";

export async function sendTelegramMessage(
  conn: Parameters<typeof connectionAccessToken>[0],
  participantId: string,
  text: string,
): Promise<string | null> {
  const token = connectionAccessToken(conn);
  if (!token) return null;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: participantId, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  return String(data?.result?.message_id ?? "");
}

export async function processTelegramWebhook(body: any, verifyToken?: string) {
  if (!body?.message) return;
  if (!verifyToken) return;

  const conn = await findConnectionByVerifyToken(verifyToken);
  if (!conn || conn.channel !== "telegram") return;

  const msg = body.message;
  if (!msg.text || !msg.chat?.id || !msg.from?.id) return;

  const externalThreadId = String(msg.chat.id);
  const senderId = String(msg.from.id);
  const senderName = msg.from.first_name || msg.from.username || "Telegram User";
  
  const shadowUser = await ensureShadowUser(
    "telegram",
    senderId,
    senderName,
  );
  
  const conv = await ensureChannelConversation(
    conn.id,
    "telegram",
    externalThreadId,
    conn.userId,
    shadowUser.id,
  );
  
  await ingestExternalMessage({
    conversationId: conv.id,
    senderUserId: shadowUser.id,
    body: msg.text,
    externalId: String(msg.message_id),
  });
  
  await touchConnection(conn.id);
  await createNotification(conn.userId, {
    type: "new_message",
    title: `Telegram: ${senderName}`,
    body: msg.text.slice(0, 100),
    link: `/messages/${conv.id}`,
  });
}
