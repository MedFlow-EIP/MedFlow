import 'package:flutter/material.dart';

// Petit rendu HTML du résumé de cours (remplace react-native-render-html).
//
// Le backend demande à l'IA du « HTML pur » avec <h2>, <h3>, <ul>, <li>, <p>
// (services/ai/*_provider.py), plus parfois <strong>, <em>, <ol>, <br>…
// flutter_markdown ne sait pas afficher du HTML : ce rendu couvre les balises
// de mise en forme et reprend les styles par défaut de react-native-render-html
// (listes : marges 16 px, retrait 30 px ; blockquote : marges 16/40 px), avec
// les surcharges de SummaryCard (`tagsStyles`). Les balises inconnues gardent
// leur texte ; scripts, styles et images sont ignorés.

class HtmlTagStyle {
  final TextStyle? text;
  final double marginTop;
  final double marginBottom;
  const HtmlTagStyle({this.text, this.marginTop = 0, this.marginBottom = 0});
}

class HtmlView extends StatelessWidget {
  final String html;

  /// Style de base (équivalent de `baseStyle`).
  final TextStyle baseStyle;

  /// Surcharges par balise (équivalent de `tagsStyles`).
  final Map<String, HtmlTagStyle> tagsStyles;

  const HtmlView({super.key, required this.html, required this.baseStyle, this.tagsStyles = const {}});

  @override
  Widget build(BuildContext context) {
    final root = _parse(html);
    final renderer = _Renderer(tagsStyles, context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: renderer.blocks(root.children, baseStyle),
    );
  }
}

// ---------------------------------------------------------------- Analyse

class _Node {
  final String tag; // '#text' pour un texte
  final String text;
  final List<_Node> children = [];
  _Node(this.tag, [this.text = '']);
}

const _voidTags = {'br', 'hr', 'img', 'meta', 'link', 'input', 'wbr', 'col', 'area', 'base', 'source', 'embed'};
const _skipTags = {'script', 'style', 'head', 'title', 'svg', 'iframe', 'object', 'template', 'noscript'};
const _blockTags = {
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'ul',
  'ol',
  'li',
  'div',
  'blockquote',
  'hr',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'nav',
  'aside',
  'pre',
  'figure',
  'figcaption',
  'dl',
  'dt',
  'dd',
  'address',
};

final _token = RegExp(r'<!--[\s\S]*?-->|<(/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(/?)>|[^<]+|<');

_Node _parse(String html) {
  final root = _Node('');
  final stack = <_Node>[root];
  String? skipping;
  for (final m in _token.allMatches(html)) {
    final raw = m.group(0)!;
    if (raw.startsWith('<!--')) continue;
    final name = m.group(2)?.toLowerCase();
    final closing = m.group(1) == '/';
    if (skipping != null) {
      if (closing && name == skipping) skipping = null;
      continue;
    }
    if (name == null) {
      stack.last.children.add(_Node('#text', _decodeEntities(raw)));
      continue;
    }
    if (closing) {
      final index = stack.lastIndexWhere((n) => n.tag == name);
      if (index > 0) stack.removeRange(index, stack.length);
      continue;
    }
    final selfClosing = m.group(3) == '/';
    if (_skipTags.contains(name)) {
      if (!selfClosing) skipping = name;
      continue;
    }
    // Fermetures implicites : <li> suivant, bloc ouvert dans un <p>.
    if (name == 'li' && stack.last.tag == 'li') stack.removeLast();
    if (_blockTags.contains(name) && stack.last.tag == 'p') stack.removeLast();
    final node = _Node(name);
    stack.last.children.add(node);
    if (!_voidTags.contains(name) && !selfClosing) stack.add(node);
  }
  return root;
}

