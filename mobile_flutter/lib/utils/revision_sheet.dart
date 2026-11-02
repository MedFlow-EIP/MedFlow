import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import 'course_documents.dart';

// Fiche de révision PDF (F51) : résumé, flashcards et corrigé du quiz d'un
// cours, mis en page pour être imprimée ou partagée (copie de utils/revisionSheet.ts).
//
// Le cours est la Map JSON de /api/course/<id> : nom, summary, flashcards,
// quiz, tags.

/// Valeur « vraie » au sens JavaScript (chaîne non vide, nombre non nul…).
bool _truthy(Object? v) => v != null && v != false && v != '' && v != 0;

String escapeHtml(Object? text) =>
    '${text ?? ''}'.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Balises de mise en forme gardées dans la fiche (sans aucun attribut).
const _summaryTags = {
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'blockquote',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
};

final _bareAmpersand = RegExp(r'&(?![a-zA-Z]+;|#\d+;|#x[\da-fA-F]+;)');
final _scriptOrStyle = RegExp(r'&lt;(script|style)\b[\s\S]*?&lt;\/\1\s*&gt;', caseSensitive: false);
final _escapedTag = RegExp(r'&lt;(\/?)([a-z][a-z0-9]*)\b(?:(?!&gt;)[\s\S])*?&gt;', caseSensitive: false);

/// Le résumé est du HTML produit par l'IA. Tout est d'abord échappé (plus
/// aucune balise active), puis seules des balises de mise en forme sont
/// rétablies, sans attributs : rien ne peut s'exécuter ni charger une
/// ressource dans la fiche, même avec des balises imbriquées pièges.
String sanitizeSummary(String? html) {
  return (html ?? '')
      // Les entités déjà valides (&amp;, &eacute;, &#39;) restent telles quelles.
      .replaceAll(_bareAmpersand, '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      // Contenu des scripts et styles retiré (il apparaîtrait sinon en texte).
      .replaceAll(_scriptOrStyle, '')
      .replaceAllMapped(_escapedTag, (m) {
    final slash = m.group(1)!;
    final name = m.group(2)!.toLowerCase();
    return _summaryTags.contains(name) ? '<$slash$name>' : '';
  });
}

String buildRevisionSheetHtml(Map<String, dynamic> course, [DateTime? date]) {
  final day = date ?? DateTime.now();
  final flashcards = course['flashcards'] is List ? (course['flashcards'] as List) : const [];
  final quiz = course['quiz'] is List ? (course['quiz'] as List) : const [];
  final tags = (course['tags'] is List ? (course['tags'] as List) : const [])
      .map((t) => '<span class="tag">${escapeHtml(t)}</span>')
      .join('');

  final cards = [
    for (var i = 0; i < flashcards.length; i++)
      '''

      <tr>
        <td class="num">${i + 1}</td>
        <td class="q">${escapeHtml(flashcards[i]['question'])}</td>
        <td>${escapeHtml(flashcards[i]['answer'])}</td>
      </tr>''',
  ].join('');

  final questions = [
    for (var i = 0; i < quiz.length; i++) _question(quiz[i] as Map, i),
  ].join('');

  final summary = course['summary'];
  return '''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: #111827; font-size: 12pt; line-height: 1.5; }
  header { border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { font-size: 22pt; margin: 0 0 6px; }
  .meta { color: #4b5563; font-size: 10pt; }
  .tag { display: inline-block; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 2px 10px; margin-right: 6px; font-size: 9pt; font-weight: 600; }
  h2 { font-size: 15pt; color: #1d4ed8; border-left: 4px solid #2563eb; padding-left: 8px; margin: 26px 0 10px; page-break-after: avoid; }
  .summary h2, .summary h3 { color: #111827; border: none; padding: 0; font-size: 13pt; margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  th, td { border: 1px solid #d1d5db; padding: 7px 9px; vertical-align: top; text-align: left; }
  th { background: #f3f4f6; }
  tr { page-break-inside: avoid; }
  td.num { width: 24px; color: #6b7280; text-align: center; }
  .q { font-weight: 600; }
  .question { page-break-inside: avoid; margin-bottom: 14px; }
  .question ul { margin: 4px 0; padding-left: 20px; }
  .question li.correct { color: #15803d; font-weight: 700; }
  .expl { color: #4b5563; font-size: 10pt; margin: 2px 0 0; }
  footer { margin-top: 28px; color: #9ca3af; font-size: 9pt; text-align: center; }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(course['nom'])}</h1>
    <div class="meta">Fiche de révision MedFlow · ${escapeHtml(DateFormat('dd/MM/yyyy', 'fr_FR').format(day))}</div>
    ${tags.isNotEmpty ? '<div style="margin-top:8px">$tags</div>' : ''}
  </header>

  ${_truthy(summary) ? '<h2>Résumé</h2><div class="summary">${sanitizeSummary('$summary')}</div>' : ''}

  ${flashcards.isNotEmpty ? '''<h2>Flashcards (${flashcards.length})</h2>
  <table><thead><tr><th></th><th>Question</th><th>Réponse</th></tr></thead><tbody>$cards</tbody></table>''' : ''}

  ${quiz.isNotEmpty ? '<h2>Quiz corrigé (${quiz.length})</h2>$questions' : ''}

  <footer>Généré avec MedFlow</footer>
</body>
</html>''';
}

String _question(Map q, int i) {
  final correct = q['correct'];
  final options = (q['options'] is Map ? (q['options'] as Map) : const {})
      .entries
      .map((e) =>
          '<li class="${e.key == correct ? 'correct' : ''}">${escapeHtml(e.value)}${e.key == correct ? ' ✓' : ''}</li>')
      .join('');
  final explanation = q['explanation'];
  return '''

      <div class="question">
        <p class="q">${i + 1}. ${escapeHtml(q['question'])}</p>
        <ul>$options</ul>
        ${_truthy(explanation) ? '<p class="expl">${escapeHtml(explanation)}</p>' : ''}
      </div>''';
}

/// Crée le PDF et ouvre la feuille de partage (enregistrer, imprimer, envoyer).
/// [context] : bouton d'où part la feuille de partage sur iPad.
Future<void> shareRevisionSheet(Map<String, dynamic> course, {BuildContext? context}) async {
  final origin = shareOrigin(context);
  // Même rendu qu'expo-print : le HTML passe par la WebView du système.
  // ignore: deprecated_member_use
  final bytes = await Printing.convertHtml(html: buildRevisionSheetHtml(course));
  // Nom aléatoire dans un dossier « Print », comme expo-print.
  final folder = Directory('${(await getTemporaryDirectory()).path}/Print');
  await folder.create(recursive: true);
  final random = math.Random.secure();
  final id = List.generate(16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  final file = File('${folder.path}/${id.toUpperCase()}.pdf');
  await file.writeAsBytes(bytes, flush: true);
  await SharePlus.instance.share(ShareParams(
    files: [XFile(file.path, mimeType: 'application/pdf')],
    title: 'Fiche « ${course['nom']} »',
    sharePositionOrigin: origin,
  ));
}
