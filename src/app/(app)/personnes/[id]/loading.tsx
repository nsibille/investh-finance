import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/layout/PageSkeleton";

export default function PersonneDetailLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={2} minWidth={300} height={200} />
    </>
  );
}
