import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getCategoryDisplayMap } from "@/lib/transactions/queries";
import {
  internalTransferSubIds,
  isLinkedInternalTransfer,
} from "@/lib/transactions/internalTransfers";
import type { DashTx } from "@/lib/dashboard/analysis";
import type {
  EntityStats,
  EntityMonthlyPoint,
  EntityDailyPoint,
  EntityTxn,
  EntitySlice,
} from "@/lib/stats/entity";
import type { CategoryDisplay } from "@/lib/transactions/types";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Agrégat d'une catégorie ou sous-catégorie sur la fenêtre choisie. */
export interface CategoryStat {
  /** Total signé des transactions validées (revenus +, dépenses −). */
  total: number;
  count: number;
  /** 10 plus grosses opérations (par magnitude) de la portée. */
  top: DashTx[];
}

export interface CategoryStatsResult {
  /** Stats par sous-catégorie (id de sous-catégorie). */
  bySub: Record<string, CategoryStat>;
  /** Stats par catégorie (id de catégorie) — cumul de ses sous-catégories. */
  byCat: Record<string, CategoryStat>;
  months: string[]; // 12 clés YYYY-MM
  monthLabels: string[];
  zoom: string | null;
  /** Bornes ISO de la fenêtre (pour le drill-down vers le listing). */
  from: string;
  to: string;
}

interface TxAcc {
  total: number;
  count: number;
  txs: DashTx[];
}

/** 10 plus grosses opérations par magnitude. */
function topTen(txs: DashTx[]): DashTx[] {
  return [...txs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10);
}

/**
 * Statistiques par catégorie et sous-catégorie sur une fenêtre temporelle :
 * année glissante (12 mois) par défaut, ou un mois précis (`zoom`). Total signé,
 * nombre d'opérations et top 10 par nœud. Fenêtré sur `accounting_date` pour
 * coller exactement au listing filtré (date de rattachement des revenus).
 */
export async function getCategoryStats(
  ref: Date,
  zoom: string | null = null,
  months = 12,
): Promise<CategoryStatsResult> {
  const supabase = await createClient();

  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++)
    monthKeys.push(format(subMonths(ref, months - 1 - i), "yyyy-MM"));
  const monthLabels = monthKeys.map((k) =>
    format(new Date(`${k}-01`), "LLL", { locale: fr }),
  );

  const from = zoom ? `${zoom}-01` : iso(startOfMonth(subMonths(ref, months - 1)));
  const to = iso(
    zoom ? endOfMonth(new Date(`${zoom}-01T00:00:00`)) : endOfMonth(ref),
  );

  const [{ data }, categories, { data: merchantsData }, { data: purchasesData }, { data: recurringData }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id, amount, subcategory_id, transfer_group_id, operation_date, label, raw_label, merchant_id, purchase_id, recurring_pattern_id",
        )
        .eq("status", "validated")
        .gte("accounting_date", from)
        .lte("accounting_date", to)
        .not("subcategory_id", "is", null),
      getCategoryDisplayMap(),
      supabase.from("merchants").select("id, name"),
      supabase.from("purchases").select("id, name"),
      supabase.from("recurring_patterns").select("id, name"),
    ]);

  const merchantName = new Map((merchantsData ?? []).map((m) => [m.id, m.name]));
  const purchaseName = new Map((purchasesData ?? []).map((p) => [p.id, p.name]));
  const recurringName = new Map((recurringData ?? []).map((r) => [r.id, r.name]));

  // Virements internes reliés : neutralisés (simple déplacement entre comptes).
  const internalIds = internalTransferSubIds(categories);

  const subAcc = new Map<string, TxAcc>();
  for (const t of data ?? []) {
    const subId = t.subcategory_id;
    if (!subId) continue;
    if (isLinkedInternalTransfer(t, internalIds)) continue;
    const disp = categories.get(subId);
    if (!disp) continue;
    const acc = subAcc.get(subId) ?? { total: 0, count: 0, txs: [] };
    const amount = Number(t.amount);
    acc.total += amount;
    acc.count += 1;
    const rawSub = disp.subcategoryName;
    acc.txs.push({
      id: t.id,
      date: t.operation_date,
      label: (t.label && t.label.trim()) || t.raw_label,
      amount,
      categoryName: disp.categoryName,
      categoryColor: disp.color,
      subName: rawSub && rawSub !== "—" ? rawSub : null,
      merchant: t.merchant_id ? (merchantName.get(t.merchant_id) ?? null) : null,
      purchase: t.purchase_id ? (purchaseName.get(t.purchase_id) ?? null) : null,
      recurring: t.recurring_pattern_id
        ? (recurringName.get(t.recurring_pattern_id) ?? null)
        : null,
    });
    subAcc.set(subId, acc);
  }

  const bySub: Record<string, CategoryStat> = {};
  const catAcc = new Map<string, TxAcc>();
  for (const [subId, acc] of subAcc) {
    bySub[subId] = { total: acc.total, count: acc.count, top: topTen(acc.txs) };
    const catId = categories.get(subId)?.categoryId;
    if (!catId) continue;
    const c = catAcc.get(catId) ?? { total: 0, count: 0, txs: [] };
    c.total += acc.total;
    c.count += acc.count;
    c.txs.push(...acc.txs);
    catAcc.set(catId, c);
  }

  const byCat: Record<string, CategoryStat> = {};
  for (const [catId, c] of catAcc)
    byCat[catId] = { total: c.total, count: c.count, top: topTen(c.txs) };

  return { bySub, byCat, months: monthKeys, monthLabels, zoom, from, to };
}

