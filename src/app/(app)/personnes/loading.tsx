import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/layout/PageSkeleton";

export default function PersonnesLoading() {
  return (
    <>
      <PageHeaderSkeleton withActions />
      <CardGridSkeleton count={4} minWidth={300} height={160} />
    </>
  );
}
