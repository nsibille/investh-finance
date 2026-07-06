"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, Store, ShoppingBag } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { SearchInput, DateInput, CurrencyInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { MultiSelectCombobox } from "@/components/ui/MultiSelectCombobox";
import { CategorySelect } from "./CategorySelect";
import type { AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type { PurchaseOption } from "@/lib/purchases/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "À valider",
  validated: "Validées",
  ignored: "Ignorées",
};

const parseList = (v: string | null): string[] =>
  v ? v.split(",").filter(Boolean) : [];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function TransactionFilters({
  accountOptions,
  subcategoryOptions,
  merchantOptions,
  purchaseOptions,
  showStatus = true,
}: {
  accountOptions: AccountOption[];
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
  purchaseOptions: PurchaseOption[];
  showStatus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const merchantIds = parseList(params.get("merchant"));
  const purchaseIds = parseList(params.get("purchase"));
  const amin = params.get("amin") ?? "";
  const amax = params.get("amax") ?? "";

  // Montant : édition locale, commit sur blur/Enter pour ne pas naviguer à
  // chaque frappe. Resynchronise le brouillon quand l'URL change en externe
  // (retrait d'une chip, « Tout effacer »…) — même logique que syncedRows.
  const [minDraft, setMinDraft] = useState(amin);
  const [maxDraft, setMaxDraft] = useState(amax);
  const [seen, setSeen] = useState({ amin, amax });
  if (seen.amin !== amin || seen.amax !== amax) {
    setSeen({ amin, amax });
    setMinDraft(amin);
    setMaxDraft(amax);
  }

  function pushParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setParam(key: string, value: string) {
    pushParams((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
  }

  function setMulti(key: string, ids: string[]) {
    pushParams((next) => {
      if (ids.length) next.set(key, ids.join(","));
      else next.delete(key);
    });
  }

  function commitAmount(key: "amin" | "amax", raw: string) {
    const cleaned = raw.replace(/\s/g, "").replace(",", ".");
    const n = Number(cleaned);
    const value = cleaned && Number.isFinite(n) && n >= 0 ? String(n) : "";
    if ((params.get(key) ?? "") !== value) setParam(key, value);
  }

  const merchantMs = useMemo(
    () => merchantOptions.map((m) => ({ id: m.id, label: m.name })),
    [merchantOptions],
  );
  const purchaseMs = useMemo(
    () =>
      purchaseOptions.map((p) => ({
        id: p.id,
        label: p.name,
        hint: p.merchantName,
      })),
    [purchaseOptions],
  );

  const merchantName = useMemo(
    () => new Map(merchantOptions.map((m) => [m.id, m.name])),
    [merchantOptions],
  );
  const purchaseName = useMemo(
    () => new Map(purchaseOptions.map((p) => [p.id, p.name])),
    [purchaseOptions],
  );
  const subcategoryLabel = useMemo(
    () => new Map(subcategoryOptions.map((s) => [s.id, s.label])),
    [subcategoryOptions],
  );
  const accountName = useMemo(
    () => new Map(accountOptions.map((a) => [a.id, a.name])),
    [accountOptions],
  );

  // Chips de filtres actifs — remontées en haut du listing pour rendre chaque
  // critère (surtout les multiselect) évident et retirable d'un clic.
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  const q = params.get("q");
  if (q) chips.push({ key: "q", label: `« ${q} »`, onRemove: () => setParam("q", "") });
  const account = params.get("account");
  if (account)
    chips.push({
      key: "account",
      label: accountName.get(account) ?? "Compte",
      onRemove: () => setParam("account", ""),
    });
  const status = params.get("status");
  if (showStatus && status)
    chips.push({
      key: "status",
      label: STATUS_LABELS[status] ?? status,
      onRemove: () => setParam("status", ""),
    });
  const subcategory = params.get("subcategory");
  if (subcategory)
    chips.push({
      key: "subcategory",
      label: subcategoryLabel.get(subcategory) ?? "Catégorie",
      onRemove: () => setParam("subcategory", ""),
    });
  for (const id of merchantIds)
    chips.push({
      key: `merchant-${id}`,
      label: merchantName.get(id) ?? "Enseigne",
      onRemove: () => setMulti("merchant", merchantIds.filter((m) => m !== id)),
    });
  for (const id of purchaseIds)
    chips.push({
      key: `purchase-${id}`,
      label: purchaseName.get(id) ?? "Achat",
      onRemove: () => setMulti("purchase", purchaseIds.filter((p) => p !== id)),
    });
  if (amin || amax) {
    const label =
      amin && amax
        ? `${amin} – ${amax} €`
        : amin
          ? `≥ ${amin} €`
          : `≤ ${amax} €`;
    chips.push({
      key: "amount",
      label,
      onRemove: () =>
        pushParams((next) => {
          next.delete("amin");
          next.delete("amax");
        }),
    });
  }
  const from = params.get("from");
  const to = params.get("to");
  if (from || to) {
    const label =
      from && to
        ? `${formatDate(from)} → ${formatDate(to)}`
        : from
          ? `dès le ${formatDate(from)}`
          : `jusqu'au ${formatDate(to!)}`;
    chips.push({
      key: "dates",
      label,
      onRemove: () =>
        pushParams((next) => {
          next.delete("from");
          next.delete("to");
        }),
    });
  }

  const hasFilters = chips.length > 0 || Boolean(params.get("sort"));

  return (
    <div style={{ marginBottom: "var(--space-5)" }}>
      <div className="transaction-filters">
        <div style={{ minWidth: 220, flex: 1 }}>
          <SearchInput
            defaultValue={params.get("q") ?? ""}
            placeholder="Rechercher un libellé…"
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
            }}
          />
        </div>
        <div style={{ width: 170 }}>
          <Select value={params.get("account") ?? ""} onChange={(e) => setParam("account", e.target.value)}>
            <option value="">Tous les comptes</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
        {showStatus && (
          <div style={{ width: 150 }}>
            <Select value={params.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)}>
              <option value="">Tous statuts</option>
              <option value="pending">À valider</option>
              <option value="validated">Validées</option>
              <option value="ignored">Ignorées</option>
            </Select>
          </div>
        )}
        <div style={{ width: 200 }}>
          <CategorySelect
            value={params.get("subcategory")}
            options={subcategoryOptions}
            placeholder="Toutes catégories"
            onChange={(id) => setParam("subcategory", id ?? "")}
          />
        </div>
        <div style={{ width: 190 }}>
          <MultiSelectCombobox
            options={merchantMs}
            value={merchantIds}
            onChange={(ids) => setMulti("merchant", ids)}
            placeholder="Toutes enseignes"
            noun="enseigne"
            searchPlaceholder="Rechercher une enseigne…"
            icon={<Store size={14} aria-hidden />}
          />
        </div>
        <div style={{ width: 190 }}>
          <MultiSelectCombobox
            options={purchaseMs}
            value={purchaseIds}
            onChange={(ids) => setMulti("purchase", ids)}
            placeholder="Tous les achats"
            noun="achat"
            searchPlaceholder="Rechercher un achat…"
            icon={<ShoppingBag size={14} aria-hidden />}
          />
        </div>
        <div className="filter-amount-range">
          <CurrencyInput
            aria-label="Montant minimum"
            placeholder="Min"
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            onBlur={() => commitAmount("amin", minDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAmount("amin", minDraft);
            }}
          />
          <span className="filter-amount-range__sep">–</span>
          <CurrencyInput
            aria-label="Montant maximum"
            placeholder="Max"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            onBlur={() => commitAmount("amax", maxDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAmount("amax", maxDraft);
            }}
          />
        </div>
        <div style={{ width: 150 }}>
          <DateInput value={params.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} aria-label="Du" />
        </div>
        <div style={{ width: 150 }}>
          <DateInput value={params.get("to") ?? ""} onChange={(e) => setParam("to", e.target.value)} aria-label="Au" />
        </div>
        <div style={{ width: 160 }}>
          <Select value={params.get("sort") ?? "date_desc"} onChange={(e) => setParam("sort", e.target.value)}>
            <option value="date_desc">Date ↓</option>
            <option value="date_asc">Date ↑</option>
            <option value="amount_desc">Montant ↓</option>
            <option value="amount_asc">Montant ↑</option>
          </Select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="filter-chips">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="filter-chip"
              onClick={c.onRemove}
              aria-label={`Retirer le filtre ${c.label}`}
            >
              <span className="filter-chip__label">{c.label}</span>
              <X size={13} aria-hidden />
            </button>
          ))}
          {hasFilters && (
            <Button variant="ghost" size="sm" leftIcon={<X size={14} />} onClick={() => router.push(pathname)}>
              Tout effacer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
