export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;

  textPrimary: string;
  textSecondary: string;
  textInverse: string;

  border: string;

  primary: string;
  primaryDark: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;

  tintPrimary: string;
  tintSuccess: string;
  tintWarning: string;
  tintDanger: string;
  /** Teinte bleue plus soutenue (barres non sélectionnées des graphiques). */
  tintPrimaryStrong: string;

  muted: string;

  /** Couleur de texte/icône à utiliser SUR un fond accentué
   * (primary/secondary/success/warning/danger) — distincte de
   * textInverse, qui reste réservé aux fonds véritablement sombres/noirs.
   * Nécessaire car en thème sombre, les accents sont volontairement des
   * pastels clairs : du texte blanc dessus ne passe pas le contraste
   * WCAG AA (voir docs/audit-accessibilite.md). */
  onAccent: string;

  /** Fond des actions principales (boutons pleins, onglet actif, FAB) et
   * texte/icône posé dessus. Clair : blanc sur primaryDark (5,2:1). Sombre :
   * texte foncé sur primary pastel, le blanc sur #3b82f6 n'atteignant que 3,7:1. */
  action: string;
  onAction: string;

  /** Texte lisible sur les teintes claires (tint*) : chips, bulles, états actifs. */
  primaryText: string;
  successText: string;
  warningText: string;
  dangerText: string;
};

/**
 * Mode contraste élevé (F60) : textes secondaires, bordures et icônes
 * atténuées nettement plus marqués, pour une lecture plus facile.
 */
export function withHighContrast(base: ThemeColors, isDark: boolean): ThemeColors {
  return isDark
    ? {
        ...base,
        background: '#0b0c10',
        surface: '#15171f',
        textPrimary: '#ffffff',
        textSecondary: '#e5e7eb',
        border: '#9ca3af',
        muted: '#cbd5e1',
        primaryText: '#bfdbfe',
        successText: '#a7f3d0',
        warningText: '#fde68a',
        dangerText: '#fecaca',
      }
    : {
        ...base,
        background: '#ffffff',
        textPrimary: '#000000',
        textSecondary: '#1f2937',
        border: '#6b7280',
        muted: '#374151',
        primaryText: '#1e3a8a',
        successText: '#14532d',
        warningText: '#7c2d12',
        dangerText: '#7f1d1d',
        action: '#1d4ed8',
        primaryDark: '#1d4ed8',
      };
}

export const lightColors: ThemeColors = {
  background: '#f9fafb',
  surface: '#ffffff',
  surfaceAlt: '#f3f4f6',

  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textInverse: '#ffffff',

  border: '#e5e7eb',

  primary: '#3b82f6',
  primaryDark: '#2563eb',
  secondary: '#9266f7',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',

  tintPrimary: '#eff6ff',
  tintSuccess: '#f0fdf4',
  tintWarning: '#fef3c7',
  tintDanger: '#fee2e2',
  tintPrimaryStrong: '#bfdbfe',

  muted: '#7d96b4',

  onAccent: '#111827',

  action: '#2563eb',
  onAction: '#ffffff',

  primaryText: '#1d4ed8',
  successText: '#15803d',
  warningText: '#c2410c',
  dangerText: '#b91c1c',
};

export const darkColors: ThemeColors = {
  background: '#15171f',
  surface: '#1c1f29',
  surfaceAlt: '#262a37',

  textPrimary: '#f3f4f6',
  textSecondary: '#9ca3af',
  textInverse: '#ffffff',

  border: '#323647',

  primary: '#60a5fa',
  primaryDark: '#3b82f6',
  secondary: '#a78bfa',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',

  tintPrimary: '#1e293b',
  tintSuccess: '#14291f',
  tintWarning: '#2e2410',
  tintDanger: '#2c1a1a',
  tintPrimaryStrong: '#1e3a5f',

  muted: '#5f6b7d',

  onAccent: '#15171f',

  action: '#60a5fa',
  onAction: '#15171f',

  primaryText: '#93c5fd',
  successText: '#6ee7b7',
  warningText: '#fcd34d',
  dangerText: '#fca5a5',
};