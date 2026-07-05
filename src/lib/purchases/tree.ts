// Helpers purs pour l'arborescence des achats (groupes). Un achat peut avoir un
// achat parent (« groupe »). Ces fonctions agrègent les montants sur le sous-arbre
// (self + descendants) et servent aussi à empêcher les rattachements invalides
// (auto-référence, cycle) côté client comme côté serveur.

/** Arête parent → enfant : un achat et son parent éventuel. */
export interface PurchaseEdge {
  id: string;
  parentId: string | null;
}

/** Montants propres à un achat (hors descendants). */
export interface PurchaseAmounts extends PurchaseEdge {
  paidAmount: number;
  transactionCount: number;
  forecastAmount: number;
  remaining: number;
}

/** Agrégats d'un achat sur son sous-arbre (self + descendants). */
export interface PurchaseRollup {
  /** Enfants directs (dans l'ordre d'apparition en entrée). */
  childIds: string[];
  /** Nombre de descendants (enfants + petits-enfants…). */
  descendantCount: number;
  totalPaidAmount: number;
  totalTransactionCount: number;
  totalForecastAmount: number;
  totalRemaining: number;
}

function buildChildrenMap(edges: PurchaseEdge[]): Map<string, string[]> {
  const ids = new Set(edges.map((e) => e.id));
  const children = new Map<string, string[]>();
  for (const e of edges) {
    // Parent inconnu (ex. filtré/archivé) → traité comme racine.
    if (e.parentId && ids.has(e.parentId) && e.parentId !== e.id) {
      const list = children.get(e.parentId) ?? [];
      list.push(e.id);
      children.set(e.parentId, list);
    }
  }
  return children;
}

/**
 * Ensemble des descendants (transitifs) d'un achat. Résiste aux cycles
 * (garde-fou via `seen`). Utilisé pour interdire de choisir un descendant comme
 * parent (créerait un cycle).
 */
export function descendantIdsOf(id: string, edges: PurchaseEdge[]): Set<string> {
  const children = buildChildrenMap(edges);
  const out = new Set<string>();
  const stack = [...(children.get(id) ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (out.has(cur) || cur === id) continue;
    out.add(cur);
    for (const c of children.get(cur) ?? []) stack.push(c);
  }
  return out;
}

/**
 * Un rattachement `id → newParentId` est-il valide ?
 * Invalide si : parent = soi-même, ou parent est un descendant de `id` (cycle).
 * `null` (détacher) est toujours valide.
 */
export function isValidParent(
  id: string,
  newParentId: string | null,
  edges: PurchaseEdge[],
): boolean {
  if (newParentId === null) return true;
  if (newParentId === id) return false;
  return !descendantIdsOf(id, edges).has(newParentId);
}

/**
 * Calcule les agrégats de sous-arbre pour chaque achat. Chaque transaction /
 * mensualité appartient à un seul achat de l'arbre : les totaux ne double-comptent
 * pas. Résiste aux cycles éventuels via un garde-fou sur le chemin courant.
 */
export function computeRollups(
  nodes: PurchaseAmounts[],
): Map<string, PurchaseRollup> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = buildChildrenMap(nodes);
  const memo = new Map<string, PurchaseRollup>();

  function visit(id: string, path: Set<string>): PurchaseRollup {
    const cached = memo.get(id);
    if (cached) return cached;
    const self = byId.get(id)!;
    const kids = children.get(id) ?? [];
    let totalPaidAmount = self.paidAmount;
    let totalTransactionCount = self.transactionCount;
    let totalForecastAmount = self.forecastAmount;
    let totalRemaining = self.remaining;
    let descendantCount = 0;
    const nextPath = new Set(path).add(id);
    for (const childId of kids) {
      if (path.has(childId)) continue; // garde-fou anti-cycle
      const r = visit(childId, nextPath);
      totalPaidAmount += r.totalPaidAmount;
      totalTransactionCount += r.totalTransactionCount;
      totalForecastAmount += r.totalForecastAmount;
      totalRemaining += r.totalRemaining;
      descendantCount += 1 + r.descendantCount;
    }
    const roll: PurchaseRollup = {
      childIds: kids,
      descendantCount,
      totalPaidAmount,
      totalTransactionCount,
      totalForecastAmount,
      totalRemaining,
    };
    memo.set(id, roll);
    return roll;
  }

  for (const n of nodes) visit(n.id, new Set());
  return memo;
}
