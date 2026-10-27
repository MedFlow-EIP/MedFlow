import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useScreenInsets } from '../navigation/constants';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

type Action = { label: string; onPress: () => void };

/**
 * État plein écran (vide, erreur, fin de session) : icône dans une pastille
 * teintée, titre, texte, puis actions fixées en bas au-dessus de la zone système.
 */
export function StateView({
  icon,
  tone = 'primary',
  title,
  subtitle,
  hint,
  primary,
  secondary,
  onClose,
  closeIcon = 'arrow-back',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  title: string;
  subtitle?: string;
  hint?: string;
  primary?: Action;
  secondary?: Action;
  onClose?: () => void;
  closeIcon?: 'arrow-back' | 'close';
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();

  const toneColors: Record<Tone, { bg: string; fg: string }> = {
    primary: { bg: colors.tintPrimary, fg: colors.primaryDark },
    success: { bg: colors.tintSuccess, fg: colors.success },
    warning: { bg: colors.tintWarning, fg: colors.warning },
    danger: { bg: colors.tintDanger, fg: colors.danger },
    neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary },
  };
  const t = toneColors[tone];

  return (
    <View style={[styles.container, { paddingTop: top, paddingBottom: bottom + 12 }]}>
      {onClose ? (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeIcon === 'close' ? 'Fermer' : 'Retour'}
          >
            <Ionicons name={closeIcon} size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={[styles.iconCircle, { backgroundColor: t.bg }]}>
          <Ionicons name={icon} size={48} color={t.fg} />
        </View>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {!!hint && <Text style={styles.hint}>{hint}</Text>}
      </View>

      {(primary || secondary) && (
        <View style={styles.actions}>
          {primary && (
            <TouchableOpacity style={styles.primary} onPress={primary.onPress} accessibilityRole="button">
              <Text style={styles.primaryText}>{primary.label}</Text>
            </TouchableOpacity>
          )}
          {secondary && (
            <TouchableOpacity style={styles.secondary} onPress={secondary.onPress} accessibilityRole="button">
              <Text style={styles.secondaryText}>{secondary.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20,
    },
    header: {
      flexDirection: 'row',
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 12,
    },
    iconCircle: {
      width: 104,
      height: 104,
      borderRadius: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    hint: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
      marginTop: 4,
    },
    actions: {
      gap: 10,
    },
    primary: {
      height: 56,
      borderRadius: 14,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onAction,
    },
    secondary: {
      height: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.primaryDark,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
    },
  });
}
