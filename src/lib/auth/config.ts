/**
 * Feature flag : authentification Google.
 *
 * ⚠️ DÉSACTIVÉE PAR DÉFAUT (mode libre accès / test).
 *
 * Le site est ouvert sans connexion tant que la variable n'est pas explicitement
 * posée à "true". Aucune config requise pour le libre accès.
 *
 *   (rien)            -> libre accès (auth désactivée)
 *   AUTH_ENABLED=true -> réactive la connexion Google + whitelist
 *
 * Ce flag n'est consommé que côté serveur (middleware + server components).
 * NEXT_PUBLIC_AUTH_ENABLED reste accepté en repli pour la même valeur.
 *
 * Quand l'auth est désactivée :
 *  - le middleware ne redirige plus vers /login ;
 *  - le layout applicatif ne vérifie plus la session ni la whitelist ;
 *  - les pages / et /login redirigent directement vers le dashboard.
 *
 * ⚠️ La RLS Supabase reste active : sans utilisateur connecté, les requêtes
 * client renvoient des données vides. Le libre accès ouvre l'UI, pas les données.
 *
 * 👉 Pour arriver DIRECTEMENT sur tes données sans login (dev / instance
 * privée), renseigne `SUPABASE_SERVICE_ROLE_KEY` : le client serveur
 * (`lib/supabase/server.ts`) l'utilise alors et contourne la RLS. À réserver
 * à une instance locale/privée (voir l'avertissement dans server.ts).
 */
const flag = process.env.AUTH_ENABLED ?? process.env.NEXT_PUBLIC_AUTH_ENABLED;

export const AUTH_ENABLED = flag === "true";
