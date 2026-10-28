import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../../utils/network';
import { useScreenInsets } from '../navigation/constants';
import { ProgressBar } from '../ui/progress';
import { StateView } from '../ui/StateView';
import { ReportErrorSheet, type ReportTarget } from '../ReportErrorSheet';

type DueCard = {
  course_id: string;
  course_nom: string;
  card_key: string;
  question: string;
  answer: string;
  exam?: { title: string; days_left: number };
};

type Grade = 'again' | 'hard' | 'good' | 'easy';

/** Les 4 notes, de « je ne savais pas » à « évident ». */
export const GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: 'again', label: 'À revoir', hint: 'demain' },
  { grade: 'hard', label: 'Difficile', hint: 'bientôt' },
  { grade: 'good', label: 'Bien', hint: 'plus tard' },
  { grade: 'easy', label: 'Facile', hint: 'beaucoup plus tard' },
];

/**
 * Révision des flashcards en répétition espacée : la question, puis la
 * réponse, puis l'utilisateur se note ; la note fixe la prochaine révision.
 */
export function FlashcardReviewScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const courseId: string | undefined = route.params?.courseId;

  const [cards, setCards] = useState<DueCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(0);

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setError(null);
    try {
      const query = courseId ? `?course_id=${encodeURIComponent(courseId)}` : '';
      const res = await fetchWithTimeout(`${API_URL}/api/flashcards/due${query}`, { headers: await getAuthHeaders(user) });
      const data = await readJsonOrThrow<{ items: DueCard[] }>(res, 'Impossible de charger tes flashcards.');
      setCards(data.items);
      setIndex(0);
      setRevealed(false);
      setReviewed(0);
    } catch (err) {
      setError(errorMessage(err, 'Impossible de charger tes flashcards.'));
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [courseId])
  );

  const grade = async (value: Grade) => {
    const user = auth.currentUser;
    const card = cards?.[index];
    if (!user || !card || sending) return;
    setSending(true);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/flashcards/review`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: card.course_id, card_key: card.card_key, grade: value }),
      });
      await readJsonOrThrow(res, 'Note non enregistrée.');
      setReviewed((n) => n + 1);
      setIndex((i) => i + 1);
      setRevealed(false);
    } catch (err) {
      setError(errorMessage(err, 'Note non enregistrée. Réessaie.'));
    } finally {
      setSending(false);
    }
  };

  if (cards === null) {
    return error ? (
      <StateView
        icon="cloud-offline-outline"
        tone="neutral"
        title="Impossible de charger tes flashcards"
        subtitle={error}
        primary={{ label: 'Réessayer', onPress: load }}
        onClose={() => navigation.goBack()}
      />
    ) : (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primaryDark} accessibilityLabel="Chargement des flashcards" />
      </View>
    );
  }

  if (index >= cards.length) {
    return (
      <StateView
        icon="checkmark-done-outline"
        tone="success"
        title={reviewed > 0 ? 'Session terminée' : 'Aucune flashcard à revoir'}
        subtitle={
          reviewed > 0
            ? `${reviewed} carte${reviewed > 1 ? 's' : ''} revue${reviewed > 1 ? 's' : ''}. Elles reviendront au bon moment.`
            : 'Tout est à jour. Reviens demain ou importe un nouveau cours.'
        }
        primary={{ label: 'Terminer', onPress: () => navigation.goBack() }}
        secondary={reviewed > 0 ? { label: 'Continuer s’il en reste', onPress: load } : undefined}
        onClose={() => navigation.goBack()}
        closeIcon="close"
      />
    );
  }

  const card = cards[index];

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quitter la révision"
        >
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progress}>
          <ProgressBar progress={(index / cards.length) * 100} height={8} color={colors.primaryDark} />
        </View>
        <Text style={styles.count}>{index + 1}/{cards.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.course}>{card.course_nom}</Text>
        {!!card.exam && (
          <View style={styles.examChip}>
            <Ionicons name="calendar-outline" size={13} color={colors.warningText} />
            <Text style={styles.examText}>{card.exam.title} · J-{card.exam.days_left}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.overline}>QUESTION</Text>
          <Text style={styles.question} accessibilityRole="header">{card.question}</Text>
          {revealed && (
            <>
              <View style={styles.separator} />
              <Text style={[styles.overline, { color: colors.successText }]}>RÉPONSE</Text>
              <Text style={styles.answer} accessibilityLiveRegion="polite">{card.answer}</Text>
            </>
          )}
        </View>

        {revealed && (
          <TouchableOpacity
            style={styles.reportLink}
            onPress={() =>
              setReportTarget({
                kind: 'flashcard',
                courseId: card.course_id,
                excerpt: `${card.question}\nRéponse : ${card.answer}`,
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Signaler une erreur dans cette carte"
          >
            <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.reportLinkText}>Signaler une erreur</Text>
          </TouchableOpacity>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <ReportErrorSheet target={reportTarget} onClose={() => setReportTarget(null)} />

      <View style={[styles.footer, { paddingBottom: bottom + 12 }]}>
        {!revealed ? (
          <TouchableOpacity style={styles.reveal} onPress={() => setRevealed(true)} accessibilityRole="button">
            <Text style={styles.revealText}>Voir la réponse</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.prompt}>Tu la connaissais ?</Text>
            <View style={styles.grades}>
              {GRADES.map((g) => (
                <TouchableOpacity
                  key={g.grade}
                  style={[styles.grade, g.grade === 'again' && styles.gradeAgain, g.grade === 'easy' && styles.gradeEasy]}
                  onPress={() => grade(g.grade)}
                  disabled={sending}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.label}, à revoir ${g.hint}`}
                >
                  <Text style={styles.gradeLabel}>{g.label}</Text>
                  <Text style={styles.gradeHint}>{g.hint}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    progress: {
      flex: 1,
    },
    count: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    body: {
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    course: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    examChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.tintWarning,
    },
    examText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.warningText,
    },
    card: {
      gap: 10,
      minHeight: 220,
      padding: 20,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    overline: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
    },
    question: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    separator: {
      height: 1,
      marginVertical: 6,
      backgroundColor: colors.border,
    },
    answer: {
      fontSize: 17,
      lineHeight: 25,
      color: colors.textPrimary,
    },
    error: {
      fontSize: 14,
      color: colors.dangerText,
    },
    reportLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 44,
    },
    reportLinkText: {
      fontSize: 14,
      color: colors.textSecondary,
      textDecorationLine: 'underline',
    },
    footer: {
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    reveal: {
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    revealText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.onAction,
    },
    prompt: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.textSecondary,
    },
    grades: {
      flexDirection: 'row',
      gap: 8,
    },
    grade: {
      flex: 1,
      minHeight: 60,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: 4,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    gradeAgain: {
      borderColor: colors.danger,
      backgroundColor: colors.tintDanger,
    },
    gradeEasy: {
      borderColor: colors.success,
      backgroundColor: colors.tintSuccess,
    },
    gradeLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    gradeHint: {
      fontSize: 11,
      color: colors.textSecondary,
    },
  });
}
