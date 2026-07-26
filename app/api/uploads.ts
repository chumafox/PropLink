// Cloudflare R2 (S3-compatible) storage with presigned URLs.
// If R2_* env vars are not configured, uploads are disabled and the UI
// falls back to paste-URL attachments.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

export type UploadScope = "public" | "private";

let _client: S3Client | null | undefined;

export function uploadsConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function client(): S3Client {
  if (_client) return _client;
  if (!uploadsConfigured()) {
    throw new Error(
      "File storage is not configured. Set R2_* environment variables (Cloudflare R2).",
    );
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return _client;
}

const ALLOWED_TYPES: Record<UploadScope, RegExp> = {
  public: /^image\/(jpeg|png|webp|gif|avif)$/,
  private:
    /^(image\/(jpeg|png|webp|gif)|audio\/(mpeg|wav|ogg|mp4|webm|mp3|x-m4a|aac)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.|text\/(plain|csv))$/,
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
}

export async function createPresignedUpload(args: {
  userId: number;
  scope: UploadScope;
  filename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; key: string }> {
  const { scope, filename, contentType, userId } = args;
  if (!ALLOWED_TYPES[scope].test(contentType)) {
    throw new Error(
      scope === "public"
        ? "Only images are allowed here (jpeg, png, webp, gif, avif)"
        : "File type not allowed (images, PDF, Word, text, CSV)",
    );
  }
  const key = `${scope}/${userId}/${Date.now()}-${randomBytes(6).toString("hex")}-${safeName(filename)}`;
  const uploadUrl = await getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 600 }, // 10 minutes
  );
  return { uploadUrl, key };
}

// Public files (listing photos) live behind the R2 public URL / custom domain.
export function publicFileUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
  return base ? `${base}/${key}` : `s3://${key}`;
}

// Private files (chat attachments, deal docs) are served via presigned GET.
export async function presignGet(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
    { expiresIn },
  );
}

// Resolve a stored attachment URL for display:
//   "s3://key"   → fresh presigned GET (private files)
//   anything else → returned as-is (external URL or public CDN URL)
export async function resolveFileUrl(url: string): Promise<string> {
  if (!url.startsWith("s3://")) return url;
  if (!uploadsConfigured()) return url;
  try {
    return await presignGet(url.slice(5));
  } catch {
    return url;
  }
}
