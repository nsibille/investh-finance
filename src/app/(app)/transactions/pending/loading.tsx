import { PageHeaderSkeleton, TableSkeleton } from "@/components/layout/PageSkeleton";

export default function PendingLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} withFilters={false} />
    </>
  );
}
