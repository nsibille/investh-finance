import { normalizeLabel } from "@/lib/import/dedup";

export interface PlannedInstallment {
  month: string; // YYYY-MM-01
  amount: number;
  label: string | null;
}

/** "YYYY-MM" | "YYYY-MM-DD" → [year, month1..12]. */
function parseMonth(s: string): [number, number] {
  const [y, m] = s.slice(0, 7).split("-").map(Number);
  return [y, m];
}

/**
 * Génère `count` mensualités mensuelles à partir de `startMonth`, chacune du
 * même montant (et libellé attendu). `count` = 0 → aucune (achat direct).
 */
export function generateInstallments(opts: {
  startMonth: string;
  count: number;
  amount: number;
  label?: string | null;
}): PlannedInstallment[] {
  const [year, month] = parseMonth(opts.startMonth);
  const out: PlannedInstallment[] = [];
  for (let i = 0; i < opts.count; i++) {
    const total = month - 1 + i;
    const y = year + Math.floor(total / 12);
    const m = (total % 12) + 1;
    out.push({
      month: `${y}-${String(m).padStart(2, "0")}-01`,
      amount: opts.amount,
      label: opts.label ?? null,
    });
  }
  return out;
}

/**
 * Occurrence 1-based d'une mensualité (mois `month`) par rapport au mois de
 * départ de l'achat (`startMonth`) : ex. juillet pour un achat démarré en mai
 * → 3. Accepte "YYYY-MM" ou "YYYY-MM-DD".
 */
export function installmentOccurrence(startMonth: string, month: string): number {
  const [ys, ms] = parseMonth(startMonth);
  const [y, m] = parseMonth(month);
  return (y - ys) * 12 + (m - ms) + 1;
}

/** "YYYY-MM" (+ n mois) → "YYYY-MM". n peut être négatif. */
export function addMonthsToYM(ym: string, n: number): string {
  const [y, m] = parseMonth(ym);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12 + 12) % 12;
  return `${ny}-${String(nm + 1).padStart(2, "0")}`;
}

/**
 * Liste les mois "YYYY-MM-01" de `startMonth` à `endMonth` inclus. Renvoie []
 * si start > end. Borné par `cap` (garde-fou anti-emballement).
 */
export function enumerateMonths(
  startMonth: string,
  endMonth: string,
  cap = 600,
): string[] {
  const [ys, ms] = parseMonth(startMonth);
  const [ye, me] = parseMonth(endMonth);
  const start = ys * 12 + (ms - 1);
  const end = ye * 12 + (me - 1);
  const out: string[] = [];
  for (let t = start; t <= end && out.length < cap; t++) {
    const y = Math.floor(t / 12);
    const m = (t % 12) + 1;
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
  }
  return out;
}

export interface MatchableInstallment {
  id: string;
  month: string;
  amount: number;
  label: string | null;
}

export interface MatchableTx {
  id: string;
  operation_date: string;
  amount: number;
  raw_label: string;
}

const ym = (d: string) => d.slice(0, 7);

/**
 * Apparie chaque mensualité non réglée à une transaction : même mois, même
 * montant (en valeur absolue), et — si la mensualité a un libellé attendu — le
 * libellé de la transaction le contient. Appariement glouton, 1-pour-1.
 */
export function matchInstallmentsToTransactions(
  installments: MatchableInstallment[],
  transactions: MatchableTx[],
): { installmentId: string; transactionId: string }[] {
  const used = new Set<string>();
  const pairs: { installmentId: string; transactionId: string }[] = [];

  for (const inst of installments) {
    const wantMonth = ym(inst.month);
    const wantAmount = Math.abs(inst.amount).toFixed(2);
    const wantLabel = inst.label ? normalizeLabel(inst.label) : null;

    const match = transactions.find(
      (t) =>
        !used.has(t.id) &&
        ym(t.operation_date) === wantMonth &&
        Math.abs(t.amount).toFixed(2) === wantAmount &&
        (!wantLabel || normalizeLabel(t.raw_label).includes(wantLabel)),
    );
    if (match) {
      used.add(match.id);
      pairs.push({ installmentId: inst.id, transactionId: match.id });
    }
  }

  return pairs;
}
