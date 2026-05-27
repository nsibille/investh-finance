"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { SearchInput, DateInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CategorySelect } from "./CategorySelect";
import type { AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";

export function TransactionFilters({
  accountOptions,
  subcategoryOptions,
}: {
  accountOptions: AccountOption[];
  subcategoryOptions: SubcategoryOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const hasFilters = ["account", "status", "subcategory", "q", "from", "to", "sort"].some(
    (k) => params.get(k),
  );

  return (
    <div className="transaction-filters" style={{ marginBottom: "var(--space-5)" }}>
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
      <div style={{ width: 150 }}>
        <Select value={params.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="pending">À valider</option>
          <option value="validated">Validées</option>
          <option value="ignored">Ignorées</option>
        </Select>
      </div>
      <div style={{ width: 220 }}>
        <CategorySelect
          value={params.get("subcategory")}
          options={subcategoryOptions}
          placeholder="Toutes catégories"
          onChange={(id) => setParam("subcategory", id ?? "")}
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
      {hasFilters && (
        <Button variant="ghost" leftIcon={<X size={16} />} onClick={() => router.push(pathname)}>
          Réinitialiser
        </Button>
      )}
    </div>
  );
}
