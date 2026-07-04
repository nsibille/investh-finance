import { describe, it, expect } from "vitest";
import {
  normalizeLabel,
  computeDedupHash,
  dedupeBatch,
  assignOccurrences,
  baseKey,
} from "@/lib/import/dedup";
import {
  mapGoCardlessTransaction,
  mapGoCardlessTransactions,
} from "@/lib/gocardless/mapper";
import type { GCTransaction } from "@/lib/gocardless/types";

describe("normalizeLabel", () => {
  it("uppercases, strips accents and collapses whitespace", () => {
    expect(normalizeLabel("  Café   Crème  à Paris ")).toBe("CAFE CREME A PARIS");
  });
});

describe("computeDedupHash", () => {
  it("is stable for the same input", () => {
    const tx = {
      operation_date: "2026-04-07",
      amount: -55.9,
      raw_label: "PRELEVEMENT GC RE MOBILE",
      external_id: null,
    };
    expect(computeDedupHash("acc", tx)).toBe(computeDedupHash("acc", tx));
  });

  it("differs by account", () => {
    const tx = {
      operation_date: "2026-04-07",
      amount: -55.9,
      raw_label: "X",
      external_id: null,
    };
    expect(computeDedupHash("a", tx)).not.toBe(computeDedupHash("b", tx));
  });

  it("prefers external id when present", () => {
    const withId = computeDedupHash("acc", {
      operation_date: "2026-04-07",
      amount: -1,
      raw_label: "A",
      external_id: "tx-123",
    });
    const sameIdDifferentLabel = computeDedupHash("acc", {
      operation_date: "2026-04-09",
      amount: -2,
      raw_label: "B",
      external_id: "tx-123",
    });
    expect(withId).toBe(sameIdDifferentLabel);
  });
});

describe("computeDedupHash occurrences", () => {
  const tx = {
    operation_date: "2026-07-31",
    amount: -2.55,
    raw_label: "Ile-de-france Mobilites",
    external_id: null,
  };

  it("occurrence 0 garde le hash historique", () => {
    expect(computeDedupHash("acc", tx, 0)).toBe(computeDedupHash("acc", tx));
  });

  it("des occurrences différentes donnent des hashes différents", () => {
    expect(computeDedupHash("acc", tx, 1)).not.toBe(computeDedupHash("acc", tx, 0));
    expect(computeDedupHash("acc", tx, 2)).not.toBe(computeDedupHash("acc", tx, 1));
  });
});

describe("assignOccurrences", () => {
  it("indexe les éléments identiques 0,1,2… par groupe", () => {
    const items = [
      { operation_date: "2026-07-31", amount: -5, raw_label: "A", external_id: null },
      { operation_date: "2026-07-31", amount: -5, raw_label: "A", external_id: null },
      { operation_date: "2026-07-31", amount: -9, raw_label: "B", external_id: null },
      { operation_date: "2026-07-31", amount: -5, raw_label: "A", external_id: null },
    ];
    expect(assignOccurrences(items, baseKey)).toEqual([0, 1, 0, 2]);
  });
});

describe("dedupeBatch", () => {
  it("removes duplicate hashes keeping first", () => {
    const out = dedupeBatch([
      { dedup_hash: "a", v: 1 },
      { dedup_hash: "a", v: 2 },
      { dedup_hash: "b", v: 3 },
    ]);
    expect(out).toEqual([
      { dedup_hash: "a", v: 1 },
      { dedup_hash: "b", v: 3 },
    ]);
  });
});

describe("mapGoCardlessTransaction", () => {
  it("maps a credit with remittance info", () => {
    const tx: GCTransaction = {
      transactionId: "abc",
      bookingDate: "2026-04-29",
      valueDate: "2026-04-29",
      transactionAmount: { amount: "5796.58", currency: "EUR" },
      remittanceInformationUnstructured: "VIR INST RE Salaire Avril",
    };
    expect(mapGoCardlessTransaction(tx)).toEqual({
      operation_date: "2026-04-29",
      value_date: "2026-04-29",
      label: "VIR INST RE Salaire Avril",
      raw_label: "VIR INST RE Salaire Avril",
      amount: 5796.58,
      currency: "EUR",
      external_id: "abc",
    });
  });

  it("falls back to counterparty name and internal id", () => {
    const tx: GCTransaction = {
      internalTransactionId: "int-1",
      bookingDate: "2026-04-24T00:00:00Z",
      transactionAmount: { amount: "-88.27", currency: "EUR" },
      creditorName: "EDF clients particuliers",
    };
    const out = mapGoCardlessTransaction(tx);
    expect(out.raw_label).toBe("EDF clients particuliers");
    expect(out.operation_date).toBe("2026-04-24");
    expect(out.amount).toBe(-88.27);
    expect(out.external_id).toBe("int-1");
  });

  it("filters out malformed transactions", () => {
    const out = mapGoCardlessTransactions([
      { transactionAmount: { amount: "10", currency: "EUR" }, bookingDate: "2026-01-01" },
      { transactionAmount: { amount: "NaN", currency: "EUR" }, bookingDate: "" },
    ]);
    expect(out).toHaveLength(1);
  });
});
