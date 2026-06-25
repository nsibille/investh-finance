import { redirect } from "next/navigation";
import { ShieldAlert, AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { signInWithGoogle } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth/whitelist";
import { AUTH_ENABLED } from "@/lib/auth/config";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Feature flag : en libre accès, aucune page de connexion à afficher.
  if (!AUTH_ENABLED) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isOwnerEmail(user.email)) {
    redirect("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
      }}
    >
      <div
        className="card-surface"
        style={{
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-3)",
            textAlign: "center",
          }}
        >
          <Logo size={40} showWordmark={false} />
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: "var(--fw-semibold)",
              letterSpacing: "var(--tracking-tight)",
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Connexion à Lyra
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              margin: 0,
            }}
          >
            Accès réservé au propriétaire du compte.
          </p>
        </div>

        {error === "unauthorized" && (
          <div className="alert-danger" role="alert">
            <ShieldAlert size={18} aria-hidden style={{ flexShrink: 0 }} />
            <span>
              Cet email Google n&apos;est pas autorisé à accéder à Lyra.
            </span>
          </div>
        )}
        {error === "auth" && (
          <div className="alert-danger" role="alert">
            <AlertCircle size={18} aria-hidden style={{ flexShrink: 0 }} />
            <span>
              La connexion a échoué. Merci de réessayer.
            </span>
          </div>
        )}

        <form action={signInWithGoogle}>
          <GoogleSignInButton />
        </form>
      </div>
    </main>
  );
}
