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

  muted: string;
};

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
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',

  tintPrimary: '#eff6ff',
  tintSuccess: '#f0fdf4',
  tintWarning: '#fef3c7',
  tintDanger: '#fee2e2',

  muted: '#cbd5e1',
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

  muted: '#4b5563',
};
