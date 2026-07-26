import { trpc } from "@/providers/trpc";

export type UploadScope = "public" | "private";

/**
 * Upload a file to R2 via a presigned PUT URL.
 * Returns the URL to store in the DB:
 *   public  → public CDN URL (listing photos)
 *   private → "s3://key" (resolved to a presigned GET server-side on read)
 */
export async function uploadFileWithClient(
  client: ReturnType<typeof trpc.useUtils>["client"],
  file: File,
  scope: UploadScope,
): Promise<{ storedUrl: string; key: string }> {
  const { uploadUrl, key, storedUrl } = await client.uploads.presign.mutate({
    scope,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
  return { storedUrl, key };
}

export function attachmentKind(
  mime: string,
): "image" | "document" {
  return mime.startsWith("image/") ? "image" : "document";
}
