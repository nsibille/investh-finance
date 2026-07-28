# Design System — Lyra

> Version 1.0
> **RÈGLE** : consulter l'**index des slugs** (en bas de ce fichier) avant tout composant.
> Slug existant → réutiliser. Proche → variante. Inexistant → créer + documenter + implémenter.

---

## Direction artistique

**Ambiance** — Minimaliste pro façon fintech moderne (FinSage / Linear / Stripe). Background blanc cassé, dégradés "aurora" subtils dans les hero sections (rose / violet / bleu pâle), couleur primaire indigo, sémantique finance claire (vert revenus / rouge dépenses). Densité compacte sur les tables, généreuse sur les KPI. Typographie géométrique tight (Geist). Boutons rectangulaires à coins légèrement arrondis.

**Police principale** — **Geist Sans** (UI) chargée via le package `geist/font/sans`, graisses 400/500/600/700. Fallback : `system-ui, -apple-system, sans-serif`.

**Police monospace** — **Geist Mono** (montants, codes, identifiants techniques) via `geist/font/mono`. Essentielle pour aligner les chiffres dans les tables. Fallback : `ui-monospace, SFMono-Regular, monospace`.

**Éléments décoratifs** — Dégradés "aurora" multicolores flous (radial-gradient combinés) en background du `dashboard-hero` uniquement. Ailleurs : surface plate. Pas de pattern, pas de bruit, pas d'ombres dramatiques.

---

## Conventions de nommage des slugs

```
[domaine]-[type]-[variante]
```

**Domaines** : `btn` · `input` · `badge` · `avatar` · `card` · `layout` · `nav` · `modal` · `table` · `status` · `form` · `tab` · `deco` · `skeleton` · `toast` · `alert` · `chart` · `amount` · `kpi` · `account` · `transaction` · `category` · `tag` · `rule` · `recurring` · `import` · `search` · `attachment` · `file` · `progress` · `tooltip` · `dashboard`

**Types** : `primary` · `secondary` · `ghost` · `icon` · `text` · `outline` · `mini` · `surface` · `interactive`

**Variantes** : `sm` · `md` · `lg` · `success` · `warning` · `danger` · `info` · `neutral` · `pending` · `validated` · `ignored` · `new` · `duplicate` · `active` · `missing` · `positive` · `negative` · `revenus` · `depenses` · `solde` · `epargne`

---

## Tokens — variables CSS

> **NON NÉGOCIABLE** : aucun composant ne hardcode de couleur, taille, ombre ou rayon. Toujours via variable CSS.

À placer dans `src/app/globals.css` dans `:root { … }`.

```css
:root {
  /* ============================================================
     COULEURS PRIMAIRES — Indigo Lyra
     ============================================================ */
  --color-brand-primary:        #5B5BD6;
  --color-brand-primary-50:     #EFEFFD;
  --color-brand-primary-100:    #DEDEFB;
  --color-brand-primary-200:    #BDBDF7;
  --color-brand-primary-300:    #9C9CF2;
  --color-brand-primary-400:    #7B7BEE;
  --color-brand-primary-500:    #5B5BD6;
  --color-brand-primary-600:    #4949AB;
  --color-brand-primary-700:    #373780;
  --color-brand-primary-800:    #252556;
  --color-brand-primary-900:    #13132B;
  --color-brand-dark:           #1A1A2E;

  /* Fonds & surfaces */
  --color-bg-page:              #FAFAFA;
  --color-bg-surface:           #FFFFFF;
  --color-bg-subtle:            #F4F4F5;
  --color-bg-overlay:           rgba(10, 10, 11, 0.5);

  /* Bordures */
  --color-border:               #E4E4E7;
  --color-border-strong:        #D4D4D8;
  --color-border-focus:         var(--color-brand-primary);

  /* Textes */
  --color-text-primary:         #0A0A0B;
  --color-text-secondary:       #3F3F46;
  --color-text-muted:           #71717A;
  --color-text-disabled:        #A1A1AA;
  --color-text-on-brand:        #FFFFFF;
  --color-text-link:            var(--color-brand-primary-600);

  /* Feedback — les 4 obligatoires */
  --color-success:              #10B981;
  --color-success-light:        #D1FAE5;
  --color-success-dark:         #047857;
  --color-warning:              #F59E0B;
  --color-warning-light:        #FEF3C7;
  --color-warning-dark:         #B45309;
  --color-danger:               #EF4444;
  --color-danger-light:         #FEE2E2;
  --color-danger-dark:          #B91C1C;
  --color-info:                 #3B82F6;
  --color-info-light:           #DBEAFE;
  --color-info-dark:            #1D4ED8;

  /* Couleurs métier — finance */
  --color-finance-revenus:           var(--color-success);
  --color-finance-revenus-bg:        var(--color-success-light);
  --color-finance-depenses:          var(--color-danger);
  --color-finance-depenses-bg:       var(--color-danger-light);
  --color-finance-neutre:            var(--color-info);
  --color-finance-investissement:    #8B5CF6;
  --color-finance-investissement-bg: #EDE9FE;
  --color-finance-prelevement:       #71717A;
  --color-finance-frais-fixe:        #F97316;
  --color-finance-frais-fixe-bg:     #FFEDD5;

  /* Couleurs décoratives — aurora gradient */
  --color-aurora-1:             #FCE7F3;
  --color-aurora-2:             #DBEAFE;
  --color-aurora-3:             #E9D5FF;
  --color-aurora-4:             #D1FAE5;

  /* Typographie */
  --font-primary:               'Geist', system-ui, -apple-system, sans-serif;
  --font-mono:                  'Geist Mono', ui-monospace, SFMono-Regular, monospace;

  --text-xs:                    0.75rem;
  --text-sm:                    0.875rem;
  --text-base:                  1rem;
  --text-lg:                    1.125rem;
  --text-xl:                    1.25rem;
  --text-2xl:                   1.5rem;
  --text-3xl:                   1.875rem;
  --text-4xl:                   2.25rem;
  --text-5xl:                   3rem;

  --fw-light:                   300;
  --fw-regular:                 400;
  --fw-medium:                  500;
  --fw-semibold:                600;
  --fw-bold:                    700;

  --leading-tight:              1.2;
  --leading-normal:             1.5;
  --leading-relaxed:            1.7;

  --tracking-tight:             -0.02em;
  --tracking-normal:            0;
  --tracking-wide:              0.025em;
  --tracking-wider:             0.05em;

  /* Espacements — système 4px */
  --space-1:                    0.25rem;
  --space-2:                    0.5rem;
  --space-3:                    0.75rem;
  --space-4:                    1rem;
  --space-5:                    1.25rem;
  --space-6:                    1.5rem;
  --space-8:                    2rem;
  --space-10:                   2.5rem;
  --space-12:                   3rem;
  --space-16:                   4rem;
  --space-20:                   5rem;

  /* Rayons */
  --radius-sm:                  4px;
  --radius-md:                  8px;
  --radius-lg:                  12px;
  --radius-xl:                  16px;
  --radius-2xl:                 20px;
  --radius-full:                9999px;

  /* Ombres */
  --shadow-xs:                  0 1px 1px rgba(10, 10, 11, 0.04);
  --shadow-sm:                  0 1px 2px rgba(10, 10, 11, 0.06), 0 1px 1px rgba(10, 10, 11, 0.04);
  --shadow-md:                  0 4px 6px -1px rgba(10, 10, 11, 0.08), 0 2px 4px -1px rgba(10, 10, 11, 0.04);
  --shadow-lg:                  0 10px 15px -3px rgba(10, 10, 11, 0.08), 0 4px 6px -2px rgba(10, 10, 11, 0.04);
  --shadow-xl:                  0 20px 25px -5px rgba(10, 10, 11, 0.10), 0 10px 10px -5px rgba(10, 10, 11, 0.04);
  --shadow-inner:               inset 0 2px 4px rgba(10, 10, 11, 0.06);
  --shadow-brand:               0 4px 14px rgba(91, 91, 214, 0.25);
  --shadow-focus:               0 0 0 3px rgba(91, 91, 214, 0.2);

  /* Z-index */
  --z-base:                     0;
  --z-dropdown:                 1000;
  --z-sticky:                   1020;
  --z-fixed:                    1030;
  --z-modal-backdrop:           1040;
  --z-modal:                    1050;
  --z-popover:                  1060;
  --z-tooltip:                  1070;
  --z-toast:                    1080;

  /* Transitions */
  --transition-fast:            120ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base:            200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow:            320ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring:          400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ================================================================
   DARK MODE — préparé pour V2 (light only en V1)
   ================================================================ */
@media (prefers-color-scheme: dark) {
  :root[data-theme="dark"] {
    --color-bg-page:            #0A0A0B;
    --color-bg-surface:         #18181B;
    --color-bg-subtle:          #27272A;
    --color-bg-overlay:         rgba(0, 0, 0, 0.7);
    --color-border:             #27272A;
    --color-border-strong:      #3F3F46;
    --color-text-primary:       #FAFAFA;
    --color-text-secondary:     #D4D4D8;
    --color-text-muted:         #A1A1AA;
    --color-text-disabled:      #52525B;
    --color-aurora-1:           rgba(252, 231, 243, 0.08);
    --color-aurora-2:           rgba(219, 234, 254, 0.08);
    --color-aurora-3:           rgba(233, 213, 255, 0.08);
    --color-aurora-4:           rgba(209, 250, 229, 0.08);
    --shadow-xs:                0 1px 1px rgba(0, 0, 0, 0.25);
    --shadow-sm:                0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-md:                0 4px 6px -1px rgba(0, 0, 0, 0.4);
    --shadow-lg:                0 10px 15px -3px rgba(0, 0, 0, 0.5);
    --shadow-xl:                0 20px 25px -5px rgba(0, 0, 0, 0.6);
  }
}
```

---

# Composants

> Chaque composant a TOUS ses états documentés. Dark mode : "auto" = géré par les tokens.

