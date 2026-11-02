import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../widgets/insets.dart';
import '../widgets/report_error_sheet.dart';
import '../widgets/revision/common.dart';
import '../widgets/ui.dart';

// Carte due : {course_id, course_nom, card_key, question, answer, exam?: {title, days_left}}.

typedef FlashcardGrade = ({String grade, String label, String hint});

/// Les 4 notes, de « je ne savais pas » à « évident ».
const flashcardGrades = <FlashcardGrade>[
  (grade: 'again', label: 'À revoir', hint: 'demain'),
  (grade: 'hard', label: 'Difficile', hint: 'bientôt'),
  (grade: 'good', label: 'Bien', hint: 'plus tard'),
  (grade: 'easy', label: 'Facile', hint: 'beaucoup plus tard'),
];

/// Révision des flashcards en répétition espacée : la question, puis la
/// réponse, puis l'utilisateur se note ; la note fixe la prochaine révision.
/// Paramètre : `courseId` (optionnel).
class FlashcardReviewScreen extends StatefulWidget {
  const FlashcardReviewScreen({super.key});

  @override
  State<FlashcardReviewScreen> createState() => _FlashcardReviewScreenState();
}

class _FlashcardReviewScreenState extends State<FlashcardReviewScreen> {
  String? _courseId;
  bool _started = false;

