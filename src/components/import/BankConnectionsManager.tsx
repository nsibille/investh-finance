"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, RefreshCw, Trash2, Landmark } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/hooks/useToast";
import { InstitutionPicker } from "./InstitutionPicker";
import {
  linkBankAccount,
  syncBankConnection,
  deleteBankConnection,
} from "@/server/actions/bank";
import type { BankConnection } from "@/lib/bank/queries";
import type { AccountOption } from "@/lib/rules/queries";

const STATUS_LABEL: Record<string, string> = {
  created: "Autorisation en attente",
  linked: "Connecté",
  error: "Erreur",
};

export function BankConnectionsManager({
  connections,
  accountOptions,
  configured,
}: {
  connections: BankConnection[];
  accountOptions: AccountOption[];
  configured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("linked")) {
      toast.success("Banque connectée. Associe un compte puis synchronise.");
      router.replace("/import");
    } else if (params.get("error")) {
      toast.error("La connexion bancaire a échoué.");
      router.replace("/import");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function handleLink(id: string, accountId: string) {
    const res = await linkBankAccount(id, accountId);
    if (!res.ok) return toast.error(res.error ?? "Erreur");
    toast.success("Compte associé");
    router.refresh();
  }

  async function handleSync(id: string) {
    setBusy(id);
    const res = await syncBankConnection(id);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      `${res.summary.rows_imported} importée(s), ${res.summary.rows_duplicates} doublon(s), ${res.summary.rows_auto_validated} auto-validée(s)`,
    );
    router.refresh();
  }

  async function handleDelete(id: string) {
    setBusy(id);
    const res = await deleteBankConnection(id);
    setBusy(null);
    if (!res.ok) return toast.error(res.error ?? "Erreur");
    toast.success("Connexion supprimée");
    router.refresh();
  }

  return (
    <>
      {!configured && (
        <div style={{ marginBottom: "var(--space-5)" }}>
          <Alert variant="warning">
            GoCardless n&apos;est pas encore configuré. Ajoute{" "}
            <code>GOCARDLESS_SECRET_ID</code> et <code>GOCARDLESS_SECRET_KEY</code>{" "}
            dans les variables d&apos;environnement pour activer la connexion bancaire.
          </Alert>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-5)" }}>
        <Button
          leftIcon={<Plus size={16} />}
          onClick={() => setPickerOpen(true)}
          disabled={!configured}
        >
          Connecter une banque
        </Button>
      </div>

      {connections.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="Aucune banque connectée"
            description="Connecte une banque via GoCardless pour synchroniser automatiquement tes transactions."
            action={
              <Button
                leftIcon={<Plus size={16} />}
                onClick={() => setPickerOpen(true)}
                disabled={!configured}
              >
                Connecter une banque
              </Button>
            }
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {connections.map((c) => (
            <Card key={c.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: "var(--fw-semibold)" }}>
                    {c.institution_name ?? c.institution_id}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    {STATUS_LABEL[c.status] ?? c.status}
                    {c.iban ? ` · ${c.iban.replace(/.(?=.{4})/g, "•")}` : ""}
                    {c.last_synced_at
                      ? ` · synchro ${new Date(c.last_synced_at).toLocaleDateString("fr-FR")}`
                      : ""}
                  </div>
                </div>

                {c.status === "linked" && c.gc_account_id && (
                  <div style={{ width: 220 }}>
                    <Select
                      value={c.account_id ?? ""}
                      onChange={(e) => handleLink(c.id, e.target.value)}
                    >
                      <option value="" disabled>
                        Associer un compte…
                      </option>
                      {accountOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  {c.status === "linked" && (
                    <Button
                      variant="secondary"
                      leftIcon={<RefreshCw size={16} />}
                      loading={busy === c.id}
                      disabled={!c.account_id}
                      onClick={() => handleSync(c.id)}
                    >
                      Synchroniser
                    </Button>
                  )}
                  <IconButton label="Supprimer" onClick={() => handleDelete(c.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <InstitutionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  );
}
