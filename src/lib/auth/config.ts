/**
 * Feature flag : authentification Google.
 *
 * Activée par défaut (sécurité par défaut). Pour ouvrir le site en libre accès
 * — typiquement en environnement de test — poser la variable à "false".
 *
 *   AUTH_ENABLED=false            (recommandé : lue côté serveur à l'exécution)
 *   NEXT_PUBLIC_AUTH_ENABLED=false (tolérée aussi, mais gelée au build)
 *
 * Ce flag n'est consommé que côté serveur (middleware + server components), donc
 * une variable serveur classique suffit : pas besoin du préfixe NEXT_PUBLIC_.
 *
 * Quand l'auth est désactivée :
 *  - le middleware ne redirige plus vers /login ;
 *  - le layout applicatif ne vérifie plus la session ni la whitelist ;
 *  - les pages / et /login redirigent directement vers le dashboard.
 *
 * ⚠️ La RLS Supabase reste active : sans utilisateur connecté, les requêtes
 * client renvoient des données vides. Le libre accès ouvre l'UI, pas les données.
 */
const flag = process.env.AUTH_ENABLED ?? process.env.NEXT_PUBLIC_AUTH_ENABLED;

export const AUTH_ENABLED = flag !== "false";
