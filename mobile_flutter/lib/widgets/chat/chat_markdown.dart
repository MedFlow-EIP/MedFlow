import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../theme/colors.dart';
import '../../theme/theme_controller.dart';
import '../../utils/chat_answers.dart';

// Réponse de l'assistant en Markdown, avec les styles de AIChatScreen.tsx
// (react-native-markdown-display).
//
// Les tableaux sont dessinés ici, pas par flutter_markdown : comme dans l'app
// RN, colonnes de largeur fixe (le texte passe à la ligne dans la cellule) qui
// remplissent la bulle ; au-delà, le tableau défile. Ils sont repérés avec la
// règle de markdown-it (le moteur de react-native-markdown-display).

class ChatMarkdown extends StatelessWidget {
  final String data;

  /// Largeur utile d'une bulle de réponse (schémas, tableaux).
  final double bubbleWidth;
  const ChatMarkdown({super.key, required this.data, required this.bubbleWidth});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final sheet = _styleSheet(context, c);
    final segments = _splitTables(data);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final segment in segments)
          if (segment is _TableSegment)
            _ChatTable(table: segment, bubbleWidth: bubbleWidth)
          else if (segment is String && segment.trim().isNotEmpty)
            MarkdownBody(
              data: segment,
              styleSheet: sheet,
              fitContent: false,
              // react-native-markdown-display rend un simple retour à la ligne tel quel.
              softLineBreak: true,
              onTapLink: (text, href, title) => _openLink(href),
            ),
      ],
    );
  }
}

void _openLink(String? href) {
  final uri = href == null ? null : Uri.tryParse(href);
  if (uri != null) launchUrl(uri, mode: LaunchMode.externalApplication).catchError((_) => false);
}

TextStyle _bodyStyle(AppColors c) => TextStyle(color: c.textPrimary, fontSize: 15, height: 23 / 15);

MarkdownStyleSheet _styleSheet(BuildContext context, AppColors c) {
  final body = _bodyStyle(c);
  final hairline = 1 / MediaQuery.devicePixelRatioOf(context);
  // Séparateur « --- » de l'IA : une ligne discrète avec de l'air autour
  // (14 px de chaque côté), au lieu d'une barre grise collée au texte.
  const margin = 14.0;
  final total = margin * 2 + hairline;
  final hr = BoxDecoration(
    border: Border(
      top: BorderSide(color: Colors.transparent, width: margin + hairline),
      bottom: const BorderSide(color: Colors.transparent, width: margin),
    ),
    gradient: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [Colors.transparent, Colors.transparent, c.border, c.border, Colors.transparent, Colors.transparent],
      stops: [0, margin / total, margin / total, (margin + hairline) / total, (margin + hairline) / total, 1],
    ),
  );
  // Les titres gardent l'interligne du corps (23 px), comme dans l'app RN.
  TextStyle heading(double size, {bool bold = true}) =>
      body.copyWith(fontSize: size, height: 23 / size, fontWeight: bold ? FontWeight.w600 : null);
  const headingPadding = EdgeInsets.only(bottom: 4);
  return MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
    p: body,
    // Paragraphes : 10 px au-dessus et au-dessous (style par défaut de react-native-markdown-display).
    pPadding: const EdgeInsets.symmetric(vertical: 10),
    blockSpacing: 0,
    a: body.copyWith(decoration: TextDecoration.underline),
    code: body.copyWith(backgroundColor: c.surfaceAlt, fontFamily: 'Courier'),
    h1: heading(19),
    h1Padding: headingPadding,
    h2: heading(17),
    h2Padding: headingPadding,
    h3: heading(17),
    h3Padding: headingPadding,
    h4: heading(16, bold: false),
    h5: heading(13, bold: false),
    h6: heading(11, bold: false),
    em: const TextStyle(fontStyle: FontStyle.italic),
    strong: const TextStyle(fontWeight: FontWeight.w700),
    del: const TextStyle(decoration: TextDecoration.lineThrough),
    blockquote: body,
    blockquotePadding: const EdgeInsets.symmetric(horizontal: 5),
    blockquoteDecoration: BoxDecoration(
      color: c.surfaceAlt,
      border: Border(left: BorderSide(color: c.border, width: 4)),
    ),
    codeblockPadding: const EdgeInsets.all(10),
    codeblockDecoration: BoxDecoration(
      color: c.surfaceAlt,
      border: Border.all(color: c.border),
      borderRadius: BorderRadius.circular(4),
    ),
    listBullet: body,
    horizontalRuleDecoration: hr,
    // Tableau imbriqué (dans une citation) : rendu par flutter_markdown, au plus près.
    tableHead: const TextStyle(fontWeight: FontWeight.w600),
    tableBody: body,
    tableHeadAlign: TextAlign.left,
    tableBorder: TableBorder.all(color: c.border, borderRadius: BorderRadius.circular(12)),
    tableColumnWidth: const FixedColumnWidth(130),
    tableCellsPadding: const EdgeInsets.all(10),
  );
}

