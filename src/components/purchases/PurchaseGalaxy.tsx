import type { ReactNode } from "react";
import Link from "next/link";
import { Layers, ArrowUpRight, ArrowRight } from "lucide-react";
import { StatusBadge, Dot } from "@/components/ui/Badge";
import { formatShortDate } from "@/lib/format/date";
import { PurchaseLineRow } from "./PurchaseLineRow";
import { PurchaseInstallments } from "./PurchaseInstallments";
import type { PurchaseWithDetails } from "@/lib/purchases/types";

export function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        color: "var(--color-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "var(--tracking-wide)",
      }}
    >
      {children}
      {count != null && (
        <span style={{ fontFamily: "var(--font-mono)", marginLeft: 6 }}>{count}</span>
      )}
    </span>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        borderTop: "1px solid var(--color-border)",
        paddingTop: "var(--space-3)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * « Galaxie » d'un achat : achat parent · paiements à venir/validés ·
 * transactions rattachées · sous-achats listés comme des transactions.
 * Purement présentationnel → rendu côté carte (client) comme page (serveur).
 * `variant="card"` plafonne les listes ; `variant="page"` déballe tout.
 *
 * `assignmentsSlot` : si fourni, remplace les sections « paiements » +
 * « transactions rattachées » (lecture seule) par un bloc interactif
 * (assigner / réassigner / désassigner). Utilisé par la page de détail.
 */
export function PurchaseGalaxy({
  purchase: p,
  parent,
  subPurchases,
  variant,
  renderTxActions,
  assignmentsSlot,
}: {
  purchase: PurchaseWithDetails;
  parent?: { id: string; name: string } | null;
  subPurchases?: PurchaseWithDetails[];
  variant: "card" | "page";
  /**
   * Actions par transaction rattachée (ex. éditer le partage entre personnes),
   * rendues à côté de la ligne — jamais dans le lien pour éviter l'imbrication
   * d'éléments interactifs. Absent ⇒ lignes en lecture seule (variante carte).
   */
  renderTxActions?: (tx: PurchaseWithDetails["transactions"][number]) => ReactNode;
  assignmentsSlot?: ReactNode;
}) {
  const cap = variant === "card" ? 4 : Infinity;
  const txs = p.transactions;
  const kids = subPurchases ?? [];
  const shownTxs = txs.slice(0, cap);
  const shownKids = kids.slice(0, cap);

  return (
    <>
      {parent && (
        <Section>
          <SectionTitle>Achat parent</SectionTitle>
          <PurchaseLineRow
            href={`/achats/${parent.id}`}
            leading={<Layers size={15} color="var(--color-info-dark)" aria-hidden />}
            label={parent.name}
            sublabel="Ouvrir le groupe parent"
            trailing={<ArrowUpRight size={15} color="var(--color-text-muted)" aria-hidden />}
          />
        </Section>
      )}

      {assignmentsSlot !== undefined ? (
        assignmentsSlot
      ) : (
        <>
          {p.installments.length > 0 && (
            <Section>
              <SectionTitle>Paiements à venir et validés</SectionTitle>
              <PurchaseInstallments
                installments={p.installments}
                isRecurring={p.is_recurring}
                recurrenceEnd={p.recurrence_end}
              />
            </Section>
          )}

          {txs.length > 0 && (
            <Section>
              <SectionTitle count={txs.length}>Transactions rattachées</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {shownTxs.map((t) => {
                  const row = (
                    <PurchaseLineRow
                      key={t.id}
                      href={`/transactions/${t.id}`}
                      leading={t.accountColor ? <Dot color={t.accountColor} /> : undefined}
                      label={t.label}
                      sublabel={
                        <>
                          {formatShortDate(t.operation_date)}
                          {t.accountName && <span>· {t.accountName}</span>}
                          {t.split.shares.length > 0 && (
                            <span>
                              {" "}· {t.split.shares.length} personne
                              {t.split.shares.length > 1 ? "s" : ""} ·{" "}
                              {t.split.nature === "gift"
                                ? "cadeau"
                                : t.amount > 0
                                  ? "à rendre"
                                  : "dette"}
                            </span>
                          )}
                        </>
                      }
                      amount={t.amount}
                      currency={t.currency}
                      trailing={<StatusBadge status={t.status} />}
                    />
                  );
                  if (!renderTxActions) return row;
                  return (
                    <div
                      key={t.id}
                      style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>{row}</div>
                      {renderTxActions(t)}
                    </div>
                  );
                })}
              </div>
              {txs.length > shownTxs.length && (
                <Link
                  href={`/achats/${p.id}`}
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-link)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    paddingLeft: "var(--space-2)",
                  }}
                >
                  Voir les {txs.length} transactions
                  <ArrowRight size={14} aria-hidden />
                </Link>
              )}
            </Section>
          )}
        </>
      )}

      {kids.length > 0 && (
        <Section>
          <SectionTitle count={kids.length}>Sous-achats</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {shownKids.map((c) => (
              <PurchaseLineRow
                key={c.id}
                href={`/achats/${c.id}`}
                leading={<Layers size={15} color="var(--color-info-dark)" aria-hidden />}
                label={c.name}
                sublabel={
                  <>
                    {c.totalTransactionCount} transaction
                    {c.totalTransactionCount > 1 ? "s" : ""}
                    {c.descendantCount > 0 && (
                      <span>
                        · {c.descendantCount} sous-achat{c.descendantCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </>
                }
                amount={c.totalPaidAmount}
                amountTone="neutral"
                trailing={
                  c.isFullyPaid && c.descendantCount === 0 ? (
                    <span className="badge-status-validated">Soldé</span>
                  ) : (
                    <ArrowUpRight size={15} color="var(--color-text-muted)" aria-hidden />
                  )
                }
              />
            ))}
          </div>
          {kids.length > shownKids.length && (
            <Link
              href={`/achats/${p.id}`}
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-link)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                paddingLeft: "var(--space-2)",
              }}
            >
              Voir les {kids.length} sous-achats
              <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </Section>
      )}
    </>
  );
}
