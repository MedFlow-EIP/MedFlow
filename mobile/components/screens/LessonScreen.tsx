import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ProgressBar } from '../ui/progress';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from '../../utils/authHeaders';
import { BadgeUnlockModal, UnlockedBadge } from '../../components/BadgeUnlockModal';
import { NotificationOptInModal } from '../../components/NotificationOptInModal';
import {
  scheduleReminderIfNeeded,
  enableStreakReminders,
  hasSeenNotificationPrompt,
  markNotificationPromptSeen,
} from '../../utils/streakNotifications';
import { ExplanationStep } from "../../components/steps/ExplanationStep";
import { SwipeCardsStep } from "../../components/steps/SwipeCardsStep";
import { SpeedChallengeStep } from "../../components/steps/SpeedChallengeStep";
import { QuickQuizCardsStep } from "../../components/steps/QuickQuizzCardsStep";
import { VisualDiscovery } from "../../components/steps/VisualDiscoveryStep";
import { getLessonSteps, isGradedStep } from '../../content/lessons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useScreenInsets } from '../navigation/constants';
import { appAlert } from '../../utils/appAlert';

interface LessonScreenProps {
  route: any;
  navigation: any;
}

export function LessonScreen({ route, navigation }: LessonScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();

  const { path, lesson } = route.params;
  const [showResults, setShowResults] = useState(false);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const xp = lesson?.xp ?? 10;

  // Contenu propre à la leçon (et non plus le même contenu pour toutes).
  const steps = useMemo(() => getLessonSteps(path.id, String(lesson.id), lesson.title), [path.id, lesson.id]);
  const gradedCount = steps.filter(isGradedStep).length;

  const [streak, setStreak] = useState<number | null>(null);
  const [newBadges, setNewBadges] = useState<UnlockedBadge[]>([]);

  // Signal purement analytique (jamais affiché à l'utilisateur) — sert à
  // calculer le taux d'abandon commencé/terminé pour le diagnostic de
  // frictions. Fire-and-forget : un échec ici ne doit jamais bloquer la leçon.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    (async () => {
      try {
        const headers = await getAuthHeaders(user);
        await fetch(`${API_URL}/api/lessons/${path.id}/${lesson.id}/start`, {
          method: 'POST',
          headers,
        });
      } catch (err) {
        console.error('Erreur tracking lesson_started:', err);
      }
    })();
  }, []);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [lastActivityForPrompt, setLastActivityForPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (!showResults) return;
    const user = auth.currentUser;
    if (!user) {
      setStreak(-1);
      return;
    }

    (async () => {
      try {
        const headers = await getAuthHeaders(user);

        // C'est ICI, une fois la leçon réellement terminée (pas au tap sur
        // le node dans PathScreen), que la complétion est envoyée au
        // backend — XP, streak et badges sont calculés à ce moment précis.
        const completeRes = await fetch(
          `${API_URL}/api/lessons/${path.id}/${lesson.id}/complete`,
          { method: 'POST', headers }
        );
        const completeData = await completeRes.json();
        if (Array.isArray(completeData.newBadges) && completeData.newBadges.length > 0) {
          setNewBadges(completeData.newBadges);
        }

        const res = await fetch(`${API_URL}/api/account`, { headers });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setLastActivityForPrompt(data?.stats?.lastActivity ?? null);
        setStreak(data?.stats?.streak ?? -1);
        scheduleReminderIfNeeded(data?.stats?.lastActivity ?? null);
      } catch (err) {
        console.error('Erreur complétion leçon:', err);
        setStreak(-1);
      }
    })();
  }, [showResults]);

  const step = steps[index];
  const progress = (index / steps.length) * 100;

  const next = (correct?: boolean) => {
    if (correct) setCorrectCount((c) => c + 1);
    if (index < steps.length - 1) {
      setIndex(index + 1);
    } else {
      setShowResults(true);
    }
  };

  const quit = () => {
    appAlert('Quitter la leçon ?', 'Ta progression dans cette leçon ne sera pas enregistrée.', [
      { text: 'Rester', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const handleFinish = () => {
    navigation.goBack();
  };

  if (showResults) {
    const score = gradedCount > 0 ? Math.round((correctCount / gradedCount) * 100) : 100;
    return (
      <View style={[styles.container, { paddingTop: top, paddingBottom: bottom }]}>
        <BadgeUnlockModal
          badges={newBadges}
          onDismiss={async () => {
            const hadFirstLessonBadge = newBadges.some((b) => b.id === 'first_lesson');
            setNewBadges([]);

            if (hadFirstLessonBadge && !(await hasSeenNotificationPrompt())) {
              setShowNotifPrompt(true);
            }
          }}
        />
        <NotificationOptInModal
          visible={showNotifPrompt}
          onAccept={async () => {
            setShowNotifPrompt(false);
            await markNotificationPromptSeen();
            await enableStreakReminders(lastActivityForPrompt);
          }}
          onDecline={async () => {
            setShowNotifPrompt(false);
            await markNotificationPromptSeen();
          }}
        />
        <View style={styles.resultsContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="trophy" size={48} color={colors.warning} />
          </View>

          <Text style={styles.resultsTitle} accessibilityRole="header">Leçon terminée !</Text>
          <Text style={styles.resultsSubtitle}>{lesson.title}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: colors.tintPrimary }]}>
                <Ionicons name="star" size={22} color={colors.primaryDark} />
              </View>
              <Text style={styles.statValue}>+{xp} XP</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: colors.tintWarning }]}>
                {streak === null ? (
                  <ActivityIndicator size="small" color={colors.warning} accessibilityLabel="Chargement de la série" />
                ) : (
                  <Ionicons name={streak === -1 ? 'flame-outline' : 'flame'} size={22} color={colors.warning} />
                )}
              </View>
              {streak !== null && (
                <Text style={styles.statValue}>{streak === -1 ? 'Série : —' : `Série : ${streak}j`}</Text>
              )}
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: colors.tintSuccess }]}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              </View>
              <Text style={styles.statValue}>{score} %</Text>
            </View>
          </View>

          {gradedCount > 0 && (
            <Text style={styles.scoreDetail}>
              {correctCount}/{gradedCount} bonne{correctCount > 1 ? 's' : ''} réponse{correctCount > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <View style={styles.resultsFooter}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleFinish} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={quit}
          accessibilityRole="button"
          accessibilityLabel="Quitter la leçon"
        >
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressWrap}>
          <ProgressBar progress={progress} color={colors.primaryDark} height={8} />
        </View>
        <Text style={styles.count}>
          {index + 1}/{steps.length}
        </Text>
      </View>

      <View style={styles.stepArea} key={index}>
        {step.type === "explanation" && (
          <ExplanationStep
            title={step.data.title}
            explanation={step.data.explanation}
            points={step.data.points}
            image={step.data.image}
            onContinue={() => next()}
          />
        )}

        {step.type === "swipe" && (
          <SwipeCardsStep title={step.data.title} cards={step.data.cards} onComplete={() => next()} />
        )}

        {step.type === "speed" && (
          <SpeedChallengeStep
            question={step.data.question}
            options={step.data.options}
            correctId={step.data.correctId}
            timeLimit={step.data.timeLimit}
            explanation={step.data.explanation}
            onComplete={next}
          />
        )}

        {step.type === "visualQuiz" && (
          <VisualDiscovery
            question={step.data.question}
            image={step.data.image}
            aspectRatio={step.data.aspectRatio}
            parts={step.data.parts}
            correctId={step.data.correctId}
            explanation={step.data.explanation}
            onComplete={next}
          />
        )}

        {step.type === "quickQuiz" && (
          <QuickQuizCardsStep
            question={step.data.question}
            options={step.data.options}
            correctId={step.data.correctId}
            explanation={step.data.explanation}
            onComplete={next}
          />
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
    count: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    stepArea: {
      flex: 1,
    },
    resultsContainer: {
      flex: 1,
      paddingHorizontal: 20,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    successIcon: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: colors.tintWarning,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    resultsTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    resultsSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 12,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      alignSelf: 'stretch',
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    statIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    scoreDetail: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    resultsFooter: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    primaryButton: {
      height: 56,
      borderRadius: 14,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onAction,
    },
  });
}
