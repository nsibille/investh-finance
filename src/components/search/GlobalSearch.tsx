"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Receipt, Wallet } from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { Spinner } from "@/components/ui/Spinner";
import { formatShortDate } from "@/lib/format/date";
import { searchEverything, type SearchResults } from "@/server/actions/search";

interface FlatResult {
  href: string;
  kind: "transaction" | "account";
  label: string;
  context: string;
  amount?: number;
}

function flatten(r: SearchResults): FlatResult[] {
  return [
    ...r.transactions.map((t) => ({
      href: `/transactions/${t.id}`,
      kind: "transaction" as const,
      label: t.label,
      context: `${formatShortDate(t.date)}${t.accountName ? ` · ${t.accountName}` : ""}`,
      amount: t.amount,
    })),
    ...r.accounts.map((a) => ({
      href: `/accounts/${a.id}`,
      kind: "account" as const,
      label: a.name,
      context: "Compte",
    })),
  ];
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FlatResult[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") close();
    }
    function onTrigger() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("lyra:search", onTrigger);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("lyra:search", onTrigger);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const r = await searchEverything(query);
      if (cancelled) return;
      setResults(flatten(r));
      setActive(0);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  function go(r: FlatResult) {
    close();
    router.push(r.href);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="modal-backdrop" onClick={close} aria-hidden />
      <div className="global-search-modal" role="dialog" aria-modal="true" aria-label="Recherche">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
          <Search size={18} style={{ color: "var(--color-text-muted)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une transaction, un compte…"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "var(--text-base)", fontFamily: "var(--font-primary)", color: "var(--color-text-primary)" }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter" && results[active]) go(results[active]);
            }}
          />
          {loading && <Spinner size="sm" />}
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {!loading && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
              Aucun résultat.
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.kind}-${r.href}`}
              className="search-result-item"
              data-focused={i === active || undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
            >
              {r.kind === "transaction" ? <Receipt size={16} /> : <Wallet size={16} />}
              <div className="search-result-item__body">
                <div className="search-result-item__label">{r.label}</div>
                <div className="search-result-item__context">{r.context}</div>
              </div>
              {r.amount != null && <Amount value={r.amount} size="sm" />}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
