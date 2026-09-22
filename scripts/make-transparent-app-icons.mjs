/**
 * Build transparent full-sticker app icons from the WOOF KING lockup source.
 *
 * 1. Flood-fill near-white / flat yellow canvas outside the sticker → alpha 0
 * 2. Keep the thick white sticker keyline (not connected to the canvas corners)
 * 3. Emit square transparent PNGs for PWA / favicon / apple-touch
 */
import sharp from "sharp";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public/brand");
const APP = path.resolve("src/app");

/** Fresh source the user provided (full sticker on white). */
const SOURCE =
  "C:/Users/John Jordan/.cursor/projects/c-Users-John-Jordan-Desktop-JUSTINE-APP-Wolf-King/assets/c__Users_John_Jordan_AppData_Roaming_Cursor_User_workspaceStorage_be57b19c7abeb4f42a8b821e07bd0235_images_image-81f68422-248f-473f-bb1f-0f44a65f49c2.png";

const LOCKUP = path.join(OUT, "woof-king-lockup.png");

await mkdir(OUT, { recursive: true });
await mkdir(APP, { recursive: true });

function isCanvas(r, g, b, a) {
  if (a < 8) return true;
  // White / near-white sheet
  if (r >= 242 && g >= 242 && b >= 242) return true;
  // Old yellow brand panel leftovers
  if (r >= 240 && g >= 180 && b <= 60 && Math.abs(r - g) < 80) return true;
  return false;
}

/** 4-connected flood fill from image edges → transparent. */
function punchCanvas(data, width, height) {
  const N = width * height;
  const visited = new Uint8Array(N);
  const stack = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    const o = i * 4;
    if (!isCanvas(data[o], data[o + 1], data[o + 2], data[o + 3])) return;
    visited[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const o = i * 4;
    data[o + 3] = 0;
    const x = i % width;
    const y = (i / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

async function makeTransparentLockup(srcPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  punchCanvas(pixels, info.width, info.height);

  // Trim empty transparent margins, keep a little padding around the sticker.
  const transparent = await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 0 })
    .png()
    .toBuffer();

  // Re-pad slightly so the sticker doesn't kiss the edge when scaled.
  const meta = await sharp(transparent).metadata();
  const pad = Math.round(Math.max(meta.width, meta.height) * 0.02);
  return sharp(transparent)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function squareIcon(stickerBuf, size, padRatio = 0.05) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const resized = await sharp(stickerBuf)
    .resize({
      width: inner,
      height: inner,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

console.log("source:", SOURCE);
const sticker = await makeTransparentLockup(SOURCE);
await sharp(sticker).toFile(LOCKUP);

const lockMeta = await sharp(LOCKUP).metadata();
console.log("lockup:", lockMeta.width, "x", lockMeta.height, "alpha=", lockMeta.hasAlpha);

// Also keep a copy of the raw user upload for reference.
await copyFile(SOURCE, path.join(OUT, "woof-king-sticker-source.png"));

const sizes = [
  [32, "icon-32.png"],
  [180, "icon-180.png"],
  [192, "icon-192.png"],
  [512, "icon-512.png"],
];

for (const [size, name] of sizes) {
  const buf = await squareIcon(sticker, size);
  await sharp(buf).toFile(path.join(OUT, name));
  console.log("wrote", name);
}

await sharp(await squareIcon(sticker, 64)).toFile(path.join(APP, "icon.png"));
await sharp(await squareIcon(sticker, 180)).toFile(path.join(APP, "apple-icon.png"));
await sharp(sticker)
  .resize({ width: 512, fit: "inside" })
  .png()
  .toFile(path.join(OUT, "woof-king-app-sticker.png"));

// Sanity: count transparent vs opaque pixels on 192 icon
const { data, info } = await sharp(path.join(OUT, "icon-192.png"))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let trans = 0;
let opaque = 0;
for (let i = 3; i < data.length; i += 4) {
  if (data[i] < 10) trans++;
  else opaque++;
}
console.log(
  `icon-192 sanity: ${info.width}x${info.height} transparent=${trans} opaque=${opaque}`,
);
if (trans < opaque * 0.15) {
  console.warn("WARNING: icon may still look like a solid square — check flood fill");
}

console.log("done — transparent full-sticker app icons");
