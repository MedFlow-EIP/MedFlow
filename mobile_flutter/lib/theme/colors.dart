import 'package:flutter/material.dart';

/// Palette de l'app (copie de mobile/theme/colors.ts).
class AppColors {
  final Color background;
  final Color surface;
  final Color surfaceAlt;

  final Color textPrimary;
  final Color textSecondary;
  final Color textInverse;

  final Color border;

  final Color primary;
  final Color primaryDark;
  final Color secondary;
  final Color success;
  final Color warning;
  final Color danger;

  final Color tintPrimary;
  final Color tintSuccess;
  final Color tintWarning;
  final Color tintDanger;

  /// Teinte bleue plus soutenue (barres non sélectionnées des graphiques).
  final Color tintPrimaryStrong;

  final Color muted;

  /// Texte/icône SUR un fond accentué (primary/secondary/success/warning/danger).
  final Color onAccent;

  /// Fond des actions principales (boutons pleins, onglet actif, FAB) et texte posé dessus.
  final Color action;
  final Color onAction;

  /// Texte lisible sur les teintes claires (tint*) : chips, bulles, états actifs.
  final Color primaryText;
  final Color successText;
  final Color warningText;
  final Color dangerText;

  const AppColors({
    required this.background,
    required this.surface,
    required this.surfaceAlt,
    required this.textPrimary,
    required this.textSecondary,
    required this.textInverse,
    required this.border,
    required this.primary,
    required this.primaryDark,
    required this.secondary,
    required this.success,
    required this.warning,
    required this.danger,
    required this.tintPrimary,
    required this.tintSuccess,
    required this.tintWarning,
    required this.tintDanger,
    required this.tintPrimaryStrong,
    required this.muted,
    required this.onAccent,
    required this.action,
    required this.onAction,
    required this.primaryText,
    required this.successText,
    required this.warningText,
    required this.dangerText,
  });

  AppColors copyWith({
    Color? background,
    Color? surface,
    Color? textPrimary,
    Color? textSecondary,
    Color? border,
    Color? muted,
    Color? primaryText,
    Color? successText,
    Color? warningText,
    Color? dangerText,
    Color? action,
    Color? primaryDark,
  }) {
    return AppColors(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceAlt: surfaceAlt,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textInverse: textInverse,
      border: border ?? this.border,
      primary: primary,
      primaryDark: primaryDark ?? this.primaryDark,
      secondary: secondary,
      success: success,
      warning: warning,
      danger: danger,
      tintPrimary: tintPrimary,
      tintSuccess: tintSuccess,
      tintWarning: tintWarning,
      tintDanger: tintDanger,
      tintPrimaryStrong: tintPrimaryStrong,
      muted: muted ?? this.muted,
      onAccent: onAccent,
      action: action ?? this.action,
      onAction: onAction,
      primaryText: primaryText ?? this.primaryText,
      successText: successText ?? this.successText,
      warningText: warningText ?? this.warningText,
      dangerText: dangerText ?? this.dangerText,
    );
  }
}

/// Mode contraste élevé (F60) : textes secondaires, bordures et icônes
/// atténuées nettement plus marqués, pour une lecture plus facile.
AppColors withHighContrast(AppColors base, bool isDark) {
  return isDark
      ? base.copyWith(
          background: const Color(0xFF0B0C10),
          surface: const Color(0xFF15171F),
          textPrimary: const Color(0xFFFFFFFF),
          textSecondary: const Color(0xFFE5E7EB),
          border: const Color(0xFF9CA3AF),
          muted: const Color(0xFFCBD5E1),
          primaryText: const Color(0xFFBFDBFE),
          successText: const Color(0xFFA7F3D0),
          warningText: const Color(0xFFFDE68A),
          dangerText: const Color(0xFFFECACA),
        )
      : base.copyWith(
          background: const Color(0xFFFFFFFF),
          textPrimary: const Color(0xFF000000),
          textSecondary: const Color(0xFF1F2937),
          border: const Color(0xFF6B7280),
          muted: const Color(0xFF374151),
          primaryText: const Color(0xFF1E3A8A),
          successText: const Color(0xFF14532D),
          warningText: const Color(0xFF7C2D12),
          dangerText: const Color(0xFF7F1D1D),
          action: const Color(0xFF1D4ED8),
          primaryDark: const Color(0xFF1D4ED8),
        );
}

const lightColors = AppColors(
  background: Color(0xFFF9FAFB),
  surface: Color(0xFFFFFFFF),
  surfaceAlt: Color(0xFFF3F4F6),
  textPrimary: Color(0xFF111827),
  textSecondary: Color(0xFF6B7280),
  textInverse: Color(0xFFFFFFFF),
  border: Color(0xFFE5E7EB),
  primary: Color(0xFF3B82F6),
  primaryDark: Color(0xFF2563EB),
  secondary: Color(0xFF9266F7),
  success: Color(0xFF10B981),
  warning: Color(0xFFF59E0B),
  danger: Color(0xFFEF4444),
  tintPrimary: Color(0xFFEFF6FF),
  tintSuccess: Color(0xFFF0FDF4),
  tintWarning: Color(0xFFFEF3C7),
  tintDanger: Color(0xFFFEE2E2),
  tintPrimaryStrong: Color(0xFFBFDBFE),
  muted: Color(0xFF7D96B4),
  onAccent: Color(0xFF111827),
  action: Color(0xFF2563EB),
  onAction: Color(0xFFFFFFFF),
  primaryText: Color(0xFF1D4ED8),
  successText: Color(0xFF15803D),
  warningText: Color(0xFFC2410C),
  dangerText: Color(0xFFB91C1C),
);

const darkColors = AppColors(
  background: Color(0xFF15171F),
  surface: Color(0xFF1C1F29),
  surfaceAlt: Color(0xFF262A37),
  textPrimary: Color(0xFFF3F4F6),
  textSecondary: Color(0xFF9CA3AF),
  textInverse: Color(0xFFFFFFFF),
  border: Color(0xFF323647),
  primary: Color(0xFF60A5FA),
  primaryDark: Color(0xFF3B82F6),
  secondary: Color(0xFFA78BFA),
  success: Color(0xFF34D399),
  warning: Color(0xFFFBBF24),
  danger: Color(0xFFF87171),
  tintPrimary: Color(0xFF1E293B),
  tintSuccess: Color(0xFF14291F),
  tintWarning: Color(0xFF2E2410),
  tintDanger: Color(0xFF2C1A1A),
  tintPrimaryStrong: Color(0xFF1E3A5F),
  muted: Color(0xFF5F6B7D),
  onAccent: Color(0xFF15171F),
  action: Color(0xFF60A5FA),
  onAction: Color(0xFF15171F),
  primaryText: Color(0xFF93C5FD),
  successText: Color(0xFF6EE7B7),
  warningText: Color(0xFFFCD34D),
  dangerText: Color(0xFFFCA5A5),
);