---

## Boutons

### `btn-primary-md`
**Bouton principal — taille medium**
- Usage : action principale d'une page (Valider, Importer, Créer). Un seul `btn-primary-*` par section.
- États : default, hover, focus, active, disabled, loading
- Composition : icon-leading + label + icon-trailing (optionnels)
- Dark mode : auto

```css
.btn-primary-md {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  height: 40px; padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-brand-primary); color: var(--color-text-on-brand);
  font-family: var(--font-primary); font-size: var(--text-sm); font-weight: var(--fw-medium);
  letter-spacing: var(--tracking-tight);
  border: none; cursor: pointer;
  transition: background var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}
.btn-primary-md:hover { background: var(--color-brand-primary-600); }
.btn-primary-md:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.btn-primary-md:active { transform: translateY(1px); background: var(--color-brand-primary-700); }
.btn-primary-md:disabled { background: var(--color-bg-subtle); color: var(--color-text-disabled); cursor: not-allowed; }
.btn-primary-md[data-loading="true"] { pointer-events: none; color: transparent; position: relative; }
.btn-primary-md[data-loading="true"]::after {
  content: ''; position: absolute; width: 16px; height: 16px;
  border: 2px solid var(--color-text-on-brand); border-top-color: transparent;
  border-radius: var(--radius-full); animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

### `btn-primary-sm`
**Variante small** : height 32px, padding 0 var(--space-3), font-size var(--text-xs). Mêmes états.

### `btn-primary-lg`
**Variante large** : height 48px, padding 0 var(--space-6), font-size var(--text-base). Mêmes états.

### `btn-secondary-md`
**Bouton secondaire — taille medium**
- Usage : action complémentaire (Annuler, Filtrer, Exporter)
- États : default, hover, focus, active, disabled, loading
- Dark mode : auto

```css
.btn-secondary-md {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  height: 40px; padding: 0 var(--space-4); border-radius: var(--radius-md);
  background: var(--color-bg-surface); color: var(--color-text-primary);
  font-family: var(--font-primary); font-size: var(--text-sm); font-weight: var(--fw-medium);
  border: 1px solid var(--color-border); cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.btn-secondary-md:hover { background: var(--color-bg-subtle); border-color: var(--color-border-strong); }
.btn-secondary-md:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.btn-secondary-md:disabled { color: var(--color-text-disabled); cursor: not-allowed; background: var(--color-bg-subtle); }
```

### `btn-ghost-md`
**Bouton transparent — medium**
- Usage : actions tertiaires (toolbars, dropdowns)
- États : default, hover, focus, active, disabled

```css
.btn-ghost-md {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  height: 36px; padding: 0 var(--space-3); border-radius: var(--radius-md);
  background: transparent; color: var(--color-text-secondary);
  font-family: var(--font-primary); font-size: var(--text-sm); font-weight: var(--fw-medium);
  border: none; cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.btn-ghost-md:hover { background: var(--color-bg-subtle); color: var(--color-text-primary); }
.btn-ghost-md:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.btn-ghost-md:disabled { color: var(--color-text-disabled); cursor: not-allowed; }
```

### `btn-ghost-sm`
**Variante small** : height 28px, padding 0 var(--space-2), font-size var(--text-xs).

### `btn-icon-md`
**Bouton icône carré — medium (36×36)**
- Usage : action atomique iconique (Edit, Delete, Plus, Settings)
- Composition : enfant `<svg>` Lucide 16×16
- États : default, hover, focus, active, disabled

```css
.btn-icon-md {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: var(--radius-md);
  background: transparent; color: var(--color-text-secondary);
  border: none; cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.btn-icon-md:hover { background: var(--color-bg-subtle); color: var(--color-text-primary); }
.btn-icon-md:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.btn-icon-md:disabled { color: var(--color-text-disabled); cursor: not-allowed; }
```

### `btn-danger-md`
**Bouton destructif — medium**
- Usage : actions destructives (Supprimer compte). Toujours derrière une confirmation modale.
- États : default, hover, focus, active, disabled, loading

```css
.btn-danger-md {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  height: 40px; padding: 0 var(--space-4); border-radius: var(--radius-md);
  background: var(--color-danger); color: var(--color-text-on-brand);
  font-family: var(--font-primary); font-size: var(--text-sm); font-weight: var(--fw-medium);
  border: none; cursor: pointer; transition: background var(--transition-fast);
}
.btn-danger-md:hover { background: var(--color-danger-dark); }
.btn-danger-md:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25); }
.btn-danger-md:disabled { background: var(--color-bg-subtle); color: var(--color-text-disabled); cursor: not-allowed; }
```

---

## Inputs & Forms

### `input-text-md`
**Champ texte — medium**
- Usage : tout champ texte simple
- États : default, hover, focus, filled, disabled, error, readonly
- Dark mode : auto

```css
.input-text-md {
  display: block; width: 100%; height: 40px; padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface); color: var(--color-text-primary);
  font-family: var(--font-primary); font-size: var(--text-sm);
  border: 1px solid var(--color-border);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.input-text-md::placeholder { color: var(--color-text-muted); }
.input-text-md:hover { border-color: var(--color-border-strong); }
.input-text-md:focus { outline: none; border-color: var(--color-border-focus); box-shadow: var(--shadow-focus); }
.input-text-md:disabled { background: var(--color-bg-subtle); color: var(--color-text-disabled); cursor: not-allowed; }
.input-text-md[aria-invalid="true"] { border-color: var(--color-danger); }
.input-text-md[aria-invalid="true"]:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2); }
```

### `input-search-md`
**Variante recherche** : icône loupe leading, padding-left ajusté, placeholder "Rechercher…".

### `input-currency-md`
**Variante montant** : suffix "€" trailing, font-family `var(--font-mono)`, text-align right, accepte décimales.

### `input-date-md`
**Variante date** : `type="date"`, icône calendrier trailing.

### `input-textarea-md`
**Zone de texte multilignes**
- Usage : notes, descriptions longues
- États : mêmes que input-text-md
- Min height 80px, resize vertical

```css
.input-textarea-md {
  display: block; width: 100%; min-height: 80px; padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface); color: var(--color-text-primary);
  font-family: var(--font-primary); font-size: var(--text-sm); line-height: var(--leading-normal);
  border: 1px solid var(--color-border); resize: vertical;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.input-textarea-md:hover { border-color: var(--color-border-strong); }
.input-textarea-md:focus { outline: none; border-color: var(--color-border-focus); box-shadow: var(--shadow-focus); }
.input-textarea-md:disabled { background: var(--color-bg-subtle); color: var(--color-text-disabled); }
.input-textarea-md[aria-invalid="true"] { border-color: var(--color-danger); }
```

### `input-select-md`
**Dropdown — medium**
- Usage : choix dans liste fermée (type compte, banque, format CSV)
- États : default, hover, focus, open, disabled, error

```css
.input-select-md {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);
  width: 100%; height: 40px; padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface); color: var(--color-text-primary);
  font-family: var(--font-primary); font-size: var(--text-sm);
  border: 1px solid var(--color-border); cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.input-select-md:hover { border-color: var(--color-border-strong); }