// ---------------------------------------------------------------------------
// Tableaux (règle « table » de markdown-it 10, utilisée par l'app RN)
// ---------------------------------------------------------------------------

class _TableSegment {
  final List<String> header;
  final List<List<String>> rows;
  const _TableSegment(this.header, this.rows);
}

/// Indentation d'une ligne (tabulation = 4 colonnes).
int _indent(String line) {
  var n = 0;
  for (final unit in line.codeUnits) {
    if (unit == 0x20) {
      n++;
    } else if (unit == 0x09) {
      n += 4 - n % 4;
    } else {
      break;
    }
  }
  return n;
}

/// Découpe sur « | » sauf échappé (\|) ou dans du code (`…`).
List<String> _escapedSplit(String str) {
  final result = <String>[];
  var pos = 0;
  final max = str.length;
  var escapes = 0;
  var lastPos = 0;
  var backTicked = false;
  var lastBackTick = 0;
  var ch = max > 0 ? str.codeUnitAt(0) : -1;
  while (pos < max) {
    if (ch == 0x60 /* ` */) {
      if (backTicked) {
        // \` ferme une séquence de code mais n'en ouvre pas.
        backTicked = false;
        lastBackTick = pos;
      } else if (escapes % 2 == 0) {
        backTicked = true;
        lastBackTick = pos;
      }
    } else if (ch == 0x7c /* | */ && escapes % 2 == 0 && !backTicked) {
      result.add(str.substring(lastPos, pos));
      lastPos = pos + 1;
    }
    if (ch == 0x5c /* \ */) {
      escapes++;
    } else {
      escapes = 0;
    }
    pos++;
    // Accent grave jamais refermé : on repart juste après, comme un caractère normal.
    if (pos == max && backTicked) {
      backTicked = false;
      pos = lastBackTick + 1;
    }
    ch = pos < max ? str.codeUnitAt(pos) : -1;
  }
  result.add(str.substring(lastPos));
  return result;
}

final RegExp _delimiterChars = RegExp(r'^[-:|][-:|\s]*$');
final RegExp _delimiterCell = RegExp(r'^:?-+:?$');
final RegExp _outerPipes = RegExp(r'^\||\|$');

