import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  getCategoryTree,
  INVESTMENT_TYPE_SLUG,
  TRANSFER_TYPE_SLUG,
} from "@/lib/categories/queries";
import { TYPE_SLUG } from "@/lib/dashboard/segments";
import { installmentOccurrence } from "@/lib/purchases/installments";
import type { TransactionShare } from "@/lib/persons/types";
import type {
  Transaction,
  TransactionRow,
  TransactionFilters,
  TransactionsPage,
  TransactionsSummary,
  SummaryType,
  TransactionFlow,
  CategoryDisplay,
  AccountDisplay,
} from "./types";

const DEFAULT_PER_PAGE = 50;

/** Colonnes réellement affichées : on évite de tirer `search_vector`, `dedup_hash`, etc. */
const LIST_COLUMNS =
  "id, account_id, subcategory_id, operation_date, value_date, label, raw_label, amount, currency, status, note, is_recurring, purchase_id, merchant_id, recurring_pattern_id, split_nature, transfer_group_id" as const;

/** Colonnes du détail : ajoute purchase_id, merchant_id, recurring_pattern_id. */
const DETAIL_COLUMNS =
  "id, account_id, subcategory_id, operation_date, value_date, label, raw_label, amount, currency, status, note, is_recurring, purchase_id, merchant_id, recurring_pattern_id" as const;

type TransactionRecord = Pick<
  Transaction,
  | "id"
  | "account_id"
  | "subcategory_id"
  | "operation_date"
  | "value_date"
  | "label"
  | "raw_label"
  | "amount"
  | "currency"
  | "status"
  | "note"
  | "is_recurring"
>;

/** Enregistrement de liste : base + relations résolues par `attachRelations`. */
type ListRecord = TransactionRecord & {
  purchase_id: string | null;
  merchant_id: string | null;
  recurring_pattern_id: string | null;
  split_nature: Transaction["split_nature"];
  transfer_group_id: string | null;
};

// Dérivé de l'arbre des catégories (mis en cache) : plus aucune requête
// dédiée, et memoïsé par requête pour être partagé entre les pages.
export const getCategoryDisplayMap = cache(async function getCategoryDisplayMap(): Promise<
  Map<string, CategoryDisplay>
> {
  const tree = await getCategoryTree();
  const out = new Map<string, CategoryDisplay>();
  for (const type of tree) {
    for (const cat of type.categories) {
      for (const sub of cat.subcategories) {
        out.set(sub.id, {
          subcategory_id: sub.id,
          subcategoryName: sub.name,
          categoryId: cat.id,
          categoryName: cat.name,
          typeName: type.name,
          typeSlug: type.slug,
          color: cat.color ?? type.color ?? null,
          isIncome: type.is_income,
        });
      }
    }
  }
  return out;
});

export const getAccountDisplayMap = cache(async function getAccountDisplayMap(): Promise<
  Map<string, AccountDisplay>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, name, color, type");
  return new Map(
    (data ?? []).map((a) => [
      a.id,
      { id: a.id, name: a.name, color: a.color, type: a.type },
    ]),
  );
});

