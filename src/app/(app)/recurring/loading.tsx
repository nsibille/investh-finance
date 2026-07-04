import { PageHeaderSkeleton, TableSkeleton } from "@/components/layout/PageSkeleton";

export default function RecurringLoading() {
  return (
    <>
      <PageHeaderSkeleton withActions />
      <TableSkeleton rows={6} withFilters={false} />
    </>
  );
}
