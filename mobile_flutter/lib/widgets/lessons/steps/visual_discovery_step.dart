import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../../content/lessons.dart';
import '../../../theme/theme_controller.dart';
import '../../ui.dart';
import 'step_shared.dart';

// Copie de components/steps/VisualDiscoveryStep.tsx.

const double _imageHeight = 380;
const double _spot = 36;

class VisualDiscovery extends StatefulWidget {
  final String question;

  /// Chemin de l'asset.
  final String image;

  /// Largeur / hauteur de l'image : le cadre a exactement ses proportions, les % tombent donc juste.
  final double aspectRatio;
  final List<AnatomyPart> parts;
  final String correctId;
  final String? explanation;
  final void Function(bool correct) onComplete;
  const VisualDiscovery({
    super.key,
    required this.question,
    required this.image,
    required this.aspectRatio,
    required this.parts,
    required this.correctId,
    this.explanation,
    required this.onComplete,
  });

  @override
  State<VisualDiscovery> createState() => _VisualDiscoveryState();
}

class _VisualDiscoveryState extends State<VisualDiscovery> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final answered = _selected != null;
    final isCorrect = _selected == widget.correctId;
    final correctLabel = widget.parts.where((p) => p.id == widget.correctId).firstOrNull?.label ?? '';
    const imageHeight = _imageHeight;
    final imageWidth = imageHeight * widget.aspectRatio;

    final spots = <Widget>[];
    for (var i = 0; i < widget.parts.length; i++) {
      final part = widget.parts[i];
      final state = !answered
          ? OptionState.idle
          : part.id == widget.correctId
              ? OptionState.correct
              : part.id == _selected
                  ? OptionState.incorrect
                  : OptionState.dimmed;
      final color = state == OptionState.correct
          ? c.success
          : state == OptionState.incorrect
              ? c.danger
              : c.primaryDark;
      final cx = imageWidth * part.x / 100;
      final cy = imageHeight * part.y / 100;

      spots.add(Positioned(
        key: ValueKey('spot-${part.id}'),
        left: cx - _spot / 2,
        top: cy - _spot / 2,
        child: Tappable(
          semanticLabel: answered ? part.label : 'Zone ${i + 1}',
          onTap: answered ? null : () => setState(() => _selected = part.id),
          child: ExcludeSemantics(
            child: Opacity(
              opacity: state == OptionState.dimmed ? 0.35 : 1,
              child: Container(
                width: _spot,
                height: _spot,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  // Équivalent de `color + "33"` : 20 % d'opacité.
                  color: color.withAlpha(0x33),
                  border: Border.all(color: color, width: 3),
                ),
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                ),
              ),
            ),
          ),
        ),
      ));

      if (answered && (state == OptionState.correct || state == OptionState.incorrect)) {
        spots.add(Positioned(
          key: ValueKey('label-${part.id}'),
          left: cx,
          top: cy + _spot / 2 + 4,
          child: FractionalTranslation(
            // Étiquette centrée sous la zone.
            translation: const Offset(-0.5, 0),
            child: ExcludeSemantics(
              child: Container(
                constraints: const BoxConstraints(minWidth: 90),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(999)),
                child: Text(part.label,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ),
          ),
        ));
      }
    }

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
                  const StepOverline(icon: Ionicons.scan_outline, label: 'REPÈRE ANATOMIQUE'),
                  const SizedBox(height: stepGapTight),
                  ...withGap(stepGap, [
                    Semantics(header: true, child: Text(widget.question, style: stepQuestionStyle(c))),
                    // Fond blanc fixe : le schéma reste lisible en mode sombre.
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: c.border),
                      ),
                      alignment: Alignment.center,
                      child: SizedBox(
                        width: imageWidth,
                        height: imageHeight,
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Positioned.fill(
                              child: Image.asset(widget.image, fit: BoxFit.fill, excludeFromSemantics: true),
                            ),
                            ...spots,
                          ],
                        ),
                      ),
                    ),
                    if (answered)
                      StepFeedback(
                        correct: isCorrect,
                        title: isCorrect ? 'Bien repéré !' : 'C’était : $correctLabel',
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