function enrich(
  tx: TransactionRecord,
  accounts: Map<string, AccountDisplay>,
  categories: Map<string, CategoryDisplay>,
): TransactionRow {
  return {
    id: tx.id,
    operation_date: tx.operation_date,
    value_date: tx.value_date,
    label: tx.label,
    raw_label: tx.raw_label,
    amount: Number(tx.amount),
    currency: tx.currency,
    status: tx.status,
    note: tx.note,
    is_recurring: tx.is_recurring,
    subcategory_id: tx.subcategory_id,
    account: tx.account_id ? (accounts.get(tx.account_id) ?? null) : null,
    category: tx.subcategory_id
      ? (categories.get(tx.subcategory_id) ?? null)
      : null,
  };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** UUID nul : cible impossible pour forcer un `in` vide à ne rien matcher. */
const NO_MATCH_UUID = "00000000-0000-0000-0000-000000000000";

/** Sens du flux d'une catégorie (revenu / dépense / investissement), ou null
 * pour les catégories neutres (virements internes) et les non catégorisées. */
function flowOf(display: CategoryDisplay | null | undefined): TransactionFlow | null {
  if (!display) return null;
  if (display.isIncome) return "income";
  if (display.typeSlug === INVESTMENT_TYPE_SLUG) return "investment";
  if (display.typeSlug === TRANSFER_TYPE_SLUG) return null;
  return "expense";
}

/**
 * Type de catégorie agrégé pour le bandeau KPI, ou null pour les catégories
 * neutres (virements internes) et les non catégorisées. Distingue prélèvements
 * et frais fixes ; range toute dépense de type inconnu en « frais variables ».
 */
function summaryTypeOf(
  display: CategoryDisplay | null | undefined,
): SummaryType | null {
  if (!display) return null;
  if (display.isIncome) return "revenus";
  switch (display.typeSlug) {
    case TYPE_SLUG.prelevements:
      return "prelevements";
    case TYPE_SLUG.fraisFixes:
      return "fraisFixes";
    case INVESTMENT_TYPE_SLUG:
      return "investissements";
    case TRANSFER_TYPE_SLUG:
      return null;
    default:
      return "fraisVariables";
  }
}

/** Sous-catégories appartenant à un flux donné (pour filtrer le listing). */
async function flowSubcategoryIds(flow: TransactionFlow): Promise<string[]> {
  const map = await getCategoryDisplayMap();
  const ids: string[] = [];
  for (const [id, display] of map) if (flowOf(display) === flow) ids.push(id);
  return ids;
}

/**
 * Restriction de sous-catégories issue des filtres de drill-down (catégorie
 * et/ou types) : intersection quand les deux sont présents. `null` si aucun.
 */
async function subcategoryRestriction(
  filters: TransactionFilters,
): Promise<string[] | null> {
  if (!filters.categoryId && !filters.typeSlugs?.length) return null;
  const map = await getCategoryDisplayMap();
  const displays = [...map.values()];
  let ids: string[] | null = null;
  if (filters.categoryId) {
    ids = displays
      .filter((d) => d.categoryId === filters.categoryId)
      .map((d) => d.subcategory_id);
  }
  if (filters.typeSlugs?.length) {
    const wanted = new Set(filters.typeSlugs);
    const byType = displays
      .filter((d) => wanted.has(d.typeSlug))
      .map((d) => d.subcategory_id);
    ids = ids ? ids.filter((id) => byType.includes(id)) : byType;
  }
  return ids ?? [];
}

/**
 * Construit la requête `transactions` avec tous les prédicats de filtrage (mais
 * sans tri ni pagination). Partagé par le listing paginé et l'agrégat d'en-tête
 * pour garantir que les KPIs portent exactement sur le même jeu que la liste.
 * `flowIds` restreint aux sous-catégories d'un flux (revenu/dépense/investi).
 */
function filteredTransactionsQuery(
  supabase: SupabaseServerClient,
  columns: string,
  filters: TransactionFilters,
  opts: { restrictSubIds?: string[] | null; flowIds?: string[] | null } = {},
) {
  let query = supabase
    .from("transactions")
    .select(columns, { count: "exact" });

  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.subcategoryId)
    query = query.eq("subcategory_id", filters.subcategoryId);
  if (filters.merchantIds?.length)
    query = query.in("merchant_id", filters.merchantIds);
  if (filters.purchaseIds?.length)
    query = query.in("purchase_id", filters.purchaseIds);
  // Drill-down (catégorie / types) : restriction toujours appliquée.
  if (opts.restrictSubIds)
    query = query.in(
      "subcategory_id",
      opts.restrictSubIds.length ? opts.restrictSubIds : [NO_MATCH_UUID],
    );
  // Flux (revenu/dépense/investissement) : restreint aux sous-catégories du flux
  // (UUID nul si aucune, pour ne rien renvoyer plutôt que tout).
  if (opts.flowIds)
    query = query.in("subcategory_id", opts.flowIds.length ? opts.flowIds : [NO_MATCH_UUID]);
  // Montant filtré en valeur absolue : les dépenses sont stockées négatives, on
  // veut « entre 10 et 50 € » qu'il s'agisse d'un débit ou d'un crédit.
  const { amountMin: aMin, amountMax: aMax } = filters;
  if (aMin != null && aMax != null) {
    query = query.or(
      `and(amount.gte.${aMin},amount.lte.${aMax}),and(amount.gte.${-aMax},amount.lte.${-aMin})`,
    );
  } else if (aMin != null) {
    query = query.or(`amount.gte.${aMin},amount.lte.${-aMin}`);
  } else if (aMax != null) {
    query = query.gte("amount", -aMax).lte("amount", aMax);
  }
  // Filtrage par date de rattachement comptable (revenus de fin de mois → mois
  // suivant), pour rester raccord au dashboard.
  if (filters.from) query = query.gte("accounting_date", filters.from);
  if (filters.to) query = query.lte("accounting_date", filters.to);
  if (filters.search) {
    query = query.textSearch("search_vector", filters.search, {
      type: "websearch",
      config: "french",
    });
  }

  return query;
}

