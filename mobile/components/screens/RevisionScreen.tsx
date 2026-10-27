import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { scheduleRevisionReminder } from '../../utils/revisionNotifications';
import { ProgressBar } from '../ui/progress';
import { shuffle } from '../../utils/shuffle';
import { StateView } from '../ui/StateView';
import { logEvent } from '../../utils/analytics';
import { useScreenInsets } from '../navigation/constants';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { errorMessage, fetchWithTimeout, readJsonOrThrow, UserFacingError } from '../../utils/network';
import {
  flushRevisionQueue,
  gradeOffline,
  queueAnswer,
  queueSessionDone,
  readOfflineItems,
  saveDueItems,
} from '../../utils/offlineRevision';
import { OfflineBanner } from '../course/OfflineBanner';
import { explainPrompt } from '../../utils/explainPrompt';

type DueItem = {
  course_id: string;
  course_nom: string;
  item_index: number;
  question: string;
  options: Record<string, string>;
  lapses?: number;
  /** Examen proche lié à ce cours : la carte passe en priorité. */
  exam?: { title: string; days_left: number };
  /** Ordre d'affichage des réponses, tiré au chargement de la session. */
  optionOrder?: string[];
};

type AnswerResult = {
  correct: boolean;
  correct_answer: string;
  explanation?: string | null;
  is_leech?: boolean;
};

type RevisionRoute = RouteProp<RootStackParamList, 'Revision'>;

