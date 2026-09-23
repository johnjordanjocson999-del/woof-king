import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { mediaId } from "@/lib/ids";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Vercel lets you set a custom env prefix when creating a Blob store.
 * That yields names like BLOB_WEBHOOK_PUBLIC_KEY_STORE_ID instead of BLOB_STORE_ID.
 * Find whatever was actually injected.
 */
function resolveBlobCredentials(): { token?: string; storeId?: string } {
  const env = process.env;
  const token =
    env.BLOB_READ_WRITE_TOKEN ||
    env.VERCEL_BLOB_READ_WRITE_TOKEN ||
    Object.entries(env).find(
      ([key, value]) =>
        Boolean(value) &&
        key.includes("BLOB") &&
        /READ_WRITE_TOKEN$/i.test(key),
    )?.[1];

  const storeId =
    env.BLOB_STORE_ID ||
    Object.entries(env).find(
      ([key, value]) =>
        Boolean(value) && key.includes("BLOB") && /STORE_ID$/i.test(key),
    )?.[1];

  return {
    token: token || undefined,
    storeId: storeId || undefined,
  };
}

/**
 * Saves an uploaded image and returns a public URL/path.
 *
 * - Locally: writes under public/uploads.
 * - On Vercel: Vercel Blob (serverless disk is read-only).
 *   Use a Public Blob store so storefront images load for everyone.
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
  const { token, storeId } = resolveBlobCredentials();
  const canUseBlob = Boolean(token || storeId || onVercel);

  if (canUseBlob) {
    try {
      const blob = await put(pathname, file, {
        access: "public",
        contentType: file.type,
        addRandomSuffix: false,
        ...(token ? { token } : {}),
        ...(storeId ? { storeId } : {}),
      });
      return { path: blob.url, mime: file.type, size: file.size };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      if (/private/i.test(raw) && /public|access/i.test(raw)) {
        throw new Error(
          "This Blob store is Private. Create a Public Blob store (Storage → Create → Blob → Public), leave the env prefix blank, connect woof-king, then Redeploy.",
        );
      }
      if (
        /unauthorized|forbidden|401|403|token|credential|oidc|store|missing/i.test(
          raw,
        ) ||
        (!token && !storeId)
      ) {
        throw new Error(
          "Blob is connected but this deploy cannot see it yet. In Vercel → Settings → Environment Variables, confirm BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN exists for Production. Then Deployments → … → Redeploy.",
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
