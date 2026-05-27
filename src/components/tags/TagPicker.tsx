"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import {
  addTransactionTag,
  removeTransactionTag,
  createAndAttachTag,
} from "@/server/actions/tags";
import type { Tag } from "@/lib/tags/queries";

type TagChip = { id: string; name: string };

export function TagPicker({
  transactionId,
  tags,
  allTags,
}: {
  transactionId: string;
  tags: Tag[];
  allTags: Tag[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");

  // Local source of truth, re-synced from the server whenever the prop
  // identity changes (after router.refresh()).
  const [localTags, setLocalTags] = useState<TagChip[]>(tags);
  const [prevTags, setPrevTags] = useState(tags);
  if (tags !== prevTags) {
    setPrevTags(tags);
    setLocalTags(tags);
  }

  const currentIds = new Set(localTags.map((t) => t.id));
  const suggestions = allTags.filter((t) => !currentIds.has(t.id));

  async function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = allTags.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing && currentIds.has(existing.id)) {
      setValue("");
      return;
    }
    const tempId = existing?.id ?? `temp-${crypto.randomUUID()}`;
    const snapshot = localTags;
    setValue("");
    const res = await runOptimistic({
      apply: () => setLocalTags([...snapshot, { id: tempId, name: existing?.name ?? trimmed }]),
      rollback: () => setLocalTags(snapshot),
      run: () =>
        existing
          ? addTransactionTag(transactionId, existing.id)
          : createAndAttachTag(transactionId, trimmed),
      onError: toast.error,
    });
    if (res.ok) router.refresh();
  }

  async function remove(tagId: string) {
    const snapshot = localTags;
    const res = await runOptimistic({
      apply: () => setLocalTags(snapshot.filter((t) => t.id !== tagId)),
      rollback: () => setLocalTags(snapshot),
      run: () => removeTransactionTag(transactionId, tagId),
      onError: toast.error,
    });
    if (res.ok) router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {localTags.length === 0 && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            Aucun tag
          </span>
        )}
        {localTags.map((t) => (
          <span key={t.id} className="badge-tag-md">
            {t.name}
            <button
              type="button"
              aria-label={`Retirer ${t.name}`}
              onClick={() => remove(t.id)}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", display: "inline-flex", padding: 0 }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <div style={{ flex: 1, maxWidth: 280 }}>
          <Input
            list="tag-suggestions"
            value={value}
            placeholder="Ajouter un tag…"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(value);
              }
            }}
          />
          <datalist id="tag-suggestions">
            {suggestions.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </div>
        <button
          type="button"
          className="btn-icon-md"
          aria-label="Ajouter le tag"
          onClick={() => add(value)}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
