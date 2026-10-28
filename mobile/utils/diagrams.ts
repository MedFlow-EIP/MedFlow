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

/** SVG sûr à afficher, ou null s'il n'en est pas un. */
export function sanitizeSvg(raw: string): string | null {
  let svg = (raw || '').trim();
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg) || svg.length > MAX_SVG_CHARS) return null;
  let previous: string;
  // Répété jusqu'à stabilité : un seul passage laisserait « <scr<script>ipt> » redevenir « <script> ».
  do {
    previous = svg;
    svg = svg
      // Blocs entiers puis balises isolées : scripts, HTML embarqué, images, liens.
      .replace(/<(script|foreignObject|style|iframe)\b[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<\/?(script|foreignObject|style|iframe|image|a|use)\b[^>]*>/gi, '')
      // Gestionnaires d'événements.
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  } while (svg !== previous);
  svg = svg
    // Liens vers l'extérieur.
    .replace(/\s(xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi, (attr, _x, value) =>
      /^["']#/.test(value) ? attr : ''
    )
    // react-native-svg ne lit que orient="auto" ou un angle : toute autre
    // valeur (ex. « auto-start-reverse ») fait planter l'app en natif.
    .replace(/\sorient\s*=\s*("[^"]*"|'[^']*')/gi, (attr, value) =>
      /^["']\s*(auto|-?\d+(\.\d+)?(deg)?)\s*["']$/i.test(value) ? attr : ' orient="auto"'
    );
  return svg;
}
