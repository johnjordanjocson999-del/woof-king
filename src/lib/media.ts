import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaId } from "@/lib/ids";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Saves an uploaded image under public/uploads and returns the public path.
 * Focal point is stored on the Product row separately — this only handles bytes.
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
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { path: `/uploads/${folder}/${name}`, mime: file.type, size: file.size };
}
