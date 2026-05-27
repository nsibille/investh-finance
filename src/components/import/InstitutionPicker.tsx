"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import {
  listFrenchInstitutions,
  startBankConnection,
} from "@/server/actions/bank";
import type { GCInstitution } from "@/lib/gocardless/types";

export function InstitutionPicker({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [institutions, setInstitutions] = useState<GCInstitution[]>([]);
  const [query, setQuery] = useState("");
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      const res = await listFrenchInstitutions();
      if (!active) return;
      setLoading(false);
      if (!res.ok) setError(res.error);
      else setInstitutions(res.institutions);
    })();
    return () => {
      active = false;
    };
  }, [open]);

  const filtered = institutions.filter((i) =>
    i.name.toLowerCase().includes(query.toLowerCase()),
  );

  async function connect(inst: GCInstitution) {
    setConnecting(inst.id);
    const res = await startBankConnection(inst.id, inst.name);
    if (!res.ok) {
      setConnecting(null);
      toast.error(res.error);
      return;
    }
    // Redirect to the bank consent flow.
    window.location.assign(res.link);
  }

  return (
    <Modal open={open} onClose={onClose} title="Connecter une banque">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {error && <Alert variant="danger">{error}</Alert>}
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher ta banque…"
        />
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-8)" }}>
            <Spinner size="lg" />
          </div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {filtered.map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => connect(inst)}
                disabled={connecting !== null}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-3)",
                  border: "none",
                  borderBottom: "1px solid var(--color-border)",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "var(--text-sm)",
                }}
              >
                {inst.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inst.logo} alt="" width={24} height={24} style={{ borderRadius: 4 }} />
                )}
                <span style={{ flex: 1 }}>{inst.name}</span>
                {connecting === inst.id && <Spinner size="sm" />}
              </button>
            ))}
            {!loading && filtered.length === 0 && !error && (
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", padding: "var(--space-4)" }}>
                Aucune banque trouvée.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
