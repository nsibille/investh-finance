import type { ParsedTransaction } from "@/lib/import/types";
import { frDateToISO, cleanLabel, parseAmountSpaces } from "./util";

const SKIP_MAIN = /solde|REGLEMENT CARTES DEBIT DIFFERE/i;

function slice(text: string, start: string, end?: string): string {
  const i = text.indexOf(start);
  if (i === -1) return "";
  const from = i + start.length;
  if (!end) return text.slice(from);
  const j = text.indexOf(end, from);
  return j === -1 ? text.slice(from) : text.slice(from, j);
}

/** Main account section: amounts already carry their sign (debit negative). */
function parseMain(text: string): ParsedTransaction[] {
  const section = slice(
    text,
    "Libellé de l'opération Débit Crédit",
    "Votre nouveau solde",
  );
  if (!section) return [];

  const re =
    /(\d{2}\/\d{2}\/\d{4})\s+(?:\d{2}\/\d{2}\/\d{4}\s+)?(.+?)\s+(-?\d{1,3}(?:\s\d{3})*,\d{2})\s*€/g;
  const out: ParsedTransaction[] = [];
  for (const m of section.matchAll(re)) {
    const label = cleanLabel(m[2]);
    if (SKIP_MAIN.test(label)) continue;
    out.push({
      operation_date: frDateToISO(m[1]),
      value_date: null,
      label: label.slice(0, 200),
      raw_label: label,
      amount: parseAmountSpaces(m[3]),
      currency: "EUR",
    });
  }
  return out;
}

/** Deferred-debit card section: positive amounts, sign inferred (AVOIR = credit). */
function parseCard(text: string): ParsedTransaction[] {
  const cardStart = text.indexOf("opérations en euros carte");
  if (cardStart === -1) return [];
  const headerEnd = text.indexOf("Débit Crédit", cardStart);
  if (headerEnd === -1) return [];
  const contentStart = headerEnd + "Débit Crédit".length;
  const totalIdx = text.indexOf("Total ", contentStart);
  const section = text.slice(
    contentStart,
    totalIdx === -1 ? undefined : totalIdx,
  );

  const re =
    /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(?:(\d{1,3}(?:\s\d{3})*,\d{2})\s*€|(\d{1,3}(?:\s\d{3})*,\d{2})\s*EUR\s*1EUR=0,000\s*EUR\s*(\d{1,3}(?:\s\d{3})*,\d{2}))/g;
  const out: ParsedTransaction[] = [];
  for (const m of section.matchAll(re)) {
    const label = cleanLabel(m[2]);
    const raw = m[3] ?? m[5];
    if (!raw) continue;
    const magnitude = parseAmountSpaces(raw);
    const isCredit = /AVOIR|REMBOURSEMENT/i.test(label);
    out.push({
      operation_date: frDateToISO(m[1]),
      value_date: null,
      label: label.slice(0, 200),
      raw_label: label,
      amount: isCredit ? magnitude : -magnitude,
      currency: "EUR",
    });
  }
  return out;
}

export function parseBforBank(text: string): ParsedTransaction[] {
  return [...parseMain(text), ...parseCard(text)];
}
