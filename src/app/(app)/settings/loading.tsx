import { PageHeaderSkeleton, CardSkeleton } from "@/components/layout/PageSkeleton";

export default function SettingsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: 640 }}>
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={2} />
      </div>
    </>
  );
}