  List<Map<String, dynamic>>? _cards;
  int _index = 0;
  bool _revealed = false;
  bool _sending = false;
  String? _error;
  int _reviewed = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final courseId = routeParams(context)['courseId'];
    _courseId = (courseId == null || '$courseId'.isEmpty) ? null : '$courseId';
    // Rien n'est empilé au-dessus de cet écran : un seul chargement suffit
    // (la feuille « Signaler une erreur » ne doit pas relancer la session).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    final user = Api.currentUser;
    if (user == null) return;
    setState(() => _error = null);
    try {
      final data = await Api.getJson(
        '/api/flashcards/due',
        query: _courseId != null ? {'course_id': _courseId} : null,
        fallback: 'Impossible de charger tes flashcards.',
      );
      final items = data is Map && data['items'] is List
          ? (data['items'] as List).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _cards = items;
        _index = 0;
        _revealed = false;
        _reviewed = 0;
      });
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Impossible de charger tes flashcards.'));
    }
  }

  Future<void> _grade(String value) async {
    final user = Api.currentUser;
    final cards = _cards;
    if (user == null || cards == null || _index >= cards.length || _sending) return;
    final card = cards[_index];
    setState(() => _sending = true);
    try {
      await Api.postJson(
        '/api/flashcards/review',
        {'course_id': card['course_id'], 'card_key': card['card_key'], 'grade': value},
        fallback: 'Note non enregistrée.',
      );
      if (!mounted) return;
      setState(() {
        _reviewed += 1;
        _index += 1;
        _revealed = false;
      });
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Note non enregistrée. Réessaie.'));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.background,
      body: _body(context),
    );
  }

  Widget _body(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final cards = _cards;

    if (cards == null) {
      if (_error != null) {
        return StateView(
          icon: Ionicons.cloudOfflineOutline,
          tone: Tone.neutral,
          title: 'Impossible de charger tes flashcards',
          subtitle: _error,
          primary: StateAction('Réessayer', _load),
          onClose: () => Nav.goBack(),
        );
      }
      return Center(
        child: Spinner(large: true, color: c.primaryDark, label: 'Chargement des flashcards'),
      );
    }

    if (_index >= cards.length) {
      final plural = _reviewed > 1 ? 's' : '';
      return StateView(
        icon: Ionicons.checkmarkDoneOutline,
        tone: Tone.success,
        title: _reviewed > 0 ? 'Session terminée' : 'Aucune flashcard à revoir',
        subtitle: _reviewed > 0
            ? '$_reviewed carte$plural revue$plural. Elles reviendront au bon moment.'
            : 'Tout est à jour. Reviens demain ou importe un nouveau cours.',
        primary: StateAction('Terminer', () => Nav.goBack()),
        secondary: _reviewed > 0 ? StateAction('Continuer s’il en reste', _load) : null,
        onClose: () => Nav.goBack(),
        closeIsCross: true,
      );
    }

    final card = cards[_index];
    final exam = card['exam'] is Map ? card['exam'] as Map : null;
    final overline = TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c.primaryText);

    return Padding(
      padding: EdgeInsets.only(top: insets.top),
      child: Column(
        children: [
          SessionHeader(index: _index, total: cards.length, paddingBottom: 12, onClose: () => Nav.goBack()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              children: [
                Text('${card['course_nom'] ?? ''}',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textSecondary)),
                if (exam != null) ...[
                  const SizedBox(height: 12),
                  ExamChip(text: '${exam['title']} · J-${jsNum(exam['days_left'])}'),
                ],
                const SizedBox(height: 12),
                Container(
                  constraints: const BoxConstraints(minHeight: 220),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: c.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('QUESTION', style: overline),
                      const SizedBox(height: 10),
                      Semantics(
                        header: true,
                        child: Text('${card['question'] ?? ''}',
                            style: TextStyle(
                                fontSize: 20, height: 28 / 20, fontWeight: FontWeight.w600, color: c.textPrimary)),
                      ),
                      if (_revealed) ...[
                        const SizedBox(height: 10),
                        Container(height: 1, margin: const EdgeInsets.symmetric(vertical: 6), color: c.border),
                        const SizedBox(height: 10),
                        Text('RÉPONSE', style: overline.copyWith(color: c.successText)),
                        const SizedBox(height: 10),
                        Semantics(
                          liveRegion: true,
                          child: Text('${card['answer'] ?? ''}',
                              style: TextStyle(fontSize: 17, height: 25 / 17, color: c.textPrimary)),
                        ),
                      ],
                    ],
                  ),
                ),
                if (_revealed) ...[
                  const SizedBox(height: 12),
                  ReportLink(
                    semanticLabel: 'Signaler une erreur dans cette carte',
                    onTap: () => showReportErrorSheet(
                      context,
                      ReportTarget(
                        kind: 'flashcard',
                        courseId: '${card['course_id']}',
                        excerpt: '${card['question']}\nRéponse : ${card['answer']}',
                      ),
                    ),
                  ),
                ],
                if (_error != null && _error!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: TextStyle(fontSize: 14, color: c.dangerText)),
                ],
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, insets.bottom + 12),
            decoration: BoxDecoration(
              color: c.surface,
              border: Border(top: BorderSide(color: c.border)),
            ),
            child: !_revealed
                ? Tappable(
                    onTap: () => setState(() => _revealed = true),
                    child: Container(
                      height: 56,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(16)),
                      child: Text('Voir la réponse',
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: c.onAction)),
                    ),
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Tu la connaissais ?',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textSecondary)),
                      const SizedBox(height: 10),
                      IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (var i = 0; i < flashcardGrades.length; i++) ...[
                              if (i > 0) const SizedBox(width: 8),
                              Expanded(child: _gradeButton(context, flashcardGrades[i])),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _gradeButton(BuildContext context, FlashcardGrade g) {
    final c = context.colors;
    final (borderColor, background) = switch (g.grade) {
      'again' => (c.danger, c.tintDanger),
      'easy' => (c.success, c.tintSuccess),
      _ => (c.border, c.surface),
    };
    return Tappable(
      onTap: _sending ? null : () => _grade(g.grade),
      semanticLabel: '${g.label}, à revoir ${g.hint}',
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 60),
          padding: const EdgeInsets.symmetric(horizontal: 4),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: borderColor, width: 1.5),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(g.label,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.textPrimary)),
              const SizedBox(height: 2),
              Text(g.hint, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: c.textSecondary)),
            ],
          ),
        ),
      ),
    );
  }
}