const _entities = {
  'amp': '&',
  'lt': '<',
  'gt': '>',
  'quot': '"',
  'apos': "'",
  'nbsp': ' ',
  'shy': '',
  'eacute': 'é',
  'egrave': 'è',
  'ecirc': 'ê',
  'euml': 'ë',
  'agrave': 'à',
  'aacute': 'á',
  'acirc': 'â',
  'auml': 'ä',
  'ccedil': 'ç',
  'icirc': 'î',
  'iuml': 'ï',
  'iacute': 'í',
  'ocirc': 'ô',
  'ouml': 'ö',
  'oacute': 'ó',
  'ugrave': 'ù',
  'ucirc': 'û',
  'uuml': 'ü',
  'uacute': 'ú',
  'yuml': 'ÿ',
  'ntilde': 'ñ',
  'oelig': 'œ',
  'aelig': 'æ',
  'Eacute': 'É',
  'Egrave': 'È',
  'Ecirc': 'Ê',
  'Agrave': 'À',
  'Acirc': 'Â',
  'Ccedil': 'Ç',
  'Icirc': 'Î',
  'Ocirc': 'Ô',
  'Ucirc': 'Û',
  'OElig': 'Œ',
  'AElig': 'Æ',
  'laquo': '«',
  'raquo': '»',
  'lsquo': '‘',
  'rsquo': '’',
  'ldquo': '“',
  'rdquo': '”',
  'hellip': '…',
  'ndash': '–',
  'mdash': '—',
  'bull': '•',
  'middot': '·',
  'deg': '°',
  'plusmn': '±',
  'times': '×',
  'divide': '÷',
  'micro': 'µ',
  'le': '≤',
  'ge': '≥',
  'ne': '≠',
  'asymp': '≈',
  'minus': '−',
  'infin': '∞',
  'rarr': '→',
  'larr': '←',
  'harr': '↔',
  'uarr': '↑',
  'darr': '↓',
  'rArr': '⇒',
  'lArr': '⇐',
  'hArr': '⇔',
  'sup1': '¹',
  'sup2': '²',
  'sup3': '³',
  'frac12': '½',
  'frac14': '¼',
  'frac34': '¾',
  'euro': '€',
  'copy': '©',
  'reg': '®',
  'trade': '™',
  'sect': '§',
  'para': '¶',
  'thinsp': ' ',
  'ensp': ' ',
  'emsp': ' ',
  'alpha': 'α',
  'beta': 'β',
  'gamma': 'γ',
  'delta': 'δ',
  'epsilon': 'ε',
  'zeta': 'ζ',
  'eta': 'η',
  'theta': 'θ',
  'iota': 'ι',
  'kappa': 'κ',
  'lambda': 'λ',
  'mu': 'μ',
  'nu': 'ν',
  'xi': 'ξ',
  'pi': 'π',
  'rho': 'ρ',
  'sigma': 'σ',
  'tau': 'τ',
  'upsilon': 'υ',
  'phi': 'φ',
  'chi': 'χ',
  'psi': 'ψ',
  'omega': 'ω',
  'Gamma': 'Γ',
  'Delta': 'Δ',
  'Theta': 'Θ',
  'Lambda': 'Λ',
  'Pi': 'Π',
  'Sigma': 'Σ',
  'Phi': 'Φ',
  'Psi': 'Ψ',
  'Omega': 'Ω',
  'sum': '∑',
  'radic': '√',
  'prop': '∝',
  'equiv': '≡',
};

final _entity = RegExp(r'&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);');

String _decodeEntities(String text) {
  if (!text.contains('&')) return text;
  return text.replaceAllMapped(_entity, (m) {
    final body = m.group(1)!;
    if (body.startsWith('#')) {
      final hex = body.length > 1 && (body[1] == 'x' || body[1] == 'X');
      final code = int.tryParse(hex ? body.substring(2) : body.substring(1), radix: hex ? 16 : 10);
      if (code == null || code <= 0 || code > 0x10FFFF) return m.group(0)!;
      return String.fromCharCode(code);
    }
    return _entities[body] ?? m.group(0)!;
  });
}

// ---------------------------------------------------------------- Rendu

class _Seg {
  final String text;
  final TextStyle style;
  final bool hardBreak;
  const _Seg(this.text, this.style, {this.hardBreak = false});
}

final _spaces = RegExp(r'[ \t\n\r\f]+');

class _Renderer {
  final Map<String, HtmlTagStyle> tags;
  final BuildContext context;
  _Renderer(this.tags, this.context);

