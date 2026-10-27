import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { appAlert } from '../../utils/appAlert';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../../utils/network';
import { logEvent } from '../../utils/analytics';
import { useScreenInsets } from '../navigation/constants';
import { QuizRunner, type RunnerQuestion } from '../quiz/QuizRunner';
import { QuizCorrection, type CorrectionItem } from '../quiz/QuizCorrection';

const COUNTS = [10, 20, 40];

type CourseChoice = { id: string; nom: string; quiz?: number };

type Result = {
  score: number;
  total: number;
  grade: number;
  xp_gained: number;
  corrections: CorrectionItem[];
};

/** « 09:05 » */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Examen blanc : quiz chronométré (1 min par question) qui mélange les cours
 * choisis, sans correction avant la fin, noté sur 20.
 */
export function MockExamScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();
  const navigation = useNavigation<any>();

  const [phase, setPhase] = useState<'setup' | 'running' | 'result'>('setup');
  const [courses, setCourses] = useState<CourseChoice[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [examId, setExamId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<RunnerQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [endsAt, setEndsAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const submittedRef = useRef(false);
  // Le chrono appelle submit depuis un intervalle créé au démarrage : il doit
  // lire les réponses à jour, pas celles du moment où il a été créé.
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
          const res = await fetchWithTimeout(`${API_URL}/api/dashboard?per_page=100`, { headers: await getAuthHeaders(user) });
          const data = await readJsonOrThrow<{ cours: CourseChoice[] }>(res, 'Impossible de charger tes cours.');
          const withQuiz = (data.cours || []).filter((c) => (c.quiz ?? 0) > 0);
          setCourses(withQuiz);
          setSelected(new Set(withQuiz.map((c) => c.id)));
        } catch (err) {
          setCourses([]);
          setError(errorMessage(err, 'Impossible de charger tes cours.'));
        }
      })();
    }, [])
  );

  // Quitter pendant l'examen : confirmation (bouton retour Android, geste iOS, croix).
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e: any) => {
      if (phase !== 'running') return;
      e.preventDefault();
      appAlert('Abandonner l’examen ?', 'Ta copie ne sera pas corrigée.', [
        { text: 'Continuer l’examen', style: 'cancel' },
        { text: 'Abandonner', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [navigation, phase]);

  const submit = async () => {
    const user = auth.currentUser;
    if (!user || examId === null || submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/mock-exam/${examId}/submit`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersRef.current }),
      });
      setResult(await readJsonOrThrow<Result>(res, 'Correction impossible.'));
      logEvent('mock_exam_finished');
      setPhase('result');
    } catch (err) {
      submittedRef.current = false;
      appAlert('Copie non envoyée', errorMessage(err, 'Réessaie dans un instant.'), [
        { text: 'Réessayer', onPress: submit },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Chrono : calculé depuis l'heure de fin (reste juste si l'app passe en arrière-plan).
  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      const left = Math.round((endsAt - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) submit();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase, endsAt]);

  const start = async () => {
    const user = auth.currentUser;
    if (!user || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/mock-exam/start`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, course_ids: [...selected] }),
      });
      const data = await readJsonOrThrow<{ exam_id: number; duration_seconds: number; questions: RunnerQuestion[] }>(
        res,
        'Impossible de lancer l’examen.'
      );
      submittedRef.current = false;
      setExamId(data.exam_id);
      logEvent('mock_exam_started');
      setQuestions(data.questions);
      setAnswers({});
      setResult(null);
      setEndsAt(Date.now() + data.duration_seconds * 1000);
      setPhase('running');
    } catch (err) {
      setError(errorMessage(err, 'Impossible de lancer l’examen.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmSubmit = () => {
    const missing = questions.length - Object.keys(answers).length;
    if (missing === 0) return submit();
    appAlert(
      'Rendre la copie ?',
      `${missing} question${missing > 1 ? 's' : ''} sans réponse ${missing > 1 ? 'compteront' : 'comptera'} comme fausse${missing > 1 ? 's' : ''}.`,
      [
        { text: 'Continuer', style: 'cancel' },
        { text: 'Rendre', onPress: submit },
      ]
    );
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const header = (title: string, right?: React.ReactNode) => (
    <View style={[styles.header, { paddingTop: top }]}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel={phase === 'running' ? 'Abandonner l’examen' : 'Retour'}
      >
        <Ionicons name={phase === 'running' ? 'close' : 'arrow-back'} size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );

  if (phase === 'running') {
    const urgent = remaining <= 60;
    return (
      <View style={[styles.container, { paddingBottom: bottom + 12 }]}>
        {header(
          'Examen blanc',
          <View style={[styles.clock, urgent && styles.clockUrgent]} accessible accessibilityLabel={`Temps restant ${formatClock(remaining)}`}>
            <Ionicons name="time-outline" size={16} color={urgent ? colors.dangerText : colors.primaryText} />
            <Text style={[styles.clockText, urgent && { color: colors.dangerText }]}>{formatClock(remaining)}</Text>
          </View>
        )}
        {busy ? (
          <ActivityIndicator style={styles.loader} size="large" color={colors.primaryDark} accessibilityLabel="Correction en cours" />
        ) : (
          <QuizRunner
            questions={questions}
            answers={answers}
            onAnswer={(key, option) => setAnswers((prev) => ({ ...prev, [key]: option }))}
            onFinish={confirmSubmit}
          />
        )}
      </View>
    );
  }

  if (phase === 'result' && result) {
    const good = result.grade >= 10;
    return (
      <View style={styles.container}>
        {header('Résultat')}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 110 }]}>
          <View style={[styles.gradeCard, { backgroundColor: good ? colors.tintSuccess : colors.tintWarning }]}>
            <Text style={[styles.grade, { color: good ? colors.successText : colors.warningText }]}>
              {String(result.grade).replace('.', ',')}/20
            </Text>
            <Text style={styles.gradeDetail}>
              {result.score} bonne{result.score > 1 ? 's' : ''} réponse{result.score > 1 ? 's' : ''} sur {result.total}
              {result.xp_gained ? ` · +${result.xp_gained} XP` : ''}
            </Text>
          </View>
          <Text style={styles.sectionTitle}>Corrigé</Text>
          <QuizCorrection items={result.corrections} />
        </ScrollView>
        <View style={[styles.actionBar, { paddingBottom: bottom + 12 }]}>
          <TouchableOpacity style={[styles.secondary, styles.flex]} onPress={() => setPhase('setup')} accessibilityRole="button">
            <Text style={styles.secondaryText}>Refaire un examen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primary, styles.flex]} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.primaryText}>Terminer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const available = (courses || []).filter((c) => selected.has(c.id)).reduce((n, c) => n + (c.quiz ?? 0), 0);

  return (
    <View style={styles.container}>
      {header('Examen blanc')}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 110 }]}>
        <View style={styles.info}>
          <Ionicons name="timer-outline" size={18} color={colors.primaryText} />
          <Text style={styles.infoText}>
            Questions tirées au hasard dans tes cours, 1 minute par question. La correction arrive à la fin, avec ta note sur 20.
          </Text>
        </View>

        {!!error && (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>Nombre de questions</Text>
        <View style={styles.counts} accessibilityRole="radiogroup">
          {COUNTS.map((n) => {
            const active = n === count;
            return (
              <TouchableOpacity
                key={n}
                style={[styles.countChip, active && styles.countChipActive]}
                onPress={() => setCount(n)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${n} questions, ${n} minutes`}
              >
                <Text style={[styles.countText, active && styles.countTextActive]}>{n}</Text>
                <Text style={[styles.countHint, active && styles.countTextActive]}>{n} min</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Cours</Text>
        {courses === null ? (
          <ActivityIndicator color={colors.primaryDark} accessibilityLabel="Chargement des cours" />
        ) : courses.length === 0 ? (
          <Text style={styles.empty}>Importe d’abord un cours pour lancer un examen blanc.</Text>
        ) : (
          courses.map((c) => {
            const checked = selected.has(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.courseRow, checked && styles.courseRowChecked]}
                onPress={() => toggle(c.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.primaryDark : colors.textSecondary} />
                <Text style={styles.courseName} numberOfLines={2}>{c.nom}</Text>
                <Text style={styles.courseCount}>{c.quiz} Q</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.primary, styles.flex, (busy || selected.size === 0) && styles.disabled]}
          onPress={start}
          disabled={busy || selected.size === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || selected.size === 0, busy }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAction} />
          ) : (
            <Text style={styles.primaryText}>
              Commencer ({Math.min(count, available)} questions)
            </Text>
          )}
        </TouchableOpacity>
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
    flex: {
      flex: 1,
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
    title: {
      flex: 1,
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    clock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.tintPrimary,
    },
    clockUrgent: {
      backgroundColor: colors.tintDanger,
    },
    clockText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primaryText,
      fontVariant: ['tabular-nums'],
    },
    loader: {
      marginTop: 60,
    },
    content: {
      paddingHorizontal: 20,
      gap: 12,
    },
    info: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.tintPrimary,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
      color: colors.primaryText,
    },
    label: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    counts: {
      flexDirection: 'row',
      gap: 10,
    },
    countChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    countChipActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.tintPrimary,
    },
    countText: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    countHint: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    countTextActive: {
      color: colors.primaryText,
    },
    empty: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    courseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 52,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    courseRowChecked: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.tintPrimary,
    },
    courseName: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
    },
    courseCount: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    gradeCard: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: 28,
      borderRadius: 20,
    },
    grade: {
      fontSize: 48,
      fontWeight: '800',
    },
    gradeDetail: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    sectionTitle: {
      marginTop: 8,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    actionBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 14,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    primary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 54,
      borderRadius: 14,
      backgroundColor: colors.action,
    },
    primaryText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onAction,
    },
    secondary: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 54,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.primaryDark,
      backgroundColor: colors.surface,
    },
    secondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
    },
    disabled: {
      opacity: 0.5,
    },
    error: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.tintDanger,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.dangerText,
    },
  });
}
