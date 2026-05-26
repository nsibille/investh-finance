"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";
import {
  addTransactionTag,
  removeTransactionTag,
  createAndAttachTag,
} from "@/server/actions/tags";
import type { Tag } from "@/lib/tags/queries";

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
  const [adding, setAdding] = useState(false);

  const currentIds = new Set(tags.map((t) => t.id));
  const suggestions = allTags.filter((t) => !currentIds.has(t.id));

  async function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    const existing = allTags.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const res = existing
      ? await addTransactionTag(transactionId, existing.id)
      : await createAndAttachTag(transactionId, trimmed);
    setAdding(false);
    if (!res.ok) return toast.error(res.error);
    setValue("");
    router.refresh();
  }

  async function remove(tagId: string) {
    const res = await removeTransactionTag(transactionId, tagId);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {tags.length === 0 && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            Aucun tag
          </span>
        )}
        {tags.map((t) => (
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
            disabled={adding}
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
