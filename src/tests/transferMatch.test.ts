import { describe, it, expect } from "vitest";
import {
  matchInternalTransfers,
  type TransferCandidate,
} from "@/lib/transactions/transferMatch";

describe("matchInternalTransfers", () => {
  it("apparie une sortie et une entrée opposées sur deux comptes proches en date", () => {
    const txs: TransferCandidate[] = [
      { id: "a", account_id: "acc1", amount: -500, operation_date: "2026-07-10" },
      { id: "b", account_id: "acc2", amount: 500, operation_date: "2026-07-11" },
    ];
    expect(matchInternalTransfers(txs)).toEqual([["a", "b"]]);
  });

  it("n'apparie pas au sein d'un même compte", () => {
    const txs: TransferCandidate[] = [
      { id: "a", account_id: "acc1", amount: -500, operation_date: "2026-07-10" },
      { id: "b", account_id: "acc1", amount: 500, operation_date: "2026-07-10" },
    ];
    expect(matchInternalTransfers(txs)).toEqual([]);
  });

  it("respecte la fenêtre de jours", () => {
    const txs: TransferCandidate[] = [
      { id: "a", account_id: "acc1", amount: -500, operation_date: "2026-07-10" },
      { id: "b", account_id: "acc2", amount: 500, operation_date: "2026-07-20" },
    ];
    expect(matchInternalTransfers(txs, 4)).toEqual([]);
  });

  it("apparie au plus proche en date quand plusieurs candidats", () => {
    const txs: TransferCandidate[] = [
      { id: "out", account_id: "acc1", amount: -100, operation_date: "2026-07-10" },
      { id: "far", account_id: "acc2", amount: 100, operation_date: "2026-07-13" },
      { id: "near", account_id: "acc2", amount: 100, operation_date: "2026-07-10" },
    ];
    expect(matchInternalTransfers(txs)).toEqual([["out", "near"]]);
  });

  it("ne réutilise pas une transaction déjà appariée", () => {
    const txs: TransferCandidate[] = [
      { id: "o1", account_id: "acc1", amount: -50, operation_date: "2026-07-10" },
      { id: "o2", account_id: "acc1", amount: -50, operation_date: "2026-07-10" },
      { id: "i1", account_id: "acc2", amount: 50, operation_date: "2026-07-10" },
    ];
    const pairs = matchInternalTransfers(txs);
    expect(pairs).toHaveLength(1);
    expect(pairs[0][1]).toBe("i1");
  });
});
