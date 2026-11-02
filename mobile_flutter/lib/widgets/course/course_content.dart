import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/colors.dart';
import '../../theme/theme_controller.dart';
import '../ui.dart';
import 'html_summary.dart';
import 'layout.dart';

// Blocs partagés par « Contenu généré » (UploadCourseScreen) et la fiche du
// cours (CourseDetail) : mêmes onglets, même typo, mêmes cartes.
// Copie de components/course/CourseContent.tsx.
//
// Flashcard : Map {question, answer}.
// Question de quiz : Map {question, options: {clé: texte}, correct, explanation?}.

enum CourseTab { resume, flashcards, quiz }

const _tabLabels = {
  CourseTab.resume: 'Résumé',
  CourseTab.flashcards: 'Flashcards',
  CourseTab.quiz: 'Quiz',
};

class CourseTabs extends StatelessWidget {
  final CourseTab value;
  final ValueChanged<CourseTab> onChange;
  const CourseTabs({super.key, required this.value, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    // Onglet actif = pastille blanche + texte primaryText (plus de texte noir sur bleu).
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: gapped([
          for (final tab in CourseTab.values)
            Expanded(
              child: Tappable(
                onTap: () => onChange(tab),
                selected: tab == value,
                child: Container(
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                  decoration: BoxDecoration(
                    color: tab == value ? c.surface : null,
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: tab == value
                        ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 6, offset: const Offset(0, 2))]
                        : null,
                  ),
                  child: Text(
                    _tabLabels[tab]!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: tab == value ? FontWeight.w600 : FontWeight.w500,
                      color: tab == value ? c.primaryText : c.textSecondary,
                    ),
                  ),
                ),
              ),
            ),
        ], 4, axis: Axis.horizontal),
      ),
    );
  }
}

final _startsWithHeading = RegExp(r'^\s*<h[1-4]', caseSensitive: false);

/// Hiérarchie typo : intertitres 19 px, paragraphes 16 px / 25, 8 px titre→texte, 24 px entre sections.
class SummaryCard extends StatelessWidget {
  final String html;
  const SummaryCard({super.key, required this.html});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final heading = HtmlTagStyle(
      text: TextStyle(fontSize: 19, height: 26 / 19, fontWeight: FontWeight.w600, color: c.textPrimary),
      marginTop: 24,
      marginBottom: 8,
    );
    // Le premier intertitre porte déjà 24 px de marge haute : on retire alors le padding haut de la carte.
    final startsWithHeading = _startsWithHeading.hasMatch(html);

    return Container(
      padding: EdgeInsets.fromLTRB(20, startsWithHeading ? 0 : 20, 20, 20),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(20),
      ),
      child: HtmlView(
        html: html,
        baseStyle: TextStyle(color: c.textPrimary, fontSize: 16, height: 25 / 16),
        tagsStyles: {
          'h1': heading,
          'h2': heading,
          'h3': heading,
          'h4': HtmlTagStyle(
            text: TextStyle(fontSize: 17, height: 26 / 17, fontWeight: FontWeight.w600, color: c.textPrimary),
            marginTop: 24,
            marginBottom: 8,
          ),
          'p': const HtmlTagStyle(marginTop: 0, marginBottom: 0),
          'li': const HtmlTagStyle(marginBottom: 4),
          'strong': const HtmlTagStyle(text: TextStyle(fontWeight: FontWeight.w700)),
        },
      ),
    );
  }
}

class FlashcardList extends StatelessWidget {
  final List cards;
  final Set<String>? dueQuestions;
  const FlashcardList({super.key, required this.cards, this.dueQuestions});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: gapped([
        for (final card in cards)
          _ItemCard(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _Overline('QUESTION', color: c.primaryText),
                  if (dueQuestions?.contains(card['question']) ?? false)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(color: c.tintWarning, borderRadius: BorderRadius.circular(999)),
                      child: Text('À revoir',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.warningText)),
                    ),
                ],
              ),
              Text('${card['question'] ?? ''}', style: _questionStyle(c)),
              Container(height: 1, color: c.border),
              _Overline('RÉPONSE', color: c.successText),
              Text('${card['answer'] ?? ''}', style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textPrimary)),
            ],
          ),
      ], 16),
    );
  }
}

enum QuizListMode {
  /// Quiz à répondre (choix neutres + radio, « Valider mes réponses »).
  answer,

  /// Corrigé non interactif (bonne réponse en vert + explication).
  key,
}

class QuizList extends StatefulWidget {
  final List questions;
  final QuizListMode mode;
  const QuizList({super.key, required this.questions, required this.mode});

  @override
  State<QuizList> createState() => _QuizListState();
}

