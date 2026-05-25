"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { UploadCloud, FileCheck2 } from "lucide-react";

interface FileDropzoneProps {
  onFile: (file: File) => void;
  accept?: string;
  /** Max size in megabytes. Default 10. */
  maxSizeMb?: number;
  mini?: boolean;
  hint?: ReactNode;
}

export function FileDropzone({
  onFile,
  accept,
  maxSizeMb = 10,
  mini = false,
  hint,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handle(file: File | undefined) {
    if (!file) return;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${maxSizeMb} Mo).`);
      setFileName(null);
      return;
    }
    setError(null);
    setFileName(file.name);
    onFile(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handle(e.dataTransfer.files?.[0]);
  }

  const Icon = fileName ? FileCheck2 : UploadCloud;

  return (
    <div
      className={mini ? "file-dropzone-mini" : "file-dropzone"}
      data-drag-over={dragOver || undefined}
      data-has-file={fileName ? true : undefined}
      data-error={error ? true : undefined}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
    >
      <Icon size={mini ? 20 : 32} aria-hidden />
      <span style={{ fontSize: "var(--text-sm)" }}>
        {error ??
          fileName ??
          (mini
            ? "Ajouter un justificatif"
            : "Glisse un fichier ou clique pour parcourir")}
      </span>
      {hint && !error && !fileName && (
        <span className="form-help-text">{hint}</span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  );
}
