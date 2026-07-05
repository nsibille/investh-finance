import Papa from "papaparse";
import type { ParsedTransaction } from "@/lib/import/types";
import { frDateToISO, cleanLabel } from "./util";

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

/** En-têtes attendus (export Bankin'). */
const REQUIRED_HEADERS = ["Date", "Libellé", "Montant"];

/**
 * Bankin' exporte selon la locale avec une tabulation OU un point-virgule
 * comme séparateur. On le déduit de la ligne d'en-tête (le caractère le plus
 * présent), avec repli sur la tabulation. La virgule n'est jamais candidate :
 * c'est le séparateur décimal des montants (« -15,98 »).
 */
function detectDelimiter(text: string): string {
  const nl = text.search(/\r?\n/);
  const header = nl === -1 ? text : text.slice(0, nl);
  const tabs = (header.match(/\t/g) ?? []).length;
  const semicolons = (header.match(/;/g) ?? []).length;
  return semicolons > tabs ? ";" : "\t";
}

/**
 * Montant Bankin' : décimales en virgule, signe optionnel, séparateur de
 * milliers en espace (ou point). Ex. "-15,98", "1 234,56", "-5", "1.234,56".
 */
function parseBankinAmount(s: string): number {
  let v = s.replace(/[\s €]/g, "");
  if (v.includes(",")) {
    v = v.replace(/\./g, "").replace(",", ".");
  }
  return parseFloat(v);
}

export interface BankinCsvResult {
  transactions: ParsedTransaction[];
  /** true si les colonnes attendues sont absentes (mauvais format). */
  unrecognized: boolean;
}

/**
 * Parse un export CSV/TSV Bankin' en transactions.
 * La catégorie et le compte du fichier sont ignorés : la destination est
 * choisie dans l'UI et la catégorisation passe par les règles de l'app.
 */
export function parseBankinCsv(text: string): BankinCsvResult {
  const trimmed = text.trim();
  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    delimiter: detectDelimiter(trimmed),
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const fields = parsed.meta.fields ?? [];
  const hasHeaders = REQUIRED_HEADERS.every((h) => fields.includes(h));
  if (!hasHeaders) return { transactions: [], unrecognized: true };

  const out: ParsedTransaction[] = [];
  for (const row of parsed.data) {
    const date = (row["Date"] ?? "").trim();
    const label = cleanLabel(row["Libellé"] ?? "");
    const amountRaw = (row["Montant"] ?? "").trim();
    if (!DATE_RE.test(date) || !label || !amountRaw) continue;

    const amount = parseBankinAmount(amountRaw);
    if (!Number.isFinite(amount)) continue;

    // Pivot de compte : « Nom de la connexion », repli sur « Nom du compte ».
    const connection =
      (row["Nom de la connexion"] ?? "").trim() ||
      (row["Nom du compte"] ?? "").trim() ||
      null;

    out.push({
      operation_date: frDateToISO(date),
      value_date: null,
      label: label.slice(0, 200),
      raw_label: label,
      amount,
      currency: "EUR",
      connection_name: connection,
    });
  }

  return { transactions: out, unrecognized: false };
}
