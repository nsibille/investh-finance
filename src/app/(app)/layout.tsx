import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth/whitelist";
import { AUTH_ENABLED } from "@/lib/auth/config";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Feature flag : en libre accès on n'exige ni session ni whitelist.
  if (AUTH_ENABLED) {
    if (!user) {
      redirect("/login");
    }

    if (!isOwnerEmail(user.email)) {
      await supabase.auth.signOut();
      redirect("/login?error=unauthorized");
    }
  }

  const email = user?.email ?? "Accès libre";
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Header
          email={email}
          avatarUrl={avatarUrl}
          showSignOut={AUTH_ENABLED}
        />
        <main className="app-content">{children}</main>
      </div>
      <GlobalSearch />
    </div>
  );
}
