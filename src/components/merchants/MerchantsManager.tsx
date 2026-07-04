"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Store, X, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Dot } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { MerchantForm } from "./MerchantForm";
import { deleteMerchant, addMerchantRule } from "@/server/actions/merchants";
import { deleteRule } from "@/server/actions/rules";
import type { MerchantWithDetails } from "@/lib/merchants/types";
import type { SubcategoryOption } from "@/lib/categories/types";

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; merchant: MerchantWithDetails }
  | null;

const MATCH_LABEL: Record<string, string> = {
  contains: "contient",
  regex: "regex",
  exact: "exact",
};

function RuleEditor({ merchant }: { merchant: MerchantWithDetails }) {
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
        ? `Règle créée · ${res.applied} transaction(s) rattachée(s)`
        : "Règle créée",
    );
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteRule(id);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
        Règles rattachées
      </span>
      {merchant.rules.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {merchant.rules.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", opacity: r.is_active ? 1 : 0.5 }}>
              <Wand2 size={13} aria-hidden style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", wordBreak: "break-all" }}>
                {MATCH_LABEL[r.match_type]} « {r.pattern} »
              </span>
              {r.hit_count > 0 && (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  {r.hit_count}×
                </span>
              )}
              <IconButton label="Supprimer la règle" onClick={() => remove(r.id)}>
                <X size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      {canAddRules ? (
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <Select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value as typeof matchType)}
            style={{ maxWidth: 120 }}
          >
            <option value="contains">Contient</option>
            <option value="regex">Regex</option>
            <option value="exact">Exact</option>
          </Select>
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Motif (ex. CARREFOUR)"
            style={{ flex: 1 }}
          />
          <Button variant="secondary" size="sm" loading={busy} onClick={add}>
            Ajouter
          </Button>
        </div>
      ) : (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
          Définis une catégorie par défaut pour pouvoir ajouter des règles.
        </p>
      )}
    </div>
  );
}

export function MerchantsManager({
  merchants,
  subcategoryOptions,
}: {
  merchants: MerchantWithDetails[];
  subcategoryOptions: SubcategoryOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [toDelete, setToDelete] = useState<MerchantWithDetails | null>(null);

  async function handleDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    const res = await deleteMerchant(target.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Enseigne supprimée");
    router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "var(--space-5)" }}>
        <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
          Nouvelle enseigne
        </Button>
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
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "var(--space-4)" }}>
          {merchants.map((m) => (
            <Card key={m.id}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: "var(--fw-semibold)" }}>{m.name}</span>
                    {m.categoryLabel ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>
                        <Dot color={m.categoryColor ?? undefined} />
                        {m.categoryLabel}
                      </div>
                    ) : (
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>
                        Aucune catégorie par défaut
                      </div>
                    )}
                  </div>
                  <IconButton label="Modifier" onClick={() => setModal({ mode: "edit", merchant: m })}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label="Supprimer" onClick={() => setToDelete(m)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>

                <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", flexWrap: "wrap" }}>
                  <span>{m.transactionCount} transaction{m.transactionCount > 1 ? "s" : ""}</span>
                  <span>{m.purchaseCount} achat{m.purchaseCount > 1 ? "s" : ""}</span>
                </div>

                <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)" }}>
                  <RuleEditor merchant={m} />
                </div>
              </div>
            </Card>
          ))}
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
                  }
                : undefined
            }
            subcategoryOptions={subcategoryOptions}
            onDone={() => setModal(null)}
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
          catégorie). Les règles rattachées seront également détachées de
          l&apos;enseigne mais conservées.
        </Alert>
      </Modal>
    </>
  );
}