  /// Styles par défaut de react-native-render-html, avant les surcharges.
  HtmlTagStyle _defaults(String tag, TextStyle style) {
    final size = style.fontSize ?? 14;
    switch (tag) {
      case 'h1':
        return HtmlTagStyle(
            text: TextStyle(fontSize: size * 2, fontWeight: FontWeight.bold),
            marginTop: size * 1.34,
            marginBottom: size * 1.34);
      case 'h2':
        return HtmlTagStyle(
            text: TextStyle(fontSize: size * 1.5, fontWeight: FontWeight.bold),
            marginTop: size * 1.245,
            marginBottom: size * 1.245);
      case 'h3':
        return HtmlTagStyle(
            text: TextStyle(fontSize: size * 1.17, fontWeight: FontWeight.bold),
            marginTop: size * 1.17,
            marginBottom: size * 1.17);
      case 'h4':
        return HtmlTagStyle(
            text: const TextStyle(fontWeight: FontWeight.bold), marginTop: size * 1.33, marginBottom: size * 1.33);
      case 'h5':
        return HtmlTagStyle(
            text: TextStyle(fontSize: size * 0.83, fontWeight: FontWeight.bold),
            marginTop: size * 1.39,
            marginBottom: size * 1.39);
      case 'h6':
        return HtmlTagStyle(
            text: TextStyle(fontSize: size * 0.67, fontWeight: FontWeight.bold),
            marginTop: size * 1.56,
            marginBottom: size * 1.56);
      case 'p':
      case 'ul':
      case 'ol':
      case 'blockquote':
      case 'dl':
      case 'figure':
        return HtmlTagStyle(marginTop: size, marginBottom: size);
      case 'th':
        return const HtmlTagStyle(text: TextStyle(fontWeight: FontWeight.bold));
      default:
        return const HtmlTagStyle();
    }
  }

  /// Style d'un bloc : défauts, puis `tagsStyles`.
  HtmlTagStyle _blockStyle(String tag, TextStyle inherited) {
    final d = _defaults(tag, inherited);
    final o = tags[tag];
    if (o == null) {
      return HtmlTagStyle(text: inherited.merge(d.text), marginTop: d.marginTop, marginBottom: d.marginBottom);
    }
    return HtmlTagStyle(
      text: inherited.merge(d.text).merge(o.text),
      marginTop: o.marginTop,
      marginBottom: o.marginBottom,
    );
  }

  TextStyle _inlineStyle(String tag, TextStyle style) {
    final base = switch (tag) {
      'strong' || 'b' => style.copyWith(fontWeight: FontWeight.bold),
      'em' || 'i' || 'cite' || 'var' || 'dfn' => style.copyWith(fontStyle: FontStyle.italic),
      'u' || 'ins' => style.copyWith(decoration: TextDecoration.underline, decorationColor: style.color),
      's' || 'del' || 'strike' => style.copyWith(decoration: TextDecoration.lineThrough, decorationColor: style.color),
      'code' || 'kbd' || 'samp' || 'tt' => style.copyWith(fontFamily: 'Courier'),
      'sub' || 'sup' || 'small' => style.copyWith(fontSize: (style.fontSize ?? 14) * 0.8),
      'a' => style.copyWith(color: const Color(0xFF245DC1), decoration: TextDecoration.underline),
      _ => style,
    };
    final o = tags[tag];
    return o == null ? base : base.merge(o.text);
  }

  List<Widget> blocks(List<_Node> nodes, TextStyle style) {
    final out = <Widget>[];
    final pending = <_Node>[];
    void flush() {
      if (pending.isEmpty) return;
      final paragraph = _paragraph(List.of(pending), style);
      pending.clear();
      if (paragraph != null) out.add(paragraph);
    }

    for (final n in nodes) {
      if (_blockTags.contains(n.tag)) {
        flush();
        out.add(_block(n, style));
      } else {
        pending.add(n);
      }
    }
    flush();
    return out;
  }

