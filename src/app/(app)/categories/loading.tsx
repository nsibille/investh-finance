import { PageHeaderSkeleton, CardSkeleton } from "@/components/layout/PageSkeleton";

export default function CategoriesLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} height={56} />
        ))}
      </div>
    </>
  );
}
