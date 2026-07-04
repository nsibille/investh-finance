import { describe, it, expect } from "vitest";
import {
  generateInstallments,
  installmentOccurrence,
  matchInstallmentsToTransactions,
  type MatchableInstallment,
  type MatchableTx,
} from "@/lib/purchases/installments";

describe("installmentOccurrence", () => {
  it("compte l'occurrence 1-based depuis le mois de départ", () => {
    expect(installmentOccurrence("2026-05", "2026-05")).toBe(1);
    expect(installmentOccurrence("2026-05", "2026-07")).toBe(3);
    expect(installmentOccurrence("2026-05-01", "2026-08-31")).toBe(4);
  });

  it("franchit le passage d'année", () => {
    expect(installmentOccurrence("2026-11", "2027-02")).toBe(4);
  });
});

describe("generateInstallments", () => {
  it("génère `count` mensualités consécutives à partir du mois de départ", () => {
    const out = generateInstallments({
      startMonth: "2026-03",
      count: 3,
      amount: -100,
      label: "Canapé",
    });
    expect(out).toEqual([
      { month: "2026-03-01", amount: -100, label: "Canapé" },
      { month: "2026-04-01", amount: -100, label: "Canapé" },
      { month: "2026-05-01", amount: -100, label: "Canapé" },
    ]);
  });

  it("franchit correctement le passage à l'année suivante", () => {
    const out = generateInstallments({ startMonth: "2026-11", count: 4, amount: -50 });
    expect(out.map((i) => i.month)).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ]);
    expect(out.every((i) => i.label === null)).toBe(true);
  });

  it("accepte un startMonth au format YYYY-MM-DD", () => {
    const out = generateInstallments({ startMonth: "2026-06-15", count: 1, amount: -20 });
    expect(out).toEqual([{ month: "2026-06-01", amount: -20, label: null }]);
  });

  it("count = 0 → achat direct (aucune mensualité)", () => {
    expect(generateInstallments({ startMonth: "2026-01", count: 0, amount: -10 })).toEqual([]);
  });
});

describe("matchInstallmentsToTransactions", () => {
  const inst = (over: Partial<MatchableInstallment>): MatchableInstallment => ({
    id: "i1",
    month: "2026-03-01",
    amount: -100,
    label: null,
    ...over,
  });
  const tx = (over: Partial<MatchableTx>): MatchableTx => ({
    id: "t1",
    operation_date: "2026-03-12",
    amount: -100,
    raw_label: "CANAPE CONFORAMA",
    ...over,
  });

  it("apparie sur mois + montant (valeur absolue) sans libellé", () => {
    expect(
      matchInstallmentsToTransactions([inst({})], [tx({ amount: 100 })]),
    ).toEqual([{ installmentId: "i1", transactionId: "t1" }]);
  });

  it("exige que le libellé de la transaction contienne le libellé attendu", () => {
    const installments = [inst({ label: "Conforama" })];
    expect(matchInstallmentsToTransactions(installments, [tx({ raw_label: "AMAZON" })])).toEqual(
      [],
    );
    expect(
      matchInstallmentsToTransactions(installments, [tx({ raw_label: "CANAPE CONFORAMA" })]),
    ).toEqual([{ installmentId: "i1", transactionId: "t1" }]);
  });

  it("ne matche pas un mois différent", () => {
    expect(
      matchInstallmentsToTransactions([inst({})], [tx({ operation_date: "2026-04-01" })]),
    ).toEqual([]);
  });

  it("ne matche pas un montant différent", () => {
    expect(
      matchInstallmentsToTransactions([inst({})], [tx({ amount: -99.5 })]),
    ).toEqual([]);
  });

  it("appariement glouton 1-pour-1 : une transaction n'est utilisée qu'une fois", () => {
    const installments = [inst({ id: "i1" }), inst({ id: "i2" })];
    const pairs = matchInstallmentsToTransactions(installments, [tx({ id: "t1" })]);
    expect(pairs).toEqual([{ installmentId: "i1", transactionId: "t1" }]);
  });

  it("sans libellé : apparie mensualité négative et transaction négative (mois + montant)", () => {
    // Cas achat sans transaction : label null, on matche montant/mois uniquement.
    const installments = [inst({ label: null, amount: -49.9 })];
    const txs = [tx({ raw_label: "PEU IMPORTE", amount: -49.9 })];
    expect(matchInstallmentsToTransactions(installments, txs)).toEqual([
      { installmentId: "i1", transactionId: "t1" },
    ]);
  });

  it("sans libellé : montant positif de mensualité matche transaction négative", () => {
    const installments = [inst({ label: null, amount: 49.9 })];
    const txs = [tx({ amount: -49.9, raw_label: "X" })];
    expect(matchInstallmentsToTransactions(installments, txs)).toEqual([
      { installmentId: "i1", transactionId: "t1" },
    ]);
  });
});