/// Tableau commençant à la ligne ``start`` : (tableau, ligne suivante), ou null.
(_TableSegment, int)? _parseTable(List<String> lines, int start) {
  if (start + 1 >= lines.length) return null;
  final delimiter = lines[start + 1];
  if (_indent(delimiter) >= 4) return null;
  final delimiterText = delimiter.trim();
  if (delimiterText.isEmpty || !_delimiterChars.hasMatch(delimiterText)) return null;
  final columns = delimiter.split('|');
  var aligns = 0;
  for (var i = 0; i < columns.length; i++) {
    final t = columns[i].trim();
    if (t.isEmpty) {
      // Colonnes vides permises avant et après le tableau, pas entre deux colonnes.
      if (i == 0 || i == columns.length - 1) continue;
      return null;
    }
    if (!_delimiterCell.hasMatch(t)) return null;
    aligns++;
  }
  final headerLine = lines[start].trim();
  if (!headerLine.contains('|') || _indent(lines[start]) >= 4) return null;
  final header = _escapedSplit(headerLine.replaceAll(_outerPipes, '')).map((s) => s.trim()).toList();
  // La ligne d'en-tête fixe le nombre de colonnes du tableau.
  final columnCount = header.length;
  if (columnCount > aligns) return null;

  final rows = <List<String>>[];
  var next = start + 2;
  for (; next < lines.length; next++) {
    final text = lines[next].trim();
    if (!text.contains('|') || _indent(lines[next]) >= 4) break;
    final cells = _escapedSplit(text.replaceAll(_outerPipes, ''));
    rows.add([for (var i = 0; i < columnCount; i++) i < cells.length ? cells[i].trim() : '']);
  }
  return (_TableSegment(header, rows), next);
}

final RegExp _fenceOpen = RegExp(r'^ {0,3}(`{3,}|~{3,})');

/// Texte Markdown découpé en morceaux de texte (String) et tableaux, dans l'ordre.
List<Object> _splitTables(String source) {
  final lines = source.replaceAll(RegExp(r'\r\n?'), '\n').split('\n');
  final segments = <Object>[];
  final buffer = <String>[];
  String? fence;
  void flush() {
    if (buffer.isNotEmpty) segments.add(buffer.join('\n'));
    buffer.clear();
  }

  var i = 0;
  while (i < lines.length) {
    final line = lines[i];
    // Bloc de code : rien à chercher dedans.
    if (fence != null) {
      final close = _fenceOpen.firstMatch(line);
      final marker = close?.group(1);
      if (marker != null &&
          marker[0] == fence[0] &&
          marker.length >= fence.length &&
          line.substring(close!.end).trim().isEmpty) {
        fence = null;
      }
      buffer.add(line);
      i++;
      continue;
    }
    final open = _fenceOpen.firstMatch(line);
    if (open != null) {
      fence = open.group(1);
      buffer.add(line);
      i++;
      continue;
    }
    final table = _parseTable(lines, i);
    if (table != null) {
      flush();
      segments.add(table.$1);
      i = table.$2;
      continue;
    }
    buffer.add(line);
    i++;
  }
  flush();
  return segments;
}

final RegExp _thematicBreak = RegExp(r'^([-*_])(\s*\1){2,}\s*$');
final RegExp _blockStart = RegExp(r'^(#{1,6}(\s|$)|>|[-+*](\s|$)|`{3,}|~{3,}|\[[^\]]*\]:)');
final RegExp _orderedItem = RegExp(r'^(\d{1,9})([.)])(\s|$)');

/// Une cellule ne contient que du texte en ligne (gras, italique, code…) :
/// on neutralise ce qui ouvrirait un bloc (titre, liste, citation, « > 140 »…).
String _inlineOnly(String cell) {
  final t = cell.trim();
  if (_thematicBreak.hasMatch(t) || _blockStart.hasMatch(t)) return '\\$t';
  final ordered = _orderedItem.firstMatch(t);
  if (ordered != null) return '${ordered.group(1)}\\${t.substring(ordered.group(1)!.length)}';
  return t;
}

class _ChatTable extends StatefulWidget {
  final _TableSegment table;
  final double bubbleWidth;
  const _ChatTable({required this.table, required this.bubbleWidth});

  @override
  State<_ChatTable> createState() => _ChatTableState();
}

