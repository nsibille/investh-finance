import {
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getCategoryDisplayMap } from "@/lib/transactions/queries";
import { getPersonalAmountAdjustments } from "@/lib/persons/queries";
import { accountingMonth } from "./accounting";
import { segmentOf, type Segment } from "./segments";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Pourcentage de variation (null si base nulle). */
function pct(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** Transaction condensée pour les encarts « plus grosses opérations ». */
export interface DashTx {
  id: string;
  date: string;
  label: string;
  amount: number; // signé (ajusté des parts personnes)
  categoryName: string;
  categoryColor: string | null;
  /** Sous-catégorie précise (null si placeholder « — »). */
  subName: string | null;
  /** Enseigne rattachée. */
  merchant: string | null;
  /** Achat rattaché. */
  purchase: string | null;
  /** Récurrente rattachée. */
  recurring: string | null;
}

/** Point mensuel du graphe global (montants positifs par flux). */
export interface DashSeriesPoint {
  month: string; // YYYY-MM
  label: string; // « janv. »
  revenus: number;
  depenses: number; // fixes + variables
  investissements: number;
}

/** Décomposition d'une catégorie au sein d'un segment. */
export interface DashCategory {
  categoryId: string;
  name: string;
  color: string | null;
  total: number; // magnitude cumulée sur la portée (mois zoomé ou année)
  count: number;
  monthly: number[]; // magnitude par mois de la fenêtre (12), pour sparkline
  /** Variation du mois de référence vs mois précédent (%). */
  changePct: number | null;
  topTransactions: DashTx[]; // 10 plus grosses sur la portée
}

/** Analyse complète d'un segment (revenus / fixes / variables / investi). */
export interface DashSegment {
  key: Segment;
  total: number; // magnitude cumulée sur la portée
  count: number;
  monthly: number[]; // magnitude par mois de la fenêtre (12)
  avgMonthly: number; // moyenne mensuelle sur la fenêtre
  changePct: number | null; // segment : mois de réf vs précédent
  categories: DashCategory[]; // triées par total décroissant
  topTransactions: DashTx[]; // 10 plus grosses du segment sur la portée
  funFacts: string[];
}

export interface DashboardData {
  months: string[]; // 12 clés YYYY-MM
  monthLabels: string[];
  /** Mois zoomé (YYYY-MM) ou null = année glissante entière. */
  zoomMonth: string | null;
  /** Bornes ISO de la portée (mois zoomé ou fenêtre 12 mois) pour le drill-down. */
  scopeFrom: string;
  scopeTo: string;
  series: DashSeriesPoint[];
  totals: {
    revenus: number;
    fixes: number;
    variables: number;
    depenses: number; // fixes + variables
    investissements: number;
    solde: number; // revenus − dépenses − investissements
  };
  segments: Record<Segment, DashSegment>;
}

interface Rec {
  id: string;
  monthIdx: number;
  monthKey: string;
  amount: number; // signé, ajusté
  segment: Segment;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  subName: string | null;
  merchant: string | null;
  purchase: string | null;
  recurring: string | null;
  label: string;
  date: string;
}

/** Magnitude positive d'un enregistrement (revenus = +, dépenses/investi = −amount). */
const mag = (r: Rec): number => (r.segment === "revenus" ? r.amount : -r.amount);

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
function dmy(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** 10 plus grosses opérations (par magnitude) parmi une liste. */
function topTen(recs: Rec[]): DashTx[] {
  return [...recs]
    .sort((a, b) => mag(b) - mag(a))
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      date: r.date,
      label: r.label,
      amount: r.amount,
      categoryName: r.categoryName,
      categoryColor: r.categoryColor,
      subName: r.subName,
      merchant: r.merchant,
      purchase: r.purchase,
      recurring: r.recurring,
    }));
}

/**
 * Agrège tout ce dont le dashboard a besoin sur une année glissante (12 mois) :
 * série mensuelle 3 flux (revenus / dépenses / investissements), totaux, et pour
 * chaque segment sa décomposition par catégorie (mensuelle, variation, top 10) et
 * des « fun facts ». Le paramètre `zoomMonth` restreint les totaux / décompositions
 * / tops à un seul mois (la série reste sur 12 mois). Réutilise les règles
 * comptables du reste du dashboard : rattachement des revenus de fin de mois,
 * exclusion des virements et des remboursements, ajustement des parts personnes.
 */
