import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, emailUnionId } from "./emailAuth";

describe("emailAuth", () => {
  describe("hashPassword / verifyPassword", () => {
    it("should hash and verify a password correctly", async () => {
      const hash = await hashPassword("test1234");
      expect(hash).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/);
      expect(await verifyPassword("test1234", hash)).toBe(true);
    });

    it("should reject an incorrect password", async () => {
      const hash = await hashPassword("correct");
      expect(await verifyPassword("wrong", hash)).toBe(false);
    });

    it("should produce different hashes for the same password (random salt)", async () => {
      const h1 = await hashPassword("samepass");
      const h2 = await hashPassword("samepass");
      expect(h1).not.toBe(h2);
      // But both should verify
      expect(await verifyPassword("samepass", h1)).toBe(true);
      expect(await verifyPassword("samepass", h2)).toBe(true);
    });

    it("should return false for malformed stored hashes", async () => {
      expect(await verifyPassword("test", "invalid")).toBe(false);
      expect(await verifyPassword("test", "bcrypt:salt:key")).toBe(false);
      expect(await verifyPassword("test", "scrypt::")).toBe(false);
    });
  });

  describe("emailUnionId", () => {
    it("should lowercase the email", () => {
      expect(emailUnionId("Test@Example.COM")).toBe("email:test@example.com");
    });

    it("should prefix with email:", () => {
      expect(emailUnionId("user@mail.com")).toBe("email:user@mail.com");
    });
  });
});
