import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:medflow/theme/colors.dart';

// Rapport de contraste WCAG entre deux couleurs.
double _luminance(Color c) {
  double channel(int v) {
    final x = v / 255;
    return x <= 0.03928 ? x / 12.92 : math.pow((x + 0.055) / 1.055, 2.4).toDouble();
  }

  return 0.2126 * channel(c.red) + 0.7152 * channel(c.green) + 0.0722 * channel(c.blue);
}

double _contrast(Color a, Color b) {
  final la = _luminance(a), lb = _luminance(b);
  final hi = math.max(la, lb), lo = math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  for (final (name, c) in [
    ('clair', withHighContrast(lightColors, false)),
    ('sombre', withHighContrast(darkColors, true)),
  ]) {
    group('contraste élevé, thème $name', () {
      test('textes principaux et secondaires au niveau AAA (≥ 7:1) sur le fond et les cartes', () {
        for (final bg in [c.background, c.surface]) {
          expect(_contrast(c.textPrimary, bg), greaterThanOrEqualTo(7));
          expect(_contrast(c.textSecondary, bg), greaterThanOrEqualTo(7));
        }
      });

      test('bordures visibles (≥ 3:1, éléments non textuels)', () {
        expect(_contrast(c.border, c.surface), greaterThanOrEqualTo(3));
      });

      test('texte des boutons principaux lisible (≥ 4,5:1)', () {
        expect(_contrast(c.onAction, c.action), greaterThanOrEqualTo(4.5));
      });
    });
  }

  test('le contraste élevé renforce bien le texte secondaire', () {
    const white = Color(0xFFFFFFFF);
    expect(
      _contrast(withHighContrast(lightColors, false).textSecondary, white),
      greaterThan(_contrast(lightColors.textSecondary, white)),
    );
  });
}