.input-select-md:focus { outline: none; border-color: var(--color-border-focus); box-shadow: var(--shadow-focus); }
.input-select-md:disabled { background: var(--color-bg-subtle); color: var(--color-text-disabled); }
```

### `input-checkbox`
**Case à cocher** (16×16, radius-sm, border `--color-border-strong`, checked = `--color-brand-primary`). États : default, hover, checked, indeterminate, focus, disabled.

### `input-radio`
**Bouton radio** (16×16, radius-full, idem checkbox). États : default, hover, checked, focus, disabled.

### `input-toggle`
**Switch on/off** (track 36×20, thumb 16×16, transition `--transition-base`). États : off, on, focus, disabled.

### `input-month-picker`
**Sélecteur de mois** : `btn-ghost-md` ← + label "Janvier 2026" + `btn-ghost-md` →.

### `input-category-picker`
**Sélecteur composé Type → Catégorie → Sous-catégorie** : 3× `input-select-md` empilés ou en ligne selon viewport.

### `input-category-combobox`
**Sélecteur de catégorie avec recherche + arborescence**
- Usage : **partout où l'on choisit une (sous-)catégorie** — catégorisation d'une transaction (table, détail, validation), filtre « Toutes catégories », sous-catégorie cible d'une règle (`RuleForm`, `RuleSuggestionForm`), catégorie d'une récurrente. Remplace systématiquement le `<select>` natif. Le texte du trigger vide / de la ligne d'effacement est paramétrable (`placeholder` : « Non catégorisée », « Toutes catégories », « Aucune catégorie »…).
- Composition : trigger (pastille couleur + libellé courant ou « Non catégorisée » + chevron) → panneau flottant (rendu en **portal**, `position: fixed`, z-index `--z-popover`) avec champ recherche (`Search` leading) + liste arborescente Type (header majuscule) → Catégorie (pastille couleur) → Sous-catégorie (indentée, filet vertical).
- Recherche : insensible casse/accents, multi-tokens (chaque mot doit matcher le chemin complet).
- États : closed, open, option hover/active (`--color-brand-primary-50`), option sélectionnée (check `--color-brand-primary`), disabled, vide (« Aucune catégorie »).
- Clavier : ↑/↓ navigue les feuilles sélectionnables, Entrée valide, Échap ferme.
- Focus : à l'ouverture le champ recherche est focus automatiquement (`autoFocus` sur l'input remonté à chaque ouverture).
- **Création inline** (`allowCreate`) : pied de panneau « Créer une catégorie » + raccourci « Créer «&nbsp;query&nbsp;» » quand la recherche ne renvoie rien. Bascule le panneau en mode création (segment Sous-catégorie / Catégorie → `<select>` du parent → nom → couleur si catégorie). À la création, la nouvelle (sous-)catégorie est sélectionnée (`onChange`) et la liste rafraîchie. Activé sur les sélecteurs de (sous-)catégorie, pas sur le filtre « Toutes catégories ».
- Dark mode : auto.

```css
.cat-combobox { position: relative; width: 100%; }
.cat-combobox__trigger { /* aligné sur input-select-md : height 40px, border, radius-md */ }
.cat-combobox__panel { position: fixed; z-index: var(--z-popover); max-height: 320px; box-shadow: var(--shadow-lg); }
.cat-combobox__type { text-transform: uppercase; font-size: var(--text-xs); color: var(--color-text-muted); }
.cat-combobox__opt[data-indent="true"] { padding-left: var(--space-6); } /* feuille sous-catégorie */
.cat-combobox__opt[data-active="true"] { background: var(--color-brand-primary-50); }
```
> Implémentation complète dans `src/app/globals.css` (section `input-category-combobox`) et `src/components/transactions/CategorySelect.tsx`.

### `form-field`
**Wrapper label + input + erreur + aide**
```css
.form-field { display: flex; flex-direction: column; gap: var(--space-2); }
.form-field label {
  font-family: var(--font-primary); font-size: var(--text-sm); font-weight: var(--fw-medium);
  color: var(--color-text-primary);
}
```

### `form-error-msg`
```css
.form-error-msg {
  font-family: var(--font-primary); font-size: var(--text-xs); color: var(--color-danger);
  display: flex; align-items: center; gap: var(--space-1);
}
```

### `form-help-text`
```css
.form-help-text { font-family: var(--font-primary); font-size: var(--text-xs); color: var(--color-text-muted); }
```

---

## Badges & Status

### `badge-status-pending`
**Badge transaction à valider**
```css
.badge-status-pending {
  display: inline-flex; align-items: center; gap: var(--space-1);
  height: 22px; padding: 0 var(--space-2); border-radius: var(--radius-full);
  background: var(--color-warning-light); color: var(--color-warning-dark);
  font-family: var(--font-primary); font-size: var(--text-xs); font-weight: var(--fw-medium);
}
```

### `badge-status-validated`
Idem avec `--color-success-light` / `--color-success-dark`.

### `badge-status-ignored`
Idem avec `--color-bg-subtle` / `--color-text-muted`.

### `badge-status-new`
Idem avec `--color-info-light` / `--color-info-dark` (import preview, transaction nouvelle).

### `badge-status-duplicate`
Idem avec `--color-bg-subtle` / `--color-text-disabled` + texte rayé (import preview, doublon déjà en base).

### `badge-status-duplicate-file`
Idem avec `--color-warning-light` / `--color-warning-dark` (import preview, doublon répété dans le fichier importé).

### `badge-status-forced`
Idem avec `--color-brand-primary-50` / `--color-brand-primary-700` (import preview, doublon déjà en base déflagué manuellement : sera importé via une occurrence libre). Libellé « Ré-inclus ».

### `flag-editable`
Utilitaire d'interaction pour un nom d'entité cliquable (enseigne, récurrente) affiché sous une transaction. Signale l'action d'édition : curseur main + soulignement au survol.
```css
.flag-editable { cursor: pointer; }
.flag-editable:hover { text-decoration: underline; text-underline-offset: 2px; }
```

### `modal-entity-detail` + panneau stats `ms-*`
Variante élargie (`max-width: 940px`) de `modal-surface` pour le détail d'une **entité** (enseigne, achat) : grille 2 colonnes générique (`entity-detail-layout`) avec le formulaire d'édition à gauche et le panneau statistiques à droite (empilées sous 820px). Le panneau `ms-*` (famille partagée) regroupe : en-tête (`ms-head`), héro (`ms-hero`, + barre `ms-progress` pour un achat), grille de KPIs (`ms-kpi`), fun facts (`ms-funfact`), un graphe temporel, listes compactes (`ms-list` : échéances à venir, transactions rattachées, personnes) et répartition (`ms-cat`). Graphes : `chart-merchant-spend` (enseigne) / `chart-purchase-timeline` (achat, payé vs à venir). Fonds/bordures via tokens (compatibles dark).

**Variante `recurring-detail-layout`** (modale d'édition d'une récurrente, `RecurringEditModal`) : même modale élargie mais colonnes **inversées** — panneau stats `ms-*` à **gauche** (`recurring-detail-layout__stats`, bordure droite), formulaire à droite. Le panneau réutilise la famille `ms-*` : héro « Cumul payé », KPIs (versement moyen, coût/an, prochaine échéance, fréquence), fun facts (dérive de prix, ancienneté), graphe `chart-merchant-spend` des derniers versements. Implémentation : `src/components/recurring/RecurringStatsPanel.tsx`. Le formulaire remplace le motif texte par une **liste de motifs** éditable (une ligne = un `input-text-md` mono + croix, bouton « Ajouter un motif »).

### `badge-category`
**Badge catégorie avec pastille couleur**
```css
.badge-category {
  display: inline-flex; align-items: center; gap: var(--space-2);
  height: 24px; padding: 0 var(--space-2); border-radius: var(--radius-sm);
  background: var(--color-bg-subtle); color: var(--color-text-primary);
  font-family: var(--font-primary); font-size: var(--text-xs); font-weight: var(--fw-medium);
  cursor: pointer; transition: background var(--transition-fast);
}
.badge-category::before {
  content: ''; width: 6px; height: 6px; border-radius: var(--radius-full);
  background: var(--category-color, var(--color-text-muted));
}
.badge-category:hover { background: var(--color-border); }
```

### `badge-tag-md`
**Badge tag libre**
```css
.badge-tag-md {
  display: inline-flex; align-items: center; gap: var(--space-1);
  height: 22px; padding: 0 var(--space-2); border-radius: var(--radius-full);
  background: var(--color-brand-primary-50); color: var(--color-brand-primary-700);
  font-family: var(--font-primary); font-size: var(--text-xs); font-weight: var(--fw-medium);
}
```

### `badge-group`
**Badge groupe d'achats** : bleu (`--color-info-light` / `--color-info-dark`), icône `layers` Lucide + libellé « Groupe · N sous-achats ». Marque un achat qui agrège des sous-achats (arborescence via `purchases.parent_id`).

### `badge-recurring-active`
Vert (`--color-success-light` / `--color-success-dark`), icône `repeat` Lucide.

### `badge-recurring-missing`
Orange (`--color-warning-light` / `--color-warning-dark`), icône `alert-triangle` Lucide.

### `badge-count`
**Compteur numérique** : pastille ronde, fond `--color-brand-primary`, texte blanc, font-mono, padding 0 var(--space-2), min-width 20px.

### `badge-dot`
**Pastille colorée simple** (6×6, radius-full, couleur via `--dot-color`).

---

## Avatars

### `avatar-md`
**Avatar utilisateur Google** (32×32, radius-full, image ou initiale fallback)
```css
.avatar-md {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--radius-full);
  background: var(--color-brand-primary-100); color: var(--color-brand-primary-700);
  font-family: var(--font-primary); font-size: var(--text-sm); font-weight: var(--fw-semibold);
  overflow: hidden;
}
.avatar-md img { width: 100%; height: 100%; object-fit: cover; }
```

### `avatar-account-md`
**Avatar compte bancaire** (36×36, radius-md, couleur du compte en background, icône Lucide blanche). Variantes par type : `avatar-account-checking`, `avatar-account-savings`, `avatar-account-pel`, `avatar-account-joint`, `avatar-account-investment`.

---

## Cards

### `card-surface`
**Card neutre wrapper**
```css
.card-surface {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}
```

### `card-interactive`
**Card cliquable**
- États : default, hover, focus, active, selected
```css
.card-interactive {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5); cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}
.card-interactive:hover { border-color: var(--color-border-strong); box-shadow: var(--shadow-sm); }
.card-interactive:focus-visible { outline: none; border-color: var(--color-border-focus); box-shadow: var(--shadow-focus); }
.card-interactive:active { transform: translateY(1px); }
.card-interactive[data-selected="true"] { border-color: var(--color-brand-primary); box-shadow: var(--shadow-brand); }
```

### `card-kpi`
**Card KPI dashboard** (valeur + delta vs mois précédent)
- Variantes : `card-kpi-revenus`, `card-kpi-depenses`, `card-kpi-solde`, `card-kpi-epargne`
```css
.card-kpi {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-2);
}
.card-kpi__label { font-size: var(--text-sm); color: var(--color-text-muted); font-weight: var(--fw-medium); }
.card-kpi__value {
  font-family: var(--font-mono); font-size: var(--text-3xl); font-weight: var(--fw-semibold);
  letter-spacing: var(--tracking-tight); color: var(--color-text-primary);
}
.card-kpi__delta { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); font-weight: var(--fw-medium); }
.card-kpi__delta[data-direction="up"] { color: var(--color-success); }
.card-kpi__delta[data-direction="down"] { color: var(--color-danger); }
```

### `card-account`
**Card compte bancaire** : `avatar-account-md` + nom + type + solde courant + `badge-count` (pending).

### `card-account-mini`
**Variante mini** pour le dashboard (largeur réduite, sans pending).

### `card-pending-validator`
**Card workflow validation** : amount + libellé + date + `input-category-picker` + `btn-primary-sm` (Valider) + `btn-ghost-sm` (Ignorer / Note) + chips Enseigne · Achat · Récurrente · Personnes · Note. **Édition sans validation** : changer la catégorie / l'enseigne / l'achat / la récurrente ou ventiler entre personnes persiste sans valider — la transaction reste dans l'onglet « à valider » (statut `pending`) jusqu'au clic explicite sur **Valider** (les rattachements passent `validate: false` aux actions serveur ; catégorie via `setTransactionSubcategory`).

### `card-recurring`
**Card transaction récurrente** : nom + montant attendu + fréquence + `badge-recurring-active`/`badge-recurring-missing` + dernière occurrence.

### `card-analytics`
**Card section analytique** : titre + chart Recharts ou table.

---

## Navigation

### `nav-sidebar`
**Sidebar gauche app** (240px desktop, 64px collapsed tablet, drawer mobile)
```css
.nav-sidebar {
  width: 240px; height: 100vh;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  display: flex; flex-direction: column; padding: var(--space-4);
}
.nav-sidebar-item {
  display: flex; align-items: center; gap: var(--space-3);
  height: 36px; padding: 0 var(--space-3); border-radius: var(--radius-md);
  font-family: var(--font-primary); font-size: var(--text-sm); font-weight: var(--fw-medium);
  color: var(--color-text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast);
}
.nav-sidebar-item:hover { background: var(--color-bg-subtle); color: var(--color-text-primary); }
.nav-sidebar-item[data-active="true"] { background: var(--color-brand-primary-50); color: var(--color-brand-primary-700); }
```

### `nav-header`
**Header haut** (56px, border-bottom) : breadcrumb gauche + `input-search-md` centre (Cmd+K trigger) + actions droite.

### `nav-tabs`
**Onglets de section**
```css
.nav-tabs { display: flex; gap: var(--space-1); border-bottom: 1px solid var(--color-border); }
.nav-tabs-item {
  display: inline-flex; align-items: center; gap: var(--space-2);
  height: 40px; padding: 0 var(--space-4);
  font-family: var(--font-primary); font-size: var(--text-sm); font-weight: var(--fw-medium);
  color: var(--color-text-muted);
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.nav-tabs-item:hover { color: var(--color-text-primary); }
.nav-tabs-item[data-active="true"] { color: var(--color-brand-primary); border-bottom-color: var(--color-brand-primary); }
```

### `nav-breadcrumb`
Fil d'Ariane : text-sm, séparateur `/` en `--color-text-muted`, dernier en `--color-text-primary`.

---

## Modal & Overlay

### `modal-surface`
**Modale standard**
- Composition : backdrop + dialog (header + body + footer)
- Z-index : `--z-modal`, backdrop `--z-modal-backdrop`
- États : open (fade-in 200ms), closing (fade-out 120ms)

```css
.modal-backdrop {
  position: fixed; inset: 0;
  background: var(--color-bg-overlay);
  z-index: var(--z-modal-backdrop);
  animation: fadeIn var(--transition-base);
}
.modal-surface {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: var(--color-bg-surface); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 560px; width: calc(100vw - var(--space-8));
  max-height: calc(100vh - var(--space-8)); overflow: auto;
  z-index: var(--z-modal);
  animation: scaleIn var(--transition-spring);
}
.modal-surface__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}
.modal-surface__body { padding: var(--space-6); }
.modal-surface__footer {
  display: flex; justify-content: flex-end; gap: var(--space-3);
  padding: var(--space-5) var(--space-6); border-top: 1px solid var(--color-border);
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
```

### `modal-bank-selector`
Variante pour choisir le format banque à l'import.

### `modal-export-options`
Variante pour configurer un export CSV/Excel.

### `modal-confirm-danger`
Variante pour confirmer une action destructive (avec `btn-danger-md`).

---

## Tables

### `table-transactions`
**Table principale transactions**
- Colonnes : Date, Libellé, Compte, Catégorie, Tags, Montant, Statut, Actions
- États : default, row hover, row selected, sorted asc/desc, loading (skeleton), empty
- Densité : row 36px

```css
.table-transactions {
  width: 100%; border-collapse: collapse;
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg); overflow: hidden;
  border: 1px solid var(--color-border);
}
.table-transactions thead { background: var(--color-bg-subtle); }
.table-transactions th {
  padding: var(--space-3) var(--space-4); text-align: left;
  font-size: var(--text-xs); font-weight: var(--fw-semibold);
  color: var(--color-text-muted); letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border);
}
.table-transactions td {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm); color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border); height: 36px;
}
.table-transactions tbody tr:hover { background: var(--color-bg-subtle); }
.table-transactions tbody tr[data-selected="true"] { background: var(--color-brand-primary-50); }
```

### `table-transaction-editor`
**Table éditrice mutualisée** — partagée par l'aperçu d'import ET la liste des
transactions (même niveau d'information, mêmes actions). Colonnes communes :
Date · [Compte] · Libellé (+ sous-affordances enseigne/récurrente/personnes/
achat) · Catégorie (édition inline `import-cat-edit` + boutons achat/récurrente)
· Montant · Note (`note-cell`) · colonne de fin (render-prop du parent : import
= statut + switch inclure ; liste = statut + valider/ignorer/détails).
- `table-layout: fixed`, densité row 36px, **jamais de scroll horizontal** : le
  libellé et la catégorie reviennent à la ligne (`td[data-col="label"]` /
  `[data-col="category"]`), le compte s'ellipse (`[data-col="account"]`).
- États lignes : `tr[data-excluded="true"]` (doublon décoché à l'import, grisé),
  `tr[data-duplicate="existing"]`.
- La gestion des doublons reste propre à l'import (via la colonne de fin).

### `table-import-preview`
_(Déprécié — remplacé par `table-transaction-editor`.)_ Ancienne table d'aperçu
d'import : colonnes "Compte", "Catégorie" (édition inline `import-cat-edit`),
"Action" (switch include/exclude) + colonne dedup status.

### `note-cell`
**Annotation inline d'une transaction** — icône « note » par ligne
(`note-cell__btn`, pleine `[data-filled]` en primaire si une note existe) qui
ouvre un éditeur en popover (`note-popover` : `input-textarea-md` +
Annuler/Enregistrer). Persistance selon le contexte : store d'import ou
`updateTransactionNote` pour une transaction existante.

### `import-cat-edit`
**Bouton d'édition inline de catégorie dans l'aperçu d'import** — bordure
pointillée, affiche le libellé de la catégorie proposée par les règles ;
au clic, remplacé par un `input-select-md` (montage paresseux, un seul à la
fois pour tenir des milliers de lignes).

### `table-top-transactions`
Variante compact pour widgets analytics (top 10 dépenses).

### `category-group`
**Regroupement d'items par catégorie** (règles, récurrentes, enseignes) en
respectant la hiérarchie définie Type → Catégorie (ordre `sort_order`).
- Composition : `category-group__type` (header niveau 1, majuscule muted) →
  pour chaque catégorie `category-group__cat-head` (pastille `badge-dot` +
  `category-group__cat-name` + `badge-count`) → une `table-transactions`
  listant les items de la catégorie.
- Les catégories/types sans item sont omis ; les items non catégorisés
  atterrissent dans un groupe final « Sans catégorie » (sans header catégorie).
- **Alignement (règle générale)** : les tables de chaque groupe portent la
  classe `table-grouped` (`table-layout: fixed`) + un `<colgroup>` **identique**
  → les colonnes sont alignées d'un groupe à l'autre. Cellules tronquées
  (ellipsis) par défaut, `data-wrap="true"` pour celles qui reviennent à la
  ligne (nom, motif). Ligne de détail dépliée : `tr[data-expand="true"]`.
- **Colonne « Catégorie » (règle générale)** : afficher la catégorie la plus
  précise via `preciseSubName` — la sous-catégorie si nommée, sinon la
  catégorie parente (pas de libellé « défaut »).
- Implémentation : `src/components/categories/GroupedByCategory.tsx` (rendu
  générique, prop `renderTable`) + helpers `src/lib/categories/group.ts`
  (`groupByCategory`, `preciseSubName`). CSS sections `.category-group*` et
  `.table-grouped*` dans `globals.css`.

---

## Amount (composant clé finance)

### `amount-display`
**Affichage générique d'un montant**
- Composition : font-family mono + formatage `1 234,56 €` (locale fr-FR)
- Variantes couleur : `amount-positive`, `amount-negative`, `amount-neutral`
- Variantes taille : `amount-sm`, `amount-md`, `amount-lg`, `amount-xl`

```css
.amount-display {
  font-family: var(--font-mono);
  font-weight: var(--fw-semibold);
  letter-spacing: var(--tracking-tight);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.amount-positive { color: var(--color-finance-revenus); }
.amount-negative { color: var(--color-finance-depenses); }
.amount-neutral { color: var(--color-text-primary); }
.amount-sm { font-size: var(--text-sm); }
.amount-md { font-size: var(--text-base); }
.amount-lg { font-size: var(--text-xl); }
.amount-xl { font-size: var(--text-3xl); }
```

---

## Charts

### `chart-pie-categories`
Camembert dépenses par catégorie. Recharts `<PieChart>`. Couleurs via `categories.color` ou `--color-finance-*`. Tooltip custom `tooltip-md`.

### `chart-bar-monthly`
Bar chart 12 mois (revenus vert + dépenses rouge). Axe Y formatté `1,2k €`.

### `chart-comparison`
Comparaison mois actuel vs précédent vs moyenne 12 mois (3 barres groupées par catégorie).

### `chart-net-worth-evolution`
Line chart évolution patrimoine total (somme `account_balances.current_balance` par mois).

---

## Feedback

### `spinner-md`
**Spinner medium (16×16)**
```css
.spinner-md {
  width: 16px; height: 16px;
  border: 2px solid var(--color-bg-subtle);
  border-top-color: var(--color-brand-primary);
  border-radius: var(--radius-full);
  animation: spin 0.6s linear infinite;
}
```

### `spinner-sm`
Variante 12×12.

### `spinner-lg`
Variante 24×24, border 3px.

### `skeleton-line`
**Squelette ligne de texte**
```css
.skeleton-line {
  height: 12px; border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--color-bg-subtle) 0%, var(--color-border) 50%, var(--color-bg-subtle) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
```

### `skeleton-block`
Idem skeleton-line, height paramétrable, radius `--radius-md`.

### `toast-success`
**Toast notification succès**
- Position : `fixed; bottom: var(--space-6); right: var(--space-6)`, z-index `--z-toast`
- Auto-dismiss 4s, max 3 simultanées

```css
.toast-success {
  display: flex; align-items: center; gap: var(--space-3);
  min-width: 280px; max-width: 480px; padding: var(--space-3) var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-success); border-left-width: 4px;
  border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
  font-size: var(--text-sm); color: var(--color-text-primary);
  animation: slideInRight var(--transition-spring);
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
}
```

### `toast-error`
Idem avec border `--color-danger`.

### `toast-warning`
Idem avec border `--color-warning`.

### `toast-info`
Idem avec border `--color-info`.

### `alert-info`
**Bannière inline informative**
```css
.alert-info {
  display: flex; align-items: flex-start; gap: var(--space-3);
  padding: var(--space-4); border-radius: var(--radius-md);
  background: var(--color-info-light); color: var(--color-info-dark);
  font-size: var(--text-sm);
}
```

### `alert-warning`
Idem avec `--color-warning-light` / `--color-warning-dark`. Utilisée pour récurrentes manquantes en haut du dashboard.

### `alert-danger`
Idem avec `--color-danger-light` / `--color-danger-dark`. Utilisée pour erreur whitelist/import.

### `alert-success`
Idem avec `--color-success-light` / `--color-success-dark`.

### `empty-state`
**État vide**
```css
.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: var(--space-4);
  padding: var(--space-12) var(--space-6); text-align: center;
}
.empty-state__icon { color: var(--color-text-muted); width: 48px; height: 48px; }
.empty-state__title { font-size: var(--text-lg); font-weight: var(--fw-semibold); color: var(--color-text-primary); }
.empty-state__description { font-size: var(--text-sm); color: var(--color-text-muted); max-width: 360px; }
```

### `progress-bar`
**Barre de progression** (import, upload)
```css
.progress-bar { height: 8px; background: var(--color-bg-subtle); border-radius: var(--radius-full); overflow: hidden; }
.progress-bar__fill {
  height: 100%; background: var(--color-brand-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-base);
}
```

### `tooltip-md`
**Tooltip survol** : delay 300ms, fond `--color-brand-dark`, texte `--color-text-on-brand`, padding `var(--space-2) var(--space-3)`, radius `--radius-sm`, font-size `--text-xs`, z-index `--z-tooltip`.

---

## Composants métier

### `dashboard-hero`
**Hero du dashboard avec aurora gradient**
```css
.dashboard-hero {
  position: relative;
  padding: var(--space-12) var(--space-8);
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: var(--color-bg-surface);
}
.dashboard-hero > * { position: relative; z-index: 1; }
```
Composition : `deco-aurora-gradient` en background + `input-month-picker` + grid 4× `card-kpi`.

### `transaction-row`
**Row de transaction** — défini dans `table-transactions`.

### `table-transactions-list`
**Table de la liste `/transactions`** (distincte de `table-transaction-editor`, réservée à l'aperçu d'import). Colonnes :
- **Transaction** : titre = enseigne si connue (`tx-merchant`, cliquable → `merchant-quick-view`), sinon **libellé en style code** (`tx-label-code` : `font-mono`, fond `--color-bg-subtle`, bord + `radius-sm`). Sous-lignes `tx-main__meta` (xs, wrap) : virement interne apparié (`tx-meta--transfer` : `ArrowLeftRight` + « Virement apparié », vert `--color-success`, affiché quand la transaction a un `transfer_group_id`) · libellé code réduit (`tx-label-code--sub`, quand l'enseigne occupe le titre) · achat (`tx-meta--purchase` + occurrence mono X/Y + croix détacher) · récurrence (`tx-meta--recurring` + croix) · personnes (`tx-meta--persons`, cliquable → éditeur de partage).
- **Compte · date** mutualisés (`tx-acctdate` : `badge-dot` + nom de compte ellipsé au-dessus, date muette en dessous) — une seule colonne.
- **Catégorie** (`tx-cat`) : `badge-dot` couleur + **nom complet sans retour à la ligne** ; le chemin parent (`tx-cat__path` : « Type / Catégorie / ») est ellipsé et révélé au survol (`title`), la feuille (`tx-cat__leaf`) n'est jamais tronquée. Cliquable → `CategoryInlineEditor`. Verrouillée si héritée d'un achat.
- **Montant** (`tx-amount`) : `amount-display` + `badge-status-*` empilés à droite.
- **Actions** (`tx-actions`, rangée de `btn-icon-md` 30px, `data-on` = indigo quand défini) : enseigne (`Store`) · achat (`ShoppingBag`) · récurrence (`Repeat`) · partage (`Users`) · valider (`Check`, `data-validate`) ou invalider/rétablir (`RotateCcw`, → `pending`) · détail/éditer (`Pencil`, lien `/transactions/[id]`) · supprimer (`Trash2`, `data-danger` = rouge au survol → modale `modal-confirm-danger`).
> Implémentation : `src/components/transactions/TransactionsTable.tsx` + `TransactionsManager.tsx` (état + actions serveur optimistes). Section CSS `table-transactions-list` dans `globals.css`.

### `transfer-reconcile`
**Réconciliation des virements internes (`/transactions/transfers`, 3ᵉ onglet de `nav-tabs`)** — un virement interne est une paire sortie/entrée sur deux comptes ; le total de tous les virements internes doit faire 0. Persisté via `transactions.transfer_group_id` (les deux jambes d'une paire partagent le même uuid). Composition :
- **`transfer-balance`** : bandeau de solde. Bord + valeur `--color-danger` par défaut, `--color-success` quand `data-balanced` (net 0 **et** aucun orphelin). En-tête label + valeur mono (`transfer-balance__value`), `transfer-balance__hint` explicatif, `transfer-balance__stats` (paires · orphelins · candidats, `data-alert` en rouge si > 0).
- **`transfer-orphan`** (section « À réconcilier ») : bord gauche `--color-warning`. `transfer-leg` (libellé `tx-label-code` + date + `badge-dot` compte + `amount-display`) + actions : **Apparier** (`btn-primary-sm` + `transfer-count` = nb de suggestions → ouvre `modal-surface` de choix de contrepartie) et **Retirer** (`btn-ghost-sm`, décatégorise → `pending`).
- **`transfer-suggestion`** (dans la modale) : contrepartie cliquable (montant opposé, autre compte, la plus proche en date) ; `transfer-suggestion__tag` « non catégorisé » si la contrepartie n'est pas encore un virement interne.
- **`transfer-candidate`** (section « Virements internes potentiels ») : paire probable non catégorisée (deux `transfer-leg` séparés par `transfer-candidate__arrow`) → **Marquer comme virement interne** ou **Ignorer** (masque local). Garantit qu'aucun virement n'est « squeezé ».
- **`transfer-pair`** (section repliable « Paires réconciliées », `transfer-section__toggle`) : les deux jambes empilées (`transfer-pair__legs`) + **Dissocier** (`btn-ghost-sm`).
> Actions serveur `src/server/actions/transfers.ts` : `pairInternalTransfer` (apparie + catégorise + valide + groupe), `unpairInternalTransfer` (casse le groupe), `removeFromInternalTransfers` (sort des virements). Données : `src/lib/transactions/transfersReconciliation.ts`. Composant : `src/components/transactions/TransferReconciliation.tsx`. Badge de l'onglet = `countTransferOrphans()` (orphelins sans groupe).

### `merchant-quick-view`
**Aperçu (lecture seule) d'une enseigne** ouvert au clic sur son nom dans la liste (`tx-merchant`). Popover en portal (`mq-popover`, `position: fixed`, `z-popover`), stats chargées à la demande (`getMerchantQuickStats`) : en-tête (icône `Store` + nom + catégorie par défaut + En ligne/pays) → `mq-kpis` (Total dépensé · Transactions · Moy./mois, mono) → `mq-bars` (12 derniers mois, barres CSS normalisées) → `mq-cats` (top 4 catégories : pastille + nom + compteur + montant) → lien `mq-popover__link` « Voir la fiche de l'enseigne » (→ `merchant-detail-page`). Pas d'édition. Ferme au clic dehors / Échap.
> Implémentation : `src/components/merchants/MerchantQuickView.tsx` + `src/lib/merchants/stats.ts`.

### `merchant-detail-page`
**Fiche détail d'une enseigne (`/enseignes/[id]`)** — lecture. `card-surface` en-tête (`merchant-detail__icon` + nom `text-2xl` + catégorie/pays + `btn-secondary-md` « Gérer les enseignes ») → grille `card-kpi` (Total dépensé · Transactions · Dépense moyenne/mois · Achats rattachés) → carte « 12 derniers mois » (`mq-bars mq-bars--lg`) → carte « Répartition par catégorie » (`md-cat` : libellé + montant + barre de proportion colorée) → `btn-secondary-md` « Voir les N transactions » (→ `/transactions?merchant=[id]`, réutilise le filtre enseigne). Implémentation : `src/components/merchants/MerchantDetailView.tsx`.

### `transaction-filters`
**Toolbar de filtres** : `input-search-md` + `input-select-md` (compte/statut/période) + `input-category-combobox` (filtre catégorie) + `multi-select-combobox` (enseignes, achats) + `filter-amount-range` (2× `input-currency-md` min/max, montant en valeur absolue) + `input-date-md` (du/au) + `btn-secondary-md` (Exporter / Réinitialiser). Layout flex wrap, gap `var(--space-3)`. Le paramètre `showStatus={false}` masque le sélecteur de statut (page « À valider », toujours `pending`). Sous la toolbar, `filter-chips` remonte chaque filtre actif (surtout les multiselect) en chip retirable + bouton « Tout effacer ». État porté par l'URL (`merchant`/`purchase` en CSV, `amin`/`amax`, `from`/`to`, `q`, `account`, `subcategory`, `sort`). Implémentation : `src/components/transactions/TransactionFilters.tsx`.

### `multi-select-combobox`
**Filtre multi-sélection avec recherche** (enseignes, achats…). Trigger `input-select-md`-like (40px) : icône optionnelle + placeholder ou compteur « N enseignes » + croix d'effacement ; état `data-active` (bordure/fond `--color-brand-primary`) quand ≥ 1 sélection. Panneau en portal (`position: fixed`, `z-popover`, `max-height: 320px`) : champ recherche insensible casse/accents multi-tokens + liste d'options avec case `ms-combobox__check` (✓ indigo si cochée). **Les options cochées sont triées en tête de liste.** Footer « Tout désélectionner ». Navigation clavier ↑/↓/Entrée (toggle)/Échap. Multi-toggle sans fermer le panneau.
```css
.ms-combobox__trigger[data-active="true"] { border-color: var(--color-brand-primary); background: var(--color-brand-primary-50); }
.ms-combobox__check[data-on="true"] { background: var(--color-brand-primary); border-color: var(--color-brand-primary); }
.ms-combobox__panel { position: fixed; z-index: var(--z-popover); max-height: 320px; }
```
> Implémentation : `src/components/ui/MultiSelectCombobox.tsx` (section CSS `multi-select-combobox` dans `globals.css`).

### `filter-chips`
**Barre de filtres actifs** sous une toolbar : chaque critère actif rendu en `filter-chip` (pilule `radius-full`, fond `--color-brand-primary-50`, bordure indigo, croix) qui se retire au clic ; termine par `btn-ghost-sm` « Tout effacer ». Rend les filtres (notamment multiselect) évidents et réversibles.

### `file-dropzone`
**Zone upload fichier (import)**
- États : default, drag-over, hover, with-file, error
```css
.file-dropzone {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--space-3); min-height: 200px; padding: var(--space-8);
  border: 2px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-bg-subtle); cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.file-dropzone:hover { border-color: var(--color-brand-primary); }
