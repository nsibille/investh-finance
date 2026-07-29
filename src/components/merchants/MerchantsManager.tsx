"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Store,
  X,
  Wand2,
  Globe,
  MapPin,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  GripVertical,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { Input, SearchInput } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Dot } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { MerchantForm } from "./MerchantForm";
import { RuleForm } from "@/components/rules/RuleForm";
import { RuleImport } from "@/components/rules/RuleImport";
import { GroupedByCategory } from "@/components/categories/GroupedByCategory";
import { groupByCategory, preciseSubName } from "@/lib/categories/group";
import { deleteMerchant, addMerchantRule } from "@/server/actions/merchants";
import { deleteRule, moveRuleToMerchant } from "@/server/actions/rules";
import { matchesQuery } from "@/lib/search/filter";
import type { MerchantWithDetails, MerchantRule } from "@/lib/merchants/types";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { AccountOption } from "@/lib/rules/queries";

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; merchant: MerchantWithDetails }
  | null;

type MotifModal =
  | { mode: "create"; merchant: MerchantWithDetails }
  | { mode: "edit"; merchant: MerchantWithDetails; rule: MerchantRule }
  | null;

const MATCH_LABEL: Record<string, string> = {
  contains: "contient",
  regex: "regex",
  exact: "exact",
};

/** Nom d'affichage d'une enseigne (nom réel ou libellé « Sans enseigne »). */
function displayName(m: { name: string | null }): string | null {
  return m.name && m.name.trim() ? m.name : null;
}

/**
 * Résumé des motifs d'une enseigne sans nom, affiché à la place de « Sans
 * enseigne » : les motifs regroupés par type, ex. « contient xxx, yyy · regex zzz ».
 */
function rulesSummary(rules: MerchantRule[]): string | null {
  if (rules.length === 0) return null;
  const byType = new Map<string, string[]>();
  for (const r of rules) {
    const list = byType.get(r.match_type) ?? [];
    list.push(r.pattern);
    byType.set(r.match_type, list);
  }
  return [...byType.entries()]
    .map(([type, pats]) => `${MATCH_LABEL[type] ?? type} ${pats.join(", ")}`)
    .join(" · ");
}

