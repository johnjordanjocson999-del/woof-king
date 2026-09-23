import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { mediaId } from "@/lib/ids";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Saves an uploaded image and returns a public URL/path.
 *
 * - Locally: writes under public/uploads (git-friendly for seed photos).
 * - On Vercel: uses Blob storage — the serverless disk is read-only, so mkdir
 *   under /var/task/public always fails there.
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

  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL) {
    if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL) {
      throw new Error(
        "Photo storage is not set up yet. In Vercel open Storage → Create → Blob, connect it to this project, then redeploy. After that you can add or replace product photos.",
      );
    }
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    return { path: blob.url, mime: file.type, size: file.size };
  }

  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { path: `/uploads/${folder}/${name}`, mime: file.type, size: file.size };
}
