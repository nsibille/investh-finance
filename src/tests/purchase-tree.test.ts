import { describe, it, expect } from "vitest";
import {
  descendantIdsOf,
  isValidParent,
  computeRollups,
  type PurchaseAmounts,
  type PurchaseEdge,
} from "@/lib/purchases/tree";

const edge = (id: string, parentId: string | null): PurchaseEdge => ({ id, parentId });

// Arbre : voyage → (vols, hotel → nuits), meuble (racine indépendante).
const edges: PurchaseEdge[] = [
  edge("voyage", null),
  edge("vols", "voyage"),
  edge("hotel", "voyage"),
  edge("nuits", "hotel"),
  edge("meuble", null),
];

describe("descendantIdsOf", () => {
  it("renvoie tous les descendants transitifs", () => {
    expect([...descendantIdsOf("voyage", edges)].sort()).toEqual(
      ["hotel", "nuits", "vols"].sort(),
    );
    expect([...descendantIdsOf("hotel", edges)]).toEqual(["nuits"]);
    expect([...descendantIdsOf("meuble", edges)]).toEqual([]);
  });

  it("résiste à un cycle sans boucler", () => {
    const cyclic: PurchaseEdge[] = [edge("a", "b"), edge("b", "a")];
    expect([...descendantIdsOf("a", cyclic)]).toEqual(["b"]);
  });
});

describe("isValidParent", () => {
  it("détacher (null) est toujours valide", () => {
    expect(isValidParent("hotel", null, edges)).toBe(true);
  });
  it("refuse l'auto-référence", () => {
    expect(isValidParent("hotel", "hotel", edges)).toBe(false);
  });
  it("refuse un descendant comme parent (cycle)", () => {
    expect(isValidParent("voyage", "nuits", edges)).toBe(false);
    expect(isValidParent("hotel", "nuits", edges)).toBe(false);
  });
  it("accepte un parent non-descendant", () => {
    expect(isValidParent("meuble", "voyage", edges)).toBe(true);
    expect(isValidParent("vols", "meuble", edges)).toBe(true);
  });
});

describe("computeRollups", () => {
  const amount = (
    id: string,
    parentId: string | null,
    over: Partial<PurchaseAmounts> = {},
  ): PurchaseAmounts => ({
    id,
    parentId,
    paidAmount: 0,
    transactionCount: 0,
    forecastAmount: 0,
    remaining: 0,
    ...over,
  });

  it("agrège les montants sur le sous-arbre (self + descendants)", () => {
    const nodes: PurchaseAmounts[] = [
      amount("voyage", null, { paidAmount: -100, transactionCount: 1 }),
      amount("vols", "voyage", { paidAmount: -500, transactionCount: 1, remaining: 0 }),
      amount("hotel", "voyage", { paidAmount: -200, transactionCount: 2, remaining: -50 }),
      amount("nuits", "hotel", { paidAmount: -80, transactionCount: 1 }),
      amount("meuble", null, { paidAmount: -300, transactionCount: 1 }),
    ];
    const roll = computeRollups(nodes);

    const voyage = roll.get("voyage")!;
    expect(voyage.totalPaidAmount).toBe(-100 + -500 + -200 + -80);
    expect(voyage.totalTransactionCount).toBe(1 + 1 + 2 + 1);
    expect(voyage.totalRemaining).toBe(-50);
    expect(voyage.descendantCount).toBe(3);
    expect(voyage.childIds.sort()).toEqual(["hotel", "vols"].sort());

    const hotel = roll.get("hotel")!;
    expect(hotel.totalPaidAmount).toBe(-200 + -80);
    expect(hotel.descendantCount).toBe(1);

    const meuble = roll.get("meuble")!;
    expect(meuble.totalPaidAmount).toBe(-300);
    expect(meuble.descendantCount).toBe(0);
    expect(meuble.childIds).toEqual([]);
  });

  it("un parent inconnu (filtré) est traité comme racine", () => {
    const nodes: PurchaseAmounts[] = [
      amount("orphan", "missing", { paidAmount: -10 }),
    ];
    const roll = computeRollups(nodes);
    expect(roll.get("orphan")!.totalPaidAmount).toBe(-10);
    expect(roll.get("orphan")!.descendantCount).toBe(0);
  });
});
