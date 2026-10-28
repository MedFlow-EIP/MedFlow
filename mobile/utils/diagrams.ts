// Schémas de l'assistant : l'IA les écrit en SVG dans un bloc ```svg … ```,
// que l'app affiche à la place du code. Le SVG vient d'un modèle : on le
// nettoie avant affichage (pas de script, de contenu HTML ni de ressource externe).

export type MessagePart = { type: 'text'; content: string } | { type: 'svg'; content: string };

const SVG_BLOCK = /```svg\s*([\s\S]*?)```/gi;
// Taille maximale d'un schéma affiché (un SVG démesuré ralentirait le téléphone).
const MAX_SVG_CHARS = 40_000;

/** Découpe une réponse en morceaux de texte et de schémas, dans l'ordre. */
export function splitDiagrams(text: string): MessagePart[] {
  const parts: MessagePart[] = [];
  const source = typeof text === 'string' ? text : '';
  // Boucle exec plutôt que matchAll : disponible sur tous les moteurs JS.
  const re = new RegExp(SVG_BLOCK.source, 'gi');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const before = source.slice(last, match.index);
    if (before.trim()) parts.push({ type: 'text', content: before });
    const svg = sanitizeSvg(match[1]);
    if (svg) parts.push({ type: 'svg', content: svg });
    last = match.index + match[0].length;
  }
  const text_ = source;
  const rest = text_.slice(last);
  if (rest.trim()) parts.push({ type: 'text', content: rest });
  return parts;
}

/** Réponse sans ses schémas (lecture à voix haute, création de flashcards). */
export function stripDiagrams(text: string): string {
  return (typeof text === 'string' ? text : '').replace(SVG_BLOCK, '').replace(/\n{3,}/g, '\n\n').trim();
}

// Éléments de dessin gardés (react-native-svg) ; tout le reste disparaît.
const SVG_ELEMENTS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan',
  'defs', 'marker', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern', 'symbol',
  'title', 'desc',
]);

/** Attributs d'une balise, sans gestionnaires d'événements ni liens vers l'extérieur. */
function safeSvgAttributes(attributes: string): string {
  let out = '';
  const re = /([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attributes)) !== null) {
    const [, name, value] = match;
    const lower = name.toLowerCase();
    if (lower.startsWith('on')) continue;
    if ((lower === 'href' || lower === 'xlink:href') && !/^["']#/.test(value)) continue;
    // react-native-svg ne lit que orient="auto" ou un angle : toute autre
    // valeur (ex. « auto-start-reverse ») fait planter l'app en natif.
    if (lower === 'orient' && !/^["']\s*(auto|-?\d+(\.\d+)?(deg)?)\s*["']$/i.test(value)) {
      out += ' orient="auto"';
      continue;
    }
    out += ` ${name}=${value}`;
  }
  return out;
}

/**
 * SVG sûr à afficher, ou null s'il n'en est pas un. Tout est d'abord
 * neutralisé (plus aucune balise active), puis seuls les éléments de dessin
 * sont rétablis, avec leurs attributs filtrés : rien d'autre ne peut passer,
 * même avec des balises imbriquées pièges.
 */
export function sanitizeSvg(raw: string): string | null {
  const svg = (raw || '').trim();
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg) || svg.length > MAX_SVG_CHARS) return null;
  return svg
    .replace(/&(?![a-zA-Z]+;|#\d+;|#x[\da-fA-F]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Contenu des scripts, styles et HTML embarqué retiré (il apparaîtrait sinon en texte).
    .replace(/&lt;(script|style|foreignObject|iframe)\b[\s\S]*?&lt;\/\1\s*&gt;/gi, '')
    .replace(
      /&lt;(\/?)([A-Za-z][\w:-]*)((?:(?!&lt;|&gt;)[\s\S])*?)(\/?)&gt;/g,
      (_tag, close: string, name: string, attributes: string, selfClosing: string) => {
        if (!SVG_ELEMENTS.has(name.toLowerCase())) return '';
        return close ? `</${name}>` : `<${name}${safeSvgAttributes(attributes)}${selfClosing}>`;
      }
    );
}
