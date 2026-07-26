// Email/password auth WITHOUT email verification — intended for test and
// demo accounts (multi-user communication testing) and as a simple
// credential login. No emails are sent anywhere.
import { scrypt, randomBytes, timingSafeEqual } from "crypto";

const SCRYPT_KEYLEN = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEYLEN, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [alg, saltHex, keyHex] = stored.split(":");
  if (alg !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  const expected = Buffer.from(keyHex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export const emailUnionId = (email: string) => `email:${email.toLowerCase()}`;
