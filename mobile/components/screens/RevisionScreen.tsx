import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { ProgressBar } from '../ui/progress';
import type { RootStackParamList } from '../navigation/AppNavigator';

type DueCard = {
  course_id: string;
  course_nom: string;
  card_index: number;
  question: string;
  answer: string;
  overdue_days?: number;
};

type RevisionRoute = RouteProp<RootStackParamList, 'Revision'>;

export function RevisionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const route = useRoute<RevisionRoute>();
  const courseId = route.params?.courseId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cards, setCards] = useState<DueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [goodAnswers, setGoodAnswers] = useState(0);
  const [finished, setFinished] = useState(false);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const headers = await getAuthHeaders(user);
      const url = courseId
        ? `${API_URL}/api/revision/due?course_id=${encodeURIComponent(courseId)}`
        : `${API_URL}/api/revision/due`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Erreur serveur');
      const data = await res.json();
      setCards(Array.isArray(data.cards) ? data.cards : []);
      setCurrentIndex(0);
      setRevealed(false);
      setGoodAnswers(0);
      setFinished(false);
    } catch (err) {
      console.error('Erreur chargement révision:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const finishSession = async (finalGoodAnswers: number, totalReviewed: number) => {
    const user = auth.currentUser;
    if (!user || totalReviewed === 0) return;
    try {
      const headers = await getAuthHeaders(user);
      const scorePercent = Math.round((finalGoodAnswers / totalReviewed) * 100);
      await fetch(`${API_URL}/api/session-done`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: courseId ? 'course' : 'all',
          course_id: courseId,
          session_type: 'revision',
          score: scorePercent,
          total_questions: totalReviewed,
        }),
      });
    } catch (err) {
      console.error('Erreur fin de session:', err);
    }
  };

  const answerCard = async (quality: number) => {
    const card = cards[currentIndex];
    const user = auth.currentUser;
    if (!card || !user) return;

    const isGood = quality >= 4;
    const newGoodAnswers = goodAnswers + (isGood ? 1 : 0);

    try {
      const headers = await getAuthHeaders(user);
      await fetch(`${API_URL}/api/revision/answer`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: card.course_id,
          card_index: card.card_index,
          quality,
        }),
      });
    } catch (err) {
      console.error('Erreur enregistrement réponse:', err);
    }

    setGoodAnswers(newGoodAnswers);

    if (currentIndex + 1 >= cards.length) {
      setFinished(true);
      finishSession(newGoodAnswers, cards.length);
    } else {
      setCurrentIndex(currentIndex + 1);
      setRevealed(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Chargement de la révision" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Impossible de charger la révision</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={load} accessibilityRole="button" accessibilityLabel="Réessayer">
            <Text style={styles.primaryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (cards.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
          <Text style={styles.emptyTitle} accessibilityRole="header">Rien à réviser aujourd'hui</Text>
          <Text style={styles.emptySubtitle}>
            Reviens plus tard — les cartes réapparaîtront selon leur planning de révision.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (finished) {
    const scorePercent = Math.round((goodAnswers / cards.length) * 100);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="ribbon-outline" size={64} color={colors.warning} />
          <Text style={styles.emptyTitle} accessibilityRole="header">Session terminée !</Text>
          <Text style={styles.emptySubtitle}>
            {goodAnswers} / {cards.length} cartes bien sues ({scorePercent}%)
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Terminer"
          >
            <Text style={styles.primaryButtonText}>Terminer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const card = cards[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Révision</Text>
        <Text style={styles.headerCount}>{currentIndex + 1} / {cards.length}</Text>
      </View>

      <ProgressBar progress={((currentIndex) / cards.length) * 100} height={6} />

      <View style={styles.cardArea}>
        <Text style={styles.courseLabel}>{card.course_nom}</Text>
        <View style={styles.card}>
          <Text style={styles.questionLabel}>Question</Text>
          <Text style={styles.questionText}>{card.question}</Text>

          {revealed && (
            <>
              <View style={styles.divider} />
              <Text style={styles.answerLabel}>Réponse</Text>
              <Text style={styles.answerText}>{card.answer}</Text>
            </>
          )}
        </View>

        {!revealed ? (
          <TouchableOpacity
            style={styles.revealButton}
            onPress={() => setRevealed(true)}
            accessibilityRole="button"
            accessibilityLabel="Voir la réponse"
          >
            <Text style={styles.revealButtonText}>Voir la réponse</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.qualityRow}>
            <TouchableOpacity
              style={[styles.qualityButton, { backgroundColor: colors.danger }]}
              onPress={() => answerCard(1)}
              accessibilityRole="button"
              accessibilityLabel="Encore — je ne savais pas"
            >
              <Text style={styles.qualityButtonText}>Encore</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.qualityButton, { backgroundColor: colors.warning }]}
              onPress={() => answerCard(3)}
              accessibilityRole="button"
              accessibilityLabel="Difficile — j'ai eu du mal"
            >
              <Text style={styles.qualityButtonText}>Difficile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.qualityButton, { backgroundColor: colors.primary }]}
              onPress={() => answerCard(4)}
              accessibilityRole="button"
              accessibilityLabel="Bien — j'ai su avec un effort"
            >
              <Text style={styles.qualityButtonText}>Bien</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.qualityButton, { backgroundColor: colors.success }]}
              onPress={() => answerCard(5)}
              accessibilityRole="button"
              accessibilityLabel="Facile — je savais immédiatement"
            >
              <Text style={styles.qualityButtonText}>Facile</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerCount: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 8,
    },
    primaryButtonText: {
      color: colors.onAccent,
      fontWeight: '600',
      fontSize: 15,
    },
    cardArea: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
    },
    courseLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      minHeight: 220,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    questionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    questionText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 26,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    answerLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.success,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    answerText: {
      fontSize: 16,
      color: colors.textPrimary,
      lineHeight: 24,
    },
    revealButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    revealButtonText: {
      color: colors.onAccent,
      fontSize: 16,
      fontWeight: '600',
    },
    qualityRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 24,
    },
    qualityButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    qualityButtonText: {
      color: colors.onAccent,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}