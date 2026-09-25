import { describe, expect, it } from "vitest";
import {
  applyVat,
  formatPeso,
  parsePesoInput,
  pesos,
  percentBps,
} from "../src/lib/money";
import {
  usagePerPiece,
  productCostBreakdown,
  batchIngredientCost,
} from "../src/domain/costing";
import { convertToBase, Decimal, UnitError } from "../src/lib/units";
import {
  bakeCycleFor,
  countdown,
  fromManila,
  isPastCutoff,
  manilaParts,
  nextWeekdayAt,
} from "../src/lib/time";
import { MIN_MENU_ITEMS, MAX_MENU_ITEMS } from "../src/domain/menu";

describe("money", () => {
  it("stores pesos as integer centavos", () => {
    expect(pesos(180)).toBe(18000);
    expect(pesos(180.5)).toBe(18050);
    expect(formatPeso(28000)).toBe("₱280.00");
  });

  it("parses peso inputs", () => {
    expect(parsePesoInput("280")).toBe(28000);
    expect(parsePesoInput("₱1,180.50")).toBe(118050);
  });

  it("applies VAT modes without float drift", () => {
    expect(applyVat(10000, "none", 1200)).toEqual({ base: 10000, vat: 0, total: 10000 });
    expect(applyVat(10000, "exclusive", 1200)).toEqual({
      base: 10000,
      vat: 1200,
      total: 11200,
    });
    const inclusive = applyVat(11200, "inclusive", 1200);
    expect(inclusive.total).toBe(11200);
    expect(inclusive.base + inclusive.vat).toBe(11200);
  });

  it("computes basis points", () => {
    expect(percentBps(10000, 250)).toBe(250);
  });
});

describe("units", () => {
  it("converts mass and volume into base units", () => {
    expect(convertToBase("2", "kg", "g").toString()).toBe("2000");
    expect(convertToBase("1.5", "l", "ml").toString()).toBe("1500");
    expect(convertToBase("1", "dozen", "piece").toString()).toBe("12");
  });

  it("accepts custom purchase factors like a flour sack", () => {
    expect(convertToBase("1", "sack", "g", { sack: "25000" }).toString()).toBe("25000");
  });

  it("refuses mixing volume into a weight ingredient without a density", () => {
    expect(() => convertToBase("1", "cup", "g")).toThrow(UnitError);
  });
});

describe("costing — the cupcake question", () => {
  it("divides batch flour across yield pieces", () => {
    const per = usagePerPiece("480", 24);
    expect(per.toString()).toBe("20");
  });

  it("costs a piece from recipe lines", () => {
    const flour = {
      id: "flour",
      name: "Flour",
      photoPath: null,
      baseUnit: "g",
      purchaseUnit: "kg",
      purchaseToBase: "1000",
      qtyOnHandBase: "10000",
      costPerBaseCentavos: "5",
      reorderThresholdBase: "0",
      supplier: "",
      sheetWidth: "",
      sheetHeight: "",
      sheetUnit: "in",
      createdAt: new Date(),
    };
    const recipe = {
      id: "r1",
      productId: "p1",
      yieldPieces: 24,
      instructions: "",
      ovenMinutes: 20,
      laborCentavos: 4800,
      updatedAt: new Date(),
    };
    const lines = [
      {
        id: "l1",
        recipeId: "r1",
        ingredientId: "flour",
        qty: "480",
        unit: "g",
        kind: "ingredient",
        position: 0,
        ingredient: flour,
      },
    ];
    const cost = productCostBreakdown({
      recipe,
      lines,
      sellingPrice: 8500,
      estimatedFeeBps: 0,
      overhead: null,
    });
    expect(cost.ingredientPerPiece).toBe(100);
    expect(cost.laborPerPiece).toBe(200);
    expect(cost.estimatedCost).toBe(300);
  });

  it("sums batch ingredient cost in centavos", () => {
    expect(
      batchIngredientCost([
        { qtyBase: "1000", costPerBaseCentavos: "5.4" },
        { qtyBase: "500", costPerBaseCentavos: "10" },
      ]),
    ).toBe(5400 + 5000);
  });
});

describe("Manila weekly cycle", () => {
  it("reads Manila wall-clock fields with a fixed +08 offset", () => {
    const instant = new Date("2026-09-24T15:59:00.000Z");
    const parts = manilaParts(instant);
    expect(parts.weekday).toBe(4);
    expect(parts.hour).toBe(23);
    expect(parts.minute).toBe(59);
  });

  it("builds next Thursday cutoff and Sunday pickup", () => {
    const monday = new Date("2026-09-20T21:00:00.000Z");
    const cycle = bakeCycleFor(monday, {
      cutoffWeekday: 4,
      cutoffHour: 23,
      cutoffMinute: 59,
      prepWeekdays: [5, 6],
      pickupWeekday: 0,
    });
    expect(manilaParts(cycle.cutoffAt)).toMatchObject({
      year: 2026,
      month: 9,
      day: 24,
      hour: 23,
      minute: 59,
    });
    expect(manilaParts(cycle.pickupDate)).toMatchObject({
      year: 2026,
      month: 9,
      day: 27,
    });
    expect(cycle.prepDates).toEqual(["2026-09-25", "2026-09-26"]);
  });

  it("treats cutoff as closed the millisecond after", () => {
    const cutoff = fromManila(2026, 9, 24, 23, 59);
    expect(isPastCutoff(cutoff, new Date(cutoff.getTime() - 1))).toBe(false);
    expect(isPastCutoff(cutoff, new Date(cutoff.getTime() + 1))).toBe(true);
  });

  it("counts down without going negative", () => {
    const target = new Date(Date.now() + 90_000);
    const c = countdown(target);
    expect(c.expired).toBe(false);
    expect(c.minutes).toBeGreaterThanOrEqual(1);
    expect(countdown(new Date(Date.now() - 1000)).expired).toBe(true);
  });

  it("finds the next weekday strictly after now", () => {
    const thu = fromManila(2026, 9, 24, 12, 0);
    const nextThu = nextWeekdayAt(thu, 4, 23, 59);
    expect(manilaParts(nextThu).day).toBe(24);
    const after = nextWeekdayAt(fromManila(2026, 9, 24, 23, 59), 4, 23, 59);
    expect(manilaParts(after).day).toBe(1);
  });
});

describe("menu limits", () => {
  it("exposes a 3+ item publish window", () => {
    expect(MIN_MENU_ITEMS).toBe(3);
    expect(MAX_MENU_ITEMS).toBe(24);
  });
});

describe("delivery fee", () => {
  it("uses a flat fee from settings", async () => {
    const { flatDeliveryFeeCentavos } = await import("../src/domain/delivery-fee");
    expect(flatDeliveryFeeCentavos({ deliveryBaseFeeCentavos: 5000 })).toBe(5000);
    expect(flatDeliveryFeeCentavos({ deliveryBaseFeeCentavos: 0 })).toBe(5000);
  });
});

void Decimal;
