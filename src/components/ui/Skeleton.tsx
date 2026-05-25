import type { CSSProperties } from "react";

export function SkeletonLine({ width }: { width?: string | number }) {
  return <span className="skeleton-line" style={{ width, display: "block" }} />;
}

export function SkeletonBlock({
  height = 80,
  style,
}: {
  height?: number | string;
  style?: CSSProperties;
}) {
  return <span className="skeleton-block" style={{ height, display: "block", ...style }} />;
}
