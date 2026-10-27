import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useScreenInsets } from '../navigation/constants';

// Éléments communs aux étapes de leçon : même charte que la Révision
// (options à bordure 2 px + indicateur rond à droite, encadré de correction,
// bouton principal fixé en bas au-dessus de la zone système).

export type OptionState = 'idle' | 'correct' | 'incorrect' | 'dimmed';

export function StepOption({
  text,
  state,
  onPress,
  disabled,
}: {
  text: string;
  state: OptionState;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[
        styles.option,
        state === 'correct' && styles.optionCorrect,
        state === 'incorrect' && styles.optionIncorrect,
        state === 'dimmed' && styles.optionDimmed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${text}${state === 'correct' ? ', bonne réponse' : state === 'incorrect' ? ', mauvaise réponse' : ''}`}
      accessibilityState={{ disabled }}
    >
      <Text
        style={[
          styles.optionText,
          state === 'correct' && { color: colors.successText, fontWeight: '600' },
          state === 'incorrect' && { color: colors.dangerText, fontWeight: '600' },
        ]}
      >
        {text}
      </Text>
      {state === 'correct' ? (
        <Ionicons name="checkmark-circle" size={26} color={colors.success} />
      ) : state === 'incorrect' ? (
        <Ionicons name="close-circle" size={26} color={colors.danger} />
      ) : (
        <View style={styles.indicator} />
      )}
    </TouchableOpacity>
  );
}

export function StepFeedback({
  correct,
  title,
  explanation,
}: {
  correct: boolean;
  title: string;
  explanation?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const color = correct ? colors.successText : colors.dangerText;

  return (
    <Animated.View
      entering={FadeIn}
      style={[styles.feedback, { backgroundColor: correct ? colors.tintSuccess : colors.tintDanger }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.feedbackTitle, { color }]}>{title}</Text>
      {!!explanation && <Text style={[styles.feedbackText, { color }]}>{explanation}</Text>}
    </Animated.View>
  );
}

export function StepPrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useScreenInsets();

  return (
    <View style={[styles.footer, { paddingBottom: bottom + 12 }]}>
      <TouchableOpacity style={styles.primary} onPress={onPress} accessibilityRole="button">
        <Text style={styles.primaryText}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function StepOverline({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.overlineRow}>
      <Ionicons name={icon} size={14} color={colors.primaryText} />
      <Text style={styles.overline}>{label}</Text>
    </View>
  );
}

export function makeStepStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 120,
      gap: 20,
    },
    question: {
      fontSize: 21,
      lineHeight: 29,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    options: {
      gap: 12,
    },
  });
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      padding: 16,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionCorrect: {
      borderColor: colors.success,
      backgroundColor: colors.tintSuccess,
    },
    optionIncorrect: {
      borderColor: colors.danger,
      backgroundColor: colors.tintDanger,
    },
    optionDimmed: {
      opacity: 0.6,
    },
    optionText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    indicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.muted,
    },
    feedback: {
      gap: 4,
      padding: 16,
      borderRadius: 14,
    },
    feedbackTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    feedbackText: {
      fontSize: 14,
      lineHeight: 20,
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 20,
      paddingTop: 12,
      backgroundColor: colors.background,
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
    overlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    overline: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.4,
    },
  });
}
