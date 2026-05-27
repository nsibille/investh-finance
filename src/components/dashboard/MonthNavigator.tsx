"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import { MonthPicker } from "@/components/ui/MonthPicker";

export function MonthNavigator({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = new Date(`${month}-01T00:00:00`);

  function onChange(next: Date) {
    const sp = new URLSearchParams(params.toString());
    sp.set("month", format(next, "yyyy-MM"));
    router.push(`${pathname}?${sp.toString()}`);
  }

  return <MonthPicker value={value} onChange={onChange} />;
}