class _QuizListState extends State<QuizList> {
  Map<int, String> _answers = {};
  bool _validated = false;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final questions = widget.questions;
    final mode = widget.mode;
    final showCorrection = mode == QuizListMode.key || _validated;
    final answeredCount = _answers.length;
    var score = 0;
    for (var i = 0; i < questions.length; i++) {
      if (_answers[i] != null && _answers[i] == questions[i]['correct']) score += 1;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (mode == QuizListMode.answer) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${questions.length} question${questions.length > 1 ? 's' : ''}',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.textPrimary)),
              Text(
                _validated
                    ? 'Score : $score/${questions.length}'
                    : '$answeredCount/${questions.length} répondue${answeredCount > 1 ? 's' : ''}',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: c.textSecondary),
              ),
            ],
          ),
          // marginBottom: -4 sur l'en-tête : 12 px au lieu de 16.
          const SizedBox(height: 12),
        ],
        ...gapped([
          for (var i = 0; i < questions.length; i++) _question(context, questions[i] as Map, i, showCorrection),
          if (mode == QuizListMode.answer && !_validated)
            Opacity(
              opacity: answeredCount == 0 ? 0.5 : 1,
              child: Tappable(
                onTap: answeredCount == 0 ? null : () => setState(() => _validated = true),
                child: Container(
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
                  child: Text('Valider mes réponses',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction)),
                ),
              ),
            ),
          if (mode == QuizListMode.answer && _validated)
            Tappable(
              onTap: () => setState(() {
                _answers = {};
                _validated = false;
              }),
              child: Container(
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(vertical: 15),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: c.primaryDark, width: 1.5),
                ),
                child: Text('Recommencer le quiz',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
              ),
            ),
        ], 16),
      ],
    );
  }

  Widget _question(BuildContext context, Map q, int i, bool showCorrection) {
    final c = context.colors;
    final options = q['options'] is Map ? (q['options'] as Map) : const {};
    final explanation = q['explanation'];
    return _ItemCard(
      children: [
        _Overline('QUESTION ${i + 1}/${widget.questions.length}', color: c.primaryText),
        Text('${q['question'] ?? ''}', style: _questionStyle(c)),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: gapped([
            for (final entry in options.entries)
              showCorrection
                  ? _keyOption(context, '${entry.value}',
                      isCorrect: entry.key == q['correct'],
                      isWrongPick: _validated && _answers[i] == entry.key && entry.key != q['correct'])
                  : _answerOption(context, '${entry.value}',
                      selected: _answers[i] == entry.key,
                      onTap: () => setState(() => _answers = {..._answers, i: '${entry.key}'})),
          ], 10),
        ),
        if (showCorrection && explanation != null && '$explanation'.isNotEmpty)
          Text('$explanation', style: TextStyle(fontSize: 13, height: 18 / 13, color: c.textSecondary)),
      ],
    );
  }

  Widget _keyOption(BuildContext context, String value, {required bool isCorrect, required bool isWrongPick}) {
    final c = context.colors;
    final highlighted = isCorrect || isWrongPick;
    return Semantics(
      label: '$value${isCorrect ? ', bonne réponse' : isWrongPick ? ', ta réponse, incorrecte' : ''}',
      excludeSemantics: true,
      child: Container(
        // La bordure (1 ou 2 px) s'ajoute au padding, comme en RN.
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: isCorrect ? c.tintSuccess : (isWrongPick ? c.tintDanger : null),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isCorrect ? c.success : (isWrongPick ? c.danger : c.border),
            width: highlighted ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                value,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: highlighted ? FontWeight.w600 : FontWeight.w400,
                  color: isCorrect ? c.successText : (isWrongPick ? c.dangerText : c.textSecondary),
                ),
              ),
            ),
            if (isCorrect) ...[const SizedBox(width: 10), Icon(Ionicons.checkmarkCircle, size: 22, color: c.success)],
            if (isWrongPick) ...[const SizedBox(width: 10), Icon(Ionicons.closeCircle, size: 22, color: c.danger)],
          ],
        ),
      ),
    );
  }

  // Réponses aérées : padding 14-16, cible tactile ≥ 56 px, même bordure pour tous les états.
  Widget _answerOption(BuildContext context, String value, {required bool selected, required VoidCallback onTap}) {
    final c = context.colors;
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: selected,
      child: Tappable(
        onTap: onTap,
        button: false,
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: selected ? c.tintPrimary : c.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? c.primaryDark : c.border, width: 2),
          ),
          child: Row(
            children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: selected ? c.primaryDark : c.muted, width: 2),
                ),
                child: selected
                    ? Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(color: c.primaryDark, shape: BoxShape.circle),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  value,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                    color: selected ? c.primaryText : c.textPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

TextStyle _questionStyle(AppColors c) =>
    TextStyle(fontSize: 16, height: 22 / 16, fontWeight: FontWeight.w600, color: c.textPrimary);

class _ItemCard extends StatelessWidget {
  final List<Widget> children;
  const _ItemCard({required this.children});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped(children, 10)),
    );
  }
}

class _Overline extends StatelessWidget {
  final String text;
  final Color color;
  const _Overline(this.text, {required this.color});

  @override
  Widget build(BuildContext context) =>
      Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color));
}
