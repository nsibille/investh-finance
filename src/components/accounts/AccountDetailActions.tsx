"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { AccountForm } from "./AccountForm";
import {
  setAccountArchived,
  deleteAccount,
} from "@/server/actions/accounts";
import type { AccountWithBalance } from "@/lib/accounts/types";

export function AccountDetailActions({
  account,
}: {
  account: AccountWithBalance;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [archived, setArchived] = useState(account.is_archived);
  const [prevArchived, setPrevArchived] = useState(account.is_archived);
  if (account.is_archived !== prevArchived) {
    setPrevArchived(account.is_archived);
    setArchived(account.is_archived);
  }

  async function handleArchive() {
    const next = !archived;
    const res = await runOptimistic({
      apply: () => setArchived(next),
      rollback: () => setArchived(!next),
      run: () => setAccountArchived(account.id, next),
      onError: toast.error,
    });
    if (res.ok) {
      toast.success(next ? "Compte archivé" : "Compte désarchivé");
      router.refresh();
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteAccount(account.id);
    setDeleting(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Compte supprimé");
    router.push("/accounts");
  }

  return (
    <div style={{ display: "flex", gap: "var(--space-3)" }}>
      <Button
        variant="secondary"
        leftIcon={<Pencil size={16} />}
        onClick={() => setEditing(true)}
      >
        Modifier
      </Button>
      <Button
        variant="secondary"
        leftIcon={
          archived ? <ArchiveRestore size={16} /> : <Archive size={16} />
        }
        onClick={handleArchive}
      >
        {archived ? "Désarchiver" : "Archiver"}
      </Button>
      <Button
        variant="danger"
        leftIcon={<Trash2 size={16} />}
        onClick={() => setConfirmDelete(true)}
      >
        Supprimer
      </Button>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Modifier le compte"
      >
        <AccountForm
          mode="edit"
          id={account.id}
          initial={{
            name: account.name,
            type: account.type,
            bank: account.bank ?? "",
            connection_name: account.connection_name ?? "",
            initial_balance: account.initial_balance,
            initial_date: account.initial_date,
            currency: account.currency,
            color: account.color ?? "#5B5BD6",
          }}
          onDone={() => setEditing(false)}
        />
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer le compte ?"
        variantClass="modal-confirm-danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Annuler
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <Alert variant="danger">
          Cette action supprime le compte <strong>{account.name}</strong> et
          toutes ses transactions. Elle est irréversible. Préfère l&apos;archivage
          pour conserver l&apos;historique.
        </Alert>
      </Modal>
    </div>
  );
}
