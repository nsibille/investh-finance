import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/layout/PageSkeleton";

export default function EnseignesLoading() {
  return (
    <>
      <PageHeaderSkeleton withActions />
      <CardGridSkeleton count={6} minWidth={300} height={140} />
    </>
  );
}
