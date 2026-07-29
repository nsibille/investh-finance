import { startOfMonth, endOfMonth, subMonths, addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCategoryDisplayMap } from "@/lib/transactions/queries";
import {
  internalTransferSubIds,
  isLinkedInternalTransfer,
} from "@/lib/transactions/internalTransfers";
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
 * Reconstruit l'historique à partir des transactions : ancré sur le solde
 * consolidé d'aujourd'hui, déroulé en arrière via TOUTES les transactions
 * validées (virements externes inclus ; les internes se compensent au global).
 * Seuls les débits différés (règlement mensuel de carte) sont exclus pour ne
 * pas doubler les achats déjà comptés individuellement.
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

  const [{ data: balances }, categories] = await Promise.all([
    supabase.from("account_balances").select("current_balance"),
    getCategoryDisplayMap(),
  ]);
  const total = (balances ?? []).reduce((s, b) => s + Number(b.current_balance), 0);

  // Sous-catégories « Débit différé » à exclure des flux (double comptage).
  const deferredSubIds = new Set<string>();
  for (const [subId, d] of categories)
    if (normalizeText(d.categoryName) === DEFERRED_CATEGORY) deferredSubIds.add(subId);
  // Virements internes reliés : neutralisés (déplacement entre tes comptes, sans
  // effet sur le solde global — évite les faux creux/pics au jour le jour).
  const internalIds = internalTransferSubIds(categories);

  // Reconstruction de l'historique : on part du solde consolidé d'aujourd'hui
  // (les comptes sont ancrés à leur solde réel) et on déroule EN ARRIÈRE via
  // TOUTES les transactions validées (hors débit différé) — chaque jour du passé
  // vaut le solde d'aujourd'hui moins les opérations survenues depuis. Flux
  // journaliers de la fenêtre jusqu'à aujourd'hui, parcourus par tranches.
  const flowByDay = new Map<string, number>();
  const CHUNK = 1000;
  let offset = 0;
  for (;;) {
    const { data } = await supabase
      .from("transactions")
      .select("operation_date, amount, subcategory_id, transfer_group_id")
      .eq("status", "validated")
      .gte("operation_date", startIso)
      .lte("operation_date", todayIso)
      .order("id", { ascending: true })
      .range(offset, offset + CHUNK - 1);
    const rows = (data ?? []) as {
      operation_date: string;
      amount: number;
      subcategory_id: string | null;
      transfer_group_id: string | null;
    }[];
    for (const t of rows) {
      if (t.subcategory_id && deferredSubIds.has(t.subcategory_id)) continue; // débit différé
      if (isLinkedInternalTransfer(t, internalIds)) continue; // virement interne relié
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
