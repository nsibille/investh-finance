import { PageHeaderSkeleton, TableSkeleton } from "@/components/layout/PageSkeleton";

export default function TransfersLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} withFilters={false} />
    </>
  );
}
