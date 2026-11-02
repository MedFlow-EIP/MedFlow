import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../../theme/theme_controller.dart';
import 'step_shared.dart';

// Copie de components/steps/ExplanationStep.tsx.

class ExplanationStep extends StatelessWidget {
  final String title;
  final String explanation;

  /// Points clés affichés en liste sous l'explication.
  final List<String>? points;

  /// Chemin d'un asset (`assets/…`) ou URL.
  final String? image;
  final VoidCallback onContinue;
  const ExplanationStep({
    super.key,
    required this.title,
    required this.explanation,
    this.points,
    this.image,
    required this.onContinue,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final img = image;

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
                  const StepOverline(icon: Ionicons.bulbOutline, label: 'À COMPRENDRE'),
                  const SizedBox(height: stepGapTight),
                  ...withGap(stepGap, [
                    Semantics(
                      header: true,
                      child: Text(title,
                          style: TextStyle(
                              fontSize: 24, height: 30 / 24, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    ),
                    if (img != null && img.isNotEmpty)
                      Semantics(
                        image: true,
                        label: 'Illustration : $title',
                        child: Container(
                          height: 200,
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: img.startsWith('http')
                              ? Image.network(img, fit: BoxFit.contain, excludeFromSemantics: true)
                              : Image.asset(img, fit: BoxFit.contain, excludeFromSemantics: true),
                        ),
                      ),
                    Text(explanation, style: TextStyle(fontSize: 16, height: 25 / 16, color: c.textPrimary)),
                    if (points != null && points!.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: c.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: c.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: withGap(12, [
                            for (final point in points!)
                              Row(
                                key: ValueKey(point),
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(Ionicons.checkmarkCircle, size: 20, color: c.success),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(point,
                                        style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textPrimary)),
                                  ),
                                ],
                              ),
                          ]),
                        ),
                      ),
                  ]),
                ],
              ),
            ),
          ),
          StepPrimaryButton(label: 'Continuer', onPress: onContinue),
        ],
      ),
    );
  }
}
