import { startOfMonth, endOfMonth, subMonths, addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCategoryDisplayMap } from "@/lib/transactions/queries";
import { normalizeText } from "@/lib/search/filter";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Nom (normalisé) de la catégorie des débits différés (règlement mensuel de
 * carte) : ces opérations consolident des achats déjà comptés, on les exclut de
 * la trésorerie pour ne pas compter deux fois. */
const DEFERRED_CATEGORY = "debit differe";

export interface TreasuryPoint {
  date: string; // YYYY-MM-DD
  balance: number;
}

export interface TreasuryResult {
  /** Solde global jour par jour sur la fenêtre (jusqu'à aujourd'hui). */
  points: TreasuryPoint[];
  /** Solde global consolidé à ce jour (somme des comptes). */
  total: number;
  /** Date du dernier point (aujourd'hui, ou fin de fenêtre si passée). */
  asOf: string;
}

/**
 * Série de trésorerie consolidée (solde global de tous les comptes) au jour le
 * jour sur la fenêtre choisie. Ancrée sur le solde consolidé à ce jour, puis
 * déroulée en arrière via les flux journaliers.
 *
 * Prend TOUTES les transactions validées qui composent les soldes (donc y
 * compris virements externes ; les virements internes se compensent au global).
 * Seules sont exclues les transactions antérieures à l'ancre de leur compte
 * (non comptées dans le solde). Les cartes à débit différé devront être exclues
 * ici dès qu'un moyen de les identifier existera.
 */
export async function getTreasurySeries(
  ref: Date,
  zoom: string | null,
  months = 12,
): Promise<TreasuryResult> {
  const supabase = await createClient();
  const todayIso = iso(ref);
  const windowStart = zoom
    ? new Date(`${zoom}-01T00:00:00`)
    : startOfMonth(subMonths(ref, months - 1));
  const windowEnd = zoom
    ? endOfMonth(new Date(`${zoom}-01T00:00:00`))
    : endOfMonth(ref);
  const startIso = iso(windowStart);
  const drawEndIso = iso(windowEnd) < todayIso ? iso(windowEnd) : todayIso;

  const [{ data: balances }, { data: accts }, { data: rebases }, categories] =
    await Promise.all([
      supabase.from("account_balances").select("current_balance"),
      supabase.from("accounts").select("id, initial_date").eq("is_archived", false),
      supabase.from("account_rebases").select("account_id, rebase_date"),
      getCategoryDisplayMap(),
    ]);
  const total = (balances ?? []).reduce((s, b) => s + Number(b.current_balance), 0);

  // Sous-catégories « Débit différé » à exclure des flux (double comptage).
  const deferredSubIds = new Set<string>();
  for (const [subId, d] of categories)
    if (normalizeText(d.categoryName) === DEFERRED_CATEGORY) deferredSubIds.add(subId);

  // Date d'ancre effective par compte (solde initial ou dernier rebasement).
  const anchorDate = new Map<string, string>();
  for (const a of accts ?? []) anchorDate.set(a.id, a.initial_date);
  for (const r of rebases ?? []) {
    const cur = anchorDate.get(r.account_id);
    if (cur && r.rebase_date > cur) anchorDate.set(r.account_id, r.rebase_date);
  }

  // Flux journaliers validés comptés dans le solde (postérieurs à l'ancre du
  // compte), de la fenêtre à aujourd'hui. Parcouru par tranches.
  const flowByDay = new Map<string, number>();
  const CHUNK = 1000;
  let offset = 0;
  for (;;) {
    const { data } = await supabase
      .from("transactions")
      .select("account_id, operation_date, amount, subcategory_id")
      .eq("status", "validated")
      .gte("operation_date", startIso)
      .lte("operation_date", todayIso)
      .order("id", { ascending: true })
      .range(offset, offset + CHUNK - 1);
    const rows = (data ?? []) as {
      account_id: string;
      operation_date: string;
      amount: number;
      subcategory_id: string | null;
    }[];
    for (const t of rows) {
      const ad = anchorDate.get(t.account_id);
      if (ad && t.operation_date <= ad) continue; // pré-ancre : hors solde
      if (t.subcategory_id && deferredSubIds.has(t.subcategory_id)) continue; // débit différé
      flowByDay.set(
        t.operation_date,
        (flowByDay.get(t.operation_date) ?? 0) + Number(t.amount),
      );
    }
    if (rows.length < CHUNK) break;
    offset += CHUNK;
  }

  // Solde en début de fenêtre = solde d'aujourd'hui − tous les flux de la fenêtre.
  const totalFlow = [...flowByDay.values()].reduce((s, v) => s + v, 0);
  const base = total - totalFlow;

  const points: TreasuryPoint[] = [];
  let cum = 0;
  for (let d = new Date(windowStart); iso(d) <= drawEndIso; d = addDays(d, 1)) {
    cum += flowByDay.get(iso(d)) ?? 0;
    points.push({ date: iso(d), balance: Math.round((base + cum) * 100) / 100 });
  }

  return { points, total, asOf: drawEndIso };
}
