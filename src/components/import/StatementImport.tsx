"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { ImportRowBadge } from "@/components/ui/Badge";
import { Toggle, Checkbox } from "@/components/ui/Checkbox";
import {
  TransactionEditorTable,
  type EditorRowVM,
  type EditorHandlers,
} from "@/components/transactions/TransactionEditorTable";
import { useToast } from "@/hooks/useToast";
import { confirmImport, confirmCsvImport, rematchPreviewPurchases } from "@/server/actions/import";
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
import type { PurchaseOption, InstallmentChoice } from "@/lib/purchases/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type { RecurringOption } from "@/lib/recurring/queries";
import type { PersonOption } from "@/lib/persons/types";

export function StatementImport({
  accountOptions,
  subcategoryOptions,
  purchaseOptions,
  merchantOptions,
  recurringOptions,
  personOptions,
}: {
  accountOptions: AccountOption[];
  subcategoryOptions: SubcategoryOption[];
  purchaseOptions: PurchaseOption[];
  merchantOptions: MerchantOption[];
  recurringOptions: RecurringOption[];
  personOptions: PersonOption[];
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
  // Filtre rapide : n'afficher que les lignes sans catégorie.
  const [onlyUncat, setOnlyUncat] = useState(false);
  // Catégories créées à la volée pendant cette session d'import.
  const [extraOptions, setExtraOptions] = useState<SubcategoryOption[]>([]);
  // Achats créés à la volée pendant cette session d'import.
  const [extraPurchases, setExtraPurchases] = useState<PurchaseOption[]>([]);
  // Enseignes créées à la volée pendant cette session d'import.
  const [extraMerchants, setExtraMerchants] = useState<MerchantOption[]>([]);
  // Recalcul des rattachements d'achats (achats créés après le parse).
  const [rematching, setRematching] = useState(false);

  const allPurchases = useMemo(() => {
    const seen = new Set(purchaseOptions.map((p) => p.id));
    return [...purchaseOptions, ...extraPurchases.filter((p) => !seen.has(p.id))];
  }, [purchaseOptions, extraPurchases]);

  const allMerchants = useMemo(() => {
    const seen = new Set(merchantOptions.map((m) => m.id));
    return [...merchantOptions, ...extraMerchants.filter((m) => !seen.has(m.id))];
  }, [merchantOptions, extraMerchants]);

  function attachPurchase(
    index: number,
    option: PurchaseOption,
    choice: InstallmentChoice,
  ) {
    setExtraPurchases((prev) => (prev.some((p) => p.id === option.id) ? prev : [...prev, option]));
    // Occurrence X/Y : rang du mois de la ligne (ou de l'échéance remplie).
    const startMonth = option.installmentMonths[0] ?? null;
    const txMonth = preview?.rows[index]?.operation_date.slice(0, 7) ?? null;
    const refMonth =
      choice.mode === "existing" ? choice.month.slice(0, 7) : txMonth;
    const occurrence =
      startMonth && refMonth ? installmentOccurrence(startMonth, refMonth) : null;
    // Créer une échéance ajoute une ligne à l'échéancier.
    const total =
      option.installmentMonths.length + (choice.mode === "create" ? 1 : 0);
    patchRow(index, {
      purchaseId: option.id,
      purchaseName: option.name,
      purchaseOccurrence: occurrence,
      purchaseInstallmentTotal: total,
      purchaseEndless: option.endless,
      // Choix d'échéance appliqué à la confirmation de l'import.
      installmentId: choice.mode === "existing" ? choice.installmentId : null,
      installmentCreate: choice.mode === "create",
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
      installmentId: null,
      installmentCreate: false,
      merchantLocked: false,
    });
  }

  // Rejoue l'appariement aux achats sur l'aperçu courant : reconnaît les achats
  // créés après l'analyse du fichier, sans re-uploader. Ne touche qu'aux lignes
  // sans achat (les rattachements manuels/détachements sont préservés).
  async function runRematch(opts?: { notify?: boolean }) {
    const cur = useImportStore.getState().preview;
    if (!cur) return;
    setRematching(true);
    try {
      const candidates = cur.rows
        .map((r, index) => ({
          index,
          operation_date: r.operation_date,
          amount: r.amount,
          raw_label: r.raw_label,
          dup: r.duplicateReason === "existing",
        }))
        .filter((r) => !r.dup)
        .map(({ index, operation_date, amount, raw_label }) => ({
          index,
          operation_date,
          amount,
          raw_label,
        }));
      const res = await rematchPreviewPurchases(candidates);
      if (!res.ok) {
        if (opts?.notify) toast.error(res.error);
        return;
      }
      let applied = 0;
      for (const { index, match } of res.matches) {
        const row = useImportStore.getState().preview?.rows[index];
        // N'écrase pas un rattachement déjà présent (auto ou manuel).
        if (!row || row.purchaseId) continue;
        patchRow(index, {
          purchaseId: match.purchaseId,
          purchaseName: match.purchaseName,
          purchaseOccurrence: match.occurrence,
          purchaseInstallmentTotal: match.installmentTotal,
          purchaseEndless: match.endless,
          ...(match.subcategoryId ? { categoryId: match.subcategoryId } : {}),
          ...(match.merchantId
            ? {
                merchantId: match.merchantId,
                merchantName: match.merchantName,
                merchantLocked: true,
              }
            : {}),
        });
        applied += 1;
      }
      if (opts?.notify) {
        toast.success(
          applied > 0
            ? `${applied} achat${applied > 1 ? "s" : ""} rattaché${applied > 1 ? "s" : ""}`
            : "Aucun nouvel achat à rattacher",
        );
      }
    } finally {
      setRematching(false);
    }
  }

  // Au montage : si un aperçu est déjà en cache (retour sur /import), on rejoue
  // l'appariement pour capter les achats créés entre-temps.
  const didMountRematch = useRef(false);
  useEffect(() => {
    if (didMountRematch.current) return;
    didMountRematch.current = true;
    // Différé hors du corps de l'effet : évite un setState synchrone au montage.
    if (useImportStore.getState().preview?.rows.length) {
      void Promise.resolve().then(() => runRematch());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          note: r.note ?? null,
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
      // Choix d'échéance : remplir une échéance existante ou en créer une.
      if (r.installmentId) base.installment_id = r.installmentId;
      else if (r.installmentCreate) base.installment_create = true;
      // L'aperçu fait foi pour l'enseigne (règle, achat ou choix manuel), y
      // compris le détachement explicite (null).
      base.merchant_id = r.merchantId ?? null;
      if (r.persons && r.persons.personIds.length > 0) base.persons = r.persons;
      if (r.note?.trim()) base.note = r.note.trim();
      // Doublon déjà en base ré-inclus manuellement (déflagué) : force l'import
      // via une occurrence libre au lieu d'être ignoré par la dédup.
      if (r.duplicateReason === "existing") base.force = true;
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

  // Lignes de l'aperçu → vue normalisée de la table éditrice partagée.
  const editorRows: EditorRowVM[] = useMemo(
    () =>
      (preview?.rows ?? []).map((r, i) => ({
        key: String(i),
        operationDate: r.operation_date,
        account: preview?.multiAccount
          ? { name: r.connectionLabel ?? "", color: null }
          : null,
        label: r.label,
        amount: r.amount,
        currency: r.currency,
        categoryId: r.categoryId,
        purchase: r.purchaseId
          ? {
              id: r.purchaseId,
              name: r.purchaseName ?? "",
              occurrence: r.purchaseOccurrence ?? null,
              installmentTotal: r.purchaseInstallmentTotal ?? null,
              endless: r.purchaseEndless ?? false,
            }
          : null,
        merchant: r.merchantId
          ? { id: r.merchantId, name: r.merchantName ?? "", locked: r.merchantLocked }
          : null,
        recurring: r.recurringId
          ? { id: r.recurringId, name: r.recurringName ?? "" }
          : null,
        personsBadge:
          r.persons && r.persons.personIds.length > 0
            ? { count: r.persons.personIds.length, nature: r.persons.nature }
            : null,
        personsInitial: r.persons ?? null,
        note: r.note ?? null,
        dimmed: !r.include,
        isExistingDuplicate: r.duplicateReason === "existing",
      })),
    [preview],
  );

  // Adaptateur import : chaque action patche le store (persistance différée au
  // clic « Importer »), en réutilisant la logique existante (règles, toasts…).
  const editorHandlers: EditorHandlers = {
    onAssignCategory: (key, subId) => assignCategory(Number(key), subId),
    onCreateCategory: (key, name) => handleCreateCategory(Number(key), name),
    onAttachPurchase: (key, option, choice) =>
      attachPurchase(Number(key), option, choice),
    onDetachPurchase: (key) => detachPurchase(Number(key)),
    onAttachMerchant: (key, option) => attachMerchant(Number(key), option),
    onDetachMerchant: (key) => detachMerchant(Number(key)),
    onAttachRecurring: (key, option) => attachRecurring(Number(key), option),
    onCreateRecurring: (key, name) => createRecurring(Number(key), name),
    onSharePersons: (key, value) => patchRow(Number(key), { persons: value }),
    onSaveNote: (key, note) => patchRow(Number(key), { note }),
  };

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
                présente{preview.dupExisting > 1 ? "s" : ""} en base (même compte · date · montant,
                libellé éventuellement différent) — décochée{preview.dupExisting > 1 ? "s" : ""},
                elles ne seront pas ré-importées.
              </Alert>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                <Checkbox
                  checked={onlyUncat}
                  onChange={(e) => setOnlyUncat(e.target.checked)}
                  disabled={uncategorizedCount === 0}
                />
                Sans catégorie uniquement ({uncategorizedCount})
              </label>
              <Button
                variant="ghost"
                size="sm"
                loading={rematching}
                leftIcon={<RefreshCw size={14} />}
                onClick={() => runRematch({ notify: true })}
              >
                Ré-analyser les achats
              </Button>
            </div>

            <TransactionEditorTable
              rows={editorRows}
              handlers={editorHandlers}
              subcategoryOptions={allOptions}
              purchaseOptions={allPurchases}
              merchantOptions={allMerchants}
              recurringOptions={recurringOptions}
              personOptions={personOptions}
              showAccount={preview.multiAccount}
              filterRow={onlyUncat ? (row) => !row.categoryId : undefined}
              trailingHeader={
                <>
                  <th style={{ width: 96 }}>Statut</th>
                  <th style={{ width: 72 }}>Inclure</th>
                </>
              }
              renderTrailing={(row) => {
                const i = Number(row.key);
                const src = preview.rows[i];
                if (!src) return null;
                // Doublon déjà en base ré-inclus manuellement (déflagué) : la
                // détection était un faux positif, la ligne sera bien importée.
                const isDup = src.duplicateReason === "existing";
                const kind = !isDup ? "new" : src.include ? "forced" : "duplicate";
                return (
                  <>
                    <td>
                      <ImportRowBadge kind={kind} />
                    </td>
                    <td>
                      <Toggle
                        checked={src.include}
                        onChange={() => patchRow(i, { include: !src.include })}
                        aria-label="Inclure"
                        title={
                          isDup
                            ? "Doublon détecté : activer pour forcer l'import (faux positif)"
                            : undefined
                        }
                      />
                    </td>
                  </>
                );
              }}
            />
          </>
        )}
      </div>
    </Card>
  );
}
