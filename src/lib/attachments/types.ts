import type { Database } from "@/types/database.types";

export const ATTACHMENTS_BUCKET = "attachments";

export type Attachment = Database["public"]["Tables"]["attachments"]["Row"];

export interface AttachmentView extends Attachment {
  url: string | null;
}