class _ChatTableState extends State<_ChatTable> {
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Widget _cell(BuildContext context, AppColors c, String text, {required bool header}) {
    final body = _bodyStyle(c);
    final style = header ? body.copyWith(fontWeight: FontWeight.w600) : body;
    return Padding(
      padding: const EdgeInsets.all(10),
      child: MarkdownBody(
        data: _inlineOnly(text),
        softLineBreak: true,
        onTapLink: (text, href, title) => _openLink(href),
        styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
          p: style,
          pPadding: EdgeInsets.zero,
          blockSpacing: 0,
          a: style.copyWith(decoration: TextDecoration.underline),
          code: style.copyWith(backgroundColor: c.surfaceAlt, fontFamily: 'Courier'),
          em: const TextStyle(fontStyle: FontStyle.italic),
          strong: const TextStyle(fontWeight: FontWeight.w700),
          del: const TextStyle(decoration: TextDecoration.lineThrough),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final table = widget.table;
    final width = tableColumnWidth(table.header.length, widget.bubbleWidth);
    final radius = BorderRadius.circular(12);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Scrollbar(
        controller: _scroll,
        child: SingleChildScrollView(
          controller: _scroll,
          scrollDirection: Axis.horizontal,
          child: Container(
            // La bordure est dessinée par-dessus, dans la marge de 1 px.
            padding: const EdgeInsets.all(1),
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(borderRadius: radius),
            foregroundDecoration: BoxDecoration(border: Border.all(color: c.border), borderRadius: radius),
            child: Table(
              defaultColumnWidth: FixedColumnWidth(width),
              defaultVerticalAlignment: TableCellVerticalAlignment.top,
              children: [
                TableRow(
                  decoration: BoxDecoration(color: c.surfaceAlt),
                  children: [for (final h in table.header) _cell(context, c, h, header: true)],
                ),
                for (final row in table.rows)
                  TableRow(children: [for (final cell in row) _cell(context, c, cell, header: false)]),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Réponse en HTML (anciennes réponses) → Markdown
// ---------------------------------------------------------------------------

String _decodeEntities(String s) {
  return s
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&apos;', "'")
      .replaceAllMapped(RegExp(r'&#(\d+);'), (m) => String.fromCharCode(int.parse(m.group(1)!)))
      .replaceAllMapped(
          RegExp(r'&#x([\da-fA-F]+);'), (m) => String.fromCharCode(int.parse(m.group(1)!, radix: 16)))
      .replaceAll('&amp;', '&');
}

/// L'app RN affichait ces réponses avec react-native-render-html, absent en
/// Flutter : les balises courantes (paragraphes, titres, gras, italique,
/// listes, retours à la ligne) sont converties en Markdown, le reste est retiré.
String htmlToMarkdown(String html) {
  RegExp tag(String pattern) => RegExp(pattern, caseSensitive: false);
  var s = html.replaceAll(RegExp(r'\s+'), ' ');
  // Listes numérotées : chaque <li> reçoit son numéro.
  s = s.replaceAllMapped(tag(r'<ol\b[^>]*>([\s\S]*?)</ol\s*>'), (m) {
    var n = 0;
    final items = m.group(1)!.replaceAllMapped(tag(r'<li\b[^>]*>'), (_) => '\n${++n}. ');
    return '\n\n$items\n\n';
  });
  s = s
      .replaceAll(tag(r'<br\s*/?>'), '\n')
      .replaceAll(tag(r'<hr\b[^>]*>'), '\n\n---\n\n')
      .replaceAllMapped(tag(r'<h([1-6])\b[^>]*>'), (m) => '\n\n${'#' * int.parse(m.group(1)!)} ')
      .replaceAll(tag(r'</h[1-6]\s*>'), '\n\n')
      .replaceAll(tag(r'</?(p|div|ul|ol|table|section)\b[^>]*>'), '\n\n')
      .replaceAll(tag(r'<li\b[^>]*>'), '\n- ')
      .replaceAll(tag(r'</li\s*>'), '')
      .replaceAll(tag(r'</tr\s*>'), '\n')
      .replaceAll(tag(r'</?(strong|b)\b[^>]*>'), '**')
      .replaceAll(tag(r'</?(em|i)\b[^>]*>'), '*')
      .replaceAll(tag(r'<[^>]+>'), '');
  s = _decodeEntities(s);
  return s
      .split('\n')
      .map((l) => l.trim())
      .join('\n')
      .replaceAll(RegExp(r'\n{3,}'), '\n\n')
      .trim();
}
