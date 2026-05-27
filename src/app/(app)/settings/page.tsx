import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { isGoCardlessConfigured } from "@/lib/gocardless/client";
import { signOut } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

function StatusLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
      {ok ? (
        <CheckCircle2 size={16} style={{ color: "var(--color-success)" }} />
      ) : (
        <XCircle size={16} style={{ color: "var(--color-text-muted)" }} />
      )}
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const gocardless = isGoCardlessConfigured();

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Profil, intégrations et informations." />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: 640 }}>
        <Card>
          <h2 className="card-analytics__title">Profil</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Avatar email={user?.email ?? ""} src={avatarUrl} />
            <div>
              <div style={{ fontWeight: "var(--fw-medium)" }}>{user?.email}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                Propriétaire (accès exclusif)
              </div>
            </div>
          </div>
          <div style={{ marginTop: "var(--space-4)" }}>
            <form action={signOut}>
              <Button variant="secondary" type="submit">Se déconnecter</Button>
            </form>
          </div>
        </Card>

        <Card>
          <h2 className="card-analytics__title">Intégrations</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <StatusLine ok={gocardless}>
              Connecteur bancaire GoCardless{" "}
              {gocardless ? "configuré" : "non configuré (clés API manquantes)"}
            </StatusLine>
            <StatusLine ok>
              Import de relevés PDF (BforBank, Société Générale)
            </StatusLine>
            <StatusLine ok>Stockage des justificatifs (Supabase Storage)</StatusLine>
          </div>
        </Card>

        <Card>
          <h2 className="card-analytics__title">À propos</h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: "0 0 var(--space-3)" }}>
            <strong>Lyra</strong> — application de finances personnelles mono‑utilisateur.
          </p>
          <Link href="/design-system" style={{ fontSize: "var(--text-sm)", color: "var(--color-text-link)" }}>
            Voir le design system →
          </Link>
        </Card>
      </div>
    </>
  );
}
