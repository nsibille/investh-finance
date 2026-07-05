import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { TransactionDetail } from "@/components/transactions/TransactionDetail";
import { getTransaction } from "@/lib/transactions/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getMerchantOptions } from "@/lib/merchants/queries";
import { getRecurringOptions } from "@/lib/recurring/queries";
import { getTags, getTagsForTransaction } from "@/lib/tags/queries";
import { getAttachments } from "@/lib/attachments/queries";
import { getPersonOptions, getSharesForTransaction } from "@/lib/persons/queries";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    tx,
    subcategoryOptions,
    merchantOptions,
    recurringOptions,
    tags,
    allTags,
    attachments,
    personOptions,
    split,
  ] = await Promise.all([
    getTransaction(id),
    getSubcategoryOptions(),
    getMerchantOptions(),
    getRecurringOptions(),
    getTagsForTransaction(id),
    getTags(),
    getAttachments(id),
    getPersonOptions(),
    getSharesForTransaction(id),
  ]);

  if (!tx) notFound();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Transactions", href: "/transactions" },
          { label: tx.label },
        ]}
      />
      <div style={{ marginTop: "var(--space-5)" }}>
        <TransactionDetail
          tx={tx}
          subcategoryOptions={subcategoryOptions}
          merchantOptions={merchantOptions}
          recurringOptions={recurringOptions}
          tags={tags}
          allTags={allTags}
          attachments={attachments}
          personOptions={personOptions}
          split={split}
        />
      </div>
    </>
  );
}
