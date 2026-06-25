/**
 * Feature flag : authentification Google.
 *
 * Activée par défaut (sécurité par défaut). Pour ouvrir le site en libre accès
 * — typiquement en environnement de test — poser `NEXT_PUBLIC_AUTH_ENABLED=false`.
 *
 * Quand l'auth est désactivée :
 *  - le middleware ne redirige plus vers /login ;
 *  - le layout applicatif ne vérifie plus la session ni la whitelist ;
 *  - les pages / et /login redirigent directement vers le dashboard.
 *
 * ⚠️ La RLS Supabase reste active : sans utilisateur connecté, les requêtes
 * client renvoient des données vides. Le libre accès ouvre l'UI, pas les données.
 */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED !== "false";
