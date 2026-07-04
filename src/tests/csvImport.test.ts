import { describe, it, expect } from "vitest";
import { parseBankinCsv } from "@/lib/import/parsers/bankinCsv";
import {
  buildPreviewRows,
  resolveCsvTargets,
  buildCsvPreview,
  groupByConnection,
} from "@/lib/import/preview";
import { computeDedupHash } from "@/lib/import/dedup";
import { normalizeConnection } from "@/lib/import/connection";
import type { ParsedTransaction } from "@/lib/import/types";

const HEADER =
  "Date\tLibellé\tCatégorie\tMontant\tNotes\tN° de chèque\tLabels\tNom du compte\tNom de la connexion";

function csv(lines: string[]): string {
  return [HEADER, ...lines].join("\r\n");
}

describe("parseBankinCsv", () => {
  it("parses a Bankin' tab-separated export", () => {
    const text = csv([
      "31/07/2026\tDeuxpointzero\tTransports en commun\t-5\t\t\t\tNICOLAS SIBILLE\tBforBank",
      "31/07/2026\tPaypal Paiemen\tServices\t-15,98\t\t\t\tNICOLAS SIBILLE\tBforBank",
      "01/07/2026\tSalaire\tRevenus\t2 500,50\t\t\t\tNICOLAS SIBILLE\tBforBank",
    ]);
    const { transactions, unrecognized } = parseBankinCsv(text);
    expect(unrecognized).toBe(false);
    expect(transactions).toHaveLength(3);
    expect(transactions[0]).toMatchObject({
      operation_date: "2026-07-31",
      label: "Deuxpointzero",
      raw_label: "Deuxpointzero",
      amount: -5,
      currency: "EUR",
    });
    expect(transactions[1].amount).toBe(-15.98);
    expect(transactions[2].amount).toBe(2500.5);
  });

  it("flags an unrecognized file (missing columns)", () => {
    const text = "Foo\tBar\r\n1\t2";
    const { transactions, unrecognized } = parseBankinCsv(text);
    expect(unrecognized).toBe(true);
    expect(transactions).toHaveLength(0);
  });

  it("skips rows with an invalid date or amount", () => {
    const text = csv([
      "not-a-date\tX\tY\t-1\t\t\t\tA\tB",
      "31/07/2026\tOK\tY\t-2\t\t\t\tA\tB",
      "31/07/2026\tBadAmount\tY\t\t\t\t\tA\tB",
    ]);
    const { transactions } = parseBankinCsv(text);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].label).toBe("OK");
  });

  it("extrait le nom de la connexion comme pivot de compte", () => {
    const text = csv([
      "31/07/2026\tX\tY\t-5\t\t\t\tNICOLAS SIBILLE\tBforBank",
    ]);
    const { transactions } = parseBankinCsv(text);
    expect(transactions[0].connection_name).toBe("BforBank");
  });

  it("retombe sur le nom du compte si la connexion est vide", () => {
    const text = csv(["31/07/2026\tX\tY\t-5\t\t\t\tLivret A\t"]);
    const { transactions } = parseBankinCsv(text);
    expect(transactions[0].connection_name).toBe("Livret A");
  });
});

describe("groupByConnection", () => {
  const txs: ParsedTransaction[] = [
    { operation_date: "2026-07-31", label: "a", raw_label: "a", amount: -5, currency: "EUR", connection_name: "BforBank" },
    { operation_date: "2026-07-30", label: "b", raw_label: "b", amount: -6, currency: "EUR", connection_name: "bforbank" },
    { operation_date: "2026-07-29", label: "c", raw_label: "c", amount: -7, currency: "EUR", connection_name: "Boursorama" },
    { operation_date: "2026-07-28", label: "d", raw_label: "d", amount: -8, currency: "EUR", connection_name: null },
  ];

  it("regroupe par connexion normalisée (casse ignorée) + défaut si vide", () => {
    const groups = groupByConnection(txs);
    expect(groups.get(normalizeConnection("BforBank"))?.txs).toHaveLength(2);
    expect(groups.get(normalizeConnection("Boursorama"))?.txs).toHaveLength(1);
    expect(groups.get(normalizeConnection(null))?.label).toBe("Compte importé");
  });
});

describe("resolveCsvTargets + buildCsvPreview", () => {
  const txs: ParsedTransaction[] = [
    // déjà en base (compte existant)
    { operation_date: "2026-07-31", label: "a", raw_label: "a", amount: -5, currency: "EUR", connection_name: "BforBank" },
    // nouveau (compte existant, absent de la base)
    { operation_date: "2026-07-30", label: "b", raw_label: "b", amount: -6, currency: "EUR", connection_name: "BforBank" },
    // identique au précédent → doublon dans le fichier
    { operation_date: "2026-07-30", label: "b", raw_label: "b", amount: -6, currency: "EUR", connection_name: "BforBank" },
    // connexion inconnue → compte à créer, jamais doublon en base
    { operation_date: "2026-07-29", label: "c", raw_label: "c", amount: -7, currency: "EUR", connection_name: "Boursorama" },
  ];

  it("mappe connexions existantes, détecte doublons et récapitule", () => {
    const accByConn = new Map([[normalizeConnection("BforBank"), "acc-1"]]);
    const targets = resolveCsvTargets(txs, accByConn);
    expect(targets[0].accountId).toBe("acc-1");
    expect(targets[3].accountId).toBeNull();

    const existing = new Set([computeDedupHash("acc-1", txs[0])]);
    const { rows, connections } = buildCsvPreview(txs, targets, existing);

    expect(rows[0].duplicateReason).toBe("existing");
    expect(rows[1].duplicateReason).toBeNull();
    expect(rows[2].duplicateReason).toBe("in_file");
    expect(rows[3].duplicateReason).toBeNull();
    expect(rows[3].targetAccountExists).toBe(false);

    const bfor = connections.find((c) => c.label === "BforBank");
    const bourso = connections.find((c) => c.label === "Boursorama");
    expect(bfor).toMatchObject({ count: 3, exists: true });
    expect(bourso).toMatchObject({ count: 1, exists: false });
  });
});

describe("buildPreviewRows", () => {
  const txs = [
    { operation_date: "2026-07-31", label: "A", raw_label: "A", amount: -5, currency: "EUR" },
    // exact repeat -> in-file duplicate
    { operation_date: "2026-07-31", label: "A", raw_label: "A", amount: -5, currency: "EUR" },
    // already in DB
    { operation_date: "2026-07-30", label: "B", raw_label: "B", amount: -9, currency: "EUR" },
  ];

  it("flags in-file and existing duplicates with reasons", () => {
    const existing = new Set([computeDedupHash("acc", txs[2])]);
    const { rows } = buildPreviewRows("acc", txs, existing);

    expect(rows[0].duplicate).toBe(false);
    expect(rows[0].duplicateReason).toBeNull();

    expect(rows[1].duplicate).toBe(true);
    expect(rows[1].duplicateReason).toBe("in_file");

    expect(rows[2].duplicate).toBe(true);
    expect(rows[2].duplicateReason).toBe("existing");
  });
});
