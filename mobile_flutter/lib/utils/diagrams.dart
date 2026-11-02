// Schémas de l'assistant : l'IA les écrit en SVG dans un bloc ```svg … ```,
// que l'app affiche à la place du code. Le SVG vient d'un modèle : on le
// nettoie avant affichage (pas de script, de contenu HTML ni de ressource externe).
// (copie de utils/diagrams.ts)

enum MessagePartType { text, svg }

class MessagePart {
  final MessagePartType type;
  final String content;
  const MessagePart(this.type, this.content);
}

final RegExp _svgBlock = RegExp(r'```svg\s*([\s\S]*?)```', caseSensitive: false);
// Taille maximale d'un schéma affiché (un SVG démesuré ralentirait le téléphone).
const int _maxSvgChars = 40000;

/// Découpe une réponse en morceaux de texte et de schémas, dans l'ordre.
List<MessagePart> splitDiagrams(String? text) {
  final parts = <MessagePart>[];
  final source = text ?? '';
  var last = 0;
  for (final match in _svgBlock.allMatches(source)) {
    final before = source.substring(last, match.start);
    if (before.trim().isNotEmpty) parts.add(MessagePart(MessagePartType.text, before));
    final svg = sanitizeSvg(match.group(1));
    if (svg != null) parts.add(MessagePart(MessagePartType.svg, svg));
    last = match.end;
  }
  final rest = source.substring(last);
  if (rest.trim().isNotEmpty) parts.add(MessagePart(MessagePartType.text, rest));
  return parts;
}

/// Réponse sans ses schémas (lecture à voix haute, création de flashcards).
String stripDiagrams(String? text) {
  return (text ?? '').replaceAll(_svgBlock, '').replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();
}

// Éléments de dessin gardés (react-native-svg) ; tout le reste disparaît.
const Set<String> _svgElements = {
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', //
  'defs', 'marker', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern', 'symbol', //
  'title', 'desc',
};

final RegExp _attribute = RegExp(r'''([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')''');
final RegExp _localHref = RegExp(r'''^["']#''');
final RegExp _safeOrient = RegExp(r'''^["']\s*(auto|-?\d+(\.\d+)?(deg)?)\s*["']$''', caseSensitive: false);

/// Attributs d'une balise, sans gestionnaires d'événements ni liens vers l'extérieur.
String _safeSvgAttributes(String attributes) {
  final out = StringBuffer();
  for (final match in _attribute.allMatches(attributes)) {
    final name = match.group(1)!;
    final value = match.group(2)!;
    final lower = name.toLowerCase();
    if (lower.startsWith('on')) continue;
    if ((lower == 'href' || lower == 'xlink:href') && !_localHref.hasMatch(value)) continue;
    // react-native-svg ne lit que orient="auto" ou un angle : toute autre
    // valeur (ex. « auto-start-reverse ») fait planter l'app en natif.
    if (lower == 'orient' && !_safeOrient.hasMatch(value)) {
      out.write(' orient="auto"');
      continue;
    }
    out.write(' $name=$value');
  }
  return out.toString();
}

final RegExp _svgStart = RegExp(r'^<svg[\s>]', caseSensitive: false);
final RegExp _svgEnd = RegExp(r'<\/svg>\s*$', caseSensitive: false);
final RegExp _bareAmpersand = RegExp(r'&(?![a-zA-Z]+;|#\d+;|#x[\da-fA-F]+;)');
final RegExp _embedded =
    RegExp(r'&lt;(script|style|foreignObject|iframe)\b[\s\S]*?&lt;\/\1\s*&gt;', caseSensitive: false);
final RegExp _escapedTag = RegExp(r'&lt;(\/?)([A-Za-z][\w:-]*)((?:(?!&lt;|&gt;)[\s\S])*?)(\/?)&gt;');

/// SVG sûr à afficher, ou null s'il n'en est pas un. Tout est d'abord
/// neutralisé (plus aucune balise active), puis seuls les éléments de dessin
/// sont rétablis, avec leurs attributs filtrés : rien d'autre ne peut passer,
/// même avec des balises imbriquées pièges.
String? sanitizeSvg(String? raw) {
  final svg = (raw ?? '').trim();
  if (!_svgStart.hasMatch(svg) || !_svgEnd.hasMatch(svg) || svg.length > _maxSvgChars) return null;
  return svg
      .replaceAll(_bareAmpersand, '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      // Contenu des scripts, styles et HTML embarqué retiré (il apparaîtrait sinon en texte).
      .replaceAll(_embedded, '')
      .replaceAllMapped(_escapedTag, (m) {
    final close = m.group(1) ?? '';
    final name = m.group(2) ?? '';
    final attributes = m.group(3) ?? '';
    final selfClosing = m.group(4) ?? '';
    if (!_svgElements.contains(name.toLowerCase())) return '';
    return close.isNotEmpty ? '</$name>' : '<$name${_safeSvgAttributes(attributes)}$selfClosing>';
  });
}