/** Décrémente un "YYYY-MM" de `n` mois. */
function subtractMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) - n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
/** Nb de mois entre deux "YYYY-MM" inclus (≥ 1). */
function monthSpanC(first: string, last: string): number {
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  return Math.max(1, (ly - fy) * 12 + (lm - fm) + 1);
}
function pctC(cur: number, prev: number): number | null {
  return prev <= 0.005 ? null : ((cur - prev) / prev) * 100;
}

/**
 * Statistiques DÉTAILLÉES d'une catégorie, au format générique `EntityStats` —
 * strictement le même modèle que `getMerchantStats`, pour être rendu par le même
 * composant. L'entité est la catégorie ; son parent est le TYPE ; ses enfants
 * sont ses sous-catégories. Le sens du flux suit le type (revenu vs dépense).
 */
export async function getCategoryDetailStats(
  categoryId: string,
  refMonth: string,
  zoomMonth: string | null = null,
): Promise<EntityStats | null> {
  const supabase = await createClient();
  const categories = await getCategoryDisplayMap();

  // Sous-catégories de la catégorie + un display représentatif (nom, couleur,
  // type). Sous-catégories du type pour le parent.
  const subIds: string[] = [];
  const typeSubIds: string[] = [];
  let rep: CategoryDisplay | null = null;
  for (const d of categories.values()) {
    if (d.categoryId === categoryId) {
      subIds.push(d.subcategory_id);
      if (!rep) rep = d;
    }
  }
  if (!rep || subIds.length === 0) return null;
  const repDisplay = rep;
  for (const d of categories.values())
    if (d.typeSlug === repDisplay.typeSlug) typeSubIds.push(d.subcategory_id);

  const isIncome = repDisplay.isIncome;
  const flowOf = (amount: number): number =>
    isIncome ? Math.max(0, amount) : Math.max(0, -amount);

  const firstMonthKey = subtractMonths(refMonth, 11);
  const windowStartIso = `${firstMonthKey}-01`;
  const windowEndIso = format(endOfMonth(new Date(`${refMonth}-01T00:00:00`)), "yyyy-MM-dd");

  const [{ data: txs }, { count: purchaseCount }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount, operation_date, subcategory_id, label, raw_label, status")
      .in("subcategory_id", subIds)
      .neq("status", "ignored"),
    supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .in("subcategory_id", subIds),
  ]);

  const rows = (txs ?? []) as {
    id: string;
    amount: number;
    operation_date: string;
    subcategory_id: string | null;
    label: string | null;
    raw_label: string | null;
  }[];

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(subtractMonths(refMonth, i));
  const monthLabels = months.map((k) => format(new Date(`${k}-01`), "LLL", { locale: fr }));
  const monthIndex = new Map(months.map((m, i) => [m, i]));
  if (zoomMonth && !monthIndex.has(zoomMonth)) zoomMonth = null;

  // Répartition enfants = par SOUS-catégorie (nom précis, couleur de la catégorie).
  const subSlice = (map: Map<string, EntitySlice>, subId: string | null, flow: number) => {
    const disp = subId ? categories.get(subId) : null;
    const raw = disp?.subcategoryName;
    const label = raw && raw !== "—" ? raw : "(défaut)";
    const key = subId ?? "__none__";
    const slice = map.get(key) ?? { key, label, color: disp?.color ?? repDisplay.color, amount: 0, count: 0 };
    slice.amount += flow;
    slice.count += 1;
    map.set(key, slice);
  };

  let total = 0;
  let counterTotal = 0;
  let mainCount = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  let maxFlow: { amount: number; date: string } | null = null;
  const monthAmount = new Array(12).fill(0) as number[];
  const monthCount = new Array(12).fill(0) as number[];
  const byAll = new Map<string, EntitySlice>();

  for (const t of rows) {
    const amount = Number(t.amount);
    const flow = flowOf(amount);
    total += flow;
    counterTotal += Math.abs(amount) - flow;
    if (flow > 0) mainCount += 1;
    if (!firstDate || t.operation_date < firstDate) firstDate = t.operation_date;
    if (!lastDate || t.operation_date > lastDate) lastDate = t.operation_date;
    if (flow > 0 && (!maxFlow || flow > maxFlow.amount)) maxFlow = { amount: flow, date: t.operation_date };
    if (flow > 0) {
      subSlice(byAll, t.subcategory_id, flow);
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

  const inScope = (d: string) => (zoomMonth ? d.slice(0, 7) === zoomMonth : d >= windowStartIso);
  const scopeRows = rows.filter((t) => inScope(t.operation_date));
  const scopeTotal = scopeRows.reduce((s, t) => s + flowOf(Number(t.amount)), 0);

  type Row = (typeof rows)[number];
  const toTxn = (t: Row): EntityTxn => {
    const disp = t.subcategory_id ? categories.get(t.subcategory_id) : null;
    const raw = disp?.subcategoryName;
    return {
      id: t.id,
      date: t.operation_date,
      label: (t.label && t.label.trim()) || t.raw_label || "—",
      amount: Number(t.amount),
      categoryLabel: raw && raw !== "—" ? raw : disp?.categoryName ?? null,
      categoryColor: disp?.color ?? null,
    };
  };
  const top10 = (txs: EntityTxn[]) =>
    [...txs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10);

  // Répartition par SOUS-catégorie sur la portée (enfant = sous-catégorie) : id + top.
  const scopeAcc = new Map<string, { slice: EntitySlice; txs: EntityTxn[] }>();
  for (const t of scopeRows) {
    const flow = flowOf(Number(t.amount));
    if (flow <= 0) continue;
    const disp = t.subcategory_id ? categories.get(t.subcategory_id) : null;
    const raw = disp?.subcategoryName;
    const id = t.subcategory_id ?? null;
    const key = id ?? "__none__";
    const acc = scopeAcc.get(key) ?? {
      slice: {
        key,
        id,
        label: raw && raw !== "—" ? raw : "(défaut)",
        color: disp?.color ?? repDisplay.color,
        amount: 0,
        count: 0,
      },
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

  let daily: EntityDailyPoint[] | null = null;
  if (zoomMonth) {
    const days = endOfMonth(new Date(`${zoomMonth}-01T00:00:00`)).getDate();
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

  const scopeTransactions: EntityTxn[] = [...scopeRows]
    .sort((a, b) => (a.operation_date < b.operation_date ? 1 : -1))
    .slice(0, 100)
    .map(toTxn);

  // Parent = TYPE : total + série mensuelle cumulée (fenêtre 12 mois).
  const merchantWindow = monthAmount.reduce((s, v) => s + v, 0);
  const weights: EntityStats["weights"] = [];
  const parents: EntityStats["parents"] = [];
  if (typeSubIds.length > 0) {
    const { data: typeTxs } = await supabase
      .from("transactions")
      .select("amount, operation_date")
      .in("subcategory_id", typeSubIds)
      .neq("status", "ignored")
      .gte("operation_date", windowStartIso)
      .lte("operation_date", windowEndIso);
    let typeTotal = 0;
    const typeMonthly = new Array(12).fill(0) as number[];
    for (const t of typeTxs ?? []) {
      const f = flowOf(Number(t.amount));
      if (f <= 0) continue;
      typeTotal += f;
      const idx = monthIndex.get(t.operation_date.slice(0, 7));
      if (idx != null) typeMonthly[idx] += f;
    }
    if (typeTotal > 0.005 && Math.abs(typeTotal - merchantWindow) > 0.005) {
      parents.push({ scope: "Type", label: repDisplay.typeName, monthly: typeMonthly });
      weights.push({
        scope: "Type",
        label: repDisplay.typeName,
        color: null,
        pct: (merchantWindow / typeTotal) * 100,
        total: typeTotal,
      });
    }
  }

  const activeMonths = monthAmount.filter((v) => v > 0.005).length;
  const runRate = activeMonths > 0 ? merchantWindow / activeMonths : 0;
  const recent3 = (monthAmount[9] + monthAmount[10] + monthAmount[11]) / 3;
  const prev3 = (monthAmount[6] + monthAmount[7] + monthAmount[8]) / 3;
  const projection: EntityStats["projection"] =
    activeMonths >= 2
      ? { runRate, nextMonth: recent3, year: runRate * 12, trendPct: pctC(recent3, prev3) }
      : null;

  const firstM = firstDate?.slice(0, 7) ?? null;
  const lastM = lastDate?.slice(0, 7) ?? null;
  const span = firstM && lastM ? monthSpanC(firstM, lastM) : 1;

  return {
    kind: "category",
    id: categoryId,
    name: repDisplay.categoryName,
    categoryLabel: repDisplay.typeName, // sous-titre = le type parent
    categoryColor: repDisplay.color,
    isOnline: false,
    country: null,
    isIncome,
    total,
    counterTotal,
    netAmount: rows.reduce((s, t) => s + Number(t.amount), 0),
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
    categories: [...byAll.values()].sort((a, b) => b.amount - a.amount),
    scopeCategories,
    breakdownTitle: "sous-catégorie",
    weights,
    parents,
    projection,
    nav: {
      manageHref: "/categories",
      manageLabel: "Gérer les catégories",
      listQuery: `category=${categoryId}`,
    },
  };
}

/**
 * Statistiques DÉTAILLÉES d'une SOUS-catégorie, au format générique `EntityStats`
 * (même composant). Parents = sa catégorie puis son type ; enfants = les
 * enseignes qui l'alimentent. Le sens du flux suit le type.
 */
export async function getSubcategoryDetailStats(
  subId: string,
  refMonth: string,
  zoomMonth: string | null = null,
): Promise<EntityStats | null> {
  const supabase = await createClient();
  const categories = await getCategoryDisplayMap();
  const rep = categories.get(subId);
  if (!rep) return null;

  const catSubIds: string[] = [];
  const typeSubIds: string[] = [];
  for (const d of categories.values()) {
    if (d.categoryId === rep.categoryId) catSubIds.push(d.subcategory_id);
    if (d.typeSlug === rep.typeSlug) typeSubIds.push(d.subcategory_id);
  }

  const isIncome = rep.isIncome;
  const flowOf = (a: number): number => (isIncome ? Math.max(0, a) : Math.max(0, -a));

  const firstMonthKey = subtractMonths(refMonth, 11);
  const windowStartIso = `${firstMonthKey}-01`;
  const windowEndIso = format(endOfMonth(new Date(`${refMonth}-01T00:00:00`)), "yyyy-MM-dd");

  const [{ data: txs }, { count: purchaseCount }, { data: merchantsData }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount, operation_date, merchant_id, label, raw_label, status")
      .eq("subcategory_id", subId)
      .neq("status", "ignored"),
    supabase.from("purchases").select("id", { count: "exact", head: true }).eq("subcategory_id", subId),
    supabase.from("merchants").select("id, name"),
  ]);

  const merchantName = new Map((merchantsData ?? []).map((m) => [m.id, m.name as string | null]));
  const rows = (txs ?? []) as {
    id: string;
    amount: number;
    operation_date: string;
    merchant_id: string | null;
    label: string | null;
    raw_label: string | null;
  }[];

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(subtractMonths(refMonth, i));
  const monthLabels = months.map((k) => format(new Date(`${k}-01`), "LLL", { locale: fr }));
  const monthIndex = new Map(months.map((m, i) => [m, i]));
  if (zoomMonth && !monthIndex.has(zoomMonth)) zoomMonth = null;

  const subName = rep.subcategoryName && rep.subcategoryName !== "—" ? rep.subcategoryName : null;

  let total = 0;
  let counterTotal = 0;
  let mainCount = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  let maxFlow: { amount: number; date: string } | null = null;
  const monthAmount = new Array(12).fill(0) as number[];
  const monthCount = new Array(12).fill(0) as number[];

  for (const t of rows) {
    const amount = Number(t.amount);
    const flow = flowOf(amount);
    total += flow;
    counterTotal += Math.abs(amount) - flow;
    if (flow > 0) mainCount += 1;
    if (!firstDate || t.operation_date < firstDate) firstDate = t.operation_date;
    if (!lastDate || t.operation_date > lastDate) lastDate = t.operation_date;
    if (flow > 0 && (!maxFlow || flow > maxFlow.amount)) maxFlow = { amount: flow, date: t.operation_date };
    if (flow > 0) {
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

  type Row = (typeof rows)[number];
  const toTxn = (t: Row): EntityTxn => ({
    id: t.id,
    date: t.operation_date,
    label: (t.label && t.label.trim()) || t.raw_label || "—",
    amount: Number(t.amount),
    categoryLabel: t.merchant_id ? merchantName.get(t.merchant_id) ?? null : null,
    categoryColor: null,
  });
  const top10 = (list: EntityTxn[]) =>
    [...list].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10);

  const inScope = (d: string) => (zoomMonth ? d.slice(0, 7) === zoomMonth : d >= windowStartIso);
  const scopeRows = rows.filter((t) => inScope(t.operation_date));
  const scopeTotal = scopeRows.reduce((s, t) => s + flowOf(Number(t.amount)), 0);

  // Répartition par ENSEIGNE sur la portée (enfant = enseigne).
  const scopeAcc = new Map<string, { slice: EntitySlice; txs: EntityTxn[] }>();
  for (const t of scopeRows) {
    const flow = flowOf(Number(t.amount));
    if (flow <= 0) continue;
    const id = t.merchant_id ?? null;
    const key = id ?? "__none__";
    const acc = scopeAcc.get(key) ?? {
      slice: {
        key,
        id,
        label: id ? merchantName.get(id) ?? "Enseigne" : "Sans enseigne",
        color: null,
        amount: 0,
        count: 0,
      },
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

  let daily: EntityDailyPoint[] | null = null;
  if (zoomMonth) {
    const days = endOfMonth(new Date(`${zoomMonth}-01T00:00:00`)).getDate();
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
      daily.push({ date: `${zoomMonth}-${String(d).padStart(2, "0")}`, day: d, amount: cur?.amount ?? 0, count: cur?.count ?? 0 });
    }
  }

  const scopeTransactions: EntityTxn[] = [...scopeRows]
    .sort((a, b) => (a.operation_date < b.operation_date ? 1 : -1))
    .slice(0, 100)
    .map(toTxn);

  // Parents : catégorie puis type (cumulés), fenêtre 12 mois.
  const subWindow = monthAmount.reduce((s, v) => s + v, 0);
  const weights: EntityStats["weights"] = [];
  const parents: EntityStats["parents"] = [];
  if (typeSubIds.length > 0) {
    const catSet = new Set(catSubIds);
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
      if (t.subcategory_id && catSet.has(t.subcategory_id)) {
        catTotal += f;
        if (idx != null) catMonthly[idx] += f;
      }
    }
    if (catTotal > 0.005 && Math.abs(catTotal - subWindow) > 0.005) {
      parents.push({ scope: "Catégorie", label: rep.categoryName, monthly: catMonthly });
      weights.push({ scope: "Catégorie", label: rep.categoryName, color: rep.color, pct: (subWindow / catTotal) * 100, total: catTotal });
    }
    if (typeTotal > 0.005 && Math.abs(typeTotal - catTotal) > 0.005) {
      parents.push({ scope: "Type", label: rep.typeName, monthly: typeMonthly });
      weights.push({ scope: "Type", label: rep.typeName, color: null, pct: (subWindow / typeTotal) * 100, total: typeTotal });
    }
  }

  const activeMonths = monthAmount.filter((v) => v > 0.005).length;
  const runRate = activeMonths > 0 ? subWindow / activeMonths : 0;
  const recent3 = (monthAmount[9] + monthAmount[10] + monthAmount[11]) / 3;
  const prev3 = (monthAmount[6] + monthAmount[7] + monthAmount[8]) / 3;
  const projection: EntityStats["projection"] =
    activeMonths >= 2 ? { runRate, nextMonth: recent3, year: runRate * 12, trendPct: pctC(recent3, prev3) } : null;

  const firstM = firstDate?.slice(0, 7) ?? null;
  const lastM = lastDate?.slice(0, 7) ?? null;
  const span = firstM && lastM ? monthSpanC(firstM, lastM) : 1;

  return {
    kind: "subcategory",
    id: subId,
    name: subName ?? `${rep.categoryName} (défaut)`,
    categoryLabel: rep.categoryName, // sous-titre = la catégorie parente
    categoryColor: rep.color,
    isOnline: false,
    country: null,
    isIncome,
    total,
    counterTotal,
    netAmount: rows.reduce((s, t) => s + Number(t.amount), 0),
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
    scopeTo: zoomMonth ? format(endOfMonth(new Date(`${zoomMonth}-01T00:00:00`)), "yyyy-MM-dd") : windowEndIso,
    monthly,
    scopeTotal,
    scopeCount: scopeRows.length,
    daily,
    scopeTransactions,
    categories: scopeCategories,
    scopeCategories,
    breakdownTitle: "enseigne",
    weights,
    parents,
    projection,
    nav: {
      manageHref: "/categories",
      manageLabel: "Gérer les catégories",
      listQuery: `subcategory=${subId}`,
    },
  };
}
