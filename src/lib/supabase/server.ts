import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import { AUTH_ENABLED } from "@/lib/auth/config";

export async function createClient() {
  // Mode libre accès / dev : sans utilisateur connecté, la RLS masque toutes
  // les données. Si une clé service_role est fournie, on l'utilise (serveur
  // UNIQUEMENT) pour accéder directement aux données du propriétaire — on
  // arrive donc sur ses données sans authentification.
  //
  // ⚠️ SÉCURITÉ : le service_role contourne la RLS. Réserve ce mode à une
  // instance locale/privée. Ne déploie JAMAIS publiquement avec AUTH_ENABLED
  // désactivée + cette clé, sinon tes données financières sont accessibles à
  // quiconque connaît l'URL.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!AUTH_ENABLED && serviceKey) {
    return createServiceClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Called from a Server Component: the middleware refreshes the
          // session cookie, so swallowing the write here is safe.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* no-op in Server Components */
          }
        },
      },
    },
  );
}