export async function getDashboardData(
  ref: Date,
  zoomMonth: string | null = null,
  months = 12,
): Promise<DashboardData> {
  const supabase = await createClient();
  const monthEnd = endOfMonth(ref);
  const firstStart = startOfMonth(subMonths(ref, months - 1));

  const [
    { data },
    categories,
    { debtByTx, repaymentTxIds },
    { data: merchantsData },
    { data: purchasesData },
    { data: recurringData },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, operation_date, amount, subcategory_id, label, raw_label, merchant_id, purchase_id, recurring_pattern_id",
      )
      .eq("status", "validated")
      // Borne basse élargie : les revenus de fin de mois précédent basculent sur
      // le mois suivant (cf. accountingMonth) et doivent être captés.
      .gte("operation_date", iso(subDays(firstStart, 7)))
      .lte("operation_date", iso(monthEnd)),
    getCategoryDisplayMap(),
    getPersonalAmountAdjustments(),
    supabase.from("merchants").select("id, name"),
    supabase.from("purchases").select("id, name"),
    supabase.from("recurring_patterns").select("id, name"),
  ]);

  const merchantName = new Map((merchantsData ?? []).map((m) => [m.id, m.name]));
  const purchaseName = new Map((purchasesData ?? []).map((p) => [p.id, p.name]));
  const recurringName = new Map((recurringData ?? []).map((r) => [r.id, r.name]));

  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++)
    monthKeys.push(format(subMonths(ref, months - 1 - i), "yyyy-MM"));
  const monthIndex = new Map(monthKeys.map((m, i) => [m, i]));
  const monthLabels = monthKeys.map((k) =>
    format(new Date(`${k}-01`), "LLL", { locale: fr }),
  );

  const recs: Rec[] = [];
  for (const t of data ?? []) {
    const sub = t.subcategory_id ? categories.get(t.subcategory_id) : null;
    const seg = sub ? segmentOf(sub.typeSlug, sub.isIncome) : null;
    if (!seg) continue; // virements internes / non catégorisées
    if (repaymentTxIds.has(t.id)) continue; // remboursement : pas un revenu
    const key = accountingMonth(t.operation_date, seg === "revenus");
    const idx = monthIndex.get(key);
    if (idx == null) continue;
    const amount = Number(t.amount) + (debtByTx.get(t.id) ?? 0);
    const rawSub = sub!.subcategoryName;
    recs.push({
      id: t.id,
      monthIdx: idx,
      monthKey: key,
      amount,
      segment: seg,
      categoryId: sub!.categoryId,
      categoryName: sub!.categoryName,
      categoryColor: sub!.color,
      subName: rawSub && rawSub !== "—" ? rawSub : null,
      merchant: t.merchant_id ? (merchantName.get(t.merchant_id) ?? null) : null,
      purchase: t.purchase_id ? (purchaseName.get(t.purchase_id) ?? null) : null,
      recurring: t.recurring_pattern_id
        ? (recurringName.get(t.recurring_pattern_id) ?? null)
        : null,
      label: (t.label && t.label.trim()) || t.raw_label,
      date: t.operation_date,
    });
  }

  // Série mensuelle (toujours sur 12 mois).
  const series: DashSeriesPoint[] = monthKeys.map((m, i) => ({
    month: m,
    label: monthLabels[i],
    revenus: 0,
    depenses: 0,
    investissements: 0,
  }));
  for (const r of recs) {
    const s = series[r.monthIdx];
    if (r.segment === "revenus") s.revenus += r.amount;
    else if (r.segment === "investissements") s.investissements += -r.amount;
    else s.depenses += -r.amount;
  }

  // Portée : mois zoomé ou fenêtre entière.
  const refIdx = zoomMonth ? (monthIndex.get(zoomMonth) ?? months - 1) : months - 1;
  const inScope = (r: Rec) => (zoomMonth ? r.monthKey === zoomMonth : true);
  const scopeRecs = recs.filter(inScope);

  const totals = { revenus: 0, fixes: 0, variables: 0, depenses: 0, investissements: 0, solde: 0 };
  for (const r of scopeRecs) {
    if (r.segment === "revenus") totals.revenus += r.amount;
    else if (r.segment === "fixes") totals.fixes += -r.amount;
    else if (r.segment === "variables") totals.variables += -r.amount;
    else totals.investissements += -r.amount;
  }
  totals.depenses = totals.fixes + totals.variables;
  totals.solde = totals.revenus - totals.depenses - totals.investissements;

  const buildSegment = (key: Segment): DashSegment => {
    const all = recs.filter((r) => r.segment === key);
    const scoped = all.filter(inScope);

    const monthly = new Array(months).fill(0) as number[];
    for (const r of all) monthly[r.monthIdx] += mag(r);
    const activeMonths = monthly.filter((v) => v > 0.005).length || 1;
    const windowTotal = monthly.reduce((s, v) => s + v, 0);
    const changePct = refIdx > 0 ? pct(monthly[refIdx], monthly[refIdx - 1]) : null;

    // Regroupement par catégorie sur la portée.
    const byCat = new Map<string, Rec[]>();
    for (const r of scoped) {
      const list = byCat.get(r.categoryId) ?? [];
      list.push(r);
      byCat.set(r.categoryId, list);
    }
    const categoriesOut: DashCategory[] = [...byCat.entries()]
      .map(([categoryId, list]) => {
        const catMonthly = new Array(months).fill(0) as number[];
        for (const r of all)
          if (r.categoryId === categoryId) catMonthly[r.monthIdx] += mag(r);
        return {
          categoryId,
          name: list[0].categoryName,
          color: list[0].categoryColor,
          total: list.reduce((s, r) => s + mag(r), 0),
          count: list.length,
          monthly: catMonthly,
          changePct: refIdx > 0 ? pct(catMonthly[refIdx], catMonthly[refIdx - 1]) : null,
          topTransactions: topTen(list),
        };
      })
      .sort((a, b) => b.total - a.total);

    // Fun facts : catégorie n°1, plus grosse opération, hausse marquante.
    const funFacts: string[] = [];
    const top1 = categoriesOut[0];
    if (top1)
      funFacts.push(`Catégorie n°1 : ${top1.name} (${fmt(top1.total)}).`);
    const biggest = scoped.reduce<Rec | null>(
      (best, r) => (best && mag(best) >= mag(r) ? best : r),
      null,
    );
    if (biggest)
      funFacts.push(
        `Plus grosse opération : ${fmt(Math.abs(biggest.amount))} le ${dmy(biggest.date)} (${biggest.categoryName}).`,
      );
    const frequent = [...categoriesOut].sort((a, b) => b.count - a.count)[0];
    if (frequent && frequent.count > 1)
      funFacts.push(`La plus fréquente : ${frequent.name} (${frequent.count} opérations).`);
    const rising = categoriesOut
      .filter((c) => c.changePct != null && c.changePct >= 20)
      .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];
    if (rising)
      funFacts.push(
        `En hausse : ${rising.name} +${Math.round(rising.changePct!)}% vs mois précédent.`,
      );

    return {
      key,
      total: scoped.reduce((s, r) => s + mag(r), 0),
      count: scoped.length,
      monthly,
      avgMonthly: zoomMonth ? monthly[refIdx] : windowTotal / activeMonths,
      changePct,
      categories: categoriesOut,
      topTransactions: topTen(scoped),
      funFacts,
    };
  };

  return {
    months: monthKeys,
    monthLabels,
    zoomMonth,
    scopeFrom: zoomMonth ? `${zoomMonth}-01` : iso(firstStart),
    scopeTo: iso(zoomMonth ? endOfMonth(new Date(`${zoomMonth}-01T00:00:00`)) : monthEnd),
    series,
    totals,
    segments: {
      revenus: buildSegment("revenus"),
      fixes: buildSegment("fixes"),
      variables: buildSegment("variables"),
      investissements: buildSegment("investissements"),
    },
  };
}
