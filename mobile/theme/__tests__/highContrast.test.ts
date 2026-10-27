import { darkColors, lightColors, withHighContrast } from '../colors';

// Rapport de contraste WCAG entre deux couleurs « #rrggbb ».
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each([
  ['clair', withHighContrast(lightColors, false)],
  ['sombre', withHighContrast(darkColors, true)],
])('contraste élevé, thème %s', (_, c) => {
  it('textes principaux et secondaires au niveau AAA (≥ 7:1) sur le fond et les cartes', () => {
    for (const bg of [c.background, c.surface]) {
      expect(contrast(c.textPrimary, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.textSecondary, bg)).toBeGreaterThanOrEqual(7);
    }
  });

  it('bordures visibles (≥ 3:1, éléments non textuels)', () => {
    expect(contrast(c.border, c.surface)).toBeGreaterThanOrEqual(3);
  });

  it('texte des boutons principaux lisible (≥ 4,5:1)', () => {
    expect(contrast(c.onAction, c.action)).toBeGreaterThanOrEqual(4.5);
  });
});

it('le contraste élevé renforce bien le texte secondaire', () => {
  expect(contrast(withHighContrast(lightColors, false).textSecondary, '#ffffff')).toBeGreaterThan(
    contrast(lightColors.textSecondary, '#ffffff')
  );
});
