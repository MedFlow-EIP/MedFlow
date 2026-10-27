import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { appAlert } from '../../utils/appAlert';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../../utils/network';
import { useScreenInsets } from '../navigation/constants';
import { QuizRunner, type RunnerQuestion } from '../quiz/QuizRunner';
import { QuizCorrection, type CorrectionItem } from '../quiz/QuizCorrection';
import { StateView } from '../ui/StateView';
import { challengeStatusText, type Challenge } from '../challenge/ChallengeSection';

type Result = { challenge: Challenge; score: number; total: number; xp_gained: number; corrections: CorrectionItem[] };

/** Jouer un défi (F57) : même déroulé qu'un examen blanc, sans chrono. */
export function ChallengeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const challengeId: number = route.params?.challengeId;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [questions, setQuestions] = useState<RunnerQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoadError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/challenges/${challengeId}`, { headers: await getAuthHeaders(user) });
      const data = await readJsonOrThrow<{ challenge: Challenge; questions: RunnerQuestion[] }>(res, 'Défi introuvable.');
      setChallenge(data.challenge);
      setQuestions(data.questions);
    } catch (err) {
      setLoadError(errorMessage(err, 'Défi introuvable.'));
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!result) load();
    }, [challengeId])
  );

  const playing = !!challenge && !result;

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e: any) => {
      if (!playing || Object.keys(answers).length === 0) return;
      e.preventDefault();
      appAlert('Quitter le défi ?', 'Tes réponses seront perdues, mais tu pourras le rejouer.', [
        { text: 'Continuer', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [navigation, playing, answers]);

  const submit = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setBusy(true);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/challenges/${challengeId}/submit`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      setResult(await readJsonOrThrow<Result>(res, 'Copie non envoyée.'));
    } catch (err) {
      appAlert('Copie non envoyée', errorMessage(err, 'Réessaie dans un instant.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmSubmit = () => {
    const missing = questions.length - Object.keys(answers).length;
    if (missing === 0) return submit();
    appAlert('Valider tes réponses ?', `${missing} question${missing > 1 ? 's' : ''} sans réponse.`, [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Valider', onPress: submit },
    ]);
  };

  if (loadError) {
    return (
      <StateView
        icon="flash-outline"
        tone="neutral"
        title="Défi indisponible"
        subtitle={loadError}
        primary={{ label: 'Retour', onPress: () => navigation.goBack() }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  if (!challenge) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primaryDark} accessibilityLabel="Chargement du défi" />
      </View>
    );
  }

  const header = (
    <View style={[styles.header, { paddingTop: top }]}>
      <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
        <Ionicons name={result ? 'arrow-back' : 'close'} size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.headerText}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          Défi contre {challenge.friend_name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>{challenge.course_nom}</Text>
      </View>
    </View>
  );

  if (result) {
    const c = result.challenge;
    const tone = c.outcome === 'win' ? colors.tintSuccess : c.outcome === 'loss' ? colors.tintDanger : colors.tintPrimary;
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}>
          <View style={[styles.scoreCard, { backgroundColor: tone }]}>
            <Text style={styles.score}>
              {result.score}/{result.total}
            </Text>
            <Text style={styles.scoreText}>
              {c.status === 'done' ? challengeStatusText(c) : `En attente de ${c.friend_name} : tu verras le résultat quand il aura joué.`}
            </Text>
            {result.xp_gained > 0 && <Text style={styles.xp}>+{result.xp_gained} XP</Text>}
          </View>
          <Text style={styles.sectionTitle}>Corrigé</Text>
          <QuizCorrection items={result.corrections} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: bottom + 12 }]}>
      {header}
      {busy ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primaryDark} accessibilityLabel="Correction en cours" />
      ) : (
        <QuizRunner
          questions={questions}
          answers={answers}
          onAnswer={(key, option) => setAnswers((prev) => ({ ...prev, [key]: option }))}
          onFinish={confirmSubmit}
          finishLabel="Valider mes réponses"
        />
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
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    loader: {
      marginTop: 60,
    },
    content: {
      paddingHorizontal: 20,
      gap: 12,
    },
    scoreCard: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: 24,
      paddingHorizontal: 16,
      borderRadius: 20,
    },
    score: {
      fontSize: 44,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    scoreText: {
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.textPrimary,
    },
    xp: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.successText,
    },
    sectionTitle: {
      marginTop: 8,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
}
