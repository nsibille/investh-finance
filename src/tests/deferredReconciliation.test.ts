import { describe, it, expect } from "vitest";
import { reconcileDeferredAccount } from "@/lib/transactions/deferredReconciliation";

let n = 0;
function tx(
  operation_date: string,
  amount: number,
  raw_label = "CB MONOPRIX",
  extra: { subcategory_id?: string; transfer_group_id?: string } = {},
) {
  n += 1;
  return {
    id: `t${n}`,
    account_id: "acc",
    operation_date,
    label: raw_label,
    raw_label,
    amount,
    currency: "EUR",
    subcategory_id: extra.subcategory_id ?? null,
    transfer_group_id: extra.transfer_group_id ?? null,
  };
}

const opts = { deferredSubId: "sub-deferred", internalSubId: "sub-internal", currentMonth: "2026-10" };

describe("reconcileDeferredAccount", () => {
  it("associe les paiements du mois au prélèvement de fin de mois", () => {
    const res = reconcileDeferredAccount(
      [
        tx("2026-08-03", -30),
        tx("2026-08-20", -70),
        tx("2026-08-31", -100, "DEBIT DIFFERE - M. X"),
      ],
      opts,
    );
    expect(res.months).toHaveLength(1);
    expect(res.months[0]).toMatchObject({ month: "2026-08", status: "ok", gap: 0, opsTotal: -100, debitTotal: -100 });
    expect(res.gapTotal).toBe(0);
  });

  it("rattache un prélèvement de début de mois au mois précédent", () => {
    const res = reconcileDeferredAccount(
      [tx("2026-08-15", -50), tx("2026-09-02", -50, "Debit Differe")],
      opts,
    );
    expect(res.months[0]).toMatchObject({ month: "2026-08", status: "ok" });
  });

  it("signale l'écart, le mois sans prélèvement et l'encours du mois courant", () => {
    const res = reconcileDeferredAccount(
      [
        tx("2026-07-10", -40),
        tx("2026-07-31", -45, "x", { subcategory_id: "sub-deferred" }),
        tx("2026-08-10", -60),
        tx("2026-09-10", -20),
        tx("2026-09-30", -20, "DEBIT DIFFERE"),
        tx("2026-10-05", -15),
      ],
      opts,
    );
    const byMonth = Object.fromEntries(res.months.map((m) => [m.month, m]));
    expect(byMonth["2026-07"]).toMatchObject({ status: "gap", gap: 5 });
    expect(byMonth["2026-08"]).toMatchObject({ status: "missing" });
    expect(byMonth["2026-09"]).toMatchObject({ status: "ok" });
    expect(byMonth["2026-10"]).toMatchObject({ status: "open" });
    expect(res.pending).toBe(-15);
    expect(res.missingTotal).toBe(-60);
    expect(res.gapTotal).toBe(5);
    // Mois les plus récents en premier.
    expect(res.months[0].month).toBe("2026-10");
  });

  it("ignore les virements (couverture) et isole les paiements antérieurs au 1er prélèvement", () => {
    const res = reconcileDeferredAccount(
      [
        tx("2026-05-10", -12),
        tx("2026-06-12", -80),
        tx("2026-06-29", 80, "VIR NICOLAS", { subcategory_id: "sub-internal" }),
        tx("2026-06-29", 5, "VIR", { transfer_group_id: "g1" }),
        tx("2026-06-30", -80, "DEBIT DIFFERE"),
      ],
      opts,
    );
    expect(res.before).toEqual({ count: 1, total: -12 });
    expect(res.months.find((m) => m.month === "2026-06")).toMatchObject({ status: "ok", opsTotal: -80 });
  });
});
