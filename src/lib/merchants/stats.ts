import { endOfMonth, format } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getCategoryDisplayMap } from "@/lib/transactions/queries";

import type {
  EntityStats,
  EntityMonthlyPoint,
  EntityDailyPoint,
  EntityTxn,
  EntitySlice,
  EntityWeight,
  EntityParentSeries,
} from "@/lib/stats/entity";
import { computeProjection } from "@/lib/stats/projection";

/** Alias historique : la fiche enseigne partage le modèle générique `EntityStats`. */
export type MerchantStats = EntityStats;

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
  const byCatAll = new Map<string, EntitySlice>();

  const catSlice = (
    map: Map<string, EntitySlice>,
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

  const monthly: EntityMonthlyPoint[] = months.map((m, i) => ({
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

  // Opération condensée + top 10 par magnitude (aperçus).
  type Row = (typeof rows)[number];
  const toTxn = (t: Row): EntityTxn => {
    const disp = t.subcategory_id ? categories.get(t.subcategory_id) : null;
    return {
      id: t.id,
      date: t.operation_date,
      label: (t.label && t.label.trim()) || t.raw_label || "—",
      amount: Number(t.amount),
      categoryLabel: disp?.categoryName ?? null,
      categoryColor: disp?.color ?? null,
    };
  };
  const top10 = (txs: EntityTxn[]) =>
    [...txs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10);

  // Répartition par catégorie sur la portée (enfant = catégorie) : id + top 10.
  const scopeAcc = new Map<string, { slice: EntitySlice; txs: EntityTxn[] }>();
  for (const t of scopeRows) {
    const flow = flowOf(Number(t.amount));
    if (flow <= 0) continue;
    const disp = t.subcategory_id ? categories.get(t.subcategory_id) : null;
    const id = disp?.categoryId ?? null;
    const key = id ?? "__none__";
    const acc = scopeAcc.get(key) ?? {
      slice: { key, id, label: disp?.categoryName ?? "Sans catégorie", color: disp?.color ?? null, amount: 0, count: 0 },
      txs: [],
    };
    acc.slice.amount += flow;
    acc.slice.count += 1;
    acc.txs.push(toTxn(t));
    scopeAcc.set(key, acc);
  }
  const scopeCategories: EntitySlice[] = [...scopeAcc.values()]
    .map((a) => ({ ...a.slice, top: top10(a.txs) }))
    .sort((a, b) => b.amount - a.amount);

  // Série journalière (mois zoomé uniquement) : un point par jour du mois.
  let daily: EntityDailyPoint[] | null = null;
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
  const scopeTransactions: EntityTxn[] = [...scopeRows]
    .sort((a, b) => (a.operation_date < b.operation_date ? 1 : -1))
    .slice(0, 100)
    .map(toTxn);

  // ── Poids relatif dans chaque parent (catégorie directe → type), fenêtre 12 mois ──
  // Une seule requête sur les sous-catégories du TYPE (le plus large des parents) :
  // la catégorie en étant un sous-ensemble, on en déduit les deux totaux en JS.
  const merchantWindow = monthAmount.reduce((s, v) => s + v, 0);
  const weights: EntityWeight[] = [];
  // Séries mensuelles CUMULÉES des parents (fenêtre 12 mois) : catégorie puis type,
  // pour la ventilation de l'enseigne dans ses parents.
  const parents: EntityParentSeries[] = [];
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
      if (catTotal > 0.005) {
        parents.push({ scope: "Catégorie", label: merchantDisplay.categoryName, monthly: catMonthly });
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
        parents.push({ scope: "Type", label: merchantDisplay.typeName, monthly: typeMonthly });
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

  // ── Projection (mois complets, robuste aux primes) ──
  const activeMonths = monthAmount.filter((v) => v > 0.005).length;
  const projection = computeProjection(monthAmount);

  const firstM = firstDate?.slice(0, 7) ?? null;
  const lastM = lastDate?.slice(0, 7) ?? null;
  const span = firstM && lastM ? monthSpan(firstM, lastM) : 1;

  return {
    kind: "merchant",
    id: merchant.id,
    name: merchant.name ?? "",
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
    scopeCategories,
    breakdownTitle: "catégorie",
    weights,
    parents,
    projection,
    nav: {
      manageHref: "/enseignes",
      manageLabel: "Gérer les enseignes",
      listQuery: `merchant=${merchant.id}`,
    },
  };
}