  Widget? _paragraph(List<_Node> nodes, TextStyle style) {
    final segs = <_Seg>[];
    for (final n in nodes) {
      _inline(n, style, segs);
    }
    final spans = <TextSpan>[];
    var lastSpace = true; // espaces de début de bloc ignorés
    for (final s in segs) {
      if (s.hardBreak) {
        spans.add(TextSpan(text: '\n', style: s.style));
        lastSpace = true;
        continue;
      }
      var t = s.text.replaceAll(_spaces, ' ');
      if (lastSpace && t.startsWith(' ')) t = t.substring(1);
      if (t.isEmpty) continue;
      lastSpace = t.endsWith(' ');
      spans.add(TextSpan(text: t, style: s.style));
    }
    // Espaces de fin de bloc ignorés.
    while (spans.isNotEmpty) {
      final last = spans.last;
      final t = last.text ?? '';
      if (t == '\n' || !t.endsWith(' ')) break;
      final trimmed = t.trimRight();
      spans.removeLast();
      if (trimmed.isNotEmpty) {
        spans.add(TextSpan(text: trimmed, style: last.style));
        break;
      }
    }
    if (!spans.any((s) => (s.text ?? '').trim().isNotEmpty)) return null;
    return Text.rich(TextSpan(style: style, children: spans));
  }

  void _inline(_Node n, TextStyle style, List<_Seg> out) {
    if (n.tag == '#text') {
      out.add(_Seg(n.text, style));
      return;
    }
    if (n.tag == 'br') {
      out.add(_Seg('\n', style, hardBreak: true));
      return;
    }
    if (n.tag == 'img') return;
    final s = _inlineStyle(n.tag, style);
    for (final c in n.children) {
      _inline(c, s, out);
    }
  }

  Widget _block(_Node n, TextStyle inherited) {
    final tag = n.tag;
    final st = _blockStyle(tag, inherited);
    final style = st.text ?? inherited;
    Widget child;
    switch (tag) {
      case 'hr':
        child = Padding(
          padding: EdgeInsets.symmetric(vertical: (inherited.fontSize ?? 14) * 0.5),
          child: Container(height: 1, color: Theme.of(context).dividerColor),
        );
      case 'ul':
      case 'ol':
        child = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: _listItems(n, style, ordered: tag == 'ol'),
        );
      case 'li':
        child = _listItem(n, style, '•');
      case 'blockquote':
        child = Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: blocks(n.children, style)),
        );
      default:
        child = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: blocks(n.children, style));
    }
    if (tag.length == 2 && tag[0] == 'h' && '123456'.contains(tag[1])) {
      child = Semantics(header: true, child: child);
    }
    if (st.marginTop == 0 && st.marginBottom == 0) return child;
    return Padding(padding: EdgeInsets.only(top: st.marginTop, bottom: st.marginBottom), child: child);
  }

  List<Widget> _listItems(_Node list, TextStyle style, {required bool ordered}) {
    final out = <Widget>[];
    final pending = <_Node>[];
    void flush() {
      if (pending.isEmpty) return;
      final p = _paragraph(List.of(pending), style);
      pending.clear();
      if (p != null) out.add(Padding(padding: const EdgeInsets.only(left: 30), child: p));
    }

    var index = 0;
    for (final c in list.children) {
      if (c.tag == 'li') {
        flush();
        index += 1;
        out.add(_listItem(c, style, ordered ? '$index.' : '•'));
      } else if (_blockTags.contains(c.tag)) {
        flush();
        out.add(Padding(padding: const EdgeInsets.only(left: 30), child: _block(c, style)));
      } else {
        pending.add(c);
      }
    }
    flush();
    return out;
  }

  /// Puce (ou numéro) dans le retrait de 30 px de la liste, puis le contenu.
  Widget _listItem(_Node li, TextStyle inherited, String marker) {
    final st = _blockStyle('li', inherited);
    final style = st.text ?? inherited;
    return Padding(
      padding: EdgeInsets.only(top: st.marginTop, bottom: st.marginBottom),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: SizedBox(
              width: 30,
              child: Padding(
                padding: const EdgeInsets.only(right: 5),
                child: Text(marker, textAlign: TextAlign.right, style: style),
              ),
            ),
          ),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: blocks(li.children, style)),
          ),
        ],
      ),
    );
  }
}
