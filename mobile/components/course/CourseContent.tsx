import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import RenderHTML from 'react-native-render-html';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

// Blocs partagés par « Contenu généré » (UploadCourseScreen) et la fiche du
// cours (CourseDetail) : mêmes onglets, même typo, mêmes cartes.

export type CourseTab = 'resume' | 'flashcards' | 'quiz';

export type Flashcard = { question: string; answer: string };
export type QuizQuestion = {
  question: string;
  options: Record<string, string>;
  correct: string;
  explanation?: string;
};

const TAB_LABELS: Record<CourseTab, string> = {
  resume: 'Résumé',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
};

export function CourseTabs({ value, onChange }: { value: CourseTab; onChange: (tab: CourseTab) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {(Object.keys(TAB_LABELS) as CourseTab[]).map((tab) => {
        const active = tab === value;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{TAB_LABELS[tab]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Hiérarchie typo : intertitres 19 px, paragraphes 16 px / 25, 8 px titre→texte, 24 px entre sections. */
export function SummaryCard({ html }: { html: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();

  const heading = { fontSize: 19, lineHeight: 26, fontWeight: '600' as const, color: colors.textPrimary, marginTop: 24, marginBottom: 8 };
  // Le premier intertitre porte déjà 24 px de marge haute : on retire alors le padding haut de la carte.
  const startsWithHeading = /^\s*<h[1-4]/i.test(html || '');

  return (
    <View style={[styles.summaryCard, startsWithHeading && { paddingTop: 0 }]}>
      <RenderHTML
        contentWidth={width - 80}
        source={{ html: html || '' }}
        baseStyle={{ color: colors.textPrimary, fontSize: 16, lineHeight: 25 }}
        tagsStyles={{
          h1: heading,
          h2: heading,
          h3: heading,
          h4: { ...heading, fontSize: 17 },
          p: { marginTop: 0, marginBottom: 0 },
          li: { marginBottom: 4 },
          strong: { fontWeight: '700' },
        }}
      />
    </View>
  );
}

export function FlashcardList({ cards, dueQuestions }: { cards: Flashcard[]; dueQuestions?: Set<string> }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.list}>
      {cards.map((card, i) => (
        <View key={i} style={styles.itemCard}>
          <View style={styles.labelRow}>
            <Text style={[styles.overline, { color: colors.primaryText }]}>QUESTION</Text>
            {dueQuestions?.has(card.question) && (
              <View style={styles.dueBadge}>
                <Text style={styles.dueBadgeText}>À revoir</Text>
              </View>
            )}
          </View>
          <Text style={styles.question}>{card.question}</Text>
          <View style={styles.separator} />
          <Text style={[styles.overline, { color: colors.successText }]}>RÉPONSE</Text>
          <Text style={styles.answer}>{card.answer}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * mode="answer" : quiz à répondre (choix neutres + radio, « Valider mes réponses »).
 * mode="key" : corrigé non interactif (bonne réponse en vert + explication).
 */
export function QuizList({ questions, mode }: { questions: QuizQuestion[]; mode: 'answer' | 'key' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [validated, setValidated] = useState(false);

  const showCorrection = mode === 'key' || validated;
  const answeredCount = Object.keys(answers).length;
  const score = questions.filter((q, i) => answers[i] === q.correct).length;

  return (
    <View style={styles.list}>
      {mode === 'answer' && (
        <View style={styles.quizHeader}>
          <Text style={styles.quizCount}>
            {questions.length} question{questions.length > 1 ? 's' : ''}
          </Text>
          <Text style={styles.quizProgress}>
            {validated
              ? `Score : ${score}/${questions.length}`
              : `${answeredCount}/${questions.length} répondue${answeredCount > 1 ? 's' : ''}`}
          </Text>
        </View>
      )}

      {questions.map((q, i) => (
        <View key={i} style={styles.itemCard}>
          <Text style={[styles.overline, { color: colors.primaryText }]}>
            QUESTION {i + 1}/{questions.length}
          </Text>
          <Text style={styles.question}>{q.question}</Text>

          <View style={styles.options}>
            {Object.entries(q.options || {}).map(([key, value]) => {
              const isCorrect = key === q.correct;
              const isSelected = answers[i] === key;

              if (showCorrection) {
                const isWrongPick = validated && isSelected && !isCorrect;
                return (
                  <View
                    key={key}
                    style={[
                      styles.keyOption,
                      isCorrect && styles.keyOptionCorrect,
                      isWrongPick && styles.keyOptionWrong,
                    ]}
                    accessible
                    accessibilityLabel={`${value}${isCorrect ? ', bonne réponse' : isWrongPick ? ', ta réponse, incorrecte' : ''}`}
                  >
                    <Text
                      style={[
                        styles.keyOptionText,
                        isCorrect && styles.keyOptionTextCorrect,
                        isWrongPick && styles.keyOptionTextWrong,
                      ]}
                    >
                      {String(value)}
                    </Text>
                    {isCorrect && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
                    {isWrongPick && <Ionicons name="close-circle" size={22} color={colors.danger} />}
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.answerOption, isSelected && styles.answerOptionSelected]}
                  onPress={() => setAnswers({ ...answers, [i]: key })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.answerText, isSelected && styles.answerTextSelected]}>{String(value)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {showCorrection && !!q.explanation && <Text style={styles.explanation}>{q.explanation}</Text>}
        </View>
      ))}

      {mode === 'answer' && !validated && (
        <TouchableOpacity
          style={[styles.validateButton, answeredCount === 0 && styles.validateButtonDisabled]}
          onPress={() => setValidated(true)}
          disabled={answeredCount === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: answeredCount === 0 }}
        >
          <Text style={styles.validateText}>Valider mes réponses</Text>
        </TouchableOpacity>
      )}
      {mode === 'answer' && validated && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setAnswers({});
            setValidated(false);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>Recommencer le quiz</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // Onglet actif = pastille blanche + texte primaryText (plus de texte noir sur bleu).
    tabs: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderRadius: 11,
    },
    tabActive: {
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    tabText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    tabTextActive: {
      fontWeight: '600',
      color: colors.primaryText,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 20,
    },
    list: {
      gap: 16,
    },
    itemCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      gap: 10,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    overline: {
      fontSize: 11,
      fontWeight: '700',
    },
    dueBadge: {
      backgroundColor: colors.tintWarning,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    dueBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.warningText,
    },
    question: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
    },
    answer: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    quizHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: -4,
    },
    quizCount: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    quizProgress: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    options: {
      gap: 10,
    },
    // Réponses aérées : padding 14-16, cible tactile ≥ 56 px, même bordure pour tous les états.
    answerOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      padding: 14,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    answerOptionSelected: {
      backgroundColor: colors.tintPrimary,
      borderColor: colors.primaryDark,
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
    answerText: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
    },
    answerTextSelected: {
      fontWeight: '600',
      color: colors.primaryText,
    },
    keyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    keyOptionCorrect: {
      borderWidth: 2,
      borderColor: colors.success,
      backgroundColor: colors.tintSuccess,
    },
    keyOptionWrong: {
      borderWidth: 2,
      borderColor: colors.danger,
      backgroundColor: colors.tintDanger,
    },
    keyOptionText: {
      flex: 1,
      fontSize: 15,
      color: colors.textSecondary,
    },
    keyOptionTextCorrect: {
      fontWeight: '600',
      color: colors.successText,
    },
    keyOptionTextWrong: {
      fontWeight: '600',
      color: colors.dangerText,
    },
    explanation: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    validateButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: colors.action,
    },
    validateButtonDisabled: {
      opacity: 0.5,
    },
    validateText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onAction,
    },
    retryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 15,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.primaryDark,
      backgroundColor: colors.surface,
    },
    retryText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
    },
  });
}
