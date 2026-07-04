import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth/whitelist";
import { AUTH_ENABLED } from "@/lib/auth/config";

export default async function Home() {
  // Feature flag : libre accès, on file directement au dashboard.
  if (!AUTH_ENABLED) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isOwnerEmail(user.email)) {
    redirect("/dashboard");
  }
  redirect("/login");
}
