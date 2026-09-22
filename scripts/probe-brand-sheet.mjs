import sharp from "sharp";

const SRC =
  "C:/Users/John Jordan/.cursor/projects/c-Users-John-Jordan-Desktop-JUSTINE-APP-Wolf-King/assets/c__Users_John_Jordan_AppData_Roaming_Cursor_User_workspaceStorage_be57b19c7abeb4f42a8b821e07bd0235_images_image-e7ac771a-0761-472a-884a-137a1d3a7127.png";

const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width: W, height: H, channels: C } = info;
const at = (x, y) => {
  const i = (y * W + x) * C;
  return [data[i], data[i + 1], data[i + 2]];
};
const hex = ([r, g, b]) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const dist = (a, b) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

console.log("size", W, H);

const YELLOW = [255, 194, 9];
const isY = (p) => dist(p, YELLOW) < 45;

// Where do the yellow panels start vertically, and where is the seam between the
// bottom-left and bottom-right panels?
console.log("\n--- vertical scan down the middle of each half ---");
for (const x of [Math.round(W * 0.2), Math.round(W * 0.7)]) {
  let first = -1;
  for (let y = 0; y < H; y++)
    if (isY(at(x, y))) {
      first = y;
      break;
    }
  console.log(`x=${x}: first yellow row = ${first}, colour at top = ${hex(at(x, 5))}`);
}

const probeY = Math.round(H * 0.9);
console.log(`\n--- horizontal scan at y=${probeY} (inside the yellow panels) ---`);
let runs = [];
let cur = null;
for (let x = 0; x < W; x++) {
  if (isY(at(x, probeY))) {
    if (!cur) cur = { from: x, to: x };
    else cur.to = x;
  } else if (cur) {
    runs.push(cur);
    cur = null;
  }
}
if (cur) runs.push(cur);
console.log("yellow runs:", runs.filter((r) => r.to - r.from > 5));

console.log("\n--- corner / background samples ---");
for (const [x, y] of [
  [5, 5],
  [Math.round(W * 0.55), 5],
  [W - 6, 5],
  [5, H - 6],
  [W - 6, H - 6],
  [Math.round(W / 2), Math.round(H * 0.45)],
]) {
  console.log(`(${x},${y}) ${hex(at(x, y))}`);
}

// Confirm each yellow panel's exact rect by walking from a seed inside it.
function panelRect(seedX, seedY) {
  let x0 = seedX,
    x1 = seedX,
    y0 = seedY,
    y1 = seedY;
  while (x0 > 0 && isY(at(x0 - 1, seedY))) x0--;
  while (x1 < W - 1 && isY(at(x1 + 1, seedY))) x1++;
  while (y0 > 0 && isY(at(seedX, y0 - 1))) y0--;
  while (y1 < H - 1 && isY(at(seedX, y1 + 1))) y1++;
  return { x0, y0, x1, y1 };
}
console.log("\n--- panel rects from seeds ---");
console.log("left  :", panelRect(Math.round(W * 0.06), probeY));
console.log("right :", panelRect(Math.round(W * 0.97), probeY));

// Does the big bottom-right logo carry a white keyline? Sample just outside its
// dark outline near the widest point of the plate.
console.log("\n--- looking for a white keyline in each bottom panel ---");
for (const [label, sx] of [
  ["bottom-left", Math.round(W * 0.2)],
  ["bottom-right", Math.round(W * 0.7)],
]) {
  // Walk in from the panel edge toward the logo and print the colour transitions.
  const y = Math.round(H * 0.87);
  const seen = [];
  let last = null;
  for (let x = 0; x < W; x++) {
    const h = hex(at(x, y));
    if (h !== last) {
      seen.push(`${x}:${h}`);
      last = h;
    }
  }
  console.log(`${label} transitions at y=${y} (first 24):`, seen.slice(0, 24).join(" "));
  break;
}
