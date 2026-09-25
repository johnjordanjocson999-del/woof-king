/**
 * Sheet-cut math for wax / baking paper.
 * Stock stays in whole sheets (pieces). This only answers: how many cuts fit,
 * and how many sheets a bake needs.
 */

export type SheetDims = {
  width: number;
  height: number;
};

export type SheetFitResult = {
  perSheet: number;
  orientation: "normal" | "rotated";
  gridW: number;
  gridH: number;
  leftoverW: number;
  leftoverH: number;
};

function positive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/** How many rectangular pieces fit on one sheet (tries both rotations). */
export function piecesPerSheet(sheet: SheetDims, piece: SheetDims): SheetFitResult | null {
  if (!positive(sheet.width) || !positive(sheet.height)) return null;
  if (!positive(piece.width) || !positive(piece.height)) return null;

  const normal = {
    gridW: Math.floor(sheet.width / piece.width),
    gridH: Math.floor(sheet.height / piece.height),
  };
  const rotated = {
    gridW: Math.floor(sheet.width / piece.height),
    gridH: Math.floor(sheet.height / piece.width),
  };
  const normalCount = normal.gridW * normal.gridH;
  const rotatedCount = rotated.gridW * rotated.gridH;

  if (normalCount <= 0 && rotatedCount <= 0) return null;

  if (rotatedCount > normalCount) {
    const pw = piece.height;
    const ph = piece.width;
    return {
      perSheet: rotatedCount,
      orientation: "rotated",
      gridW: rotated.gridW,
      gridH: rotated.gridH,
      leftoverW: sheet.width - rotated.gridW * pw,
      leftoverH: sheet.height - rotated.gridH * ph,
    };
  }

  return {
    perSheet: normalCount,
    orientation: "normal",
    gridW: normal.gridW,
    gridH: normal.gridH,
    leftoverW: sheet.width - normal.gridW * piece.width,
    leftoverH: sheet.height - normal.gridH * piece.height,
  };
}

/**
 * Circle liner: treat diameter as a square bounding box (conservative —
 * you cannot nest circles tighter than that without waste math).
 */
export function circlePieceDims(diameter: number): SheetDims | null {
  if (!positive(diameter)) return null;
  return { width: diameter, height: diameter };
}

/** Fraction of a sheet as a rectangular cut along the long side (or 2×2 for 1/4). */
export function fractionPiece(sheet: SheetDims, fraction: "1/2" | "1/3" | "1/4"): SheetDims {
  const longIsWidth = sheet.width >= sheet.height;
  if (fraction === "1/2") {
    return longIsWidth
      ? { width: sheet.width / 2, height: sheet.height }
      : { width: sheet.width, height: sheet.height / 2 };
  }
  if (fraction === "1/3") {
    return longIsWidth
      ? { width: sheet.width / 3, height: sheet.height }
      : { width: sheet.width, height: sheet.height / 3 };
  }
  // 1/4 → 2×2 grid pieces
  return { width: sheet.width / 2, height: sheet.height / 2 };
}

export type BakeSuggestion = {
  perSheet: number;
  sheetsOnHand: number;
  piecesAvailable: number;
  loavesWanted: number;
  sheetsNeeded: number;
  piecesNeeded: number;
  canBake: number;
  shortfallSheets: number;
};

export function suggestForBake(input: {
  perSheet: number;
  sheetsOnHand: number;
  loavesWanted: number;
  /** Pieces (liners) per loaf — usually 1. */
  piecesPerLoaf?: number;
}): BakeSuggestion | null {
  const perSheet = Math.floor(input.perSheet);
  if (perSheet <= 0) return null;
  const piecesPerLoaf = Math.max(1, Math.floor(input.piecesPerLoaf ?? 1));
  const loavesWanted = Math.max(0, Math.floor(input.loavesWanted));
  const sheetsOnHand = Math.max(0, input.sheetsOnHand);
  const piecesAvailable = Math.floor(sheetsOnHand) * perSheet;
  const piecesNeeded = loavesWanted * piecesPerLoaf;
  const sheetsNeeded = piecesNeeded === 0 ? 0 : Math.ceil(piecesNeeded / perSheet);
  const canBake = Math.floor(piecesAvailable / piecesPerLoaf);
  const shortfallSheets = Math.max(0, sheetsNeeded - Math.floor(sheetsOnHand));

  return {
    perSheet,
    sheetsOnHand,
    piecesAvailable,
    loavesWanted,
    sheetsNeeded,
    piecesNeeded,
    canBake,
    shortfallSheets,
  };
}

export function parseDim(raw: string): number {
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}
