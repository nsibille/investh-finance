import { createClient } from "@/lib/supabase/server";
import { ATTACHMENTS_BUCKET, type AttachmentView } from "./types";

export type { Attachment, AttachmentView } from "./types";

export async function getAttachments(
  transactionId: string,
): Promise<AttachmentView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });

  const rows = data ?? [];
  return Promise.all(
    rows.map(async (a) => {
      const { data: signed } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(a.storage_path, 3600);
      return { ...a, url: signed?.signedUrl ?? null };
    }),
  );
}
