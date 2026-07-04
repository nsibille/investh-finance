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
**Card workflow validation** : amount + libellé + date + `input-category-picker` + `btn-primary-sm` (Valider) + `btn-ghost-sm` (Ignorer / Note).

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

### `table-import-preview`
Variante avec colonnes "Compte", "Catégorie" (édition inline `import-cat-edit`),
"Action" (switch include/exclude) + colonne dedup status. Ligne
`tr[data-duplicate="file"]` : doublon potentiel en rouge léger (ré-importable).

### `import-cat-edit`
**Bouton d'édition inline de catégorie dans l'aperçu d'import** — bordure
pointillée, affiche le libellé de la catégorie proposée par les règles ;
au clic, remplacé par un `input-select-md` (montage paresseux, un seul à la
fois pour tenir des milliers de lignes).

### `table-top-transactions`
Variante compact pour widgets analytics (top 10 dépenses).

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

### `transaction-filters`
**Toolbar de filtres** : `input-search-md` + `input-select-md` (compte/statut/période) + `input-category-combobox` (filtre catégorie) + `btn-secondary-md` (Exporter / Réinitialiser). Layout flex wrap, gap `var(--space-3)`.

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
| `badge-recurring-active` | Status | Badge récurrente OK | auto |
| `badge-recurring-missing` | Status | Badge récurrente manquante | auto |
| `badge-status-duplicate` | Status | Badge import row doublon (en base) | auto |
| `badge-status-duplicate-file` | Status | Badge import row doublon (dans le fichier) | auto |
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
| `chart-bar-monthly` | Chart | Bar chart 12 mois | auto |
| `chart-comparison` | Chart | Bar chart groupé comparaison | auto |
| `chart-net-worth-evolution` | Chart | Line chart évolution patrimoine | auto |
| `chart-pie-categories` | Chart | Camembert catégories | auto |
| `dashboard-hero` | Métier | Hero du dashboard avec aurora | auto |
| `deco-aurora-gradient` | Déco | Fond aurora gradient | auto |
| `deco-divider` | Déco | Séparateur horizontal | auto |
| `empty-state` | Feedback | État vide générique | auto |
| `file-dropzone` | Métier | Zone upload fichier import | auto |
| `file-dropzone-mini` | Métier | Zone upload justificatif | auto |
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
| `input-text-md` | Form | Champ texte md (défaut) | auto |
| `input-textarea-md` | Form | Zone texte multilignes | auto |
| `input-toggle` | Form | Switch on/off | auto |
| `layout-page-header` | Layout | Header de page avec titre + actions | auto |
| `modal-bank-selector` | Modal | Variante sélection banque | auto |
| `modal-confirm-danger` | Modal | Variante confirmation destructive | auto |
| `modal-export-options` | Modal | Variante options export | auto |
| `modal-surface` | Modal | Modale standard | auto |
| `nav-breadcrumb` | Nav | Fil d'Ariane | auto |
| `nav-header` | Nav | Header haut app | auto |
| `nav-sidebar` | Nav | Sidebar gauche app | auto |
| `nav-tabs` | Nav | Onglets de section | auto |
| `progress-bar` | Feedback | Barre de progression | auto |
| `rule-suggestion-form` | Métier | Form proposition règle depuis libellé | auto |
| `search-result-item` | Métier | Item résultat recherche | auto |
| `skeleton-block` | Feedback | Squelette bloc | auto |
| `skeleton-line` | Feedback | Squelette ligne | auto |
| `spinner-lg` | Feedback | Spinner large | auto |
| `spinner-md` | Feedback | Spinner medium (défaut) | auto |
| `spinner-sm` | Feedback | Spinner small | auto |
| `table-import-preview` | Table | Variante preview import | auto |
| `import-cat-edit` | Import | Édition inline catégorie (aperçu import) | auto |
| `table-top-transactions` | Table | Variante top dépenses compact | auto |
| `table-transactions` | Table | Table principale transactions | auto |
| `toast-error` | Feedback | Toast erreur | auto |
| `toast-info` | Feedback | Toast info | auto |
| `toast-success` | Feedback | Toast succès | auto |
| `toast-warning` | Feedback | Toast warning | auto |
| `tooltip-md` | Feedback | Tooltip survol md | auto |
| `transaction-filters` | Métier | Toolbar de filtres au-dessus liste | auto |
| `transaction-row` | Métier | Row de table-transactions | auto |

---

> **Si tu crées un nouveau composant**, ajoute-le immédiatement ici (section dédiée + ligne dans cet index, ordre alphabétique). Sinon, le design system perd sa cohérence.
