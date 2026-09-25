"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  upsertIngredient,
  quickRestockIngredient,
  adjustIngredientStock,
  saveProductLinerSize,
} from "@/app/actions/ops";
import { formatBase, BASE_UNITS } from "@/lib/units";
import { Card, Chip, Field, EmptyState, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { cn } from "@/lib/cn";
import {
  circlePieceDims,
  fractionPiece,
  parseDim,
  piecesPerSheet,
  suggestForBake,
} from "@/domain/sheet-math";

export type IngredientRow = {
  id: string;
  name: string;
  baseUnit: string;
  purchaseUnit: string;
  purchaseToBase: string;
  qtyOnHandBase: string;
  costPerBaseCentavos: string;
  reorderThresholdBase: string;
  supplier: string;
  sheetWidth: string;
  sheetHeight: string;
  sheetUnit: string;
  onHand: number;
  threshold: number;
  low: boolean;
  pct: number;
};

export type ProductOption = {
  id: string;
  name: string;
  category: string;
  linerWidth: string;
  linerHeight: string;
  linerShape: string;
};

type PanelProps = {
  filter: "all" | "low" | "ok";
  ingredients: IngredientRow[];
  products: ProductOption[];
  needsRestockCount: number;
  okCount: number;
  totalCount: number;
};

export function AdminIngredientsPanel({
  filter,
  ingredients,
  products,
  needsRestockCount,
  okCount,
  totalCount,
}: PanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"stock" | "sheet" | "edit">("stock");
  const shown =
    filter === "low"
      ? ingredients.filter((i) => i.low)
      : filter === "ok"
        ? ingredients.filter((i) => !i.low)
        : ingredients;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total" value={String(totalCount)} />
        <StatCard label="Need restock" value={String(needsRestockCount)} warn={needsRestockCount > 0} />
        <StatCard label="Stock OK" value={String(okCount)} />
      </div>

      {needsRestockCount > 0 ? (
        <Notice tone="warn" title={`${needsRestockCount} running low`}>
          Open a card → Restock. For wax / baking paper, use the Sheet cut tab to see how many loaves
          fit before you deduct.
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Stock filter">
        <FilterLink href="/admin/ingredients" active={filter === "all"} count={totalCount}>
          All
        </FilterLink>
        <FilterLink href="/admin/ingredients?view=low" active={filter === "low"} count={needsRestockCount}>
          Needs restock
        </FilterLink>
        <FilterLink href="/admin/ingredients?view=ok" active={filter === "ok"} count={okCount}>
          Stock OK
        </FilterLink>
      </div>

      {ingredients.length === 0 ? (
        <EmptyState title="No ingredients yet">Add flour, butter, and paper below.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title={filter === "low" ? "Nothing needs restocking" : "No items here"}>
          Switch filter or add a new ingredient.
        </EmptyState>
      ) : (
        <ul className="grid gap-2">
          {shown.map((i) => {
            const isOpen = openId === i.id;
            const unit = i.baseUnit as "g" | "ml" | "piece";
            const hasSheet = Boolean(i.sheetWidth && i.sheetHeight);
            return (
              <li key={i.id}>
                <Card
                  className={cn(
                    "overflow-hidden",
                    i.low && "border-[color-mix(in_oklab,var(--danger)_50%,var(--line))]",
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 p-4 text-left"
                    onClick={() => {
                      setOpenId(isOpen ? null : i.id);
                      setTab(hasSheet || i.baseUnit === "piece" ? "sheet" : "stock");
                    }}
                  >
                    <div className="min-w-0 flex-1 grid gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg leading-tight">{i.name}</span>
                        <Chip tone={i.low ? "danger" : "sage"} dot>
                          {i.low ? "low" : "ok"}
                        </Chip>
                        {hasSheet ? <Chip>sheet {i.sheetWidth}×{i.sheetHeight} {i.sheetUnit}</Chip> : null}
                      </div>
                      <span className="muted text-xs">
                        Buy as {i.purchaseUnit || i.baseUnit}
                        {i.supplier ? ` · ${i.supplier}` : ""}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-display text-xl tnum leading-none">
                        {formatBase(i.qtyOnHandBase, unit)}
                      </span>
                      <span className="faint block text-[0.65rem] uppercase tracking-wide">
                        on hand
                      </span>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="grid gap-4 border-t border-[var(--line)] p-4">
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["stock", "Restock / use"],
                            ["sheet", "Sheet cut"],
                            ["edit", "Edit"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={cn("btn btn-sm", tab === id ? "btn-primary" : "btn-ghost")}
                            onClick={() => setTab(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {tab === "stock" ? (
                        <StockActions ingredient={i} purchaseHint={i.purchaseUnit || i.baseUnit} />
                      ) : null}
                      {tab === "sheet" ? (
                        <SheetCutPanel ingredient={i} products={products} />
                      ) : null}
                      {tab === "edit" ? <EditIngredientForm ingredient={i} /> : null}
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="grid gap-4 p-5">
        <div className="grid gap-1">
          <h2 className="font-display text-xl">Add ingredient</h2>
          <p className="muted text-xs leading-5">
            Flour/water: grams or ml. Papers: Pieces + sheet size (e.g. 10×30 in) so the cut
            calculator can run.
          </p>
        </div>
        <AddIngredientForm />
      </Card>
    </div>
  );
}

function StockActions({
  ingredient: i,
  purchaseHint,
}: {
  ingredient: IngredientRow;
  purchaseHint: string;
}) {
  const unit = i.baseUnit as "g" | "ml" | "piece";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <form
        action={quickRestockIngredient}
        className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--line)] p-3"
      >
        <p className="text-sm font-semibold">＋ Restock</p>
        <input type="hidden" name="ingredientId" value={i.id} />
        <Field label={`Qty (${purchaseHint})`} required>
          <input name="qty" type="number" min={0.01} step="any" required placeholder="2" />
        </Field>
        <Field label="Paid (₱)" required>
          <input name="cost" required placeholder="850" />
        </Field>
        <Field label="Supplier">
          <input name="supplier" defaultValue={i.supplier || ""} />
        </Field>
        <SubmitButton small>Add to stock</SubmitButton>
      </form>

      <form
        action={adjustIngredientStock}
        className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--line)] p-3"
      >
        <p className="text-sm font-semibold">− Use / deduct</p>
        <input type="hidden" name="ingredientId" value={i.id} />
        <input type="hidden" name="direction" value="deduct" />
        <Field label={`Qty (${unit})`} required>
          <input
            name="qty"
            type="number"
            min={0.01}
            step="any"
            required
            placeholder={unit === "piece" ? "sheets used" : "amount"}
          />
        </Field>
        <Field label="Note">
          <input name="reason" placeholder="e.g. 6 round loaves" />
        </Field>
        <SubmitButton small variant="ghost">
          Deduct
        </SubmitButton>
      </form>
    </div>
  );
}

function SheetCutPanel({
  ingredient: i,
  products,
}: {
  ingredient: IngredientRow;
  products: ProductOption[];
}) {
  const [pending, start] = useTransition();
  const unit = i.sheetUnit || "in";
  const sheetW = parseDim(i.sheetWidth) || 10;
  const sheetH = parseDim(i.sheetHeight) || 30;
  const sheet = { width: sheetW, height: sheetH };

  const [productId, setProductId] = useState("");
  const [shape, setShape] = useState<"rect" | "circle">("rect");
  const [pieceW, setPieceW] = useState("5");
  const [pieceH, setPieceH] = useState("7.5");
  const [loaves, setLoaves] = useState("12");

  const selected = products.find((p) => p.id === productId);

  useEffect(() => {
    if (!selected) return;
    if (selected.linerShape === "circle") {
      setShape("circle");
      if (selected.linerWidth) setPieceW(selected.linerWidth);
    } else {
      setShape("rect");
      if (selected.linerWidth) setPieceW(selected.linerWidth);
      if (selected.linerHeight) setPieceH(selected.linerHeight);
    }
  }, [productId, selected]);

  const piece =
    shape === "circle"
      ? circlePieceDims(parseDim(pieceW))
      : {
          width: parseDim(pieceW),
          height: parseDim(pieceH),
        };

  const fit =
    piece && Number.isFinite(piece.width) && Number.isFinite(piece.height)
      ? piecesPerSheet(sheet, piece as { width: number; height: number })
      : null;

  const suggestion = fit
    ? suggestForBake({
        perSheet: fit.perSheet,
        sheetsOnHand: i.onHand,
        loavesWanted: Math.max(0, Math.floor(Number(loaves) || 0)),
      })
    : null;

  const example = useMemo(() => {
    const quarter = fractionPiece(sheet, "1/4");
    const qFit = piecesPerSheet(sheet, quarter);
    return { quarter, qFit };
  }, [sheetW, sheetH]);

  return (
    <div className="grid gap-4">
      <Notice tone="info" title="How sheet math works (example)">
        Sheet <strong>{sheetW}×{sheetH} {unit}</strong>. If you use{" "}
        <strong>¼ of it</strong> as a {example.quarter.width}×{example.quarter.height} {unit}{" "}
        rectangle, you get{" "}
        <strong>{example.qFit?.perSheet ?? "—"} pieces per sheet</strong>
        {example.qFit
          ? ` (${example.qFit.gridW}×${example.qFit.gridH} grid${example.qFit.orientation === "rotated" ? ", rotated" : ""}).`
          : "."}{" "}
        With <strong>{Math.floor(i.onHand)} sheets</strong> on hand → about{" "}
        <strong>
          {(example.qFit?.perSheet ?? 0) * Math.floor(i.onHand)} pieces
        </strong>{" "}
        total. Pick a bread below to size the cut for that loaf.
      </Notice>

      {!(i.sheetWidth && i.sheetHeight) ? (
        <Notice tone="warn" title="Set the full sheet size first">
          Open Edit and fill Sheet width × height (e.g. 10 × 30 in). Stock still counts whole
          sheets; this only calculates cuts.
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Bread / product
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Custom size (no bread)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Cut shape
          <select
            value={shape}
            onChange={(e) => setShape(e.target.value === "circle" ? "circle" : "rect")}
          >
            <option value="rect">Rectangle (batard / pan)</option>
            <option value="circle">Circle (boule / cake)</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["1/2", "1/3", "1/4"] as const).map((f) => {
          const dims = fractionPiece(sheet, f);
          return (
            <button
              key={f}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setShape("rect");
                setPieceW(String(roundNice(dims.width)));
                setPieceH(String(roundNice(dims.height)));
              }}
            >
              Use {f} sheet
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          {shape === "circle" ? `Diameter (${unit})` : `Piece width (${unit})`}
          <input
            type="number"
            min={0.1}
            step="any"
            value={pieceW}
            onChange={(e) => setPieceW(e.target.value)}
          />
        </label>
        {shape === "rect" ? (
          <label className="grid gap-1 text-sm">
            Piece height ({unit})
            <input
              type="number"
              min={0.1}
              step="any"
              value={pieceH}
              onChange={(e) => setPieceH(e.target.value)}
            />
          </label>
        ) : (
          <div />
        )}
        <label className="grid gap-1 text-sm">
          How many loaves?
          <input
            type="number"
            min={0}
            step={1}
            value={loaves}
            onChange={(e) => setLoaves(e.target.value)}
          />
        </label>
      </div>

      {fit && suggestion ? (
        <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm">
          <p>
            <strong>{fit.perSheet}</strong> pieces fit per sheet
            {fit.orientation === "rotated" ? " (best when rotated)" : ""} · grid {fit.gridW}×
            {fit.gridH}
          </p>
          <p className="muted text-xs leading-5">
            On hand: {Math.floor(i.onHand)} sheets → {suggestion.piecesAvailable} pieces available.
            {selected ? ` For “${selected.name}”.` : ""}
          </p>
          <p>
            For <strong>{suggestion.loavesWanted}</strong> loaves: need{" "}
            <strong>{suggestion.piecesNeeded}</strong> pieces ={" "}
            <strong>{suggestion.sheetsNeeded}</strong> sheet
            {suggestion.sheetsNeeded === 1 ? "" : "s"}
            {suggestion.shortfallSheets > 0
              ? ` · short ${suggestion.shortfallSheets} sheet(s)`
              : " · enough stock"}
          </p>
          <p className="muted text-xs">
            Max you can bake with current sheets: <strong>{suggestion.canBake}</strong> loaves.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <form
              action={(fd) => {
                start(async () => {
                  fd.set("ingredientId", i.id);
                  fd.set("direction", "deduct");
                  fd.set("qty", String(suggestion.sheetsNeeded));
                  fd.set(
                    "reason",
                    selected
                      ? `${suggestion.loavesWanted}× ${selected.name} (${fit.perSheet}/sheet)`
                      : `${suggestion.loavesWanted} loaves (${fit.perSheet}/sheet)`,
                  );
                  await adjustIngredientStock(fd);
                });
              }}
            >
              <SubmitButton
                small
                disabled={pending || suggestion.sheetsNeeded <= 0 || suggestion.shortfallSheets > 0}
              >
                Deduct {suggestion.sheetsNeeded} sheet
                {suggestion.sheetsNeeded === 1 ? "" : "s"}
              </SubmitButton>
            </form>

            {productId ? (
              <form
                action={(fd) => {
                  start(async () => {
                    fd.set("productId", productId);
                    fd.set("linerWidth", pieceW);
                    fd.set("linerHeight", shape === "circle" ? pieceW : pieceH);
                    fd.set("linerShape", shape);
                    await saveProductLinerSize(fd);
                  });
                }}
              >
                <SubmitButton small variant="ghost" disabled={pending}>
                  Save size on this bread
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="muted text-sm">Enter piece size — pieces must be smaller than the sheet.</p>
      )}
    </div>
  );
}

function EditIngredientForm({ ingredient: i }: { ingredient: IngredientRow }) {
  return (
    <form action={upsertIngredient} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={i.id} />
      <Field label="Name" required>
        <input name="name" required defaultValue={i.name} />
      </Field>
      <Field label="Base unit">
        <select name="baseUnit" defaultValue={i.baseUnit}>
          {BASE_UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Buy as">
        <input name="purchaseUnit" defaultValue={i.purchaseUnit} />
      </Field>
      <Field label="One pack = base units">
        <input name="purchaseToBase" defaultValue={i.purchaseToBase} />
      </Field>
      <Field label={`Reorder below (${i.baseUnit})`}>
        <input name="reorderThresholdBase" defaultValue={i.reorderThresholdBase} />
      </Field>
      <Field label="Supplier">
        <input name="supplier" defaultValue={i.supplier} />
      </Field>
      <Field label="Sheet width" hint="Papers only — leave blank for flour">
        <input name="sheetWidth" defaultValue={i.sheetWidth} placeholder="10" />
      </Field>
      <Field label="Sheet height">
        <input name="sheetHeight" defaultValue={i.sheetHeight} placeholder="30" />
      </Field>
      <Field label="Sheet unit">
        <select name="sheetUnit" defaultValue={i.sheetUnit || "in"}>
          <option value="in">inches</option>
          <option value="cm">cm</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton small variant="ghost">
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}

function AddIngredientForm() {
  return (
    <form action={upsertIngredient} className="grid gap-3 sm:grid-cols-2 sm:items-start">
      <Field label="Name" required>
        <input name="name" required placeholder="e.g. Baking paper 10×30" />
      </Field>
      <Field label="Base unit">
        <select name="baseUnit" defaultValue="g">
          {BASE_UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Buy as">
        <input name="purchaseUnit" defaultValue="kg" />
      </Field>
      <Field label="One pack → base units">
        <input name="purchaseToBase" defaultValue="1000" />
      </Field>
      <Field label="Reorder below">
        <input name="reorderThresholdBase" defaultValue="0" />
      </Field>
      <Field label="Supplier">
        <input name="supplier" placeholder="Optional" />
      </Field>
      <Field label="Sheet width" hint="Optional — for paper">
        <input name="sheetWidth" placeholder="10" />
      </Field>
      <Field label="Sheet height">
        <input name="sheetHeight" placeholder="30" />
      </Field>
      <Field label="Sheet unit">
        <select name="sheetUnit" defaultValue="in">
          <option value="in">inches</option>
          <option value="cm">cm</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>Add ingredient</SubmitButton>
      </div>
    </form>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card className="grid gap-1 p-4">
      <span className="eyebrow">{label}</span>
      <span className={`font-display text-2xl leading-none ${warn ? "text-[var(--danger)]" : ""}`}>
        {value}
      </span>
    </Card>
  );
}

function FilterLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={`btn btn-sm ${active ? "btn-primary" : "btn-ghost"}`}>
      {children}
      <span className={`ml-2 tabular-nums ${active ? "opacity-90" : "muted"}`}>{count}</span>
    </a>
  );
}

function roundNice(n: number): number {
  return Math.round(n * 100) / 100;
}
