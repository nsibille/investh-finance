import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { TransactionDetail } from "@/components/transactions/TransactionDetail";
import { getTransaction } from "@/lib/transactions/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getTags, getTagsForTransaction } from "@/lib/tags/queries";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tx, subcategoryOptions, tags, allTags] = await Promise.all([
    getTransaction(id),
    getSubcategoryOptions(),
    getTagsForTransaction(id),
    getTags(),
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
          tags={tags}
          allTags={allTags}
        />
      </div>
    </>
  );
}
