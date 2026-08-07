import { describe, it, expect } from "vitest";
import {
  normalizeLabel,
  computeDedupHash,
  dedupeBatch,
  assignOccurrences,
  baseKey,
  resolveDedupHashes,
  contentKey,
  flagContentDuplicates,
  significantTokens,
  labelsSimilar,
} from "@/lib/import/dedup";
import { merchantCompatible } from "@/lib/import/merchantGate";
import { parseAmountInput } from "@/lib/format/amount";
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

describe("resolveDedupHashes (déflaggage de doublon)", () => {
  const tx = {
    operation_date: "2026-07-31",
    amount: -10,
    raw_label: "DEUXPOINTZERO",
    external_id: null,
  };

  it("garde le hash naturel sans ligne forcée", () => {
    const out = resolveDedupHashes("acc", [tx], new Set());
    expect(out).toEqual([computeDedupHash("acc", tx, 0)]);
  });

  it("décale une ligne forcée déjà présente en base vers une occurrence libre", () => {
    // Le hash naturel (occ 0) est déjà en base → faux positif déflagué.
    const existing = new Set([computeDedupHash("acc", tx, 0)]);
    const out = resolveDedupHashes("acc", [{ ...tx, force: true }], existing);
    expect(out).toEqual([computeDedupHash("acc", tx, 1)]);
    expect(existing.has(out[0])).toBe(false);
  });

  it("saute les occurrences déjà consommées en base", () => {
    const existing = new Set([
      computeDedupHash("acc", tx, 0),
      computeDedupHash("acc", tx, 1),
    ]);
    const out = resolveDedupHashes("acc", [{ ...tx, force: true }], existing);
    expect(out).toEqual([computeDedupHash("acc", tx, 2)]);
  });

  it("n'entre pas en collision avec une ligne non forcée du même contenu", () => {
    // Ligne 0 forcée (occ 0 en base) + ligne 1 nouvelle (occ 1) : la forcée doit
    // sauter par-dessus l'occ 1 de la ligne normale.
    const existing = new Set([computeDedupHash("acc", tx, 0)]);
    const out = resolveDedupHashes(
      "acc",
      [{ ...tx, force: true }, { ...tx }],
      existing,
    );
    expect(new Set(out).size).toBe(2);
    expect(out[1]).toBe(computeDedupHash("acc", tx, 1)); // normale : occ 1
    expect(out[0]).toBe(computeDedupHash("acc", tx, 2)); // forcée : occ libre 2
  });

  it("attribue des hashs distincts à deux lignes forcées identiques", () => {
    const existing = new Set([computeDedupHash("acc", tx, 0)]);
    const out = resolveDedupHashes(
      "acc",
      [{ ...tx, force: true }, { ...tx, force: true }],
      existing,
    );
    expect(new Set(out).size).toBe(2);
  });
});

describe("contentKey (signature inter-source)", () => {
  it("ignore le libellé : même compte + date + montant → même clé", () => {
    const a = contentKey("acc", "2026-07-28", 550);
    const b = contentKey("acc", "2026-07-28", 550);
    expect(a).toBe(b);
  });

  it("distingue compte, date et montant", () => {
    expect(contentKey("a", "2026-07-28", 550)).not.toBe(
      contentKey("b", "2026-07-28", 550),
    );
    expect(contentKey("acc", "2026-07-28", 550)).not.toBe(
      contentKey("acc", "2026-07-29", 550),
    );
    expect(contentKey("acc", "2026-07-28", 550)).not.toBe(
      contentKey("acc", "2026-07-28", 551),
    );
  });
});

describe("significantTokens / labelsSimilar (départage par libellé)", () => {
  it("écarte nombres, dates et termes bancaires structurels", () => {
    const t = significantTokens(
      "VIR INST RE 670989691262 DE: MLLE KAMINSKI CELIA DATE: 28/07/2026 10:31 MOTIF: VIREMENT",
    );
    expect(t.has("KAMINSKI")).toBe(true);
    expect(t.has("CELIA")).toBe(true);
    // Termes structurels / nombres écartés.
    expect(t.has("VIR")).toBe(false);
    expect(t.has("VIREMENT")).toBe(false);
    expect(t.has("MOTIF")).toBe(false);
    expect(t.has("670989691262")).toBe(false);
  });

  it("rapproche deux libellés inter-source de la même opération", () => {
    expect(
      labelsSimilar(
        "VIR INSTANTANE RECU DE: MLLE KAMINSKI CELIA MOTIF: VIREMENT",
        "VIR INST RE 670989691262 DE: MLLE KAMINSKI CELIA DATE: 28/07/2026 MOTIF: VIREMENT DE MLLE KAMINSKI CELIA",
      ),
    ).toBe(true);
  });

  it("distingue deux opérations sans contrepartie commune", () => {
    expect(
      labelsSimilar("PAIEMENT CB CARREFOUR", "PAIEMENT CB MONOPRIX"),
    ).toBe(false);
  });

  it("libellé purement structurel : on s'en remet à date+montant", () => {
    expect(labelsSimilar("VIREMENT RECU", "SALAIRE ACME CORP")).toBe(true);
  });
});

