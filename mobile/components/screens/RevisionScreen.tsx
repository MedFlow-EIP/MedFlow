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

type DueItem = {
  course_id: string;
  course_nom: string;
  item_index: number;
  question: string;
  options: Record<string, string>;
};

type AnswerResult = {
  correct: boolean;
  correct_answer: string;
};

type RevisionRoute = RouteProp<RootStackParamList, 'Revision'>;

export function RevisionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const route = useRoute<RevisionRoute>();
  const courseId = route.params?.courseId;

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'scheduled' | 'practice'>('scheduled');
  const [error, setError] = useState(false);
  const [items, setItems] = useState<DueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const load = useCallback(async (loadMode: 'scheduled' | 'practice' = mode) => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    setMode(loadMode);
    try {
      const headers = await getAuthHeaders(user);
      const endpoint = loadMode === 'practice' ? '/api/revision/practice' : '/api/revision/due';
      const url = courseId
        ? `${API_URL}${endpoint}?course_id=${encodeURIComponent(courseId)}`
        : `${API_URL}${endpoint}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Erreur serveur');
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setCurrentIndex(0);
      setSelectedOption(null);
      setAnswerResult(null);
      setCorrectCount(0);
      setFinished(false);
    } catch (err) {
      console.error('Erreur chargement révision:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [courseId, mode]);

  useFocusEffect(
    useCallback(() => {
      load('scheduled');
    }, [courseId])
  );

  const finishSession = async (finalCorrectCount: number, totalReviewed: number) => {
    const user = auth.currentUser;
    if (!user || totalReviewed === 0) return;
    try {
      const headers = await getAuthHeaders(user);
      const scorePercent = Math.round((finalCorrectCount / totalReviewed) * 100);
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

  const selectOption = async (option: string) => {
    if (selectedOption) return; // déjà répondu, on attend "Continuer"
    const item = items[currentIndex];
    const user = auth.currentUser;
    if (!item || !user) return;

    setSelectedOption(option);

    try {
      const headers = await getAuthHeaders(user);
      const endpoint = mode === 'practice' ? '/api/revision/check' : '/api/revision/answer';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: item.course_id,
          item_index: item.item_index,
          selected_option: option,
        }),
      });
      const data = await res.json();
      setAnswerResult(data);
    } catch (err) {
      console.error('Erreur enregistrement réponse:', err);
      // Repli honnête : on ne sait pas si c'était correct, on ne compte
      // pas la question comme réussie, mais on laisse continuer la session.
      setAnswerResult({ correct: false, correct_answer: '' });
    }
  };

  const goToNext = () => {
    const wasCorrect = answerResult?.correct === true;
    const newCorrectCount = correctCount + (wasCorrect ? 1 : 0);
    setCorrectCount(newCorrectCount);

    if (currentIndex + 1 >= items.length) {
      setFinished(true);
      finishSession(newCorrectCount, items.length);
    } else {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setAnswerResult(null);
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
          <TouchableOpacity style={styles.primaryButton} onPress={() => load()} accessibilityRole="button" accessibilityLabel="Réessayer">
            <Text style={styles.primaryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
          <Text style={styles.emptyTitle} accessibilityRole="header">
            {mode === 'practice' ? "Aucune question dans ce cours" : "Rien à réviser aujourd'hui"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {mode === 'practice'
              ? "Ce cours n'a pas encore de quiz généré."
              : "Le planning te propose ce qui est vraiment utile à revoir maintenant."}
          </Text>
          {mode === 'scheduled' && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => load('practice')}
              accessibilityRole="button"
              accessibilityLabel="Réviser quand même en mode libre"
            >
              <Text style={styles.secondaryButtonText}>Réviser quand même (mode libre)</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (finished) {
    const scorePercent = Math.round((correctCount / items.length) * 100);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="ribbon-outline" size={64} color={colors.warning} />
          <Text style={styles.emptyTitle} accessibilityRole="header">Session terminée !</Text>
          <Text style={styles.emptySubtitle}>
            {correctCount} / {items.length} bonnes réponses ({scorePercent}%)
          </Text>
          {mode === 'practice' && (
            <Text style={styles.practiceHint}>
              Mode libre — ce résultat n'affecte pas ton planning de révision.
            </Text>
          )}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => load('practice')}
            accessibilityRole="button"
            accessibilityLabel="Recommencer"
          >
            <Text style={styles.primaryButtonText}>Recommencer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Terminer"
          >
            <Text style={styles.secondaryButtonText}>Terminer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const item = items[currentIndex];
  const optionEntries = Object.entries(item.options || {});

  const optionStyle = (key: string) => {
    if (!selectedOption) return styles.option;
    if (!answerResult) {
      // Réponse envoyée, en attente de la confirmation serveur — état
      // neutre, surtout ne pas afficher rouge/vert avant de savoir.
      return key === selectedOption ? [styles.option, styles.optionPending] : [styles.option, styles.optionDisabled];
    }
    if (key === answerResult.correct_answer) return [styles.option, styles.optionCorrect];
    if (key === selectedOption) return [styles.option, styles.optionIncorrect];
    return [styles.option, styles.optionDisabled];
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Révision</Text>
        <Text style={styles.headerCount}>{currentIndex + 1} / {items.length}</Text>
      </View>

      <ProgressBar progress={(currentIndex / items.length) * 100} height={6} />

      <View style={styles.cardArea}>
        <Text style={styles.courseLabel}>{item.course_nom}</Text>
        <Text style={styles.questionText}>{item.question}</Text>

        <View style={styles.optionsList}>
          {optionEntries.map(([key, text]) => (
            <TouchableOpacity
              key={key}
              style={optionStyle(key) as any}
              onPress={() => selectOption(key)}
              disabled={!!selectedOption}
              accessibilityRole="button"
              accessibilityLabel={`${key} : ${text}`}
              accessibilityState={{ disabled: !!selectedOption, selected: key === selectedOption }}
            >
              <Text style={styles.optionLetter}>{key}</Text>
              <Text style={styles.optionText}>{text}</Text>
              {selectedOption && key === selectedOption && !answerResult && (
                <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Vérification en cours" />
              )}
              {answerResult && key === answerResult.correct_answer && (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              )}
              {answerResult && key === selectedOption && !answerResult.correct && (
                <Ionicons name="close-circle" size={20} color={colors.danger} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {selectedOption && (
          <TouchableOpacity
            style={styles.continueButton}
            onPress={goToNext}
            accessibilityRole="button"
            accessibilityLabel="Continuer"
          >
            <Text style={styles.continueButtonText}>Continuer</Text>
          </TouchableOpacity>
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
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 8,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 15,
    },
    practiceHint: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
      marginTop: 4,
    },
    cardArea: {
      flex: 1,
      padding: 20,
    },
    courseLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    questionText: {
      fontSize: 19,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 26,
      textAlign: 'center',
      marginBottom: 28,
    },
    optionsList: {
      gap: 10,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.border,
    },
    optionCorrect: {
      borderColor: colors.success,
      backgroundColor: colors.tintSuccess,
    },
    optionIncorrect: {
      borderColor: colors.danger,
      backgroundColor: colors.tintDanger,
    },
    optionPending: {
      borderColor: colors.primary,
    },
    optionDisabled: {
      opacity: 0.5,
    },
    optionLetter: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
      textAlign: 'center',
      textAlignVertical: 'center',
      lineHeight: 28,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    optionText: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
    },
    continueButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    continueButtonText: {
      color: colors.onAccent,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}