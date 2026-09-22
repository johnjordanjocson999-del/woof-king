/**
 * Cuts transparent-background logo assets out of the WOOF KING brand sheet.
 *
 * The sheet's bottom-right lockup is the one to use: it is the largest, it is the
 * only variant drawn without the white sticker keyline, and it carries the ™.
 * It sits on flat #FFC209, so a flood fill seeded from the panel border lifts the
 * background off cleanly.
 *
 * The fill is connectivity-based rather than a colour threshold, which is the
 * whole trick here: the crown is very nearly the same gold as the panel, but it
 * is fully enclosed by the dark outline, so the fill cannot reach it.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC =
  "C:/Users/John Jordan/.cursor/projects/c-Users-John-Jordan-Desktop-JUSTINE-APP-Wolf-King/assets/c__Users_John_Jordan_AppData_Roaming_Cursor_User_workspaceStorage_be57b19c7abeb4f42a8b821e07bd0235_images_image-e7ac771a-0761-472a-884a-137a1d3a7127.png";

const OUT_DIR = path.resolve("public/brand");
const APP_DIR = path.resolve("src/app");
await mkdir(OUT_DIR, { recursive: true });

const YELLOW = [255, 194, 9];
const dist = (a, b) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

const base = sharp(SRC).ensureAlpha();
const { data, info } = await base
  .clone()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const px = (x, y) => {
  const i = (y * W + x) * C;
  return [data[i], data[i + 1], data[i + 2]];
};
const isPanel = (p) => dist(p, YELLOW) < 45;

// ---- Locate the bottom-right yellow panel ----------------------------------
// The two bottom panels are separated by a thin white seam. Scan a row that runs
// through both, take the last yellow run's right edge as the sheet edge, and the
// first yellow run after the seam as the panel's left edge.
const probeY = Math.round(H * 0.9);
const runs = [];
let cur = null;
for (let x = 0; x < W; x++) {
  if (isPanel(px(x, probeY))) {
    if (!cur) cur = { from: x, to: x };
    else cur.to = x;
  } else if (cur) {
    runs.push(cur);
    cur = null;
  }
}
if (cur) runs.push(cur);
const wide = runs.filter((r) => r.to - r.from > 5);
if (wide.length < 2) throw new Error(`expected >=2 yellow runs, got ${wide.length}`);

// The left panel is the first wide run; everything after the seam is the right.
const seamEnd = wide[1].from;
const rect = { x0: seamEnd, x1: W - 1, y0: 0, y1: H - 1 };
const insideX = W - 4;
while (rect.y0 < H - 1 && !isPanel(px(insideX, rect.y0))) rect.y0++;
while (rect.y1 > 0 && !isPanel(px(insideX, rect.y1))) rect.y1--;
console.log("bottom-right yellow panel:", rect);

const pw = rect.x1 - rect.x0 + 1;
const ph = rect.y1 - rect.y0 + 1;

// ---- Flood fill the panel background to transparent ------------------------
const region = await base
  .clone()
  .extract({ left: rect.x0, top: rect.y0, width: pw, height: ph })
  .raw()
  .toBuffer();

const out = Buffer.from(region);
const visited = new Uint8Array(pw * ph);
const stack = [];
const pushSeed = (x, y) => {
  if (x < 0 || y < 0 || x >= pw || y >= ph) return;
  const n = y * pw + x;
  if (visited[n]) return;
  const i = n * 4;
  if (dist([out[i], out[i + 1], out[i + 2]], YELLOW) >= 78) return;
  visited[n] = 1;
  stack.push(n);
};
for (let x = 0; x < pw; x++) {
  pushSeed(x, 0);
  pushSeed(x, ph - 1);
}
for (let y = 0; y < ph; y++) {
  pushSeed(0, y);
  pushSeed(pw - 1, y);
}
let cleared = 0;
while (stack.length) {
  const n = stack.pop();
  out[n * 4 + 3] = 0;
  cleared++;
  const x = n % pw;
  const y = (n - x) / pw;
  pushSeed(x + 1, y);
  pushSeed(x - 1, y);
  pushSeed(x, y + 1);
  pushSeed(x, y - 1);
}

// Feather the fill edge so the cut-out does not look jagged.
for (let y = 1; y < ph - 1; y++) {
  for (let x = 1; x < pw - 1; x++) {
    const n = y * pw + x;
    const i = n * 4;
    if (out[i + 3] === 0) continue;
    const touchesHole =
      out[(n - 1) * 4 + 3] === 0 ||
      out[(n + 1) * 4 + 3] === 0 ||
      out[(n - pw) * 4 + 3] === 0 ||
      out[(n + pw) * 4 + 3] === 0;
    if (!touchesHole) continue;
    const d = dist([out[i], out[i + 1], out[i + 2]], YELLOW);
    if (d < 120) out[i + 3] = Math.round((d / 120) * 255);
  }
}

const surviving = pw * ph - cleared;
console.log(
  `filled ${cleared} background px, ${surviving} px of artwork survive ` +
    `(${((surviving / (pw * ph)) * 100).toFixed(1)}% of the panel)`
);

const lockup = await sharp(out, { raw: { width: pw, height: ph, channels: 4 } })
  .trim({ threshold: 1 })
  .png()
  .toBuffer();
const lk = await sharp(lockup).metadata();
console.log("lockup:", lk.width, "x", lk.height);
await sharp(lockup).toFile(path.join(OUT_DIR, "woof-king-lockup.png"));

// Guard: the crown is the pixel group most at risk from a fill leak, because its
// gold is within a few units of the panel gold. If the fill had escaped through a
// gap in the outline the artwork would lose a visible chunk of its area.
if (surviving / (pw * ph) < 0.3) {
  throw new Error("suspiciously little artwork survived - the fill probably leaked");
}

// ---- Mascot only: everything above the wordmark plate ----------------------
const { data: L, info: LInfo } = await sharp(lockup)
  .raw()
  .toBuffer({ resolveWithObject: true });
const LW = LInfo.width;
const LH = LInfo.height;
const rowWidth = (y) => {
  let min = LW;
  let max = -1;
  for (let x = 0; x < LW; x++) {
    if (L[(y * LW + x) * 4 + 3] > 40) {
      if (x < min) min = x;
      if (x > max) max = x;
    }
  }
  return max < 0 ? 0 : max - min + 1;
};
// The plate is close to full width and the pup is much narrower. Find where the
// plate reaches full width, then walk back up its rounded shoulders, otherwise
// the crop keeps a few rows of dark plate border that render as a hard rule
// across the pup's feet.
let plateWidest = LH;
for (let y = Math.floor(LH * 0.45); y < LH; y++) {
  if (rowWidth(y) > LW * 0.93) {
    plateWidest = y;
    break;
  }
}
let plateTop = plateWidest;
while (plateTop > 0 && rowWidth(plateTop - 1) > LW * 0.55) plateTop--;
console.log(
  `plate full width at y=${plateWidest}, rounded top edge at y=${plateTop} of ${LH}`
);

const mascotBuf = await sharp(lockup)
  .extract({ left: 0, top: 0, width: LW, height: Math.max(8, plateTop - 3) })
  .png()
  .toBuffer();
const mascot = await sharp(mascotBuf).trim({ threshold: 1 }).png().toBuffer();
await sharp(mascot).toFile(path.join(OUT_DIR, "woof-king-mascot.png"));
const mm = await sharp(mascot).metadata();
console.log("mascot:", mm.width, "x", mm.height);

// ---- Icons ------------------------------------------------------------------
// At favicon sizes the whole pup turns to mush, so the icons use the crown and
// head only, on the gold tile the sheet itself presents the logo on.
const headCrop = await sharp(mascot)
  .extract({ left: 0, top: 0, width: mm.width, height: Math.round(mm.height * 0.66) })
  .png()
  .toBuffer();
const head = await sharp(headCrop).trim({ threshold: 1 }).png().toBuffer();
await sharp(head).toFile(path.join(OUT_DIR, "woof-king-head.png"));
const hm = await sharp(head).metadata();
console.log("head:", hm.width, "x", hm.height);

async function goldTile(size, inner, inset) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 194, b: 9, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(inner)
          .resize({
            width: Math.round(size * inset),
            height: Math.round(size * inset),
            fit: "inside",
            kernel: "lanczos3",
          })
          .toBuffer(),
        gravity: "center",
      },
    ])
    .png()
    .toBuffer();
}

// src/app/icon.png and src/app/apple-icon.png are Next.js file conventions and
// get wired up automatically, so no <link> tags are needed.
await sharp(await goldTile(64, head, 0.86)).toFile(path.join(APP_DIR, "icon.png"));
await sharp(await goldTile(180, head, 0.8)).toFile(path.join(APP_DIR, "apple-icon.png"));
for (const size of [192, 512]) {
  await sharp(await goldTile(size, head, 0.82)).toFile(
    path.join(OUT_DIR, `icon-${size}.png`)
  );
}

console.log("wrote assets to", OUT_DIR, "and icons to", APP_DIR);
