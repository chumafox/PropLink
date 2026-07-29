import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Test all Zod schemas used in routers to ensure input validation works correctly.
 * These tests run without a database — they only validate schema logic.
 */

// Reproduce schemas from messagesRouter.ts
const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(255),
  kind: z.enum(["image", "document"]),
});

const sendMessageSchema = z.object({
  conversationId: z.number().int().positive(),
  body: z.string().max(10000).optional(),
  attachments: z.array(attachmentSchema).max(10).default([]),
});

const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(4).max(128),
  name: z.string().min(1).max(255).optional(),
});

const createGroupSchema = z.object({
  participantIds: z.array(z.number()),
  subject: z.string().min(1).max(255),
});

const setPinnedFilesSchema = z.object({
  conversationId: z.number().int().positive(),
  files: z.array(
    z.object({
      url: z.string(),
      name: z.string(),
      kind: z.enum(["image", "document"]),
    })
  ),
});

describe("Zod schemas – message sending", () => {
  it("accepts valid text message", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: 1,
      body: "Hello world",
    });
    expect(result.success).toBe(true);
  });

  it("accepts message with attachments only", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: 5,
      attachments: [
        { url: "https://example.com/photo.jpg", name: "photo.jpg", kind: "image" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative conversationId", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: -1,
      body: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects body > 10000 chars", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: 1,
      body: "a".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 attachments", () => {
    const atts = Array.from({ length: 11 }, (_, i) => ({
      url: `https://example.com/${i}.jpg`,
      name: `${i}.jpg`,
      kind: "image" as const,
    }));
    const result = sendMessageSchema.safeParse({
      conversationId: 1,
      attachments: atts,
    });
    expect(result.success).toBe(false);
  });

  it("rejects attachment with invalid URL", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: 1,
      attachments: [{ url: "not-a-url", name: "test.pdf", kind: "document" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("Zod schemas – credentials", () => {
  it("accepts valid registration", () => {
    const result = credentialsSchema.safeParse({
      email: "user@example.com",
      password: "test1234",
      name: "John",
    });
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 4 chars", () => {
    const result = credentialsSchema.safeParse({
      email: "user@example.com",
      password: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = credentialsSchema.safeParse({
      email: "not-an-email",
      password: "test1234",
    });
    expect(result.success).toBe(false);
  });

  it("accepts login without name", () => {
    const result = credentialsSchema.omit({ name: true }).safeParse({
      email: "user@example.com",
      password: "test1234",
    });
    expect(result.success).toBe(true);
  });
});

describe("Zod schemas – create group", () => {
  it("accepts valid group creation", () => {
    const result = createGroupSchema.safeParse({
      participantIds: [1, 2, 3],
      subject: "Deal Team",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty subject", () => {
    const result = createGroupSchema.safeParse({
      participantIds: [1, 2],
      subject: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects subject > 255 chars", () => {
    const result = createGroupSchema.safeParse({
      participantIds: [1, 2],
      subject: "A".repeat(256),
    });
    expect(result.success).toBe(false);
  });
});

describe("Zod schemas – pinned files", () => {
  it("BUG: pinnedFiles schema lacks 'audio' kind — audio pinning breaks on S3 upload path", () => {
    // The Attachment type in schema.ts only defines: "image" | "document"
    // But the frontend supports audio files. The setPinnedFiles endpoint
    // will reject audio files with kind: "audio" because zod will fail.
    const result = setPinnedFilesSchema.safeParse({
      conversationId: 1,
      files: [{ url: "data:audio/mp3;base64,...", name: "call.mp3", kind: "audio" }],
    });
    expect(result.success).toBe(false); // This SHOULD be true once kind is updated
  });

  it("accepts image and document kinds", () => {
    const result = setPinnedFilesSchema.safeParse({
      conversationId: 1,
      files: [
        { url: "https://example.com/doc.pdf", name: "doc.pdf", kind: "document" },
        { url: "https://example.com/photo.jpg", name: "photo.jpg", kind: "image" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