.file-dropzone[data-drag-over="true"] { border-color: var(--color-brand-primary); background: var(--color-brand-primary-50); }
.file-dropzone[data-has-file="true"] { border-style: solid; border-color: var(--color-success); background: var(--color-success-light); }
.file-dropzone[data-error="true"] { border-color: var(--color-danger); background: var(--color-danger-light); }
```

### `file-dropzone-mini`
Variante mini pour upload justificatif sur une transaction (height 80px).

### `attachment-list`
Liste des pièces jointes : item = icône fichier + nom + taille + `btn-icon-md` (delete) + `btn-icon-md` (download).

### `global-search-modal`
**Recherche Cmd+K** : `modal-surface` simplifiée plein écran milieu + `input-search-md` large + liste `search-result-item` groupés par type. Raccourcis ↑↓ Enter.

### `search-result-item`
Item résultat recherche : icône type + libellé + contexte (compte, date, catégorie) + `amount-display` si transaction. États : default, focused (highlight).

### `rule-suggestion-form`
**Form modal suggestion règle depuis libellé** :
- Affiche libellé brut (readonly, `--color-bg-subtle`)
- `input-text-md` (regex pré-remplie éditable)
- `input-category-combobox` (sous-catégorie cible)
- `input-toggle` (auto-validate)
- `form-help-text` aperçu "Cette règle aurait matché N transactions existantes"

### `deco-aurora-gradient`
**Décoration aurora gradient (fond `dashboard-hero`)**
```css
.deco-aurora-gradient {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(at 20% 30%, var(--color-aurora-1) 0px, transparent 50%),
    radial-gradient(at 80% 20%, var(--color-aurora-2) 0px, transparent 50%),
    radial-gradient(at 60% 70%, var(--color-aurora-3) 0px, transparent 50%),
    radial-gradient(at 10% 80%, var(--color-aurora-4) 0px, transparent 50%);
  opacity: 0.7; filter: blur(40px);
}
```

### `deco-divider`
```css
.deco-divider { height: 1px; background: var(--color-border); margin: var(--space-6) 0; }
```

### `layout-page-header`
**Header de page (titre + actions)**
```css
.layout-page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: var(--space-4); margin-bottom: var(--space-6);
}
.layout-page-header__title {
  font-size: var(--text-2xl); font-weight: var(--fw-semibold);
  letter-spacing: var(--tracking-tight); color: var(--color-text-primary);
}
.layout-page-header__subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: var(--space-1); }
.layout-page-header__actions { display: flex; gap: var(--space-3); }
```

### `input-split-nature`
**Bascule segmentée dette / cadeau** — deux boutons exclusifs (`HandCoins` = dette, `Gift` = cadeau) qualifiant la nature de la ventilation d'une transaction (parts des personnes ≠ moi). État actif : bordure + fond `--color-brand-primary` / `--color-brand-primary-50`, texte `--color-brand-primary-700`. Hauteur 32px, `--radius-md`. Réutilisé dans `person-share-editor` et `person-attach-modal`. **Direction déduite du signe** : sur une transaction créditée (montant > 0, ex. virement pro reçu), le bouton « dette » s'affiche « À rendre » — la part comptée est de l'argent que **je dois** à la personne ; sur une dépense (montant < 0), c'est une **créance** (la personne me doit).

### `person-share-editor`
**Éditeur de lien d'une transaction avec des personnes (partage ou remboursement)**
- Usage : bloc « Partage entre personnes » du détail d'une transaction. Chaque personne est cochable (`input-checkbox` + `badge-dot` couleur), « moi » coché par défaut mais décochable.
- Composition (mode Partager) : liste des personnes cochables (part éditable `input-currency` alignée à droite à côté de chaque cochée) → actions `btn-ghost-sm` « Répartir équitablement » + `input-split-nature` → encart résumé (`--color-bg-subtle`) « Ma part / Créances (ou « À rendre (tu dois) » sur un crédit, ou Cadeaux) / Total réparti » → `btn-primary-sm` « Enregistrer le partage » (+ `btn-ghost-sm` « Ne pas partager » si déjà ventilée).
- **Compte courant (bidirectionnel)** : une part « dette » sur une transaction créditée (montant > 0) compte comme de l'argent que je dois à la personne (ex. virement pro à rembourser), au lieu d'une créance. Un texte d'aide le rappelle sous les boutons de nature.
- **Mode Remboursement (crédits uniquement)** : sur une transaction créditée (montant > 0), une bascule segmentée en tête (`Partager` `Users` / `Remboursement` `ArrowDownLeft`) donne accès à un panneau qui marque le crédit comme **remboursement d'une dette** — choix d'**une** personne (boutons exclusifs `badge-dot` + nom), `input-currency` (défaut = montant), note optionnelle, `btn-primary-sm` « Marquer comme remboursement » (+ `btn-ghost-sm` « Retirer le remboursement » si déjà lié). Crée/édite/supprime un `person_repayment` lié à la transaction (éteint la dette de la personne et exclut la transaction des revenus/dépenses du mois). Un crédit non encore ventilé s'ouvre par défaut sur ce mode ; s'il porte déjà un remboursement, l'éditeur le charge et l'affiche pré-rempli. La pastille « Personnes » de la ligne devient « Remboursement · <nom> » `--color-success` (`ArrowDownLeft`).
- Répartition : parts égales auto entre les personnes cochées (reste au centime sur la 1re part), chaque part restant modifiable. Le total réparti est signalé en `--color-warning-dark` s'il diffère du montant de la transaction.
- États : vide (aucune personne → invite), édition, mismatch (total ≠ montant), saving.
- Réutilisé (auto-sauvegarde + `onSaved` ferme la modale) : détail d'une transaction, **liste des transactions** (modale « Partager avec des personnes », pré-remplie avec la ventilation existante) et **page d'un achat** (édition du partage de chaque transaction rattachée). Corrige la perte des paramètres à la ré-ouverture depuis la liste (l'ancienne modale légère repartait de zéro).
- Dark mode : auto. Implémentation : `src/components/persons/PersonSharePicker.tsx`.

### `person-card`
**Card personne (page Personnes)** — `card-surface` : en-tête (`badge-dot` + nom + `btn-icon-md` modifier/supprimer) → grille de stats mono (`On te doit`, `Tu dois` en `--color-danger` si > 0, `Cadeaux` en `--color-finance-investissement`, `Remboursé` en `--color-success`, **`Solde`** net signé — libellé directionnel « Solde · tu dois » `--color-danger` / « Solde · on te doit » `--color-warning-dark`, « Solde » atténué si soldé) → `btn-ghost-sm` déplier → registre : transactions partagées (icône `Gift`/`HandCoins`, ou `ArrowUpRight` `--color-danger` + montant préfixé `−` pour une part « à rendre » sur un crédit + date + libellé lien + part mono) puis remboursements (date + libellé + montant `--color-success` + `btn-icon-md` supprimer) et formulaire d'ajout de remboursement (`input-currency` + `input-date` + `input-select` transaction créditée optionnelle + note). Le solde est un **compte courant signé** (virements pro reçus = « je dois », dépenses avancées = « on me doit », qui se compensent). Implémentation : `src/components/persons/PersonsManager.tsx`.

### `person-attach-modal`
**Variante de `modal-surface`** pour rattacher des personnes à une ligne d'aperçu d'import : sélection multiple (`input-checkbox` + `badge-dot`, « moi » par défaut) + `input-split-nature`. Le montant est réparti à parts égales à l'import (ajustable ensuite via `person-share-editor`). **Réservé à l'aperçu d'import** (les lignes n'ont pas encore d'id) ; la liste des transactions utilise directement `person-share-editor`. Implémentation : `src/components/import/PersonAttachModal.tsx`.

### `person-detail-page`
**Page de détail d'une personne (`/personnes/[id]`)** — `card-surface` en-tête (`badge-dot` + nom `text-2xl` + `btn-secondary-sm` Modifier via `PersonForm`) → grille de stats mono (On te doit, Tu dois `--color-danger` si > 0, Cadeaux `--color-finance-investissement`, Remboursé `--color-success`, **Solde** net signé directionnel — « Solde · tu dois » `--color-danger` / « Solde · on te doit » `--color-warning-dark`, **entrées manuelles incluses**) → carte **Événements** : timeline unifiée triée récent → ancien fusionnant parts de transactions (`Transaction`, lien `/transactions/[id]`), dettes/cadeaux manuels (`Manuel`, éditables/supprimables inline) et remboursements (`Remb.`, `+montant` `--color-success`, éditables/supprimables) — chaque ligne : icône nature (`HandCoins` créance / `ArrowUpRight` `--color-danger` « à rendre » (je dois) / `Gift` / `ArrowDownLeft` remb.) + date + libellé + `badge-tag-md` type + `amount` mono (préfixe `−` si « à rendre ») + `btn-icon-md` modifier/supprimer → carte **Enregistrer un remboursement** (formulaire réutilisé). Modales d'édition : `PersonForm`, formulaire dette/cadeau manuel (`input-split-nature` + `input-currency` + `input-date` + libellé + note), formulaire remboursement, `modal-confirm-danger` (suppression d'une entrée manuelle). Implémentation : `src/components/persons/PersonDetailView.tsx`.

### `purchase-line-row`
**Ligne compacte type transaction (lecture seule)** — sert à lister aussi bien les transactions rattachées à un achat que ses sous-achats (« les lister comme des transactions »). Composition : pastille/icône de tête optionnelle (`badge-dot` compte, `Layers` sous-achat) → libellé + sous-libellé mono (date · compte, ou nb transactions · nb sous-achats) → `amount-sm` à droite → élément de fin optionnel (`badge-status-*`, chevron `ArrowUpRight`). Cliquable (hover `--color-bg-subtle`) si `href` fourni. Implémentation : `src/components/purchases/PurchaseLineRow.tsx`.

### `purchase-installments`
**Échéancier « paiements à venir et validés »** — liste des mensualités prévisionnelles d'un achat, chacune avec mois (occurrence X/Y mono, ∞ si abonnement sans fin) + `amount-sm` neutre + marqueur d'état : ✓ `--color-success` si appariée à une transaction (payée), sinon « à venir » atténué. Présentationnel (serveur + client). Implémentation : `src/components/purchases/PurchaseInstallments.tsx`. Variante éditable (ajout/suppression ligne à ligne) : `src/components/purchases/InstallmentEditor.tsx`.

### `purchase-galaxy`
**Bloc « galaxie » d'un achat** — assemble les 4 sections d'un achat, séparées par un filet (`--color-border`) et un titre en capitales : achat parent (`purchase-line-row` → groupe parent) · `purchase-installments` (paiements à venir/validés) · transactions rattachées (`purchase-line-row` cappé à 4 en carte, illimité en page, lien « voir les N ») · sous-achats listés comme des transactions (`purchase-line-row` → `/achats/[id]`). `variant="card"` plafonne les listes, `variant="page"` déballe tout. Prop `assignmentsSlot` : si fournie, remplace les deux sections centrales (paiements + transactions) par le bloc interactif `purchase-assignments` (page de détail). Partagé entre la carte de la liste et la page de détail. Implémentation : `src/components/purchases/PurchaseGalaxy.tsx`.

### `purchase-assignments`
**Bloc interactif d'assignation (page de détail d'un achat)** — remplace les sections `purchase-installments` + transactions rattachées de `purchase-galaxy` par leurs versions actionnables, dans les mêmes cadres (filet + titre capitales). Section **Paiements** : chaque échéance affiche mois (occurrence X/Y mono) + `amount-sm` + soit, si appariée, le libellé/date/compte de la transaction avec ✓ `--color-success`, un `btn-icon-md` Réassigner (`Replace`) et un `btn-icon-md` Désassigner (`Unlink`) ; soit, si « à venir », un `btn-ghost-sm` Assigner (`Link2`). Section **Transactions rattachées** (« Autres… » s'il y a des paiements) : `purchase-line-row` (libellé cliquable → `/transactions/[id]`) + `amount-sm` + `badge-status-*` + `btn-icon-md` Désassigner, puis `btn-ghost-sm` Rattacher une transaction (`Plus`). Toutes les actions ouvrent au besoin `transaction-picker-modal` et rafraîchissent via `router.refresh()`. Désassigner (ici comme dans la liste `table-transactions` ou le détail transaction) remet la transaction « non catégorisée / à valider » (la catégorie était héritée de l'achat). Implémentation : `src/components/purchases/PurchaseAssignments.tsx`.

### `transaction-picker-modal`
**Variante de `modal-surface`** pour choisir une transaction non rattachée (rattacher à l'achat, remplir/réassigner une échéance) : `input-text-md` de recherche (débouncée) + liste `purchase-line-row` (pastille compte + libellé/date/compte + `amount-sm`), état vide/chargement atténué. Alimentée par la Server Action `getAttachableTransactions` (25 plus récentes, filtre libellé). Ne propose que des transactions **non assignées** (règle fondamentale : 0 ou 1 achat en direct) — exclut `purchase_id` non nul **et** celles réservées par une échéance (`purchase_installments.transaction_id`). Remontée à chaque ouverture via `key`. Implémentation : `src/components/purchases/TransactionPickerModal.tsx`.

### `category-override-picker`
**Choix de la politique de surcharge de la catégorie des transactions rattachées** — groupe de 3 `input-radio` (libellé `text-sm` + aide `text-xs` `--color-text-muted`) présenté quand la catégorie d'un achat change alors qu'il a des transactions rattachées : **Seulement les transactions sans catégorie** (`empty`, défaut recommandé) · **Toutes les transactions rattachées** (`all`, écrase — comportement historique) · **Ne pas surcharger** (`none`, les transactions gardent leur catégorie). Utilisé dans deux contextes : la modale « Appliquer aux transactions rattachées ? » (variante de `modal-surface`) déclenchée par le changement inline de catégorie sur `purchase-detail-page`, et un `form-field` de `PurchaseForm` en édition (affiché seulement si la catégorie change et qu'il y a des tx liées). Alimente `setPurchaseSubcategory(id, subId, mode)` / `updatePurchase(..., { categoryOverride })`. Implémentation : `src/components/purchases/CategoryOverridePicker.tsx`.

### `purchase-installment-chips`
**Calendrier compact des paiements programmés** — une pastille mono par échéance (mois court `formatShortMonth`, fond `--color-bg-subtle`, `--radius-sm`), ✓ `--color-success` si réglée (reliée à une transaction), atténuée `--color-text-muted` si « à venir ». Plafonné (défaut 10, +N). Affiché dans le sélecteur `Rattacher à un achat` (sous chaque achat en liste, et en aperçu du calendrier au choix d'une échéance). Implémentation : `InstallmentChips` dans `src/components/import/PurchaseAttachModal.tsx`.

### `purchase-detail-page`
**Page de détail d'un achat (`/achats/[id]`)** — `card-surface` : en-tête (titre `text-2xl` + badges `badge-group`/`badge-status-*`) et barre d'actions (`btn-secondary-sm` Marquer comme soldé/Rouvrir + Modifier, `btn-ghost-sm` Retirer du groupe / Archiver / Supprimer) → bloc métadonnées **Catégorie** (`input-category-combobox` éditable ; si l'achat a des transactions rattachées, le changement ouvre une modale `category-override-picker` pour choisir comment répercuter la nouvelle catégorie, sinon applique directement), **Enseigne** (icône `Store` + nom), **Personnes** (`badge-dot` + nom + badge nature `HandCoins` Dette `--color-warning-dark` / `Gift` Cadeau `--color-finance-investissement` + `amount-sm`) → encart KPI (`--color-bg-subtle`) Total dépensé · Budget prévu · Reste à payer · Transactions (mono `amount-lg`) → `purchase-galaxy` en `variant="page"` avec `assignmentsSlot={purchase-assignments}` (assignation interactive des transactions/paiements) → `btn-ghost-sm` Ajouter un achat au groupe. Le « soldé » est manuel (`is_settled`) pour les achats sans échéancier complet ; les achats à échéancier complet sont soldés automatiquement. Les achats soldés sont rangés sur un écran séparé `/achats/termines` (lien « Voir les achats terminés » depuis `/achats`). Réutilise `PurchaseForm` + `InstallmentEditor` (modale) et `modal-confirm-danger` (suppression). Implémentation : `src/components/purchases/PurchaseDetailView.tsx`.

---

# Index des slugs

> **CONSULTER AVANT TOUTE CRÉATION DE COMPOSANT.** Trier alphabétique.

| Slug | Type | Description | Dark mode |
|------|------|-------------|-----------|
| `alert-danger` | Feedback | Bannière inline rouge (erreurs critiques) | auto |
| `alert-info` | Feedback | Bannière inline bleue informative | auto |
| `alert-success` | Feedback | Bannière inline verte (succès persistant) | auto |
| `alert-warning` | Feedback | Bannière inline orange (récurrente manquante…) | auto |
| `amount-display` | Métier | Affichage générique d'un montant (mono, tabular) | auto |
| `amount-lg` | Métier | Variante taille lg | auto |
| `amount-md` | Métier | Variante taille md (défaut) | auto |
| `amount-negative` | Métier | Variante couleur rouge (dépense) | auto |
| `amount-neutral` | Métier | Variante couleur neutre | auto |
| `amount-positive` | Métier | Variante couleur verte (revenu) | auto |
| `amount-sm` | Métier | Variante taille sm | auto |
| `amount-xl` | Métier | Variante taille xl (hero KPI) | auto |
| `attachment-list` | Métier | Liste de pièces jointes sur transaction | auto |
| `avatar-account-checking` | Avatar | Avatar compte courant | auto |
| `avatar-account-investment` | Avatar | Avatar compte investissement | auto |
| `avatar-account-joint` | Avatar | Avatar compte joint | auto |
| `avatar-account-md` | Avatar | Avatar compte bancaire générique | auto |
| `avatar-account-pel` | Avatar | Avatar PEL | auto |
| `avatar-account-savings` | Avatar | Avatar livret | auto |
| `avatar-md` | Avatar | Avatar utilisateur Google | auto |
| `badge-category` | Status | Badge catégorie avec pastille couleur | auto |
| `badge-count` | Status | Pastille numérique compteur | auto |
| `badge-dot` | Status | Pastille colorée simple | auto |
| `badge-group` | Status | Badge groupe d'achats (achat agrégeant des sous-achats) | auto |
| `badge-recurring-active` | Status | Badge récurrente OK | auto |
| `badge-recurring-missing` | Status | Badge récurrente manquante | auto |
| `badge-status-duplicate` | Status | Badge import row doublon (en base) | auto |
| `badge-status-duplicate-file` | Status | Badge import row doublon (dans le fichier) | auto |
| `badge-status-forced` | Status | Badge import row doublon déflagué (ré-inclus, sera importé) | auto |
| `badge-status-ignored` | Status | Badge transaction ignorée | auto |
| `badge-status-new` | Status | Badge import row nouvelle | auto |
| `badge-status-pending` | Status | Badge transaction à valider | auto |
| `badge-status-validated` | Status | Badge transaction validée | auto |
| `badge-tag-md` | Status | Badge tag libre | auto |
| `btn-danger-md` | Bouton | Action destructive | auto |
| `btn-ghost-md` | Bouton | Action tertiaire transparente md | auto |
| `btn-ghost-sm` | Bouton | Action tertiaire transparente sm | auto |
| `btn-icon-md` | Bouton | Bouton icône carré md | auto |
| `btn-primary-lg` | Bouton | Action principale lg | auto |
| `btn-primary-md` | Bouton | Action principale md (défaut) | auto |
| `btn-primary-sm` | Bouton | Action principale sm | auto |
| `btn-secondary-md` | Bouton | Action secondaire md | auto |
| `category-override-picker` | Métier | Choix de surcharge de catégorie des tx rattachées (achat) | auto |
| `card-account` | Métier | Card compte bancaire (liste) | auto |
| `card-account-mini` | Métier | Card compte version dashboard | auto |
| `card-analytics` | Métier | Card section analytique | auto |
| `card-interactive` | Card | Card cliquable | auto |
| `card-kpi` | Métier | Card KPI dashboard | auto |
| `card-kpi-depenses` | Métier | KPI variante dépenses | auto |
| `card-kpi-epargne` | Métier | KPI variante épargne | auto |
| `card-kpi-revenus` | Métier | KPI variante revenus | auto |
| `card-kpi-solde` | Métier | KPI variante solde | auto |
| `card-pending-validator` | Métier | Card workflow validation | auto |
| `card-recurring` | Métier | Card transaction récurrente | auto |
| `card-surface` | Card | Card neutre wrapper | auto |
| `category-group` | Table | Regroupement d'items par catégorie (hiérarchie Type→Cat) | auto |
| `chart-bar-monthly` | Chart | Bar chart 12 mois | auto |
| `chart-comparison` | Chart | Bar chart groupé comparaison | auto |
| `chart-merchant-spend` | Chart | Bar chart dépenses enseigne 12 mois (mois record en relief + ligne moyenne) | auto |
| `chart-purchase-timeline` | Chart | Bar chart paiements d'un achat dans le temps (payé vs à venir) | auto |
| `chart-net-worth-evolution` | Chart | Line chart évolution patrimoine | auto |
| `chart-pie-categories` | Chart | Camembert catégories | auto |
| `dashboard-hero` | Métier | Hero du dashboard avec aurora | auto |
| `deco-aurora-gradient` | Déco | Fond aurora gradient | auto |
| `deco-divider` | Déco | Séparateur horizontal | auto |
| `empty-state` | Feedback | État vide générique | auto |
| `file-dropzone` | Métier | Zone upload fichier import | auto |
| `file-dropzone-mini` | Métier | Zone upload justificatif | auto |
| `filter-amount-range` | Form | Range de montant (2 champs devise min/max) | auto |
| `filter-chips` | Métier | Barre de filtres actifs retirables | auto |
| `flag-editable` | Interaction | Nom d'enseigne/récurrente cliquable (curseur main + soulignement au survol) | auto |
| `form-error-msg` | Form | Message erreur sous un champ | auto |
| `form-field` | Form | Wrapper label+input+erreur | auto |
| `form-help-text` | Form | Texte d'aide sous un champ | auto |
| `global-search-modal` | Métier | Recherche Cmd+K | auto |
| `input-category-combobox` | Form | Sélecteur catégorie avec recherche + arborescence | auto |
| `input-category-picker` | Form | Picker composé Type→Cat→Sous-cat | auto |
| `input-checkbox` | Form | Case à cocher | auto |
| `input-currency-md` | Form | Variante montant | auto |
| `input-date-md` | Form | Variante date | auto |
| `input-month-picker` | Form | Picker de mois (dashboard) | auto |
| `input-radio` | Form | Bouton radio | auto |
| `input-search-md` | Form | Variante recherche | auto |
| `input-select-md` | Form | Dropdown md | auto |
| `input-split-nature` | Form | Bascule segmentée dette / cadeau | auto |
| `input-text-md` | Form | Champ texte md (défaut) | auto |
| `input-textarea-md` | Form | Zone texte multilignes | auto |
| `input-toggle` | Form | Switch on/off | auto |
| `layout-page-header` | Layout | Header de page avec titre + actions | auto |
| `merchant-quick-view` | Métier | Aperçu stats enseigne (popover liste) | auto |
| `merchant-detail-page` | Métier | Fiche détail d'une enseigne | auto |
| `modal-bank-selector` | Modal | Variante sélection banque | auto |
| `modal-entity-detail` | Modal | Variante élargie détail entité — enseigne/achat (form + stats) | auto |
| `entity-detail-layout` | Layout | Grille 2 colonnes form/stats de la modale de détail | auto |
| `recurring-detail-layout` | Layout | Variante inversée (stats à gauche) — modale récurrente | auto |
| `merchant-stats-panel` | Métier | Panneau stats (KPIs, fun facts, graphe, listes) — famille `ms-*`, partagé enseigne/achat | auto |
| `multi-select-combobox` | Form | Filtre multi-sélection avec recherche (sélectionnés en tête) | auto |
| `modal-confirm-danger` | Modal | Variante confirmation destructive | auto |
| `modal-export-options` | Modal | Variante options export | auto |
| `modal-surface` | Modal | Modale standard | auto |
| `nav-breadcrumb` | Nav | Fil d'Ariane | auto |
| `nav-header` | Nav | Header haut app | auto |
| `nav-sidebar` | Nav | Sidebar gauche app | auto |
| `nav-tabs` | Nav | Onglets de section | auto |
| `person-attach-modal` | Métier | Modale d'attache de personnes (import) | auto |
| `person-card` | Métier | Card personne + registre (page Personnes) | auto |
| `person-detail-page` | Métier | Page de détail d'une personne (timeline des événements) | auto |
| `person-share-editor` | Métier | Éditeur de ventilation entre personnes | auto |
| `progress-bar` | Feedback | Barre de progression | auto |
| `purchase-assignments` | Métier | Bloc interactif assigner/réassigner/désassigner (détail achat) | auto |
| `purchase-detail-page` | Métier | Page de détail d'un achat (galaxie des dépenses) | auto |
| `purchase-installment-chips` | Métier | Calendrier compact des paiements programmés (✓ si réglé) | auto |
| `purchase-galaxy` | Métier | Bloc des 4 sections d'un achat (parent/paiements/tx/sous-achats) | auto |
| `purchase-installments` | Métier | Échéancier paiements à venir et validés | auto |
| `purchase-line-row` | Métier | Ligne compacte type transaction (tx rattachée ou sous-achat) | auto |
| `rule-suggestion-form` | Métier | Form proposition règle depuis libellé | auto |
| `search-result-item` | Métier | Item résultat recherche | auto |
| `skeleton-block` | Feedback | Squelette bloc | auto |
| `skeleton-line` | Feedback | Squelette ligne | auto |
| `spinner-lg` | Feedback | Spinner large | auto |
| `spinner-md` | Feedback | Spinner medium (défaut) | auto |
| `spinner-sm` | Feedback | Spinner small | auto |
| `table-transaction-editor` | Table | Table éditrice de l'aperçu d'import | auto |
| `table-transactions-list` | Table | Liste `/transactions` (titre enseigne + actions) | auto |
| `table-import-preview` | Table | Déprécié — voir `table-transaction-editor` | auto |
| `import-cat-edit` | Import | Édition inline catégorie (aperçu import) | auto |
| `note-cell` | Table | Annotation inline (icône + popover note) | auto |
| `table-top-transactions` | Table | Variante top dépenses compact | auto |
| `table-transactions` | Table | Table principale transactions | auto |
| `toast-error` | Feedback | Toast erreur | auto |
| `toast-info` | Feedback | Toast info | auto |
| `toast-success` | Feedback | Toast succès | auto |
| `toast-warning` | Feedback | Toast warning | auto |
| `tooltip-md` | Feedback | Tooltip survol md | auto |
| `transaction-filters` | Métier | Toolbar de filtres au-dessus liste | auto |
| `transaction-picker-modal` | Métier | Modale de choix d'une transaction non rattachée (détail achat) | auto |
| `transaction-row` | Métier | Row de table-transactions | auto |
| `transfer-balance` | Métier | Bandeau de solde des virements internes (=0) | auto |
| `transfer-candidate` | Métier | Paire de virement interne probable non catégorisée | auto |
| `transfer-orphan` | Métier | Virement interne sans contrepartie (à réconcilier) | auto |
| `transfer-pair` | Métier | Paire de virement interne réconciliée | auto |
| `transfer-reconcile` | Métier | Écran de réconciliation des virements internes | auto |
| `transfer-suggestion` | Métier | Contrepartie suggérée dans la modale d'appariement | auto |

---

> **Si tu crées un nouveau composant**, ajoute-le immédiatement ici (section dédiée + ligne dans cet index, ordre alphabétique). Sinon, le design system perd sa cohérence.