export function RevisionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RevisionRoute>();
  const courseId = route.params?.courseId;

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'scheduled' | 'practice' | 'leeches'>('scheduled');
  const [error, setError] = useState(false);
  const [items, setItems] = useState<DueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  // Pas de réseau : cartes de la copie locale, réponses corrigées sur le
  // téléphone puis envoyées au serveur au retour de la connexion.
  const [offlineMode, setOfflineMode] = useState(false);
  const activeItemKeyRef = useRef<string | null>(null);

  const resetSession = (list: DueItem[]) => {
    // Questions et réponses mélangées à chaque session, sinon on apprend
    // l'ordre (ou la position de la bonne réponse) plutôt que le contenu.
    // Les clés (A/B/C/D) restent celles du serveur pour /api/revision/answer.
    setItems(shuffle(list).map((it) => ({ ...it, optionOrder: shuffle(Object.keys(it.options || {})) })));
    if (list.length > 0) logEvent('revision_started');
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswerResult(null);
    setAnswerError(null);
    setCorrectCount(0);
    setFinished(false);
  };

  const load = useCallback(async (loadMode: 'scheduled' | 'practice' | 'leeches' = mode) => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    setMode(loadMode);
    setOfflineMode(false);
    try {
      // Réponses données hors ligne lors d'une session précédente : envoyées
      // d'abord, pour que la liste des cartes dues en tienne compte.
      await flushRevisionQueue(user);
      const headers = await getAuthHeaders(user);
      const endpoint =
        loadMode === 'practice' ? '/api/revision/practice' :
        loadMode === 'leeches' ? '/api/revision/leeches' :
        '/api/revision/due';
      const url = courseId
        ? `${API_URL}${endpoint}?course_id=${encodeURIComponent(courseId)}`
        : `${API_URL}${endpoint}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Erreur serveur');
      const data = await res.json();
      const fetchedItems: DueItem[] = Array.isArray(data.items) ? data.items : [];
      resetSession(fetchedItems);
      if (loadMode === 'scheduled') saveDueItems(user.uid, courseId, fetchedItems);

      // Remet à jour le rappel de notification avec le vrai nombre de
      // cartes dues — uniquement en mode programmé, tous cours confondus
      // (une session ciblée sur un seul cours ne représente pas le total).
      if (loadMode === 'scheduled' && !courseId) {
        scheduleRevisionReminder(fetchedItems.length).catch(() => {});
      }
    } catch (err) {
      console.error('Erreur chargement révision:', err);
      // Hors ligne : dernière liste de cartes dues connue (ou le cours gardé).
      const offlineItems = loadMode === 'leeches' ? [] : await readOfflineItems(user.uid, courseId);
      if (offlineItems.length > 0) {
        resetSession(offlineItems);
        setOfflineMode(true);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [courseId, mode]);

  useFocusEffect(
    useCallback(() => {
      load(route.params?.startMode ?? 'scheduled');
    }, [courseId])
  );

  const finishSession = async (finalCorrectCount: number, totalReviewed: number) => {
    const user = auth.currentUser;
    if (!user || totalReviewed === 0) return;
    const body = {
      mode: courseId ? 'course' : 'all',
      course_id: courseId,
      session_type: 'revision',
      score: Math.round((finalCorrectCount / totalReviewed) * 100),
      total_questions: totalReviewed,
    };
    if (offlineMode) {
      // Compte pour la série dès le retour du réseau.
      queueSessionDone(user.uid, body);
      return;
    }
    try {
      const headers = await getAuthHeaders(user);
      await fetch(`${API_URL}/api/session-done`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error('Erreur fin de session:', err);
      queueSessionDone(user.uid, body);
    }
  };

  const selectOption = async (option: string) => {
    if (selectedOption) return; // déjà répondu, on attend "Continuer"
    const item = items[currentIndex];
    const user = auth.currentUser;
    if (!item || !user) return;

    // Identifie précisément CETTE question — si la réponse serveur arrive
    // après qu'on a déjà avancé (cas normalement impossible depuis le fix
    // sur le bouton "Continuer", mais gardé en filet de sécurité), on
    // l'ignore plutôt que de l'appliquer à la mauvaise question affichée.
    const requestKey = `${item.course_id}:${item.item_index}`;
    activeItemKeyRef.current = requestKey;

    setSelectedOption(option);
    setAnswerError(null);

    // Correction avec la copie locale du cours ; la réponse part plus tard.
    const answerOffline = async (): Promise<boolean> => {
      const result = await gradeOffline(user.uid, item.course_id, item.item_index, option);
      if (activeItemKeyRef.current !== requestKey) return true;
      if (!result) return false;
      // Le mode libre ne touche pas au planning : rien à envoyer.
      if (mode !== 'practice') {
        await queueAnswer(user.uid, { course_id: item.course_id, item_index: item.item_index, selected_option: option });
      }
      setAnswerResult(result);
      return true;
    };

    if (offlineMode) {
      if (!(await answerOffline())) {
        setSelectedOption(null);
        setAnswerError('Ce cours n’est pas enregistré sur ton téléphone. Ouvre-le une fois avec du réseau.');
      }
      return;
    }

    try {
      const headers = await getAuthHeaders(user);
      const endpoint = mode === 'practice' ? '/api/revision/check' : '/api/revision/answer';
      const res = await fetchWithTimeout(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: item.course_id,
          item_index: item.item_index,
          selected_option: option,
        }),
      });
      const data = await readJsonOrThrow<AnswerResult>(res, 'Réponse non enregistrée.');
      if (activeItemKeyRef.current !== requestKey) return; // question déjà quittée
      setAnswerResult(data);
    } catch (err) {
      console.error('Erreur enregistrement réponse:', err);
      if (activeItemKeyRef.current !== requestKey) return;
      // Réseau coupé en pleine session : on continue hors ligne si possible.
      const networkLost = err instanceof UserFacingError && err.status === undefined;
      if (networkLost && (await answerOffline())) {
        setOfflineMode(true);
        return;
      }
      // Sinon on libère la question pour que l'utilisateur réponde à nouveau,
      // au lieu de la compter fausse.
      setSelectedOption(null);
      setAnswerError(errorMessage(err, 'Réponse non enregistrée. Réessaie.'));
    }
  };

  const goToNext = () => {
    const wasCorrect = answerResult?.correct === true;
    const newCorrectCount = correctCount + (wasCorrect ? 1 : 0);
    setCorrectCount(newCorrectCount);

    if (currentIndex + 1 >= items.length) {
      setFinished(true);
      logEvent('revision_finished', mode);
      finishSession(newCorrectCount, items.length);
    } else {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setAnswerResult(null);
      setAnswerError(null);
    }
  };

  const explain = () => {
    const current = items[currentIndex];
    if (!current || !answerResult) return;
    // L'onglet IA Chat (et non une copie du chat par-dessus) : la barre
    // d'onglets reste visible et il n'y a jamais deux chats ouverts à la fois.
    navigation.navigate('MainTabs', {
      screen: 'AIChat',
      params: {
        prompt: explainPrompt({
          question: current.question,
          correctAnswer: (current.options || {})[answerResult.correct_answer],
          chosenAnswer: selectedOption ? (current.options || {})[selectedOption] : undefined,
          courseName: current.course_nom,
        }),
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Chargement de la révision" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <StateView
        icon="cloud-offline-outline"
        tone="neutral"
        title="Impossible de charger la révision"
        subtitle="Vérifie ta connexion puis réessaie."
        primary={{ label: 'Réessayer', onPress: () => load() }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  if (items.length === 0) {
    return (
      <StateView
        icon={mode === 'leeches' ? 'shield-checkmark-outline' : 'checkmark-done-outline'}
        tone="success"
        title={
          mode === 'practice'
            ? "Aucune question dans ce cours"
            : mode === 'leeches'
            ? "Aucune carte difficile en ce moment"
            : "Rien à réviser aujourd'hui"
        }
        subtitle={
          mode === 'practice'
            ? "Ce cours n'a pas encore de quiz généré."
            : mode === 'leeches'
            ? "Bien joué, aucune carte n'a été ratée plusieurs fois d'affilée récemment."
            : "Le planning te propose ce qui est vraiment utile à revoir maintenant."
        }
        primary={
          mode === 'scheduled'
            ? { label: 'Réviser quand même (mode libre)', onPress: () => load('practice') }
            : undefined
        }
        onClose={() => navigation.goBack()}
      />
    );
  }

  if (finished) {
    const scorePercent = Math.round((correctCount / items.length) * 100);
    return (
      <StateView
        icon="ribbon-outline"
        tone="warning"
        title="Session terminée !"
        subtitle={`${correctCount} / ${items.length} bonnes réponses (${scorePercent}%)`}
        hint={mode === 'practice' ? "Mode libre : ce résultat n'affecte pas ton planning de révision." : undefined}
        primary={{ label: 'Terminer', onPress: () => navigation.goBack() }}
        secondary={{ label: 'Recommencer', onPress: () => load(mode) }}
      />
    );
  }

  const item = items[currentIndex];
  const optionEntries = (item.optionOrder ?? Object.keys(item.options || {})).map(
    (key) => [key, item.options[key]] as const
  );
  const correctText = answerResult ? (item.options || {})[answerResult.correct_answer] : undefined;

  // Même bordure 2 px et même indicateur rond aligné à droite pour tous les états.
  const optionState = (key: string): 'idle' | 'pending' | 'correct' | 'incorrect' | 'dimmed' => {
    if (!selectedOption) return 'idle';
    if (!answerResult) return key === selectedOption ? 'pending' : 'dimmed';
    if (key === answerResult.correct_answer) return 'correct';
    if (key === selectedOption) return 'incorrect';
    return 'idle';
  };

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
        <View style={styles.progressWrap}>
          <ProgressBar progress={(currentIndex / items.length) * 100} height={8} color={colors.primaryDark} />
        </View>
        <Text style={styles.headerCount}>{currentIndex + 1}/{items.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.cardArea} showsVerticalScrollIndicator={false}>
        {offlineMode && (
          <OfflineBanner message="Hors ligne : tes réponses seront envoyées au retour du réseau." />
        )}
        <View style={styles.questionBlock}>
          <View style={styles.overlineRow}>
            <Text style={styles.overline}>QUESTION {currentIndex + 1}</Text>
            {mode !== 'scheduled' && (
              <View
                style={[styles.modeChip, { backgroundColor: mode === 'leeches' ? colors.tintWarning : colors.surfaceAlt }]}
              >
                <Ionicons
                  name={mode === 'leeches' ? 'flame-outline' : 'infinite-outline'}
                  size={13}
                  color={mode === 'leeches' ? colors.warningText : colors.textSecondary}
                />
                <Text style={[styles.modeChipText, { color: mode === 'leeches' ? colors.warningText : colors.textSecondary }]}>
                  {mode === 'leeches' ? 'Cartes difficiles' : 'Mode libre'}
                </Text>
              </View>
            )}
          </View>
          {!!item.course_nom && <Text style={styles.courseLabel}>{item.course_nom}</Text>}
          {!!item.exam && (
            <View style={styles.examChip}>
              <Ionicons name="calendar-outline" size={13} color={colors.warningText} />
              <Text style={styles.examChipText} numberOfLines={1}>
                {item.exam.title} · {item.exam.days_left === 0 ? "aujourd'hui" : item.exam.days_left === 1 ? 'demain' : `J-${item.exam.days_left}`}
              </Text>
            </View>
          )}
          <Text style={styles.questionText} accessibilityRole="header">{item.question}</Text>
        </View>

        <View style={styles.optionsList}>
          {optionEntries.map(([key, text]) => {
            const state = optionState(key);
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.option,
                  state === 'pending' && styles.optionPending,
                  state === 'correct' && styles.optionCorrect,
                  state === 'incorrect' && styles.optionIncorrect,
                  state === 'dimmed' && styles.optionDimmed,
                ]}
                onPress={() => selectOption(key)}
                disabled={!!selectedOption}
                accessibilityRole="button"
                accessibilityLabel={`${text}${state === 'correct' ? ', bonne réponse' : state === 'incorrect' ? ', mauvaise réponse' : ''}`}
                accessibilityState={{ disabled: !!selectedOption, selected: key === selectedOption }}
              >
                <Text
                  style={[
                    styles.optionText,
                    state === 'correct' && styles.optionTextCorrect,
                    state === 'incorrect' && styles.optionTextIncorrect,
                  ]}
                >
                  {text}
                </Text>
                {state === 'pending' ? (
                  <ActivityIndicator size="small" color={colors.primaryDark} accessibilityLabel="Vérification en cours" />
                ) : state === 'correct' ? (
                  <Ionicons name="checkmark-circle" size={26} color={colors.success} />
                ) : state === 'incorrect' ? (
                  <Ionicons name="close-circle" size={26} color={colors.danger} />
                ) : (
                  <View style={styles.indicator} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {answerResult?.is_leech && (
          <View style={styles.leechBadge} accessible={true} accessibilityLabel="Carte difficile, plusieurs échecs récents">
            <Ionicons name="flame-outline" size={16} color={colors.warningText} />
            <Text style={styles.leechBadgeText}>Carte difficile : retravaille-la plus souvent</Text>
          </View>
        )}

        {/* Après une erreur : bonne réponse + explication courte */}
        {answerResult && !answerResult.correct && (!!correctText || !!answerResult.explanation) && (
          <View style={styles.feedbackBox} accessibilityLiveRegion="polite">
            {!!correctText && <Text style={styles.feedbackTitle}>{`Bonne réponse : ${correctText}`}</Text>}
            {!!answerResult.explanation && <Text style={styles.feedbackText}>{answerResult.explanation}</Text>}
          </View>
        )}

        {!!answerError && (
          <View style={styles.answerError} accessibilityLiveRegion="polite">
            <Ionicons name="cloud-offline-outline" size={18} color={colors.dangerText} />
            <Text style={styles.answerErrorText}>{answerError}</Text>
          </View>
        )}

        {/* Pas compris ? L'assistant explique cette carte, avec la question en contexte. */}
        {answerResult && !!answerResult.correct_answer && (
          <TouchableOpacity
            style={styles.explainButton}
            onPress={explain}
            accessibilityRole="button"
            accessibilityLabel="Demander une explication à l'assistant"
          >
            <Ionicons name="sparkles-outline" size={18} color={colors.primaryText} />
            <Text style={styles.explainText}>Explique-moi cette carte</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {selectedOption && answerResult && (
        <TouchableOpacity
          style={[styles.continueButton, { bottom: bottom + 16 }]}
          onPress={goToNext}
          accessibilityRole="button"
          accessibilityLabel="Continuer"
        >
          <Text style={styles.continueButtonText}>Continuer</Text>
        </TouchableOpacity>
      )}
    </View>
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
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 8,
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
    progressWrap: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerCount: {
      fontSize: 14,
      fontWeight: '600',
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
      backgroundColor: colors.action,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 14,
      marginTop: 8,
    },
    primaryButtonText: {
      color: colors.onAction,
      fontWeight: '600',
      fontSize: 16,
    },
    secondaryButton: {
      borderWidth: 1.5,
      borderColor: colors.primaryDark,
      paddingHorizontal: 24,
      paddingVertical: 13,
      borderRadius: 14,
      marginTop: 8,
    },
    secondaryButtonText: {
      color: colors.primaryText,
      fontWeight: '600',
      fontSize: 15,
    },
    practiceHint: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    cardArea: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 120,
      gap: 24,
    },
    questionBlock: {
      gap: 8,
    },
    overline: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryText,
    },
    overlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    modeChipText: {
      fontSize: 12,
      fontWeight: '600',
    },
    courseLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: -4,
    },
    questionText: {
      fontSize: 21,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 29,
    },
    // Réponses aérées : 12 px entre les choix, 16 px de padding, cible ≥ 56 px.
    optionsList: {
      gap: 12,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
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
      borderColor: colors.primaryDark,
      backgroundColor: colors.tintPrimary,
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
    optionTextCorrect: {
      fontWeight: '600',
      color: colors.successText,
    },
    optionTextIncorrect: {
      fontWeight: '600',
      color: colors.dangerText,
    },
    indicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.muted,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Bouton « Continuer » : padding vertical 16, 20 px de marge latérale, 28 px au-dessus de la barre système.
    continueButton: {
      position: 'absolute',
      left: 20,
      right: 20,
      height: 56,
      backgroundColor: colors.action,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    continueButtonText: {
      color: colors.onAction,
      fontSize: 16,
      fontWeight: '600',
    },
    leechBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.tintWarning,
      borderRadius: 12,
      padding: 12,
      marginTop: -8,
    },
    leechBadgeText: {
      flex: 1,
      fontSize: 13,
      color: colors.warningText,
      fontWeight: '500',
    },
    feedbackBox: {
      gap: 4,
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.tintSuccess,
    },
    feedbackTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.successText,
    },
    feedbackText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.successText,
    },
    examChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      maxWidth: '100%',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.tintWarning,
    },
    examChipText: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '600',
      color: colors.warningText,
    },
    answerError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.tintDanger,
    },
    answerErrorText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.dangerText,
    },
    explainButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    explainText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
    },
  });
}
