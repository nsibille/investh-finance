import { PageHeaderSkeleton, TableSkeleton } from "@/components/layout/PageSkeleton";

export default function DeferredLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} withFilters={false} />
    </>
  );
}
