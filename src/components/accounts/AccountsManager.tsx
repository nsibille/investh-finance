"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/hooks/useToast";
import { AccountCard } from "./AccountCard";
import { AccountForm } from "./AccountForm";
import { setAccountArchived } from "@/server/actions/accounts";
import type { AccountWithBalance } from "@/lib/accounts/types";

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; account: AccountWithBalance }
  | null;

export function AccountsManager({
  accounts,
}: {
  accounts: AccountWithBalance[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { active, archived } = useMemo(() => {
    return {
      active: accounts.filter((a) => !a.is_archived),
      archived: accounts.filter((a) => a.is_archived),
    };
  }, [accounts]);

  const visible = showArchived ? accounts : active;

  async function handleToggleArchive(account: AccountWithBalance) {
    const res = await setAccountArchived(account.id, !account.is_archived);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(account.is_archived ? "Compte désarchivé" : "Compte archivé");
    router.refresh();
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-5)",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        {archived.length > 0 ? (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            <Checkbox
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Afficher les comptes archivés ({archived.length})
          </label>
        ) : (
          <span />
        )}
        <Button
          leftIcon={<Plus size={16} />}
          onClick={() => setModal({ mode: "create" })}
        >
          Nouveau compte
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="Aucun compte"
            description="Crée ton premier compte pour commencer à suivre tes finances."
            action={
              <Button
                leftIcon={<Plus size={16} />}
                onClick={() => setModal({ mode: "create" })}
              >
                Nouveau compte
              </Button>
            }
          />
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {visible.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={(a) => setModal({ mode: "edit", account: a })}
              onToggleArchive={handleToggleArchive}
            />
          ))}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Modifier le compte" : "Nouveau compte"}
      >
        {modal && (
          <AccountForm
            mode={modal.mode}
            id={modal.mode === "edit" ? modal.account.id : undefined}
            initial={
              modal.mode === "edit"
                ? {
                    name: modal.account.name,
                    type: modal.account.type,
                    bank: modal.account.bank ?? "",
                    initial_balance: modal.account.initial_balance,
                    initial_date: modal.account.initial_date,
                    currency: modal.account.currency,
                    color: modal.account.color ?? "#5B5BD6",
                  }
                : undefined
            }
            onDone={() => setModal(null)}
          />
        )}
      </Modal>
    </>
  );
}