function RuleEditor({
  merchant,
  onEditMotif,
  onCreateMotif,
  draggingRuleId,
  onRuleDragStart,
  onRuleDragEnd,
}: {
  merchant: MerchantWithDetails;
  onEditMotif: (rule: MerchantRule) => void;
  onCreateMotif: () => void;
  draggingRuleId: string | null;
  onRuleDragStart: (rule: MerchantRule) => void;
  onRuleDragEnd: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<"contains" | "regex" | "exact">(
    "contains",
  );
  const [busy, setBusy] = useState(false);

  const canAddRules = Boolean(merchant.subcategory_id);

  async function add() {
    const p = pattern.trim();
    if (!p) return toast.error("Saisis un motif.");
    setBusy(true);
    const res = await addMerchantRule(merchant.id, { pattern: p, matchType });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setPattern("");
    toast.success(
      res.applied > 0
        ? `Motif créé · ${res.applied} transaction(s) rattachée(s)`
        : "Motif créé",
    );
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteRule(id);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
        Motifs rattachés
      </span>
      {merchant.rules.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {merchant.rules.map((r) => (
            <div
              key={r.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", r.id);
                onRuleDragStart(r);
              }}
              onDragEnd={onRuleDragEnd}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                fontSize: "var(--text-sm)",
                opacity: draggingRuleId === r.id ? 0.4 : r.is_active ? 1 : 0.5,
              }}
            >
              <span
                aria-hidden
                title="Glisser vers une autre enseigne"
                style={{ display: "inline-flex", color: "var(--color-text-muted)", cursor: "grab", flexShrink: 0 }}
              >
                <GripVertical size={13} />
              </span>
              <Wand2 size={13} aria-hidden style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", wordBreak: "break-all" }}>
                {MATCH_LABEL[r.match_type]} « {r.pattern} »
              </span>
              {r.hit_count > 0 && (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  {r.hit_count}×
                </span>
              )}
              <IconButton label="Réglages du motif" onClick={() => onEditMotif(r)}>
                <SlidersHorizontal size={14} />
              </IconButton>
              <IconButton label="Supprimer le motif" onClick={() => remove(r.id)}>
                <X size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      {canAddRules ? (
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap", width: "100%" }}>
          <div style={{ flex: "0 0 130px" }}>
            <Select
              value={matchType}
              onChange={(e) => setMatchType(e.target.value as typeof matchType)}
              style={{ width: "100%" }}
            >
              <option value="contains">Contient</option>
              <option value="regex">Regex</option>
              <option value="exact">Exact</option>
            </Select>
          </div>
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Motif à matcher (ex. CANAL+, NETFLIX…)"
            style={{ flex: "1 1 220px", minWidth: 0 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button variant="secondary" size="sm" loading={busy} onClick={add}>
            Ajouter
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<SlidersHorizontal size={14} />}
            onClick={onCreateMotif}
          >
            Avancé
          </Button>
        </div>
      ) : (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
          Définis une catégorie par défaut pour pouvoir ajouter des motifs.
        </p>
      )}
    </div>
  );
}

export function MerchantsManager({
  merchants,
  subcategoryOptions,
  accountOptions,
}: {
  merchants: MerchantWithDetails[];
  subcategoryOptions: SubcategoryOption[];
  accountOptions: AccountOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [motifModal, setMotifModal] = useState<MotifModal>(null);
  const [toDelete, setToDelete] = useState<MerchantWithDetails | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  // Drag & drop : déplacement d'un motif d'une enseigne vers une autre.
  // `overMerchant` = enseigne cible survolée (indicateur visuel).
  const [dragRule, setDragRule] = useState<{
    ruleId: string;
    sourceMerchantId: string;
  } | null>(null);
  const [overMerchant, setOverMerchant] = useState<string | null>(null);

  const preciseNames = useMemo(
    () => new Map(subcategoryOptions.map((o) => [o.id, preciseSubName(o)])),
    [subcategoryOptions],
  );

  // Recherche textuelle : nom, catégorie, localisation et motifs (pattern +
  // type « contient / regex / exact ») — insensible casse/accents, multi-tokens.
  const filtered = useMemo(
    () =>
      merchants.filter((m) =>
        matchesQuery(query, [
          displayName(m),
          m.categoryLabel,
          m.subcategory_id ? preciseNames.get(m.subcategory_id) : null,
          m.is_online ? "en ligne online" : null,
          m.country,
          ...m.rules.flatMap((r) => [r.pattern, MATCH_LABEL[r.match_type]]),
        ]),
      ),
    [merchants, query, preciseNames],
  );

  // Enseignes nommées (vraies marques) vs « Sans enseigne » (motifs seuls).
  const named = useMemo(
    () => filtered.filter((m) => displayName(m) !== null),
    [filtered],
  );
  const nameless = useMemo(
    () => filtered.filter((m) => displayName(m) === null),
    [filtered],
  );

  const namedGroups = useMemo(
    () => groupByCategory(named, (m) => m.subcategory_id, subcategoryOptions),
    [named, subcategoryOptions],
  );
  const namelessGroups = useMemo(
    () => groupByCategory(nameless, (m) => m.subcategory_id, subcategoryOptions),
    [nameless, subcategoryOptions],
  );

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleMoveRule(targetMerchantId: string) {
    const drag = dragRule;
    setDragRule(null);
    setOverMerchant(null);
    if (!drag || drag.sourceMerchantId === targetMerchantId) return;
    const res = await moveRuleToMerchant(drag.ruleId, targetMerchantId);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      res.moved > 0
        ? `Motif déplacé · ${res.moved} transaction(s) mise(s) à jour`
        : "Motif déplacé",
    );
    router.refresh();
  }

  async function handleDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    const res = await deleteMerchant(target.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Enseigne supprimée");
    router.refresh();
  }

  function renderTable(items: MerchantWithDetails[]) {
    return (
      <table className="table-transactions table-grouped">
        <colgroup>
          <col style={{ width: 40 }} />
          <col />
          <col style={{ width: 190 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 96 }} />
        </colgroup>
        <thead>
          <tr>
            <th />
            <th>Enseigne</th>
            <th>Catégorie</th>
            <th>Localisation</th>
            <th>Transactions</th>
            <th>Achats</th>
            <th>Motifs</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((m) => {
            const isOpen = expanded.has(m.id);
            const label = displayName(m);
            const summary = label ? null : rulesSummary(m.rules);
            const isDropTarget =
              dragRule !== null && dragRule.sourceMerchantId !== m.id;
            return (
              <Fragment key={m.id}>
                <tr
                  onDragOver={(e) => {
                    if (isDropTarget) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setOverMerchant(m.id);
                    }
                  }}
                  onDragLeave={() =>
                    setOverMerchant((o) => (o === m.id ? null : o))
                  }
                  onDrop={(e) => {
                    if (isDropTarget) {
                      e.preventDefault();
                      handleMoveRule(m.id);
                    }
                  }}
                  style={
                    overMerchant === m.id
                      ? {
                          background: "var(--color-brand-primary-50)",
                          outline: "2px dashed var(--color-brand-primary)",
                          outlineOffset: -2,
                        }
                      : undefined
                  }
                >
                  <td>
                    <IconButton
                      label={isOpen ? "Replier" : "Déplier"}
                      onClick={() => toggleExpand(m.id)}
                    >
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </IconButton>
                  </td>
                  <td data-wrap="true" style={{ fontWeight: "var(--fw-medium)" }}>
                    {label !== null ? (
                      <Link
                        href={`/enseignes/${m.id}`}
                        className="link-plain"
                        title={`Voir la fiche « ${label} »`}
                      >
                        {label}
                      </Link>
                    ) : summary ? (
                      <span style={{ fontWeight: "var(--fw-regular)", color: "var(--color-text-secondary)" }}>
                        {summary}
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)", fontStyle: "italic", fontWeight: "var(--fw-regular)" }}>
                        Sans enseigne
                      </span>
                    )}
                  </td>
                  <td>
                    {m.subcategory_id ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", maxWidth: "100%" }}>
                        <Dot color={m.categoryColor ?? undefined} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                          {preciseNames.get(m.subcategory_id) ?? "—"}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>Aucune</span>
                    )}
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>
                    {m.is_online ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Globe size={13} aria-hidden /> En ligne
                      </span>
                    ) : m.country ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={13} aria-hidden /> {m.country}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{m.transactionCount}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{m.purchaseCount}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{m.rules.length}</td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--space-1)", justifyContent: "flex-end" }}>
                      {label !== null && (
                        <IconButton label="Modifier" onClick={() => setModal({ mode: "edit", merchant: m })}>
                          <Pencil size={16} />
                        </IconButton>
                      )}
                      <IconButton label="Supprimer" onClick={() => setToDelete(m)}>
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr data-expand="true">
                    <td />
                    <td colSpan={7} style={{ paddingTop: "var(--space-3)", paddingBottom: "var(--space-3)" }}>
                      <RuleEditor
                        merchant={m}
                        onEditMotif={(rule) => setMotifModal({ mode: "edit", merchant: m, rule })}
                        onCreateMotif={() => setMotifModal({ mode: "create", merchant: m })}
                        draggingRuleId={dragRule?.ruleId ?? null}
                        onRuleDragStart={(rule) =>
                          setDragRule({ ruleId: rule.id, sourceMerchantId: m.id })
                        }
                        onRuleDragEnd={() => {
                          setDragRule(null);
                          setOverMerchant(null);
                        }}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-5)" }}>
        <div style={{ flex: "1 1 260px", maxWidth: 360 }}>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une enseigne, catégorie, motif…"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <RuleImport subcategoryOptions={subcategoryOptions} />
          <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
            Nouvelle enseigne
          </Button>
        </div>
      </div>

      {merchants.length === 0 ? (
        <Card>
          <EmptyState
            icon={Store}
            title="Aucune enseigne"
            description="Crée une enseigne (nom commercial + catégorie par défaut) pour catégoriser automatiquement ses transactions."
            action={
              <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
                Nouvelle enseigne
              </Button>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Store}
            title="Aucun résultat"
            description={`Aucune enseigne ne correspond à « ${query} ».`}
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {named.length > 0 && (
            <GroupedByCategory groups={namedGroups} renderTable={renderTable} />
          )}
          {nameless.length > 0 && (
            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div>
                <h2 style={{ fontSize: "var(--text-base)", fontWeight: "var(--fw-semibold)", margin: 0 }}>
                  Sans enseigne
                </h2>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: "var(--space-1) 0 0" }}>
                  Motifs de catégorisation sans marque : ils rangent la transaction
                  dans une catégorie sans y rattacher d&apos;enseigne.
                </p>
              </div>
              <GroupedByCategory groups={namelessGroups} renderTable={renderTable} />
            </section>
          )}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Modifier l'enseigne" : "Nouvelle enseigne"}
      >
        {modal && (
          <MerchantForm
            mode={modal.mode}
            id={modal.mode === "edit" ? modal.merchant.id : undefined}
            initial={
              modal.mode === "edit"
                ? {
                    name: modal.merchant.name,
                    subcategoryId: modal.merchant.subcategory_id,
                    country: modal.merchant.country,
                    isOnline: modal.merchant.is_online,
                  }
                : undefined
            }
            subcategoryOptions={subcategoryOptions}
            onDone={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal
        open={motifModal !== null}
        onClose={() => setMotifModal(null)}
        title={motifModal?.mode === "edit" ? "Réglages du motif" : "Nouveau motif avancé"}
      >
        {motifModal && (
          <RuleForm
            mode={motifModal.mode}
            id={motifModal.mode === "edit" ? motifModal.rule.id : undefined}
            merchantId={motifModal.merchant.id}
            merchantName={motifModal.merchant.name}
            accountOptions={accountOptions}
            initial={
              motifModal.mode === "edit"
                ? {
                    name: motifModal.rule.name,
                    match_type: motifModal.rule.match_type,
                    pattern: motifModal.rule.pattern,
                    case_sensitive: motifModal.rule.case_sensitive,
                    amount_min: motifModal.rule.amount_min ?? "",
                    amount_max: motifModal.rule.amount_max ?? "",
                    account_id: motifModal.rule.account_id ?? "",
                    auto_validate: motifModal.rule.auto_validate,
                    priority: motifModal.rule.priority,
                    is_active: motifModal.rule.is_active,
                  }
                : undefined
            }
            onDone={() => setMotifModal(null)}
          />
        )}
      </Modal>

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer l'enseigne ?"
        variantClass="modal-confirm-danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Supprimer
            </Button>
          </>
        }
      >
        <Alert variant="warning">
          Les transactions et achats rattachés seront détachés (ils gardent leur
          catégorie). Les motifs de cette enseigne seront supprimés.
        </Alert>
      </Modal>
    </>
  );
}
