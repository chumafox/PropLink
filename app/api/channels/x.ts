// X (Twitter) DM channel.
// Honest limitations (X API policy, as of 2025):
//  - Sending DMs: POST /2/dm_conversations/with/:participant_id/messages
//    requires OAuth 1.0a user context and a PAID X API tier (Basic+).
//  - Receiving DMs in real time: Account Activity API — enterprise/paid only.
// We implement the send path (works as soon as the user supplies valid paid
// credentials) and store config for receiving; webhook registration is done
// manually by the user in their X developer portal.
import { connectionAccessToken } from "../queries/channels";

export async function sendXdm(
  conn: Parameters<typeof connectionAccessToken>[0],
  participantId: string,
  text: string,
): Promise<string | null> {
  // For X we store a pre-computed OAuth2 user access token (bearer) in
  // accessTokenEnc. OAuth 1.0a signing is intentionally left to the user's
  // own proxy if they only have app-level keys.
  const token = connectionAccessToken(conn);
  if (!token) return null;
  const res = await fetch(
    `https://api.x.com/2/dm_conversations/with/${encodeURIComponent(participantId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`X API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  return data?.data?.dm_event_id ?? null;
}
