import { PageHeaderSkeleton, TableSkeleton } from "@/components/layout/PageSkeleton";

export default function RulesLoading() {
  return (
    <>
      <PageHeaderSkeleton withActions />
      <TableSkeleton rows={8} withFilters={false} />
    </>
  );
}
