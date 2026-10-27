import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

export type RunnerQuestion = {
  course_id: string;
  course_nom?: string;
  item_index: number;
  question: string;
  options: Record<string, string>;
};

export const questionKey = (q: { course_id: string; item_index: number }) => `${q.course_id}:${q.item_index}`;

/**
 * Déroulé d'un quiz sans correction immédiate (examen blanc, défi) : une
 * question à la fois, réponse modifiable, navigation libre entre questions.
 * La correction arrive à la remise (``onFinish``).
 */
export function QuizRunner({
  questions,
  answers,
  onAnswer,
  onFinish,
  finishLabel = 'Rendre la copie',
}: {
  questions: RunnerQuestion[];
  answers: Record<string, string>;
  onAnswer: (key: string, option: string) => void;
  onFinish: () => void;
  finishLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [index, setIndex] = useState(0);

  const q = questions[index];
  const key = questionKey(q);
  const isLast = index === questions.length - 1;

  return (
    <View style={styles.container}>
      {/* Accès direct à chaque question : remplie = répondue. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {questions.map((item, i) => {
          const answered = !!answers[questionKey(item)];
          const active = i === index;
          return (
            <TouchableOpacity
              key={questionKey(item)}
              style={[styles.cell, answered && styles.cellAnswered, active && styles.cellActive]}
              onPress={() => setIndex(i)}
              accessibilityRole="button"
              accessibilityLabel={`Question ${i + 1}${answered ? ', répondue' : ''}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.cellText, answered && styles.cellTextAnswered]} maxFontSizeMultiplier={1.3}>{i + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
        <Text style={styles.overline}>
          QUESTION {index + 1}/{questions.length}
          {q.course_nom ? ` · ${q.course_nom}` : ''}
        </Text>
        <Text style={styles.question} accessibilityRole="header">{q.question}</Text>
        {Object.entries(q.options).map(([option, text]) => {
          const selected = answers[key] === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => onAnswer(key, option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{text}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.nav}>
        <TouchableOpacity
          style={[styles.navButton, index === 0 && styles.disabled]}
          onPress={() => setIndex(index - 1)}
          disabled={index === 0}
          accessibilityRole="button"
          accessibilityLabel="Question précédente"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        {isLast ? (
          <TouchableOpacity style={[styles.primary, styles.flex]} onPress={onFinish} accessibilityRole="button">
            <Text style={styles.primaryText}>{finishLabel}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.primary, styles.flex]} onPress={() => setIndex(index + 1)} accessibilityRole="button">
            <Text style={styles.primaryText}>Question suivante</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.onAction} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: 12,
    },
    flex: {
      flex: 1,
    },
    grid: {
      gap: 6,
      paddingHorizontal: 20,
    },
    cell: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellAnswered: {
      backgroundColor: colors.tintPrimary,
      borderColor: colors.tintPrimary,
    },
    cellActive: {
      borderColor: colors.primaryDark,
    },
    cellText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    cellTextAnswered: {
      color: colors.primaryText,
    },
    body: {
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    overline: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryText,
    },
    question: {
      fontSize: 19,
      lineHeight: 27,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      padding: 14,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionSelected: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.tintPrimary,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: colors.primaryDark,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primaryDark,
    },
    optionText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 21,
      color: colors.textPrimary,
    },
    optionTextSelected: {
      fontWeight: '600',
      color: colors.primaryText,
    },
    nav: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
    },
    navButton: {
      width: 56,
      height: 56,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.action,
    },
    primaryText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onAction,
    },
    disabled: {
      opacity: 0.4,
    },
  });
}