describe("flagContentDuplicates (doublon inter-source)", () => {
  const KEY = contentKey("acc", "2026-07-28", 550);
  const cand = (label: string, hashDuplicate = false) => ({ key: KEY, label, hashDuplicate });

  it("marque une ligne dont le contenu existe en base malgré un hash différent", () => {
    // 1 opération en base (même compte+date+montant, libellé compatible).
    const existing = new Map([[KEY, ["VIR INSTANTANE RECU DE MLLE KAMINSKI CELIA"]]]);
    const candidates = [cand("VIR INST RE 670 DE MLLE KAMINSKI CELIA")];
    expect(flagContentDuplicates(candidates, existing)).toEqual([true]);
  });

  it("ne marque pas si le libellé ne correspond pas (collision date+montant)", () => {
    // Même date+montant mais opérations distinctes → PAS un doublon.
    const existing = new Map([[KEY, ["PAIEMENT CB CARREFOUR"]]]);
    const candidates = [cand("PAIEMENT CB MONOPRIX")];
    expect(flagContentDuplicates(candidates, existing)).toEqual([false]);
  });

  it("ne sur-marque pas : N candidats compatibles ne consomment que M emplacements", () => {
    const existing = new Map([[KEY, ["VIR RECU KAMINSKI CELIA"]]]);
    const candidates = [
      cand("VIR INST KAMINSKI CELIA"),
      cand("VIR INST KAMINSKI CELIA"),
    ];
    // 2 candidats, 1 seul en base → 1 doublon, 1 nouvelle.
    expect(flagContentDuplicates(candidates, existing)).toEqual([true, false]);
  });

  it("les doublons par hash consomment leur emplacement en priorité", () => {
    const existing = new Map([[KEY, ["VIR RECU KAMINSKI CELIA"]]]);
    const candidates = [
      cand("VIR RECU KAMINSKI CELIA", true),
      cand("VIR INST KAMINSKI CELIA", false),
    ];
    // Ligne 0 déjà doublon par hash : elle prend l'emplacement, la ligne 1
    // (autre source, même contenu) reste nouvelle.
    expect(flagContentDuplicates(candidates, existing)).toEqual([true, false]);
  });

  it("sans emplacement en base : rien n'est marqué", () => {
    const candidates = [cand("VIR KAMINSKI CELIA")];
    expect(flagContentDuplicates(candidates, new Map())).toEqual([false]);
  });
});

describe("parseAmountInput (montant format fr)", () => {
  it("accepte la virgule décimale et le signe", () => {
    expect(parseAmountInput("-5,50")).toBe(-5.5);
    expect(parseAmountInput("5,50")).toBe(5.5);
    expect(parseAmountInput("1 234,56")).toBe(1234.56);
    expect(parseAmountInput("1 234,56 €")).toBe(1234.56);
  });
  it("accepte le point décimal et les nombres", () => {
    expect(parseAmountInput("-5.5")).toBe(-5.5);
    expect(parseAmountInput(42)).toBe(42);
  });
  it("renvoie NaN pour une saisie non numérique/incomplète", () => {
    expect(Number.isNaN(parseAmountInput(""))).toBe(true);
    expect(Number.isNaN(parseAmountInput("-"))).toBe(true);
    expect(Number.isNaN(parseAmountInput("abc"))).toBe(true);
    expect(Number.isNaN(parseAmountInput(null))).toBe(true);
  });
});

describe("merchantCompatible (gating enseigne)", () => {
  it("transaction sans enseigne : toujours compatible", () => {
    expect(merchantCompatible(null, new Set())).toBe(true);
    expect(merchantCompatible(null, new Set(["m1"]))).toBe(true);
    expect(merchantCompatible(undefined, new Set(["m1"]))).toBe(true);
  });

  it("entité sans enseigne (set vide) : agnostique, compatible", () => {
    expect(merchantCompatible("m1", new Set())).toBe(true);
  });

  it("même enseigne : compatible", () => {
    expect(merchantCompatible("m1", new Set(["m1"]))).toBe(true);
    expect(merchantCompatible("m1", new Set(["m0", "m1"]))).toBe(true);
  });

  it("enseigne différente (contradiction) : incompatible", () => {
    expect(merchantCompatible("m1", new Set(["m2"]))).toBe(false);
    expect(merchantCompatible("m1", new Set(["m2", "m3"]))).toBe(false);
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
