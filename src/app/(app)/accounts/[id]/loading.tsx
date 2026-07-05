import { SkeletonLine } from "@/components/ui/Skeleton";
import { CardGridSkeleton, CardSkeleton } from "@/components/layout/PageSkeleton";

export default function AccountDetailLoading() {
  return (
    <>
      <SkeletonLine width={220} />
      <div style={{ margin: "var(--space-4) 0 var(--space-6)", display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--radius-full)",
            background:
              "linear-gradient(90deg, var(--color-bg-subtle) 0%, var(--color-border) 50%, var(--color-bg-subtle) 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <SkeletonLine width={180} />
          <SkeletonLine width={120} />
        </div>
      </div>
      <div style={{ marginBottom: "var(--space-8)" }}>
        <CardGridSkeleton count={4} minWidth={220} height={72} />
      </div>
      <CardSkeleton height={120} />
    </>
  );
}
