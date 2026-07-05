import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/layout/PageSkeleton";

export default function AccountsLoading() {
  return (
    <>
      <PageHeaderSkeleton withActions />
      <CardGridSkeleton count={6} minWidth={280} height={120} />
    </>
  );
}
