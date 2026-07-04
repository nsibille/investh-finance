import { SkeletonLine } from "@/components/ui/Skeleton";
import { PageHeaderSkeleton, CardSkeleton } from "@/components/layout/PageSkeleton";

export default function ImportLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div style={{ margin: "var(--space-8) 0 var(--space-4)" }}>
        <SkeletonLine width={200} />
      </div>
      <CardSkeleton height={160} />
      <div style={{ margin: "var(--space-8) 0 var(--space-4)" }}>
        <SkeletonLine width={240} />
      </div>
      <CardSkeleton height={120} />
    </>
  );
}
