import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../../content/lessons.dart';
import '../../../theme/theme_controller.dart';
import 'step_shared.dart';

// Copie de components/steps/QuickQuizzCardsStep.tsx.

class QuickQuizCardsStep extends StatefulWidget {
  final String question;
  final List<QuizOption> options;
  final String correctId;
  final String? explanation;
  final void Function(bool correct) onComplete;
  const QuickQuizCardsStep({
    super.key,
    required this.question,
    required this.options,
    required this.correctId,
    this.explanation,
    required this.onComplete,
  });

  @override
  State<QuickQuizCardsStep> createState() => _QuickQuizCardsStepState();
}

class _QuickQuizCardsStepState extends State<QuickQuizCardsStep> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final answered = _selected != null;
    final isCorrect = _selected == widget.correctId;
    final correctText = widget.options.where((o) => o.id == widget.correctId).firstOrNull?.text ?? '';

    return ColoredBox(
      color: c.background,
      child: Stack(
        children: [
          Positioned.fill(
            child: SingleChildScrollView(
              padding: stepScrollPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const StepOverline(icon: Ionicons.helpCircleOutline, label: 'QUIZ'),
                  const SizedBox(height: stepGapTight),
                  ...withGap(stepGap, [
                    Semantics(header: true, child: Text(widget.question, style: stepQuestionStyle(c))),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: withGap(stepOptionsGap, [
                        for (final option in widget.options)
                          StepOption(
                            key: ValueKey(option.id),
                            text: option.text,
                            disabled: answered,
                            onPress: () => setState(() => _selected = option.id),
                            state: !answered
                                ? OptionState.idle
                                : option.id == widget.correctId
                                    ? OptionState.correct
                                    : option.id == _selected
                                        ? OptionState.incorrect
                                        : OptionState.dimmed,
                          ),
                      ]),
                    ),
                    if (answered)
                      StepFeedback(
                        correct: isCorrect,
                        title: isCorrect ? 'Bonne réponse !' : 'Bonne réponse : $correctText',
                        explanation: widget.explanation,
                      ),
                  ]),
                ],
              ),
            ),
          ),
          if (answered) StepPrimaryButton(label: 'Continuer', onPress: () => widget.onComplete(isCorrect)),
        ],
      ),
    );
  }
}
