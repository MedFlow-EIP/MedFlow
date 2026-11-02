import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../theme/colors.dart';
import '../theme/theme_controller.dart';
import 'ui.dart';

// Quiz sans correction immédiate (examen blanc, défi) et corrigé détaillé.
// Copie de components/quiz/QuizRunner.tsx et QuizCorrection.tsx.
//
// Question : {course_id, course_nom?, item_index, question, options: {A: '…'}}
// Correction : la même chose + {selected, correct_answer, explanation?, is_correct}

String questionKey(Map q) => '${q['course_id']}:${q['item_index']}';

Map<String, String> _options(Map q) =>
    (q['options'] as Map? ?? const {}).map((k, v) => MapEntry('$k', '$v'));

/// Une question à la fois, réponse modifiable, navigation libre entre
/// questions. La correction arrive à la remise (``onFinish``).
class QuizRunner extends StatefulWidget {
  final List<Map<String, dynamic>> questions;
  final Map<String, String> answers;
  final void Function(String key, String option) onAnswer;
  final VoidCallback onFinish;
  final String finishLabel;
  const QuizRunner({
    super.key,
    required this.questions,
    required this.answers,
    required this.onAnswer,
    required this.onFinish,
    this.finishLabel = 'Rendre la copie',
  });

  @override
  State<QuizRunner> createState() => _QuizRunnerState();
}

class _QuizRunnerState extends State<QuizRunner> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final q = widget.questions[_index];
    final key = questionKey(q);
    final isLast = _index == widget.questions.length - 1;

    return Column(
      children: [
        // Accès direct à chaque question : remplie = répondue.
        SizedBox(
          height: 36,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: widget.questions.length,
            separatorBuilder: (_, __) => const SizedBox(width: 6),
            itemBuilder: (context, i) {
              final item = widget.questions[i];
              final answered = widget.answers[questionKey(item)] != null;
              final active = i == _index;
              return Tappable(
                onTap: () => setState(() => _index = i),
                selected: active,
                semanticLabel: 'Question ${i + 1}${answered ? ', répondue' : ''}',
                child: Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: answered ? c.tintPrimary : c.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: active ? c.primaryDark : (answered ? c.tintPrimary : c.border),
                      width: 1.5,
                    ),
                  ),
                  child: Text('${i + 1}',
                      textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: answered ? c.primaryText : c.textSecondary)),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            children: [
              Text(
                'QUESTION ${_index + 1}/${widget.questions.length}'
                '${(q['course_nom'] ?? '').toString().isNotEmpty ? ' · ${q['course_nom']}' : ''}',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.primaryText),
              ),
              const SizedBox(height: 12),
              Semantics(
                header: true,
                child: Text('${q['question']}',
                    style: TextStyle(
                        fontSize: 19, height: 27 / 19, fontWeight: FontWeight.w600, color: c.textPrimary)),
              ),
              const SizedBox(height: 16),
              for (final entry in _options(q).entries) ...[
                _RadioOption(
                  text: entry.value,
                  selected: widget.answers[key] == entry.key,
                  onTap: () => widget.onAnswer(key, entry.key),
                ),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Opacity(
                opacity: _index == 0 ? 0.4 : 1,
                child: Tappable(
                  onTap: _index == 0 ? null : () => setState(() => _index--),
                  semanticLabel: 'Question précédente',
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: c.border, width: 1.5),
                    ),
                    child: Icon(Ionicons.arrowBack, size: 22, color: c.textPrimary),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Tappable(
                  onTap: isLast ? widget.onFinish : () => setState(() => _index++),
                  semanticLabel: isLast ? widget.finishLabel : 'Question suivante',
                  child: Container(
                    height: 56,
                    decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(16)),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(isLast ? widget.finishLabel : 'Question suivante',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction)),
                        if (!isLast) ...[
                          const SizedBox(width: 8),
                          Icon(Ionicons.arrowForward, size: 20, color: c.onAction),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RadioOption extends StatelessWidget {
  final String text;
  final bool selected;
  final VoidCallback onTap;
  const _RadioOption({required this.text, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
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
            borderRadius: BorderRadius.circular(14),
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
                        width: 10, height: 10, decoration: BoxDecoration(color: c.primaryDark, shape: BoxShape.circle))
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(text,
                    style: TextStyle(
                      fontSize: 15,
                      height: 21 / 15,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                      color: selected ? c.primaryText : c.textPrimary,
                    )),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Corrigé détaillé après un examen blanc ou un défi.
class QuizCorrection extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  const QuizCorrection({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(height: 12),
          _correctionCard(c, i, items[i]),
        ],
      ],
    );
  }

  Widget _correctionCard(AppColors c, int i, Map<String, dynamic> item) {
    final options = _options(item);
    final isCorrect = item['is_correct'] == true;
    final selected = item['selected'] as String?;
    final chosen = selected != null ? options[selected] : null;
    final explanation = item['explanation'] as String?;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(isCorrect ? Ionicons.checkmarkCircle : Ionicons.closeCircle,
                  size: 22, color: isCorrect ? c.success : c.danger),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'QUESTION ${i + 1}${(item['course_nom'] ?? '').toString().isNotEmpty ? ' · ${item['course_nom']}' : ''}',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text('${item['question']}',
              style: TextStyle(fontSize: 16, height: 22 / 16, fontWeight: FontWeight.w600, color: c.textPrimary)),
          if (!isCorrect) ...[
            const SizedBox(height: 8),
            Text(chosen != null ? 'Ta réponse : $chosen' : 'Sans réponse',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.dangerText)),
          ],
          const SizedBox(height: 8),
          Text('Bonne réponse : ${options[item['correct_answer']] ?? ''}',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.successText)),
          if (explanation != null && explanation.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(explanation, style: TextStyle(fontSize: 13, height: 19 / 13, color: c.textSecondary)),
          ],
        ],
      ),
    );
  }
}
