import type { ParsedTransaction } from "@/lib/import/types";
import { frDateToISO, cleanLabel, parseAmountDots } from "./util";

/**
 * SG statements don't expose the debit/credit column in extracted text, so the
 * direction is inferred from the operation wording. The import preview lets the
 * user verify before confirming.
 */
export function inferSgSign(label: string): 1 | -1 {
  const u = label.toUpperCase();
  if (/PR[ÉE]L[ÈE]VEMENT/.test(u)) return -1;
  if (/\bEMIS\b/.test(u)) return -1;
  if (/\bVIR\s+INST\s+RE\b|\bVIR\s+RECU\b|\bVIREMENT\s+RECU\b|\bVIR\s+RE\b|\bRECU\b/.test(u))
    return 1;
  if (/\bVIR\s+PERM\b/.test(u)) return -1;
  if (/\bPOUR:/.test(u)) return -1;
  if (/\bDE:/.test(u)) return 1;
  return -1;
}

function cleanBoilerplate(text: string): string {
  return text
    .replace(/N° ADEME[\s\S]*?RA426027/g, " ")
    .replace(/RELEVÉ DE COMPTE[\s\S]*?Page \d\/\d/g, " ")
    .replace(/Date Valeur Nature de l'opération Débit Crédit/g, " ")
    .replace(/SOLDE PRÉCÉDENT AU \d{2}\/\d{2}\/\d{4}\s+[\d.,]+/g, " ")
    .replace(/\*\*\* SOLDE AU[^*]*\*\*\*/g, " ")
    .replace(/suite >>>/g, " ");
}

export function parseSocieteGenerale(text: string): ParsedTransaction[] {
  const opsStart = text.indexOf("RELEVÉ DES OPÉRATIONS");
  const body = cleanBoilerplate(
    opsStart === -1 ? text : text.slice(opsStart),
  );
  const end = body.indexOf("TOTAUX DES MOUVEMENTS");
  const section = end === -1 ? body : body.slice(0, end);

  const re =
    /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d[\d.]*,\d{2})(?=\s+\d{2}\/\d{2}\/\d{4}|\s*$)/g;

  const out: ParsedTransaction[] = [];
  for (const m of section.matchAll(re)) {
    const label = cleanLabel(m[3]);
    if (/SOLDE|TOTAUX/i.test(label)) continue;
    const magnitude = parseAmountDots(m[4]);
    out.push({
      operation_date: frDateToISO(m[1]),
      value_date: frDateToISO(m[2]),
      label: label.slice(0, 200),
      raw_label: label,
      amount: inferSgSign(label) * magnitude,
      currency: "EUR",
    });
  }
  return out;
}
