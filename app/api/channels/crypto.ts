// AES-256-GCM encryption for channel access tokens at rest.
// Key derived from APP_SECRET (already provisioned for the deployment).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { env } from "../lib/env";

function key(): Buffer {
  return createHash("sha256").update(`proplink-channel-tokens:${env.appSecret}`).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptToken(payload: string): string | null {
  try {
    const [v, iv, tag, data] = payload.split(".");
    if (v !== "v1") return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
