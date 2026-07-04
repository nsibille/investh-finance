import { PageHeaderSkeleton, TableSkeleton } from "@/components/layout/PageSkeleton";

export default function TransactionsLoading() {
  return (
    <>
      <PageHeaderSkeleton withActions />
      <TableSkeleton rows={10} />
    </>
  );
}
