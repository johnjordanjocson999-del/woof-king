import sharp from "sharp";
import path from "node:path";

const OUT = path.resolve("public/brand");
const src = path.join(OUT, "woof-king-sheet-sticker.png");

const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width: W, height: H } = info;
// A 5px hairline of leftover panel edge runs the full height of the cut, so
// a naive alpha trim cannot collapse. Ignore rows/cols with almost no ink.
const MIN = 12;
const rowInk = new Array(H).fill(0);
const colInk = new Array(W).fill(0);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 24) {
      rowInk[y]++;
      colInk[x]++;
    }
  }
}
let y0 = 0,
  y1 = H - 1,
  x0 = 0,
  x1 = W - 1;
while (y0 < H && rowInk[y0] < MIN) y0++;
while (y1 > y0 && rowInk[y1] < MIN) y1--;
while (x0 < W && colInk[x0] < MIN) x0++;
while (x1 > x0 && colInk[x1] < MIN) x1--;
// A leftover hairline from the gold panel runs the full height of the cut.
// Drop any remaining full-height columns on either side.
while (x1 > x0 && colInk[x1] > H * 0.9) x1--;
while (x0 < x1 && colInk[x0] > H * 0.9) x0++;
console.log("ink bounds", { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 });

const tight = await sharp(src)
  .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
  .png()
  .toBuffer();

await sharp(tight).toFile(path.join(OUT, "woof-king-lockup.png"));
const meta = await sharp(tight).metadata();
console.log("lockup", meta.width, "x", meta.height);

// 2x for retina headers / login.
await sharp(tight)
  .resize({ width: meta.width * 2, kernel: "lanczos3" })
  .png()
  .toFile(path.join(OUT, "woof-king-lockup@2x.png"));

const twoX = await sharp(path.join(OUT, "woof-king-lockup@2x.png")).metadata();
console.log("lockup@2x", twoX.width, "x", twoX.height);
