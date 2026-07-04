export interface ImportedRuleRow {
  /** Niveau 1 : catégorie (créée si absente, sous un type par défaut). */
  category: string;
  /** Niveau 2 : sous-catégorie (« — » si non précisée). */
  subcategory: string;
  /** Motif « contient » (les % encadrants sont retirés). */
  match: string;
}

const HEADER_RE = /^(cat[ée]gorie|category|cat)$/i;

function stripQuotes(s: string): string {
  return s.replace(/^"([^]*)"$/, "$1").trim();
}

/** Retire les % de type LIKE encadrants : `%libellé%` → `libellé`. */
function stripPercent(s: string): string {
  return s.replace(/^%+/, "").replace(/%+$/, "").trim();
}

/** Délimiteur : tabulation, puis point-virgule, sinon virgule. */
export function detectDelimiter(text: string): string {
  if (text.includes("\t")) return "\t";
  if (text.includes(";")) return ";";
  return ",";
}

/**
 * Parse un fichier de règles à 2 colonnes :
 *   1) catégorie au format `Catégorie.Sous-catégorie` (une seule partie ⇒ « — »)
 *   2) motif d'inclusion `%libellé%` (match_type « contient »)
 * La catégorie n'a pas de délimiteur → on découpe sur la 1ʳᵉ occurrence, ce qui
 * tolère un motif contenant le délimiteur (ex. des virgules dans le libellé).
 */
export function parseRulesText(text: string): ImportedRuleRow[] {
  const delimiter = detectDelimiter(text);
  const out: ImportedRuleRow[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(delimiter);
    if (idx === -1) continue;

    const path = stripQuotes(line.slice(0, idx).trim());
    const matchRaw = stripQuotes(line.slice(idx + 1).trim());
    if (!path || !matchRaw || HEADER_RE.test(path)) continue;

    const dot = path.indexOf(".");
    const category = (dot === -1 ? path : path.slice(0, dot)).trim();
    const subcategory = dot === -1 ? "—" : path.slice(dot + 1).trim() || "—";
    const match = stripPercent(matchRaw);
    if (!category || !match) continue;

    out.push({ category, subcategory, match });
  }

  return out;
}
