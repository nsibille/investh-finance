import { endOfMonth, format } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getCategoryDisplayMap } from "@/lib/transactions/queries";

export interface MerchantMonthlyPoint {
  month: string; // "YYYY-MM"
  /** Libellé court du mois (« janv. »). */
  label: string;
  year: number;
  amount: number; // flux principal du mois (positif)
  count: number; // nb d'opérations du flux principal ce mois
}

/** Point journalier (vue zoomée sur un mois) pour le look-through. */
export interface MerchantDailyPoint {
  date: string; // "YYYY-MM-DD"
  day: number; // 1..31
  amount: number; // flux principal du jour (positif)
  count: number;
}

/** Transaction condensée pour la liste look-through de la portée. */
export interface MerchantTxn {
  id: string;
  date: string; // "YYYY-MM-DD"
  label: string;
  amount: number; // signé
  categoryLabel: string | null;
  categoryColor: string | null;
}

export interface MerchantCategorySlice {
  key: string;
  label: string;
  color: string | null;
  amount: number; // flux principal cumulé (positif) sur la portée
  count: number;
}

/** Poids de l'enseigne dans un de ses parents (catégorie, type…) sur la fenêtre. */
export interface MerchantWeight {
  /** Niveau de parenté (« Catégorie », « Type »). */
  scope: string;
  /** Nom du parent. */
  label: string;
  /** Couleur du parent (pastille), si connue. */
  color: string | null;
  /** Poids de l'enseigne dans ce parent (%). */
  pct: number;
  /** Total du parent sur la fenêtre (flux principal). */
  total: number;
}

/** Projection simple basée sur l'année glissante (mois actifs). */
export interface MerchantProjection {
  /** Rythme mensuel (moyenne des mois actifs de la fenêtre). */
  runRate: number;
  /** Estimation du mois prochain (moyenne des 3 derniers mois). */
  nextMonth: number;
  /** Projection annualisée (rythme × 12). */
  year: number;
  /** Tendance : 3 derniers mois vs 3 précédents (%). */
  trendPct: number | null;
}

export interface MerchantStats {
  id: string;
  name: string;
  categoryId: string | null;
  categoryLabel: string | null;
  categoryColor: string | null;
  isOnline: boolean;
  country: string | null;
  /**
   * Enseigne de revenu : sa catégorie par défaut est d'un type « revenu » (ou, à
   * défaut de catégorie, son solde net est positif). Détermine le sens du flux
   * principal (crédits pour un revenu, débits pour une dépense) et les libellés.
   */
  isIncome: boolean;
  /**
   * Flux principal cumulé (valeur absolue, positif) — TOUTE la période d'activité :
   * dépenses pour une enseigne de dépense, revenus perçus pour un revenu.
   */
  total: number;
  /**
   * Flux inverse cumulé (positif) : remboursements/avoirs pour une enseigne de
   * dépense, sorties pour une enseigne de revenu.
   */
  counterTotal: number;
  /** Solde net (crédits − débits, signé). */
  netAmount: number;
  transactionCount: number;
  purchaseCount: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Plus grosse opération unique du flux principal et sa date. */
  maxFlow: { amount: number; date: string } | null;
  /** Moyenne mensuelle du flux principal sur la période d'activité. */
  avgMonthly: number;
  /** Panier moyen (flux principal / nb d'opérations du flux principal). */
  basket: number;
  /** Cadence : nombre moyen d'opérations par mois actif. */
  frequency: number;

  // ── Fenêtre / zoom (année glissante, comme le dashboard) ──
  /** 12 clés "YYYY-MM" (chronologique). */
  months: string[];
  /** Libellés courts alignés. */
  monthLabels: string[];
  /** Mois zoomé ("YYYY-MM") ou null = année glissante. */
  zoomMonth: string | null;
  scopeFrom: string; // ISO
  scopeTo: string; // ISO
  /** Série chronologique des 12 derniers mois (mois vides inclus). */
  monthly: MerchantMonthlyPoint[];

  // ── Portée (mois zoomé, sinon fenêtre 12 mois) ──
  /** Flux principal cumulé sur la portée. */
  scopeTotal: number;
  /** Nb total d'opérations (tous flux) sur la portée. */
  scopeCount: number;
  /** Série journalière du mois zoomé (null en vue année). */
  daily: MerchantDailyPoint[] | null;
  /** Opérations de la portée (signées), les plus récentes d'abord (cap 100). */
  scopeTransactions: MerchantTxn[];