/**
 * Agrège le jeu filtré complet (toutes pages) pour l'en-tête du listing : un
 * total par TYPE de catégorie (revenus, prélèvements, frais fixes, frais
 * variables, investi ; classés par type, pas par signe, en valeur absolue),
 * plus le solde net budgétaire et le nombre d'opérations. Ignore volontairement
 * la sélection de type/flux pilotée par le bandeau KPI (`flow`, `typeSlugs`) :
 * les cartes filtrent la liste, l'agrégat reste une vue d'ensemble stable. Le
 * drill-down par catégorie reste pris en compte. Les opérations ignorées ne
 * comptent dans aucun total. Parcouru par tranches pour rester juste quel que
 * soit le nombre de lignes.
 */
export async function getTransactionsSummary(
  filters: TransactionFilters,
): Promise<TransactionsSummary> {
  const supabase = await createClient();
  const categories = await getCategoryDisplayMap();
  // Drill-down par catégorie conservé ; la sélection de type (cartes KPI) est
  // ignorée pour garder la vue d'ensemble stable quel que soit le type cliqué.
  const restrictSubIds = await subcategoryRestriction({
    categoryId: filters.categoryId,
  });
  const CHUNK = 1000;
  let offset = 0;
  let count = 0;
  const totals: Record<SummaryType, number> = {
    revenus: 0,
    prelevements: 0,
    fraisFixes: 0,
    fraisVariables: 0,
    investissements: 0,
  };

  for (;;) {
    // Tri stable (id) indispensable pour paginer sans doublon ni saut.
    const { data, count: c } = await filteredTransactionsQuery(
      supabase,
      "amount, status, subcategory_id",
      filters,
      { restrictSubIds },
    )
      .order("id", { ascending: true })
      .range(offset, offset + CHUNK - 1);

    if (c != null) count = c;
    const rows = (data ?? []) as unknown as {
      amount: number;
      status: string;
      subcategory_id: string | null;
    }[];
    for (const r of rows) {
      if (r.status === "ignored") continue;
      const amount = Number(r.amount);
      const type = summaryTypeOf(
        r.subcategory_id ? categories.get(r.subcategory_id) : null,
      );
      if (!type) continue;
      // Revenus stockés positifs, dépenses/investis négatifs : on agrège en
      // valeur absolue pour que chaque carte affiche un montant positif.
      totals[type] += type === "revenus" ? amount : -amount;
    }
    if (rows.length < CHUNK) break;
    offset += CHUNK;
  }

  return {
    count,
    totals,
    net:
      totals.revenus -
      totals.prelevements -
      totals.fraisFixes -
      totals.fraisVariables -
      totals.investissements,
  };
}

