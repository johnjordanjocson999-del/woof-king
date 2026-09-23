import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { mediaId } from "@/lib/ids";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function blobConfigured(): boolean {
  // After Storage → Blob is connected, Vercel injects BLOB_STORE_ID (OIDC)
  // and/or BLOB_READ_WRITE_TOKEN. Either is enough on Vercel.
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_STORE_ID ||
      process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  );
}

/**
 * Saves an uploaded image and returns a public URL/path.
 *
 * - Locally: writes under public/uploads.
 * - On Vercel: Vercel Blob (serverless disk is read-only).
 *   Product photos must use a Public Blob store so the storefront can show them.
 */
export async function saveUpload(
  file: File,
  folder: "products" | "branding" | "proofs" | "payments" = "products",
): Promise<{ path: string; mime: string; size: number }> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Upload a JPG, PNG, WebP or GIF.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Keep images under 8 MB.");
  }

  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const name = `${mediaId()}.${ext}`;
  const pathname = `uploads/${folder}/${name}`;
  const onVercel = Boolean(process.env.VERCEL);

  if (onVercel || blobConfigured()) {
    if (onVercel && !blobConfigured()) {
      throw new Error(
        "Blob is not available on this deploy yet. Open Vercel → Deployments → … on the latest Production deploy → Redeploy. Then try replacing the photo again.",
      );
    }

    try {
      // Storefront <Image> needs a publicly fetchable URL.
      const blob = await put(pathname, file, {
        access: "public",
        contentType: file.type,
        addRandomSuffix: false,
      });
      return { path: blob.url, mime: file.type, size: file.size };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      if (/private/i.test(raw) && /public/i.test(raw)) {
        throw new Error(
          "Your Blob store is Private. Create another Blob store with Public access (Vercel → Storage → Create → Blob → choose Public), connect it to woof-king, Redeploy, then replace the photo.",
        );
      }
      if (/unauthorized|forbidden|401|403|token|credential|oidc|store/i.test(raw)) {
        throw new Error(
          "Blob credentials are missing on this deploy. In Vercel → Deployments, Redeploy Production (with the Blob store connected), wait until Ready, then try again.",
        );
      }
      throw new Error(raw || "Photo upload failed.");
    }
  }

  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { path: `/uploads/${folder}/${name}`, mime: file.type, size: file.size };
}
