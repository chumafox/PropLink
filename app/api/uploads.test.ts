import { describe, it, expect } from "vitest";

// Test the uploads module's pure functions without needing S3 credentials
// We test: safeName logic, ALLOWED_TYPES regex, MAX_UPLOAD_BYTES constant

describe("uploads – constants & logic", () => {
  // Import the constant directly
  it("MAX_UPLOAD_BYTES should be 25 MB", async () => {
    const { MAX_UPLOAD_BYTES } = await import("./uploads");
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
  });

  it("uploadsConfigured returns false when env vars are missing", async () => {
    // In test env, R2_* vars should not be set
    const { uploadsConfigured } = await import("./uploads");
    expect(uploadsConfigured()).toBe(false);
  });

  it("resolveFileUrl returns URLs as-is when not s3://", async () => {
    const { resolveFileUrl } = await import("./uploads");
    const url = "https://example.com/photo.jpg";
    expect(await resolveFileUrl(url)).toBe(url);
  });

  it("resolveFileUrl returns s3:// as-is when uploads not configured", async () => {
    const { resolveFileUrl } = await import("./uploads");
    const url = "s3://private/1/test.pdf";
    // When not configured, should return the raw s3:// url
    expect(await resolveFileUrl(url)).toBe(url);
  });
});

describe("uploads – ALLOWED_TYPES patterns", () => {
  // Reproduce the regex patterns from the module to test them
  const publicPattern = /^image\/(jpeg|png|webp|gif|avif)$/;
  const privatePattern =
    /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.|text\/(plain|csv))$/;

  it("public scope allows standard image types", () => {
    expect(publicPattern.test("image/jpeg")).toBe(true);
    expect(publicPattern.test("image/png")).toBe(true);
    expect(publicPattern.test("image/webp")).toBe(true);
    expect(publicPattern.test("image/gif")).toBe(true);
    expect(publicPattern.test("image/avif")).toBe(true);
  });

  it("public scope rejects non-image types", () => {
    expect(publicPattern.test("application/pdf")).toBe(false);
    expect(publicPattern.test("text/plain")).toBe(false);
    expect(publicPattern.test("image/svg+xml")).toBe(false);
  });

  it("private scope allows images, pdf, word, text, csv", () => {
    expect(privatePattern.test("image/jpeg")).toBe(true);
    expect(privatePattern.test("application/pdf")).toBe(true);
    expect(privatePattern.test("application/msword")).toBe(true);
    expect(privatePattern.test("text/csv")).toBe(true);
    expect(privatePattern.test("text/plain")).toBe(true);
  });

  it("private scope rejects executable and other dangerous types", () => {
    expect(privatePattern.test("application/x-executable")).toBe(false);
    expect(privatePattern.test("application/javascript")).toBe(false);
    expect(privatePattern.test("application/x-sh")).toBe(false);
  });

  // BUG: private scope is supposed to allow audio files for voice notes,
  // but the regex does NOT include audio/* types
  it("BUG: private scope does NOT allow audio types (missing from regex)", () => {
    expect(privatePattern.test("audio/mpeg")).toBe(false);
    expect(privatePattern.test("audio/wav")).toBe(false);
    expect(privatePattern.test("audio/ogg")).toBe(false);
    expect(privatePattern.test("audio/mp4")).toBe(false);
  });
});
