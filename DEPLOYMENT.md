# Déploiement de Lyra (Vercel + Supabase)

Application mono-utilisateur. Tout l'accès aux données est protégé par RLS via
`is_owner()` (email Google whitelisté, déjà fixé dans la migration initiale).

## 1. Variables d'environnement (Vercel → Project Settings → Environment Variables)

| Variable | Valeur | Exposée client |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://uujmbqwbnztfxuzhnjwp.supabase.co` | oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé anon Supabase | oui |
| `NEXT_PUBLIC_OWNER_EMAIL` | `nicolas.h.sibille@gmail.com` | oui (affichage) |
| `NEXT_PUBLIC_APP_URL` | `https://<ton-domaine-vercel>` | oui |
| `GOCARDLESS_SECRET_ID` | secret GoCardless | **non** (serveur) |
| `GOCARDLESS_SECRET_KEY` | secret GoCardless | **non** (serveur) |

> Les clés GoCardless sont facultatives : sans elles, l'import PDF et tout le
> reste fonctionnent ; seule la connexion bancaire automatique est désactivée.

## 2. Google OAuth (Supabase + Google Cloud Console)

1. **Google Cloud Console** → APIs & Services → Credentials → *Create OAuth client ID*
   (type *Web application*).
   - Authorized redirect URI :
     `https://uujmbqwbnztfxuzhnjwp.supabase.co/auth/v1/callback`
   - Récupère le **Client ID** et le **Client Secret**.
2. **Supabase Dashboard** → Authentication → Providers → **Google** : activer,
   coller Client ID + Secret.
3. **Supabase Dashboard** → Authentication → URL Configuration :
   - *Site URL* : `https://<ton-domaine-vercel>`
   - *Redirect URLs* : ajouter `https://<ton-domaine-vercel>/**` et
     `http://localhost:3000/**` (pour le dev).

## 3. Base de données & Storage

Déjà appliqués sur le projet Supabase via les migrations (`supabase/migrations/`) :

- Schéma complet + RLS owner-only (`00000000000000_initial_schema.sql`)
- Table `bank_connections` (GoCardless)
- Buckets Storage privés `attachments` et `imports` + RLS owner

Pour un nouveau projet Supabase, rejouer ces migrations puis remplacer l'email
dans `is_owner()`.

## 4. GoCardless Bank Account Data (optionnel)

1. Créer un compte sur https://bankaccountdata.gocardless.com
2. Developers → User secrets → générer **Secret ID** + **Secret Key**
3. Les ajouter dans les variables Vercel (`GOCARDLESS_SECRET_ID` / `_KEY`).
4. Le consentement bancaire DSP2 est à renouveler tous les 90 jours.

## 5. Vercel

1. Importer le dépôt GitHub `nsibille/investh-finance`.
2. Framework détecté : Next.js (aucune config spéciale).
3. Renseigner les variables d'environnement (section 1).
4. Déployer, puis mettre à jour `NEXT_PUBLIC_APP_URL` avec l'URL finale et
   ajouter ce domaine dans Supabase (section 2.3).

## 6. Vérifications post-déploiement

- [ ] Connexion Google → accès au dashboard (email whitelisté).
- [ ] Un autre compte Google est refusé (`/login?error=unauthorized`).
- [ ] Import d'un relevé PDF → transactions visibles.
- [ ] Upload d'un justificatif sur une transaction.
- [ ] (Si configuré) connexion d'une banque via GoCardless + synchro.