  // ── Catégorie ──
  /** Répartition du flux principal par catégorie — TOUTE la période, décroissante. */
  categories: MerchantCategorySlice[];
  /** Répartition du flux principal par catégorie sur la portée, décroissante. */
  scopeCategories: MerchantCategorySlice[];
  /**
   * Poids de l'enseigne dans chacun de ses parents (catégorie directe, puis type)
   * sur la fenêtre 12 mois — du parent le plus proche au plus large.
   */
  weights: MerchantWeight[];
  /**
   * Séries mensuelles (12) des parents pour la ventilation sur le graphe : total
   * de la catégorie directe et du type par mois. `null` si l'enseigne n'a pas de
   * catégorie par défaut.
   */
  parentMonthly: {
    categoryName: string;
    typeName: string;
    category: number[];
    type: number[];
  } | null;

  // ── Projection ──
  projection: MerchantProjection | null;
}

/** Nombre de mois calendaires entre deux "YYYY-MM" inclus (≥ 1). */
function monthSpan(first: string, last: string): number {
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  return Math.max(1, (ly - fy) * 12 + (lm - fm) + 1);
}

/** Décrémente un "YYYY-MM" de `n` mois. */
function subtractMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) - n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Pourcentage de variation (null si base ~nulle). */
function pct(cur: number, prev: number): number | null {
  if (prev <= 0.005) return null;
  return ((cur - prev) / prev) * 100;
}

/**
 * Statistiques agrégées d'une enseigne pour le quick view (liste), la fiche
 * détail et son look-through. Le sens du flux dépend de la nature de l'enseigne :
 * débits pour une dépense, crédits pour un revenu (salaire…). La fenêtre est une
 * année glissante (12 mois) terminant à `refMonth` ; `zoomMonth`, s'il est fourni,
 * restreint la portée (totaux, catégories, liste, série journalière) à ce mois.
 */