export async function getTransactionsPage(
  filters: TransactionFilters,
): Promise<TransactionsPage> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? DEFAULT_PER_PAGE;

  const [flowIds, restrictSubIds] = await Promise.all([
    filters.flow ? flowSubcategoryIds(filters.flow) : Promise.resolve(null),
    subcategoryRestriction(filters),
  ]);
  let query = filteredTransactionsQuery(supabase, LIST_COLUMNS, filters, {
    flowIds,
    restrictSubIds,
  });

  // Tri par date : on suit la date de rattachement comptable (raccord dashboard).
  switch (filters.sort) {
    case "date_asc":
      query = query.order("accounting_date", { ascending: true });
      break;
    case "amount_desc":
      query = query.order("amount", { ascending: false });
      break;
    case "amount_asc":
      query = query.order("amount", { ascending: true });
      break;
    default:
      query = query.order("accounting_date", { ascending: false });
  }
  query = query.order("created_at", { ascending: false });
  // Départage final : `operation_date`/`created_at` ne sont pas uniques (un
  // import insère tout un batch avec le même `created_at`). Sans clé unique en
  // dernier critère, Postgres renvoie les ex æquo dans un ordre arbitraire qui
  // peut varier entre deux requêtes. `id` (UUID) rend l'ordre déterministe.
  query = query.order("id", { ascending: false });
  query = query.range((page - 1) * perPage, page * perPage - 1);

  // Les maps de référence ne dépendent pas des lignes : on lance tout en parallèle.
  const [{ data, count }, accounts, categories] = await Promise.all([
    query,
    getAccountDisplayMap(),
    getCategoryDisplayMap(),
  ]);

  const records = (data ?? []) as unknown as ListRecord[];
  const rows = records.map((tx) => enrich(tx, accounts, categories));
  await attachRelations(supabase, records, rows);

  return {
    rows,
    total: count ?? 0,
    page,
    perPage,
  };
}

/**
 * Résout en lot, pour une page de transactions, les noms d'achat / enseigne /
 * récurrente et le résumé du partage entre personnes (nb + nature), afin que la
 * liste dispose du même niveau d'information que l'aperçu d'import.
 */
