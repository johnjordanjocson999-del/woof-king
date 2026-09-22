/**
 * Historical one-off rename helper (already applied in src).
 * Kept only as a reference map of Woof King string forms.
 */
import { readFile, writeFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

const PATTERNS = [
  ["WOLF KING", "WOOF KING"],
  ["Wolf King", "Woof King"],
  ["wolfking", "woofking"],
  ["WolfKing", "WoofKing"],
  ["wolf-king", "woof-king"],
];

const TARGETS = [
  "src/**/*.{ts,tsx,css}",
  "prisma/**/*.{ts,prisma}",
  "README.md",
  "package.json",
  ".env",
  ".env.example",
];

const seen = new Set();
for (const pattern of TARGETS) {
  for await (const file of glob(pattern)) {
    if (seen.has(file)) continue;
    seen.add(file);
    const before = await readFile(file, "utf8");
    let after = before;
    for (const [from, to] of PATTERNS) after = after.replaceAll(from, to);
    if (after !== before) {
      await writeFile(file, after);
      const hits = PATTERNS.reduce(
        (n, [from]) => n + before.split(from).length - 1,
        0
      );
      console.log(`${file}  (${hits})`);
    }
  }
}
console.log("done");
