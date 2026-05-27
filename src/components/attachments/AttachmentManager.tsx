"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Download, Trash2 } from "lucide-react";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { IconButton } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/hooks/useToast";
import { createClient } from "@/lib/supabase/client";
import { ATTACHMENTS_BUCKET, type AttachmentView } from "@/lib/attachments/types";
import { addAttachment, deleteAttachment } from "@/server/actions/attachments";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function AttachmentManager({
  transactionId,
  attachments,
}: {
  transactionId: string;
  attachments: AttachmentView[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${transactionId}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error(error.message);
        return;
      }
      const res = await addAttachment(transactionId, {
        storage_path: path,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Justificatif ajouté");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    const res = await deleteAttachment(id, transactionId);
    if (!res.ok) return toast.error(res.error);
    toast.success("Justificatif supprimé");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {attachments.length > 0 && (
        <div className="attachment-list">
          {attachments.map((a) => (
            <div className="attachment-list__item" key={a.id}>
              <FileText size={16} style={{ color: "var(--color-text-muted)" }} />
              <span className="attachment-list__name">{a.filename}</span>
              <span className="attachment-list__size">{formatSize(a.size_bytes)}</span>
              {a.url && (
                <a href={a.url} target="_blank" rel="noopener noreferrer" download={a.filename}>
                  <IconButton label="Télécharger"><Download size={16} /></IconButton>
                </a>
              )}
              <IconButton label="Supprimer" onClick={() => remove(a.id)}>
                <Trash2 size={16} />
              </IconButton>
            </div>
          ))}
        </div>
      )}

      {uploading ? (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-4)", justifyContent: "center", color: "var(--color-text-muted)" }}>
          <Spinner size="sm" /> Envoi en cours…
        </div>
      ) : (
        <FileDropzone mini onFile={handleFile} hint="PDF, image (10 Mo max)" />
      )}
    </div>
  );
}
