import 'dart:math' as math;

import 'diagrams.dart';

// « Créer des flashcards » n'a de sens que sous une vraie réponse de cours :
// pas sous une question de relance, un refus ou une réponse de deux lignes.
// (copie de utils/chatAnswers.ts)

const int _minLength = 400;

final RegExp _offTopic = RegExp(r'^je suis spécialisé', caseSensitive: false);

bool worthFlashcards(String? answer) {
  final text = stripDiagrams(answer ?? '').trim();
  if (text.length < _minLength) return false;
  if (_offTopic.hasMatch(text)) return false;
  // Réponse qui se termine par une question : l'assistant attend une précision.
  final lines = text.split('\n').where((l) => l.trim().isNotEmpty);
  final lastLine = lines.isEmpty ? '' : lines.last;
  return !lastLine.trim().endsWith('?');
}

const int _minColumnWidth = 130;

/// Largeur d'une colonne de tableau Markdown dans une bulle du chat : la bulle
/// partagée entre les colonnes, sans descendre sous 130 px (au-delà, le
/// tableau défile). `columns` = nombre de cellules de la ligne d'en-tête
/// (l'original le lisait dans l'arbre de react-native-markdown-display).
double tableColumnWidth(int columns, double bubbleWidth) {
  final count = math.max(1, columns);
  return math.max(_minColumnWidth, (bubbleWidth / count).floor()).toDouble();
}