export async function getMerchantStats(
  id: string,
  refMonth: string,
  zoomMonth: string | null = null,
): Promise<MerchantStats | null> {
  const supabase = await createClient();

  // Fenêtre année glissante : 12 mois terminant au mois de référence.
  const firstMonthKey = subtractMonths(refMonth, 11);
  const windowStartIso = `${firstMonthKey}-01`;
  const refDate = new Date(`${refMonth}-01T00:00:00`);
  const windowEndIso = format(endOfMonth(refDate), "yyyy-MM-dd");

  const [{ data: merchant }, { data: txs }, { count: purchaseCount }, categories] =
    await Promise.all([
      supabase
        .from("merchants")
        .select("id, name, subcategory_id, is_online, country")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("id, amount, operation_date, subcategory_id, label, raw_label, status")
        .eq("merchant_id", id)
        .neq("status", "ignored"),
      supabase
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", id),
      getCategoryDisplayMap(),
    ]);

  if (!merchant) return null;

  const rows = (txs ?? []) as {
    id: string;
    amount: number;
    operation_date: string;
    subcategory_id: string | null;
    label: string | null;
    raw_label: string | null;
  }[];

  // Sens de l'enseigne : type de sa catégorie par défaut (revenu vs dépense) ;
  // à défaut de catégorie, déduit du signe du solde net observé.
  const merchantDisplay = merchant.subcategory_id
    ? categories.get(merchant.subcategory_id)
    : null;
  const merchantCategoryId = merchantDisplay?.categoryId ?? null;
  const netAmount = rows.reduce((sum, t) => sum + Number(t.amount), 0);
  const isIncome = merchantDisplay?.isIncome ?? netAmount > 0;

  /** Flux principal (positif) d'une opération selon le sens de l'enseigne. */
  const flowOf = (amount: number): number =>
    isIncome ? Math.max(0, amount) : Math.max(0, -amount);

  // Fenêtre de mois (12) + index.
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(subtractMonths(refMonth, i));
  const monthLabels = months.map((k) =>
    format(new Date(`${k}-01`), "LLL", { locale: fr }),
  );
  const monthIndex = new Map(months.map((m, i) => [m, i]));
  // Zoom retenu seulement s'il tombe dans la fenêtre 12 mois affichée.
  if (zoomMonth && !monthIndex.has(zoomMonth)) zoomMonth = null;

  let total = 0;
  let counterTotal = 0;
  let mainCount = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  let maxFlow: { amount: number; date: string } | null = null;
  const monthAmount = new Array(12).fill(0) as number[];
  const monthCount = new Array(12).fill(0) as number[];
  const byCatAll = new Map<string, MerchantCategorySlice>();

  const catSlice = (
    map: Map<string, MerchantCategorySlice>,
    subId: string | null,
    flow: number,
  ) => {
    const disp = subId ? categories.get(subId) : null;
    const key = disp ? disp.categoryName : "__none__";
    const slice = map.get(key) ?? {
      key,
      label: disp?.categoryName ?? "Sans catégorie",
      color: disp?.color ?? null,
      amount: 0,
      count: 0,
    };
    slice.amount += flow;
    slice.count += 1;
    map.set(key, slice);
  };

  for (const t of rows) {
    const amount = Number(t.amount);
    const flow = flowOf(amount);
    total += flow;
    counterTotal += Math.abs(amount) - flow;
    if (flow > 0) mainCount += 1;

    if (!firstDate || t.operation_date < firstDate) firstDate = t.operation_date;
    if (!lastDate || t.operation_date > lastDate) lastDate = t.operation_date;
    if (flow > 0 && (!maxFlow || flow > maxFlow.amount)) {
      maxFlow = { amount: flow, date: t.operation_date };
    }

    if (flow > 0) {
      catSlice(byCatAll, t.subcategory_id, flow);
      const idx = monthIndex.get(t.operation_date.slice(0, 7));
      if (idx != null) {
        monthAmount[idx] += flow;
        monthCount[idx] += 1;
      }
    }
  }

  const monthly: MerchantMonthlyPoint[] = months.map((m, i) => ({
    month: m,
    label: monthLabels[i],
    year: Number(m.slice(0, 4)),
    amount: monthAmount[i],
    count: monthCount[i],
  }));

  // ── Portée : mois zoomé ou fenêtre entière ──
  const inScope = (isoDate: string) =>
    zoomMonth ? isoDate.slice(0, 7) === zoomMonth : isoDate >= windowStartIso;
  const scopeRows = rows.filter((t) => inScope(t.operation_date));
  const scopeTotal = scopeRows.reduce((s, t) => s + flowOf(Number(t.amount)), 0);

  // Répartition par catégorie sur la portée (flux principal).
  const byCatScope = new Map<string, MerchantCategorySlice>();
  for (const t of scopeRows) {
    const flow = flowOf(Number(t.amount));
    if (flow > 0) catSlice(byCatScope, t.subcategory_id, flow);
  }

  // Série journalière (mois zoomé uniquement) : un point par jour du mois.
  let daily: MerchantDailyPoint[] | null = null;
  if (zoomMonth) {
    const zDate = new Date(`${zoomMonth}-01T00:00:00`);
    const days = endOfMonth(zDate).getDate();
    const byDay = new Map<number, { amount: number; count: number }>();
    for (const t of scopeRows) {
      const flow = flowOf(Number(t.amount));
      if (flow <= 0) continue;
      const day = Number(t.operation_date.slice(8, 10));
      const cur = byDay.get(day) ?? { amount: 0, count: 0 };
      cur.amount += flow;
      cur.count += 1;
      byDay.set(day, cur);
    }
    daily = [];
    for (let d = 1; d <= days; d++) {
      const cur = byDay.get(d);
      daily.push({
        date: `${zoomMonth}-${String(d).padStart(2, "0")}`,
        day: d,
        amount: cur?.amount ?? 0,
        count: cur?.count ?? 0,
      });
    }
  }

  // Liste look-through de la portée (signée), plus récentes d'abord.
  const scopeTransactions: MerchantTxn[] = [...scopeRows]
    .sort((a, b) => (a.operation_date < b.operation_date ? 1 : -1))
    .slice(0, 100)
    .map((t) => {
      const disp = t.subcategory_id ? categories.get(t.subcategory_id) : null;
      return {
        id: t.id,
        date: t.operation_date,
        label: (t.label && t.label.trim()) || t.raw_label || "—",
        amount: Number(t.amount),
        categoryLabel: disp?.categoryName ?? null,
        categoryColor: disp?.color ?? null,
      };
    });

  // ── Poids relatif dans chaque parent (catégorie directe → type), fenêtre 12 mois ──
  // Une seule requête sur les sous-catégories du TYPE (le plus large des parents) :
  // la catégorie en étant un sous-ensemble, on en déduit les deux totaux en JS.
  const merchantWindow = monthAmount.reduce((s, v) => s + v, 0);
  const weights: MerchantWeight[] = [];
  // Séries mensuelles des parents (fenêtre 12 mois) : total de la catégorie et du
  // type par mois, pour montrer la ventilation de l'enseigne dans son parent.
  let parentMonthly: { categoryName: string; typeName: string; category: number[]; type: number[] } | null = null;
  if (merchantCategoryId && merchantDisplay) {
    const typeSubIds: string[] = [];
    const catSubIdSet = new Set<string>();
    for (const d of categories.values()) {
      if (d.typeSlug === merchantDisplay.typeSlug) typeSubIds.push(d.subcategory_id);
      if (d.categoryId === merchantCategoryId) catSubIdSet.add(d.subcategory_id);
    }
    if (typeSubIds.length > 0) {
      const { data: parentTxs } = await supabase
        .from("transactions")
        .select("amount, subcategory_id, operation_date")
        .in("subcategory_id", typeSubIds)
        .neq("status", "ignored")
        .gte("operation_date", windowStartIso)
        .lte("operation_date", windowEndIso);
      let catTotal = 0;
      let typeTotal = 0;
      const catMonthly = new Array(12).fill(0) as number[];
      const typeMonthly = new Array(12).fill(0) as number[];
      for (const t of parentTxs ?? []) {
        const f = flowOf(Number(t.amount));
        if (f <= 0) continue;
        typeTotal += f;
        const idx = monthIndex.get(t.operation_date.slice(0, 7));
        if (idx != null) typeMonthly[idx] += f;
        if (t.subcategory_id && catSubIdSet.has(t.subcategory_id)) {
          catTotal += f;
          if (idx != null) catMonthly[idx] += f;
        }
      }
      parentMonthly = {
        categoryName: merchantDisplay.categoryName,
        typeName: merchantDisplay.typeName,
        category: catMonthly,
        type: typeMonthly,
      };
      if (catTotal > 0.005) {
        weights.push({
          scope: "Catégorie",
          label: merchantDisplay.categoryName,
          color: merchantDisplay.color,
          pct: (merchantWindow / catTotal) * 100,
          total: catTotal,
        });
      }
      // Type : ajouté seulement s'il apporte une info distincte de la catégorie
      // (sinon la catégorie est la seule du type → poids identique).
      if (typeTotal > 0.005 && Math.abs(typeTotal - catTotal) > 0.005) {
        weights.push({
          scope: "Type",
          label: merchantDisplay.typeName,
          color: null,
          pct: (merchantWindow / typeTotal) * 100,
          total: typeTotal,
        });
      }
    }
  }

  // ── Projection (année glissante, mois actifs) ──
  const activeMonths = monthAmount.filter((v) => v > 0.005).length;
  const runRate = activeMonths > 0 ? merchantWindow / activeMonths : 0;
  const recent3 = (monthAmount[9] + monthAmount[10] + monthAmount[11]) / 3;
  const prev3 = (monthAmount[6] + monthAmount[7] + monthAmount[8]) / 3;
  const projection: MerchantProjection | null =
    activeMonths >= 2
      ? {
          runRate,
          nextMonth: recent3,
          year: runRate * 12,
          trendPct: pct(recent3, prev3),
        }
      : null;

  const firstM = firstDate?.slice(0, 7) ?? null;
  const lastM = lastDate?.slice(0, 7) ?? null;
  const span = firstM && lastM ? monthSpan(firstM, lastM) : 1;

  return {
    id: merchant.id,
    name: merchant.name ?? "",
    categoryId: merchantCategoryId,
    categoryLabel: merchantDisplay?.categoryName ?? null,
    categoryColor: merchantDisplay?.color ?? null,
    isOnline: merchant.is_online ?? false,
    country: merchant.country ?? null,
    isIncome,
    total,
    counterTotal,
    netAmount,
    transactionCount: rows.length,
    purchaseCount: purchaseCount ?? 0,
    firstDate,
    lastDate,
    maxFlow,
    avgMonthly: total / span,
    basket: mainCount > 0 ? total / mainCount : 0,
    frequency: activeMonths > 0 ? mainCount / activeMonths : 0,
    months,
    monthLabels,
    zoomMonth,
    scopeFrom: zoomMonth ? `${zoomMonth}-01` : windowStartIso,
    scopeTo: zoomMonth
      ? format(endOfMonth(new Date(`${zoomMonth}-01T00:00:00`)), "yyyy-MM-dd")
      : windowEndIso,
    monthly,
    scopeTotal,
    scopeCount: scopeRows.length,
    daily,
    scopeTransactions,
    categories: [...byCatAll.values()].sort((a, b) => b.amount - a.amount),
    scopeCategories: [...byCatScope.values()].sort((a, b) => b.amount - a.amount),
    weights,
    parentMonthly,
    projection,
  };
}
