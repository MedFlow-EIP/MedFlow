import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

export type CorrectionItem = {
  course_id: string;
  course_nom?: string;
  item_index: number;
  question: string;
  options: Record<string, string>;
  selected: string | null;
  correct_answer: string;
  explanation?: string | null;
  is_correct: boolean;
};

/** Corrigé détaillé après un examen blanc ou un défi. */
export function QuizCorrection({ items }: { items: CorrectionItem[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.list}>
      {items.map((item, i) => {
        const chosen = item.selected ? item.options?.[item.selected] : null;
        return (
          <View key={`${item.course_id}:${item.item_index}`} style={styles.card}>
            <View style={styles.header}>
              <Ionicons
                name={item.is_correct ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={item.is_correct ? colors.success : colors.danger}
              />
              <Text style={styles.overline}>
                QUESTION {i + 1}
                {item.course_nom ? ` · ${item.course_nom}` : ''}
              </Text>
            </View>
            <Text style={styles.question}>{item.question}</Text>
            {!item.is_correct && (
              <Text style={styles.wrong}>{chosen ? `Ta réponse : ${chosen}` : 'Sans réponse'}</Text>
            )}
            <Text style={styles.right}>Bonne réponse : {item.options?.[item.correct_answer]}</Text>
            {!!item.explanation && <Text style={styles.explanation}>{item.explanation}</Text>}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      gap: 12,
    },
    card: {
      gap: 8,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    overline: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    question: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    wrong: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.dangerText,
    },
    right: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.successText,
    },
    explanation: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
  });
}
