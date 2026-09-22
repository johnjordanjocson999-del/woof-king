/**
 * Cuts the WOOF KING sticker lockup from the clean four-up brand sheet.
 *
 * The bottom half is one gold field with two marks: a die-cut sticker on the
 * left and a large un-outlined drawing on the right. We take the large drawing
 * (sharper lettering) and grow a white keyline so the site mark matches the
 * sticker the sheet presents.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC =
  "C:/Users/John Jordan/.cursor/projects/c-Users-John-Jordan-Desktop-JUSTINE-APP-Wolf-King/assets/c__Users_John_Jordan_AppData_Roaming_Cursor_User_workspaceStorage_be57b19c7abeb4f42a8b821e07bd0235_images_image-e7ac771a-0761-472a-884a-137a1d3a7127.png";

const OUT = path.resolve("public/brand");
await mkdir(OUT, { recursive: true });

const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const at = (x, y) => {
  const i = (y * W + x) * C;
  return [data[i], data[i + 1], data[i + 2]];
};
const dist = (a, b) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const YELLOW = [255, 194, 9];
const isYellow = (p) => dist(p, YELLOW) < 48;

// Bottom gold field is a wide band of #FFC209. The crown is also gold, so a
// single-pixel probe would fire on it; require most of the row to be gold.
let goldY0 = -1;
for (let y = 0; y < H; y++) {
  let hits = 0;
  for (let x = 0; x < W; x += 4) if (isYellow(at(x, y))) hits++;
  if (hits > W / 8) {
    goldY0 = y;
    break;
  }
}
console.log("gold field top", goldY0, "of", H);

// Ink = anything in the gold field that is not the gold itself.
const ink = [];
for (let y = goldY0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!isYellow(at(x, y))) ink.push([x, y]);
  }
}

// Split ink into left (sticker) and right (large lockup) by finding the
// widest all-gold column between the two clusters.
const inkCols = new Uint8Array(W);
for (const [x] of ink) inkCols[x] = 1;
let bestGap = { x0: 0, x1: 0, w: 0 };
let run = null;
for (let x = 0; x < W; x++) {
  if (!inkCols[x]) {
    if (!run) run = { x0: x, x1: x };
    else run.x1 = x;
  } else if (run) {
    const w = run.x1 - run.x0;
    if (w > bestGap.w && run.x0 > 80 && run.x1 < W - 80) bestGap = { ...run, w };
    run = null;
  }
}
const seam = Math.round((bestGap.x0 + bestGap.x1) / 2);
console.log("seam between logos at x =", seam, "gap", bestGap);

function boundsOf(points) {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1,
    y1 = -1;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

const padBox = (b, p) => ({
  x0: Math.max(0, b.x0 - p),
  y0: Math.max(goldY0, b.y0 - p),
  x1: Math.min(W - 1, b.x1 + p),
  y1: Math.min(H - 1, b.y1 + p),
});

const leftInk = bestGap.w > 20 ? ink.filter(([x]) => x < seam) : [];
const rightInk = bestGap.w > 20 ? ink.filter(([x]) => x >= seam) : ink;
const stickerBox = leftInk.length ? padBox(boundsOf(leftInk), 8) : null;
const largeBox = padBox(boundsOf(rightInk), 8);
console.log("sticker box", stickerBox);
console.log("large box", largeBox);

function knockYellow(region, pw, ph) {
  const out = Buffer.from(region);
  const visited = new Uint8Array(pw * ph);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= pw || y >= ph) return;
    const n = y * pw + x;
    if (visited[n]) return;
    const i = n * 4;
    if (dist([out[i], out[i + 1], out[i + 2]], YELLOW) >= 78) return;
    visited[n] = 1;
    stack.push(n);
  };
  for (let x = 0; x < pw; x++) {
    push(x, 0);
    push(x, ph - 1);
  }
  for (let y = 0; y < ph; y++) {
    push(0, y);
    push(pw - 1, y);
  }
  while (stack.length) {
    const n = stack.pop();
    out[n * 4 + 3] = 0;
    const x = n % pw;
    const y = (n - x) / pw;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let y = 1; y < ph - 1; y++) {
    for (let x = 1; x < pw - 1; x++) {
      const n = y * pw + x;
      const i = n * 4;
      if (out[i + 3] === 0) continue;
      const hole =
        out[(n - 1) * 4 + 3] === 0 ||
        out[(n + 1) * 4 + 3] === 0 ||
        out[(n - pw) * 4 + 3] === 0 ||
        out[(n + pw) * 4 + 3] === 0;
      if (!hole) continue;
      const d = dist([out[i], out[i + 1], out[i + 2]], YELLOW);
      if (d < 110) out[i + 3] = Math.round((d / 110) * 255);
    }
  }
  return out;
}

async function extractBox(box, label) {
  const pw = box.x1 - box.x0 + 1;
  const ph = box.y1 - box.y0 + 1;
  const raw = await sharp(SRC)
    .ensureAlpha()
    .extract({ left: box.x0, top: box.y0, width: pw, height: ph })
    .raw()
    .toBuffer();
  const cut = knockYellow(raw, pw, ph);
  const png = await sharp(cut, { raw: { width: pw, height: ph, channels: 4 } })
    .trim({ threshold: 2 })
    .png()
    .toBuffer();
  const meta = await sharp(png).metadata();
  console.log(label, "->", meta.width, "x", meta.height);
  return png;
}

function growWhiteOutline(src, width, height, radius) {
  const out = Buffer.alloc(width * height * 4);
  src.copy(out);
  const r2 = radius * radius;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (src[i + 3] > 40) continue;
      let hit = false;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height - 1, y + radius);
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      for (let yy = y0; yy <= y1 && !hit; yy++) {
        const dy = yy - y;
        for (let xx = x0; xx <= x1; xx++) {
          const dx = xx - x;
          if (dx * dx + dy * dy > r2) continue;
          if (src[(yy * width + xx) * 4 + 3] > 80) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        out[i] = 255;
        out[i + 1] = 255;
        out[i + 2] = 255;
        out[i + 3] = 255;
      }
    }
  }
  return out;
}

if (stickerBox) {
  const stickerPng = await extractBox(stickerBox, "sheet sticker");
  await sharp(stickerPng).toFile(path.join(OUT, "woof-king-sheet-sticker.png"));
}
const largePng = await extractBox(largeBox, "large lockup");

const scaled = await sharp(largePng)
  .resize({ width: 720, kernel: "lanczos3" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pad = 32;
const pw = scaled.info.width + pad * 2;
const ph = scaled.info.height + pad * 2;
const padded = Buffer.alloc(pw * ph * 4);
for (let y = 0; y < scaled.info.height; y++) {
  const srcStart = y * scaled.info.width * 4;
  const dstStart = ((y + pad) * pw + pad) * 4;
  scaled.data.copy(padded, dstStart, srcStart, srcStart + scaled.info.width * 4);
}

const outlined = growWhiteOutline(padded, pw, ph, 16);
const lockup = await sharp(outlined, {
  raw: { width: pw, height: ph, channels: 4 },
})
  .trim({ threshold: 1 })
  .png()
  .toBuffer();

await sharp(lockup).toFile(path.join(OUT, "woof-king-lockup.png"));
const lockMeta = await sharp(lockup).metadata();
console.log("site lockup", lockMeta.width, "x", lockMeta.height);

const { data: lk, info: lkInfo } = await sharp(lockup)
  .raw()
  .toBuffer({ resolveWithObject: true });
const LW = lkInfo.width;
const LH = lkInfo.height;
const rowWidth = (y) => {
  let min = LW,
    max = -1;
  for (let x = 0; x < LW; x++) {
    if (lk[(y * LW + x) * 4 + 3] > 40) {
      if (x < min) min = x;
      if (x > max) max = x;
    }
  }
  return max < 0 ? 0 : max - min + 1;
};
let plateWidest = LH;
for (let y = Math.floor(LH * 0.45); y < LH; y++) {
  if (rowWidth(y) > LW * 0.88) {
    plateWidest = y;
    break;
  }
}
let plateTop = plateWidest;
while (plateTop > 0 && rowWidth(plateTop - 1) > LW * 0.55) plateTop--;
console.log("plate top", plateTop, "of", LH);

const mascotH = Math.max(8, plateTop - 4);
const mascot = await sharp(lockup)
  .extract({ left: 0, top: 0, width: LW, height: mascotH })
  .trim({ threshold: 1 })
  .png()
  .toBuffer();
await sharp(mascot).toFile(path.join(OUT, "woof-king-mascot.png"));
const mascotMeta = await sharp(mascot).metadata();
console.log("mascot", mascotMeta.width, "x", mascotMeta.height);

const headCrop = await sharp(mascot)
  .extract({
    left: 0,
    top: 0,
    width: mascotMeta.width,
    height: Math.round(mascotMeta.height * 0.62),
  })
  .png()
  .toBuffer();
const head = await sharp(headCrop).trim({ threshold: 1 }).png().toBuffer();
await sharp(head).toFile(path.join(OUT, "woof-king-head.png"));

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

const APP = path.resolve("src/app");
await sharp(await goldTile(64, head, 0.86)).toFile(path.join(APP, "icon.png"));
await sharp(await goldTile(180, head, 0.8)).toFile(path.join(APP, "apple-icon.png"));

console.log("done");
