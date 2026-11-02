import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../../content/lessons.dart';
import '../../../theme/theme_controller.dart';
import 'step_shared.dart';

// Copie de components/steps/SpeedChallengeStep.tsx.

class SpeedChallengeStep extends StatefulWidget {
  final String question;
  final List<QuizOption> options;
  final String correctId;
  final int timeLimit;
  final String? explanation;
  final void Function(bool correct) onComplete;
  const SpeedChallengeStep({
    super.key,
    required this.question,
    required this.options,
    required this.correctId,
    required this.timeLimit,
    this.explanation,
    required this.onComplete,
  });

  @override
  State<SpeedChallengeStep> createState() => _SpeedChallengeStepState();
}

class _SpeedChallengeStepState extends State<SpeedChallengeStep> with SingleTickerProviderStateMixin {
  late int _time = widget.timeLimit;
  String? _selectedId;
  bool _timedOut = false;
  late final AnimationController _bar;
  Timer? _timer;

  bool get _answered => _selectedId != null || _timedOut;

  @override
  void initState() {
    super.initState();
    // Barre de 100 % à 0 % en `timeLimit` secondes, linéaire.
    _bar = AnimationController(vsync: this, value: 1, duration: Duration(seconds: _time));
    _bar.animateTo(0, curve: Curves.linear);

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_time <= 1) {
        timer.cancel();
        _bar.stop();
        setState(() {
          _timedOut = true;
          _time = 0;
        });
        return;
      }
      setState(() => _time -= 1);
    });
  }

  void _select(String id) {
    _timer?.cancel();
    _bar.stop();
    setState(() => _selectedId = id);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _bar.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final answered = _answered;
    final isCorrect = _selectedId == widget.correctId;
    final correctText = widget.options.where((o) => o.id == widget.correctId).firstOrNull?.text ?? '';
    final urgent = _time <= 3 && !answered;

    return ColoredBox(
      color: c.background,
      child: Stack(
        children: [
          Positioned.fill(
            child: SingleChildScrollView(
              padding: stepScrollPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: withGap(stepGap, [
                  const StepOverline(icon: Ionicons.flash_outline, label: 'DÉFI CHRONO'),
                  Semantics(
                    label: '$_time secondes restantes',
                    excludeSemantics: true,
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: c.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: c.border),
                      ),
                      child: Row(
                        children: [
                          Icon(Ionicons.timer_outline, size: 22, color: urgent ? c.dangerText : c.textPrimary),
                          const SizedBox(width: 10),
                          SizedBox(
                            width: 44,
                            child: Text('$_time s',
                                maxLines: 1,
                                softWrap: false,
                                style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: urgent ? c.dangerText : c.textPrimary)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: SizedBox(
                                height: 8,
                                child: ColoredBox(
                                  color: c.border,
                                  child: AnimatedBuilder(
                                    animation: _bar,
                                    builder: (context, _) => FractionallySizedBox(
                                      alignment: Alignment.centerLeft,
                                      widthFactor: _bar.value,
                                      heightFactor: 1,
                                      child: DecoratedBox(
                                        decoration: BoxDecoration(
                                          color: urgent ? c.danger : c.warning,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Semantics(header: true, child: Text(widget.question, style: stepQuestionStyle(c))),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: withGap(stepOptionsGap, [
                      for (final o in widget.options)
                        StepOption(
                          key: ValueKey(o.id),
                          text: o.text,
                          disabled: answered,
                          onPress: () => _select(o.id),
                          state: !answered
                              ? OptionState.idle
                              : o.id == widget.correctId
                                  ? OptionState.correct
                                  : o.id == _selectedId
                                      ? OptionState.incorrect
                                      : OptionState.dimmed,
                        ),
                    ]),
                  ),
                  if (answered)
                    StepFeedback(
                      correct: isCorrect,
                      title: _timedOut
                          ? 'Temps écoulé ! Réponse : $correctText'
                          : isCorrect
                              ? 'Bonne réponse, en ${widget.timeLimit - _time} s !'
                              : 'Bonne réponse : $correctText',
                      explanation: widget.explanation,
                    ),
                ]),
              ),
            ),
          ),
          if (answered) StepPrimaryButton(label: 'Continuer', onPress: () => widget.onComplete(isCorrect)),
        ],
      ),
    );
  }
}
