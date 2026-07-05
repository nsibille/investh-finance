import { SkeletonLine } from "@/components/ui/Skeleton";
import { CardSkeleton } from "@/components/layout/PageSkeleton";

export default function TransactionDetailLoading() {
  return (
    <>
      <SkeletonLine width={260} />
      <div style={{ marginTop: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
    </>
  );
}
