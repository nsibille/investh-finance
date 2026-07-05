"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ShoppingBag, Store, Repeat, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Amount } from "@/components/ui/Amount";
import { ImportRowBadge } from "@/components/ui/Badge";
import { Toggle, Checkbox } from "@/components/ui/Checkbox";
import { ImportCategoryEditor } from "./ImportCategoryEditor";
import { PurchaseAttachModal } from "./PurchaseAttachModal";
import { MerchantAttachModal } from "./MerchantAttachModal";
import { RecurringAttachModal } from "./RecurringAttachModal";
import { useToast } from "@/hooks/useToast";
import { formatShortDate } from "@/lib/format/date";
import { confirmImport, confirmCsvImport } from "@/server/actions/import";
import { createRuleFromLabel, deleteRule } from "@/server/actions/rules";
import { addMerchantRule, createMerchantRuleFromLabel } from "@/server/actions/merchants";
import {
  associateLabelToRecurring,
  undoAssociateRecurring,
  createAndAssociateRecurring,
  deleteRecurringPattern,
} from "@/server/actions/recurring";
import { createCategoryOnTheFly } from "@/server/actions/categories";
import { useImportStore, type ImportPreviewRow } from "@/stores/import";
import type { ParsedTransaction } from "@/lib/import/types";
import type { AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";
import { installmentOccurrence } from "@/lib/purchases/installments";
import type { PurchaseOption } from "@/lib/purchases/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type { RecurringOption } from "@/lib/recurring/queries";

export function StatementImport({
  accountOptions,
  subcategoryOptions,
  purchaseOptions,
  merchantOptions,
  recurringOptions,
}: {
  accountOptions: AccountOption[];
  subcategoryOptions: SubcategoryOption[];
  purchaseOptions: PurchaseOption[];
  merchantOptions: MerchantOption[];
  recurringOptions: RecurringOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  // Aperçu conservé dans un store : survit à la navigation (retour sur /import).
  const preview = useImportStore((s) => s.preview);
  const setPreview = useImportStore((s) => s.setPreview);
  const patchRow = useImportStore((s) => s.patchRow);
  const [accountId, setAccountId] = useState(accountOptions[0]?.id ?? "");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  // Filtre rapide : n'afficher que les lignes sans catégorie.
  const [onlyUncat, setOnlyUncat] = useState(false);
  // Catégories créées à la volée pendant cette session d'import.
  const [extraOptions, setExtraOptions] = useState<SubcategoryOption[]>([]);
  // Achats (dont créés à la volée) + ligne dont on rattache un achat.
  const [extraPurchases, setExtraPurchases] = useState<PurchaseOption[]>([]);
  const [purchaseRow, setPurchaseRow] = useState<number | null>(null);
  // Enseignes (dont créées à la volée) + ligne dont on rattache une enseigne.
  const [extraMerchants, setExtraMerchants] = useState<MerchantOption[]>([]);
  const [merchantRow, setMerchantRow] = useState<number | null>(null);
  // Ligne dont on associe une récurrente.
  const [recurringRow, setRecurringRow] = useState<number | null>(null);

  const allPurchases = useMemo(() => {
    const seen = new Set(purchaseOptions.map((p) => p.id));
    return [...purchaseOptions, ...extraPurchases.filter((p) => !seen.has(p.id))];
  }, [purchaseOptions, extraPurchases]);

  const allMerchants = useMemo(() => {
    const seen = new Set(merchantOptions.map((m) => m.id));
    return [...merchantOptions, ...extraMerchants.filter((m) => !seen.has(m.id))];
  }, [merchantOptions, extraMerchants]);

  function attachPurchase(index: number, option: PurchaseOption) {
    setExtraPurchases((prev) => (prev.some((p) => p.id === option.id) ? prev : [...prev, option]));
    // Occurrence X/Y : rang du mois de la ligne dans l'échéancier de l'achat.
    const startMonth = option.installmentMonths[0] ?? null;
    const txMonth = preview?.rows[index]?.operation_date.slice(0, 7) ?? null;
    const occurrence =
      startMonth && txMonth ? installmentOccurrence(startMonth, txMonth) : null;
    patchRow(index, {
      purchaseId: option.id,
      purchaseName: option.name,
      purchaseOccurrence: occurrence,
      purchaseInstallmentTotal: option.installmentMonths.length,
      purchaseEndless: option.endless,
      // La catégorie de l'achat prime (héritée) si elle existe.
      ...(option.subcategoryId ? { categoryId: option.subcategoryId } : {}),
      // L'enseigne de l'achat est imposée (non éditable) si l'achat en a une.
      ...(option.merchantId
        ? { merchantId: option.merchantId, merchantName: option.merchantName, merchantLocked: true }
        : {}),
    });
  }

  function detachPurchase(index: number) {
    // L'enseigne imposée par l'achat redevient éditable une fois l'achat détaché.
    patchRow(index, {
      purchaseId: null,
      purchaseName: null,
      purchaseOccurrence: null,
      purchaseInstallmentTotal: null,
      purchaseEndless: false,
      merchantLocked: false,
    });
  }

  // Rattache une enseigne et crée automatiquement sa règle (même logique que
  // pour les catégories : toaster récap / annuler / appliquer partout).
  async function attachMerchant(index: number, option: MerchantOption) {
    setExtraMerchants((prev) => (prev.some((m) => m.id === option.id) ? prev : [...prev, option]));
    patchRow(index, {
      merchantId: option.id,
      merchantName: option.name,
      // L'enseigne applique sa catégorie par défaut (surchargeable).
      ...(option.subcategoryId ? { categoryId: option.subcategoryId } : {}),
    });

    const pattern = useImportStore.getState().preview?.rows[index]?.label ?? "";
    if (!pattern) return;
    if (!option.subcategoryId) {
      toast.info(
        `Enseigne « ${option.name} » rattachée. Définis une catégorie par défaut pour créer une règle automatiquement.`,
      );
      return;
    }
    // Règle non appliquée aux transactions existantes ici : « Appliquer à tout
    // l'import » gère l'aperçu courant (comme pour les catégories).
    const res = await addMerchantRule(option.id, { pattern, matchType: "contains" }, false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Règle créée : enseigne « ${option.name} » (contient « ${res.pattern} »)`, {
      duration: 10000,
      actions: [
        {
          label: "Annuler",
          onClick: async () => {
            await deleteRule(res.ruleId);
            toast.info("Règle annulée.");
          },
        },
        {
          label: "Appliquer à tout l'import",
          onClick: () => applyMerchantEverywhere(option, res.pattern),
        },
      ],
    });
  }

  function detachMerchant(index: number) {
    patchRow(index, { merchantId: null, merchantName: null });
  }

  // Crée une récurrente à la volée depuis la ligne (nom libre) puis l'associe.
  async function createRecurring(index: number, name: string) {
    const row = useImportStore.getState().preview?.rows[index];
    if (!row) return;
    const res = await createAndAssociateRecurring({
      name,
      rawLabel: row.raw_label,
      amount: row.amount,
    });
    if (!res.ok) return toast.error(res.error);
    patchRow(index, { recurringId: res.id, recurringName: name });
    toast.success(
      res.applied > 0
        ? `Récurrente « ${name} » créée · ${res.applied} transaction(s) rattachée(s)`
        : `Récurrente « ${name} » créée`,
      {
        duration: 10000,
        action: {
          label: "Annuler",
          onClick: async () => {
            await deleteRecurringPattern(res.id);
            patchRow(index, { recurringId: null, recurringName: null });
            toast.info("Récurrente supprimée.");
          },
        },
      },
    );
  }

  // Associe une ligne à une récurrente : ajoute le motif du libellé à la
  // récurrente (fera matcher à l'import), hérite catégorie + enseigne, applique
  // aux transactions existantes, avec un toaster « Annuler ».
  async function attachRecurring(index: number, option: RecurringOption) {
    patchRow(index, {
      recurringId: option.id,
      recurringName: option.name,
      ...(option.subcategoryId ? { categoryId: option.subcategoryId } : {}),
      ...(option.merchantId
        ? { merchantId: option.merchantId, merchantName: option.merchantName }
        : {}),
    });
    const row = useImportStore.getState().preview?.rows[index];
    if (!row?.raw_label) return;
    const res = await associateLabelToRecurring(option.id, row.raw_label, row.amount);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      res.applied > 0
        ? `Associée à « ${option.name} » · ${res.applied} transaction(s) existante(s) rattachée(s)`
        : `Associée à « ${option.name} »`,
      {
        duration: 10000,
        action: {
          label: "Annuler",
          onClick: async () => {
            await undoAssociateRecurring(option.id, res.addedLabel, res.addedAmount, res.ids);
            patchRow(index, { recurringId: null, recurringName: null });
            toast.info("Association annulée.");
          },
        },
      },
    );
  }

  // Rattache l'enseigne à toutes les lignes de l'aperçu dont le libellé contient
  // le motif (hors lignes verrouillées par un achat).
  function applyMerchantEverywhere(option: MerchantOption, pattern: string) {
    const state = useImportStore.getState();
    const cur = state.preview;
    if (!cur) return;
    const p = pattern.toLowerCase();
    let count = 0;
    const rows = cur.rows.map((r) => {
      if (!r.merchantLocked && r.raw_label.toLowerCase().includes(p)) {
        count += 1;
        return {
          ...r,
          merchantId: option.id,
          merchantName: option.name,
          ...(option.subcategoryId ? { categoryId: option.subcategoryId } : {}),
        };
      }
      return r;
    });
    state.setPreview({ ...cur, rows });
    toast.info(`${count} transaction(s) rattachée(s) à « ${option.name} » dans l'import.`);
  }

  const allOptions = useMemo(() => {
    const seen = new Set(subcategoryOptions.map((o) => o.id));
    return [...subcategoryOptions, ...extraOptions.filter((o) => !seen.has(o.id))];
  }, [subcategoryOptions, extraOptions]);

  const optLabel = useMemo(
    () => new Map(allOptions.map((o) => [o.id, o.label])),
    [allOptions],
  );

  // Assigne une catégorie à une ligne et crée la règle associée (avec toaster
  // récap / annuler / appliquer partout).
  async function assignCategory(
    index: number,
    subcategoryId: string | null,
    labelOverride?: string,
  ) {
    patchRow(index, { categoryId: subcategoryId });
    if (!subcategoryId) return;
    const row = useImportStore.getState().preview?.rows[index];
    if (!row) return;
    const pattern = row.label;
    const label = labelOverride ?? optLabel.get(subcategoryId) ?? "catégorie";

    // Ligne rattachée à une enseigne : la catégorie est héritée par l'enseigne
    // et la règle créée est rattachée à l'enseigne.
    if (row.merchantId) {
      const mres = await createMerchantRuleFromLabel(row.merchantId, pattern, subcategoryId);
      if (!mres.ok) {
        toast.error(mres.error);
        return;
      }
      const who = row.merchantName ?? "enseigne";
      const applyAction = {
        label: "Appliquer à tout l'import",
        onClick: () =>
          applyMerchantEverywhere(
            { id: row.merchantId!, name: who, subcategoryId },
            mres.pattern,
          ),
      };
      if (mres.exists) {
        toast.info(`Catégorie assignée · règle enseigne « ${who} » déjà existante`, {
          actions: [applyAction],
        });
        return;
      }
      toast.success(
        `Règle créée pour l'enseigne « ${who} » : contient « ${mres.pattern} » → ${label}` +
          (mres.categorySet ? " · catégorie par défaut de l'enseigne définie" : ""),
        {
          duration: 10000,
          actions: [
            {
              label: "Annuler",
              onClick: async () => {
                await deleteRule(mres.ruleId);
                toast.info("Règle annulée.");
              },
            },
            applyAction,
          ],
        },
      );
      return;
    }

    const res = await createRuleFromLabel(pattern, subcategoryId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.exists) {
      toast.info(`Catégorie assignée · règle « ${res.pattern} » déjà existante`, {
        actions: [
          {
            label: "Appliquer à tout l'import",
            onClick: () => applyEverywhere(res.pattern, subcategoryId),
          },
        ],
      });
      return;
    }
    toast.success(`Règle créée : contient « ${res.pattern} » → ${label}`, {
      duration: 10000,
      actions: [
        {
          label: "Annuler",
          onClick: async () => {
            await deleteRule(res.ruleId);
            toast.info("Règle annulée.");
          },
        },
        {
          label: "Appliquer à tout l'import",
          onClick: () => applyEverywhere(res.pattern, subcategoryId),
        },
      ],
    });
  }

  async function handleCreateCategory(index: number, name: string) {
    const res = await createCategoryOnTheFly(name);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setExtraOptions((prev) => [
      ...prev,
      {
        id: res.subcategoryId,
        label: res.label,
        categoryColor: res.categoryColor,
        typeName: res.typeName,
        categoryName: res.categoryName,
        subName: null,
      },
    ]);
    await assignCategory(index, res.subcategoryId, res.label);
  }

  // Applique la règle (motif « contient ») à toutes les lignes de l'aperçu.
  function applyEverywhere(pattern: string, subcategoryId: string) {
    const state = useImportStore.getState();
    const cur = state.preview;
    if (!cur) return;
    const p = pattern.toLowerCase();
    let count = 0;
    const rows = cur.rows.map((r) => {
      if (r.raw_label.toLowerCase().includes(p)) {
        count += 1;
        return { ...r, categoryId: subcategoryId };
      }
      return r;
    });
    state.setPreview({ ...cur, rows });
    toast.info(`${count} transaction(s) catégorisée(s) dans l'import.`);
  }

  async function handleFile(file: File) {
    setError(null);
    setParsing(true);
    setPreview(null);
    setEditing(null);
    try {
      const fd = new FormData();
      fd.append("accountId", accountId);
      fd.append("file", file);
      const res = await fetch("/api/import/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Échec de l'analyse");
        return;
      }
      setPreview({
        bank: data.bank,
        bankLabel: data.bankLabel,
        sourceFormat: data.sourceFormat,
        warning: data.warning ?? null,
        multiAccount: data.multiAccount ?? false,
        connections: data.connections ?? [],
        filename: file.name,
        dupExisting: data.dupExisting ?? 0,
        rows: data.rows.map((r: ImportPreviewRow) => ({
          ...r,
          // Virement interne détecté (ou règle) appliqué par défaut.
          categoryId: r.initialSubcategoryId ?? r.suggestedSubcategoryId ?? null,
          include: !r.duplicate,
        })),
      });
    } catch {
      setError("Échec de l'analyse du fichier.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    const included = preview.rows.filter((r) => r.include);
    if (included.length === 0) {
      toast.error("Aucune transaction sélectionnée.");
      return;
    }
    setImporting(true);
    const payload: ParsedTransaction[] = included.map((r) => {
      const base: ParsedTransaction = {
        operation_date: r.operation_date,
        value_date: r.value_date,
        label: r.label,
        raw_label: r.raw_label,
        amount: r.amount,
        currency: r.currency,
        external_id: r.external_id,
        connection_name: r.connection_name,
      };
      // N'envoie la catégorie que si l'utilisateur l'a modifiée : sinon les
      // règles s'appliquent à l'import (et leur compteur de hits est suivi).
      const suggested = r.suggestedSubcategoryId ?? null;
      if (r.categoryId !== suggested) base.subcategory_id = r.categoryId;
      if (r.purchaseId) base.purchase_id = r.purchaseId;
      // L'aperçu fait foi pour l'enseigne (règle, achat ou choix manuel), y
      // compris le détachement explicite (null).
      base.merchant_id = r.merchantId ?? null;
      return base;
    });

    const res = preview.multiAccount
      ? await confirmCsvImport(payload, preview.filename)
      : await confirmImport(accountId, payload, preview.sourceFormat, preview.filename);

    setImporting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const parts = [`${res.summary.rows_imported} importée(s)`];
    if ("accounts_created" in res.summary && res.summary.accounts_created > 0) {
      parts.push(`${res.summary.accounts_created} compte(s) créé(s)`);
    }
    if (res.transfersDetected > 0) {
      parts.push(`${res.transfersDetected} virement(s) interne(s)`);
    }
    parts.push(`${res.summary.rows_duplicates} doublon(s)`);
    toast.success(parts.join(" · "));
    setPreview(null);
    router.refresh();
  }

  const includedCount = preview?.rows.filter((r) => r.include).length ?? 0;
  const totalRows = preview?.rows.length ?? 0;
  const categorizedCount = preview?.rows.filter((r) => r.categoryId).length ?? 0;
  const uncategorizedCount = totalRows - categorizedCount;
  const catPct = totalRows > 0 ? Math.round((categorizedCount / totalRows) * 100) : 0;

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {accountOptions.length > 0 && (
          <div style={{ maxWidth: 360 }}>
            <FormField label="Compte de destination (relevé PDF)">
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
              Les exports CSV rattachent/créent les comptes automatiquement (colonne « Nom de la connexion »).
            </p>
          </div>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        {!preview && !parsing && (
          <FileDropzone
            onFile={handleFile}
            accept="application/pdf,.pdf,.csv,.tsv,.txt,text/csv"
            hint="Relevé PDF (BforBank, Société Générale) ou export CSV Bankin' (10 Mo max)"
          />
        )}

        {parsing && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-6)", justifyContent: "center" }}>
            <Spinner size="lg" />
            <span style={{ color: "var(--color-text-muted)" }}>Analyse du fichier…</span>
          </div>
        )}

        {preview && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                <FileText size={16} />
                <strong>{preview.bankLabel}</strong>
                <span style={{ color: "var(--color-text-muted)" }}>
                  · {preview.rows.length} opérations détectées · {catPct}% catégorisées
                  {" "}automatiquement
                </span>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="secondary" onClick={() => setPreview(null)}>
                  Annuler
                </Button>
                <Button loading={importing} onClick={handleImport}>
                  Importer {includedCount} transaction{includedCount > 1 ? "s" : ""}
                </Button>
              </div>
            </div>

            {preview.multiAccount && preview.connections.length > 0 && (
              <Alert variant="info">
                <span>
                  Comptes détectés :{" "}
                  {preview.connections
                    .map((c) => `${c.label} (${c.exists ? "existant" : "sera créé"}, ${c.count} op.)`)
                    .join(" · ")}
                </span>
              </Alert>
            )}

            {preview.warning && <Alert variant="warning">{preview.warning}</Alert>}

            {preview.dupExisting > 0 && (
              <Alert variant="warning">
                {preview.dupExisting} transaction{preview.dupExisting > 1 ? "s" : ""} déjà
                présente{preview.dupExisting > 1 ? "s" : ""} en base (clé date · libellé · montant)
                — décochée{preview.dupExisting > 1 ? "s" : ""}, elles ne seront pas ré-importées.
              </Alert>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                <Checkbox
                  checked={onlyUncat}
                  onChange={(e) => setOnlyUncat(e.target.checked)}
                  disabled={uncategorizedCount === 0}
                />
                Sans catégorie uniquement ({uncategorizedCount})
              </label>
            </div>

            <table className="table-import-preview">
              <thead>
                <tr>
                  <th style={{ width: 108 }}>Date</th>
                  {preview.multiAccount && <th style={{ width: 120 }}>Compte</th>}
                  <th>Libellé</th>
                  <th style={{ width: 190 }}>Catégorie</th>
                  <th style={{ width: 120, textAlign: "right" }}>Montant</th>
                  <th style={{ width: 96 }}>Statut</th>
                  <th style={{ width: 72 }}>Inclure</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => {
                  if (onlyUncat && r.categoryId) return null;
                  return (
                    <tr
                      key={i}
                      data-excluded={!r.include || undefined}
                      data-duplicate={r.duplicateReason === "existing" ? "existing" : undefined}
                    >
                      <td>{formatShortDate(r.operation_date)}</td>
                      {preview.multiAccount && (
                        <td data-col="account" style={{ color: "var(--color-text-muted)" }} title={r.connectionLabel}>
                          {r.connectionLabel}
                        </td>
                      )}
                      <td data-col="label">
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span>{r.label}</span>
                          {r.recurringName && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", color: "var(--color-brand-primary-600)" }}>
                              <Repeat size={12} aria-hidden />
                              Récurrent · {r.recurringName}
                            </span>
                          )}
                          {r.merchantId ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                              <Store size={12} aria-hidden />
                              {r.merchantLocked ? (
                                <span title="Enseigne imposée par l'achat rattaché">
                                  {r.merchantName}
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setMerchantRow(i)}
                                    style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "var(--color-brand-primary-600)", cursor: "pointer" }}
                                  >
                                    {r.merchantName}
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="Détacher l'enseigne"
                                    onClick={() => detachMerchant(i)}
                                    style={{ background: "none", border: "none", padding: 0, display: "inline-flex", color: "var(--color-text-muted)", cursor: "pointer" }}
                                  >
                                    <X size={11} aria-hidden />
                                  </button>
                                </>
                              )}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setMerchantRow(i)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", background: "none", border: "none", padding: 0, fontSize: "var(--text-xs)", color: "var(--color-text-muted)", cursor: "pointer", opacity: 0.75 }}
                            >
                              <Store size={12} aria-hidden />
                              Enseigne…
                            </button>
                          )}
                          {r.purchaseId && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", color: "var(--color-brand-primary-600)" }}>
                              <ShoppingBag size={12} aria-hidden />
                              <span>{r.purchaseName}</span>
                              {(() => {
                                const total = r.purchaseInstallmentTotal ?? 0;
                                // Occurrence affichée dès qu'il y a un échéancier (> 1) ou un abonnement sans fin.
                                if (r.purchaseOccurrence == null || (!r.purchaseEndless && total <= 1)) return null;
                                return (
                                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                                    {r.purchaseOccurrence}/{r.purchaseEndless ? "∞" : total}
                                  </span>
                                );
                              })()}
                              <button
                                type="button"
                                aria-label="Détacher l'achat"
                                onClick={() => detachPurchase(i)}
                                style={{ background: "none", border: "none", padding: 0, display: "inline-flex", color: "var(--color-text-muted)", cursor: "pointer" }}
                              >
                                <X size={11} aria-hidden />
                              </button>
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-col="category">
                        {r.purchaseId ? (
                          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                            {r.categoryId ? (optLabel.get(r.categoryId) ?? "—") : "Catégorie de l'achat"}
                          </span>
                        ) : editing === i ? (
                          <ImportCategoryEditor
                            options={allOptions}
                            value={r.categoryId}
                            onSelect={(id) => assignCategory(i, id)}
                            onCreate={(name) => handleCreateCategory(i, name)}
                            onTabNext={() =>
                              setEditing(i + 1 < preview.rows.length ? i + 1 : null)
                            }
                            onClose={() => setEditing(null)}
                          />
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <button
                              type="button"
                              className="import-cat-edit"
                              onClick={() => setEditing(i)}
                              data-empty={r.categoryId ? undefined : "true"}
                            >
                              {r.categoryId ? (optLabel.get(r.categoryId) ?? "—") : "Non catégorisée"}
                            </button>
                            <IconButton label="Rattacher un achat" onClick={() => setPurchaseRow(i)}>
                              <ShoppingBag size={15} />
                            </IconButton>
                            <IconButton label="Associer une récurrente" onClick={() => setRecurringRow(i)}>
                              <Repeat size={15} />
                            </IconButton>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Amount value={r.amount} />
                      </td>
                      <td>
                        <ImportRowBadge kind={r.duplicateReason === "existing" ? "duplicate" : "new"} />
                      </td>
                      <td>
                        <Toggle
                          checked={r.include}
                          disabled={r.duplicateReason === "existing"}
                          onChange={() => patchRow(i, { include: !r.include })}
                          aria-label="Inclure"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      <PurchaseAttachModal
        open={purchaseRow !== null}
        onClose={() => setPurchaseRow(null)}
        purchaseOptions={allPurchases}
        fromTransaction={
          purchaseRow !== null && preview?.rows[purchaseRow]
            ? {
                operationDate: preview.rows[purchaseRow].operation_date,
                amount: preview.rows[purchaseRow].amount,
                label: preview.rows[purchaseRow].label,
              }
            : null
        }
        onAttach={(option) => {
          if (purchaseRow !== null) attachPurchase(purchaseRow, option);
        }}
      />

      <MerchantAttachModal
        open={merchantRow !== null}
        onClose={() => setMerchantRow(null)}
        merchantOptions={allMerchants}
        onAttach={(option) => {
          if (merchantRow !== null) attachMerchant(merchantRow, option);
        }}
      />

      <RecurringAttachModal
        open={recurringRow !== null}
        onClose={() => setRecurringRow(null)}
        options={recurringOptions}
        onAttach={(option) => {
          if (recurringRow !== null) attachRecurring(recurringRow, option);
        }}
        onCreate={(name) => {
          if (recurringRow !== null) createRecurring(recurringRow, name);
        }}
      />
    </Card>
  );
}