async function attachRelations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  records: {
    id: string;
    operation_date: string;
    purchase_id: string | null;
    merchant_id: string | null;
    recurring_pattern_id: string | null;
    split_nature: Transaction["split_nature"];
    transfer_group_id: string | null;
  }[],
  rows: TransactionRow[],
): Promise<void> {
  const uniq = (xs: (string | null)[]) =>
    [...new Set(xs.filter((x): x is string => Boolean(x)))];
  const purchaseIds = uniq(records.map((r) => r.purchase_id));
  const merchantIds = uniq(records.map((r) => r.merchant_id));
  const recurringIds = uniq(records.map((r) => r.recurring_pattern_id));
  const txWithSplit = records.filter((r) => r.split_nature).map((r) => r.id);
  const allIds = records.map((r) => r.id);

  const [purchases, merchants, recurrings, shares, repayments] = await Promise.all([
    purchaseIds.length
      ? supabase
          .from("purchases")
          .select(
            "id, name, is_recurring, recurrence_end, installments:purchase_installments(month)",
          )
          .in("id", purchaseIds)
      : Promise.resolve({ data: [] }),
    merchantIds.length
      ? supabase.from("merchants").select("id, name").in("id", merchantIds)
      : Promise.resolve({ data: [] }),
    recurringIds.length
      ? supabase.from("recurring_patterns").select("id, name").in("id", recurringIds)
      : Promise.resolve({ data: [] }),
    txWithSplit.length
      ? supabase
          .from("transaction_persons")
          .select(
            "transaction_id, share_amount, persons(id, name, is_self, color)",
          )
          .in("transaction_id", txWithSplit)
      : Promise.resolve({ data: [] }),
    allIds.length
      ? supabase
          .from("person_repayments")
          .select("transaction_id, persons(name)")
          .in("transaction_id", allIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Remboursements liés (crédit → nom de la personne remboursée) par transaction.
  const repaymentByTx = new Map<string, string>();
  for (const r of (repayments.data ?? []) as unknown as {
    transaction_id: string | null;
    persons: { name: string } | null;
  }[]) {
    if (r.transaction_id && r.persons)
      repaymentByTx.set(r.transaction_id, r.persons.name);
  }

  const nameMap = (data: { id: string; name: string }[] | null) =>
    new Map((data ?? []).map((x) => [x.id, x.name]));
  const merchantName = nameMap(merchants.data as { id: string; name: string }[]);
  const recurringName = nameMap(recurrings.data as { id: string; name: string }[]);

  // Achat : nom + mois d'échéancier (triés) + abonnement sans fin, pour dériver
  // l'occurrence X/Y par transaction (mois de l'opération vs mois de départ).
  const purchaseInfo = new Map(
    ((purchases.data ?? []) as {
      id: string;
      name: string;
      is_recurring: boolean;
      recurrence_end: string | null;
      installments: { month: string }[] | null;
    }[]).map((p) => [
      p.id,
      {
        name: p.name,
        months: (p.installments ?? [])
          .map((i) => i.month)
          .sort((a, b) => a.localeCompare(b)),
        endless: !!(p.is_recurring && !p.recurrence_end),
      },
    ]),
  );

  // Parts détaillées par transaction : sert au badge (nb) et au pré-remplissage
  // de l'éditeur de partage depuis la liste (personnes + montants).
  type ShareRecord = {
    transaction_id: string;
    share_amount: number;
    persons: {
      id: string;
      name: string;
      is_self: boolean;
      color: string;
    } | null;
  };
  const sharesByTx = new Map<string, TransactionShare[]>();
  for (const s of (shares.data ?? []) as unknown as ShareRecord[]) {
    const p = s.persons;
    if (!p) continue;
    const list = sharesByTx.get(s.transaction_id) ?? [];
    list.push({
      personId: p.id,
      name: p.name,
      isSelf: p.is_self,
      color: p.color,
      amount: Number(s.share_amount),
    });
    sharesByTx.set(s.transaction_id, list);
  }
  for (const list of sharesByTx.values()) {
    // « Moi » en premier, puis alphabétique (cohérent avec getSharesForTransaction).
    list.sort((a, b) =>
      a.isSelf === b.isSelf ? a.name.localeCompare(b.name) : a.isSelf ? -1 : 1,
    );
  }

  records.forEach((rec, i) => {
    const row = rows[i];
    const pInfo = rec.purchase_id ? purchaseInfo.get(rec.purchase_id) : null;
    if (rec.purchase_id && pInfo) {
      const startMonth = pInfo.months[0] ?? null;
      const txMonth = rec.operation_date.slice(0, 7);
      row.purchase = {
        id: rec.purchase_id,
        name: pInfo.name,
        occurrence: startMonth ? installmentOccurrence(startMonth, txMonth) : null,
        installmentTotal: pInfo.months.length,
        endless: pInfo.endless,
      };
    }
    if (rec.merchant_id && merchantName.has(rec.merchant_id)) {
      row.merchant = { id: rec.merchant_id, name: merchantName.get(rec.merchant_id)! };
    }
    if (rec.recurring_pattern_id && recurringName.has(rec.recurring_pattern_id)) {
      row.recurring = {
        id: rec.recurring_pattern_id,
        name: recurringName.get(rec.recurring_pattern_id)!,
      };
    }
    const shareList = sharesByTx.get(rec.id) ?? [];
    if (rec.split_nature && shareList.length > 0) {
      row.personsSummary = { count: shareList.length, nature: rec.split_nature };
      row.split = { nature: rec.split_nature, shares: shareList };
    }
    const repaidName = repaymentByTx.get(rec.id);
    if (repaidName) row.repayment = { personName: repaidName };
    // Virement interne apparié : rattaché à un groupe de réconciliation (net 0).
    if (rec.transfer_group_id) row.transferPaired = true;
  });
}

export async function getTransaction(
  id: string,
): Promise<TransactionRow | null> {
  const supabase = await createClient();
  const [{ data }, accounts, categories] = await Promise.all([
    supabase.from("transactions").select(DETAIL_COLUMNS).eq("id", id).maybeSingle(),
    getAccountDisplayMap(),
    getCategoryDisplayMap(),
  ]);
  if (!data) return null;
  const row = enrich(data, accounts, categories);
  if (data.purchase_id) {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id, name")
      .eq("id", data.purchase_id)
      .maybeSingle();
    if (purchase) row.purchase = { id: purchase.id, name: purchase.name };
  }
  if (data.merchant_id) {
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id, name")
      .eq("id", data.merchant_id)
      .maybeSingle();
    // Seules les enseignes nommées sont rattachées à une transaction.
    if (merchant?.name) row.merchant = { id: merchant.id, name: merchant.name };
  }
  if (data.recurring_pattern_id) {
    const { data: rec } = await supabase
      .from("recurring_patterns")
      .select("id, name")
      .eq("id", data.recurring_pattern_id)
      .maybeSingle();
    if (rec) row.recurring = { id: rec.id, name: rec.name };
  }
  return row;
}

export async function countPending(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
