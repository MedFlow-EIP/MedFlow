import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_controller.dart';
import '../../insets.dart';
import '../../ui.dart';

// Éléments communs aux étapes de leçon : même charte que la Révision
// (options à bordure 2 px + indicateur rond à droite, encadré de correction,
// bouton principal fixé en bas au-dessus de la zone système).
// Copie de components/steps/StepShared.tsx.

enum OptionState { idle, correct, incorrect, dimmed }

/// Marges du contenu d'une étape (style `scroll` de makeStepStyles) : le bas
/// laisse la place au bouton fixé.
const stepScrollPadding = EdgeInsets.fromLTRB(20, 20, 20, 120);

/// Espace entre les blocs d'une étape (`gap: 20`).
const double stepGap = 20;

/// Espace sous la ligne de surtitre quand le titre suivant a `marginTop: -8`.
const double stepGapTight = 12;

/// Espace entre les options (`options.gap`).
const double stepOptionsGap = 12;

/// Style de la question (`question` de makeStepStyles).
TextStyle stepQuestionStyle(AppColors c) =>
    TextStyle(fontSize: 21, height: 29 / 21, fontWeight: FontWeight.w600, color: c.textPrimary);

/// Insère `gap` entre chaque enfant (équivalent de la propriété `gap`).
List<Widget> withGap(double gap, List<Widget> children) => [
      for (var i = 0; i < children.length; i++) ...[
        if (i > 0) SizedBox(height: gap),
        children[i],
      ],
    ];

class StepOption extends StatelessWidget {
  final String text;
  final OptionState state;
  final VoidCallback onPress;
  final bool disabled;
  const StepOption({
    super.key,
    required this.text,
    required this.state,
    required this.onPress,
    required this.disabled,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (borderColor, background) = switch (state) {
      OptionState.correct => (c.success, c.tintSuccess),
      OptionState.incorrect => (c.danger, c.tintDanger),
      _ => (c.border, c.surface),
    };
    final textStyle = switch (state) {
      OptionState.correct => TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.successText),
      OptionState.incorrect => TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.dangerText),
      _ => TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: c.textPrimary),
    };
    final suffix = state == OptionState.correct
        ? ', bonne réponse'
        : state == OptionState.incorrect
            ? ', mauvaise réponse'
            : '';

    return Opacity(
      opacity: state == OptionState.dimmed ? 0.6 : 1,
      child: Tappable(
        onTap: disabled ? null : onPress,
        semanticLabel: '$text$suffix',
        child: ExcludeSemantics(
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: borderColor, width: 2),
            ),
            child: Row(
              children: [
                Expanded(child: Text(text, style: textStyle)),
                const SizedBox(width: 12),
                if (state == OptionState.correct)
                  Icon(Ionicons.checkmarkCircle, size: 26, color: c.success)
                else if (state == OptionState.incorrect)
                  Icon(Ionicons.closeCircle, size: 26, color: c.danger)
                else
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: c.muted, width: 2),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Encadré de correction (apparition en fondu, annoncé aux lecteurs d'écran).
class StepFeedback extends StatelessWidget {
  final bool correct;
  final String title;
  final String? explanation;
  const StepFeedback({super.key, required this.correct, required this.title, this.explanation});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final color = correct ? c.successText : c.dangerText;
    final hasExplanation = explanation != null && explanation!.isNotEmpty;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 300),
      builder: (context, t, child) => Opacity(opacity: t, child: child),
      child: Semantics(
        liveRegion: true,
        container: true,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: correct ? c.tintSuccess : c.tintDanger,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
              if (hasExplanation) ...[
                const SizedBox(height: 4),
                Text(explanation!, style: TextStyle(fontSize: 14, height: 20 / 14, color: color)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Bouton principal fixé en bas de l'étape. À placer comme dernier enfant
/// d'un `Stack` (il se positionne lui-même).
class StepPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback onPress;
  const StepPrimaryButton({super.key, required this.label, required this.onPress});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);

    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        color: c.background,
        padding: EdgeInsets.fromLTRB(20, 12, 20, insets.bottom + 12),
        child: PrimaryButton(label: label, onPressed: onPress),
      ),
    );
  }
}

/// Surtitre de l'étape : icône + libellé en capitales.
class StepOverline extends StatelessWidget {
  final IconData icon;
  final String label;
  const StepOverline({super.key, required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      children: [
        Icon(icon, size: 14, color: c.primaryText),
        const SizedBox(width: 6),
        Flexible(
          child: Text(label,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.primaryText, letterSpacing: 0.4)),
        ),
      ],
    );
  }
}
