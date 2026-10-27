import React, { useCallback, useMemo, useRef, useState } from 'react';
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

type Step = { index: number; situation: string; question: string; options: Record<string, string> };
type PlayedStep = Step & { choice: string; correct: string; is_correct: boolean; feedback: string; explanation: string };

export type CaseState = {
  id: number;
  title: string;
  source_label: string;
  context: string;
  total_steps: number;
  played: PlayedStep[];
  current: Step | null;
  finished: boolean;
  score: number;
  debrief: string[];
};

/**
 * Cas clinique interactif : dossier du patient, puis une décision par étape
 * avec un retour sur le choix fait, et un débriefing à la fin.
 */
export function ClinicalCaseScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const caseId: number = route.params?.caseId;
  const scrollRef = useRef<ScrollView>(null);

  const [state, setState] = useState<CaseState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Dernier retour reçu, montré avant de passer à l'étape suivante.
  const [lastResult, setLastResult] = useState<PlayedStep | null>(null);
  const [xpGained, setXpGained] = useState(0);

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/cases/${caseId}`, { headers: await getAuthHeaders(user) });
      setState(await readJsonOrThrow<CaseState>(res, 'Cas introuvable.'));
    } catch (err) {
      setError(errorMessage(err, 'Cas introuvable.'));
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!state) load();
    }, [caseId])
  );

  const submit = async () => {
    const user = auth.currentUser;
    if (!user || !state?.current || !selected || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/cases/${caseId}/answer`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: state.current.index, option: selected }),
      });
      const data = await readJsonOrThrow<{ case: CaseState; xp_gained: number }>(res, 'Réponse non enregistrée.');
      setLastResult(data.case.played[data.case.played.length - 1]);
      setXpGained((x) => x + data.xp_gained);
      setState(data.case);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      setError(errorMessage(err, 'Réponse non enregistrée. Réessaie.'));
    } finally {
      setSending(false);
    }
  };

  const next = () => {
    setLastResult(null);
    setSelected(null);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  if (!state) {
    return error ? (
      <StateView
        icon="medkit-outline"
        tone="neutral"
        title="Cas indisponible"
        subtitle={error}
        primary={{ label: 'Réessayer', onPress: load }}
        onClose={() => navigation.goBack()}
      />
    ) : (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primaryDark} accessibilityLabel="Chargement du cas" />
      </View>
    );
  }

  // Étapes déjà validées (le dernier retour est affiché à part tant qu'on n'a pas continué).
  const history = lastResult ? state.played.slice(0, -1) : state.played;
  const showDebrief = state.finished && !lastResult;
  const progress = (state.played.length / state.total_steps) * 100;

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{state.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{state.source_label}</Text>
        </View>
      </View>
      <View style={styles.progress}>
        <ProgressBar progress={progress} height={6} color={colors.primaryDark} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: bottom + 120 }]}>
        <View style={styles.file}>
          <View style={styles.fileHeader}>
            <Ionicons name="person-outline" size={18} color={colors.primaryText} />
            <Text style={styles.fileTitle}>Dossier du patient</Text>
          </View>
          <Text style={styles.fileText}>{state.context}</Text>
        </View>

        {history.map((step) => (
          <View key={step.index} style={styles.past}>
            <Text style={styles.overline}>ÉTAPE {step.index + 1}</Text>
            {!!step.situation && <Text style={styles.pastSituation}>{step.situation}</Text>}
            <Text style={styles.pastQuestion}>{step.question}</Text>
            <View style={styles.pastAnswer}>
              <Ionicons
                name={step.is_correct ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={step.is_correct ? colors.success : colors.danger}
              />
              <Text style={styles.pastAnswerText}>{step.options[step.choice]}</Text>
            </View>
          </View>
        ))}

        {lastResult && (
          <View style={[styles.result, lastResult.is_correct ? styles.resultGood : styles.resultBad]} accessibilityLiveRegion="polite">
            <Text style={[styles.resultTitle, { color: lastResult.is_correct ? colors.successText : colors.dangerText }]}>
              {lastResult.is_correct ? 'Bonne décision' : 'Ce n’était pas le meilleur choix'}
            </Text>
            <Text style={styles.resultChoice}>Ton choix : {lastResult.options[lastResult.choice]}</Text>
            {!!lastResult.feedback && <Text style={styles.resultText}>{lastResult.feedback}</Text>}
            {!lastResult.is_correct && (
              <Text style={[styles.resultChoice, { color: colors.successText }]}>
                Meilleur choix : {lastResult.options[lastResult.correct]}
              </Text>
            )}
            {!!lastResult.explanation && <Text style={styles.resultExplanation}>{lastResult.explanation}</Text>}
          </View>
        )}

        {!lastResult && state.current && (
          <View style={styles.current}>
            <Text style={styles.overline}>ÉTAPE {state.current.index + 1}/{state.total_steps}</Text>
            {!!state.current.situation && <Text style={styles.situation}>{state.current.situation}</Text>}
            <Text style={styles.question}>{state.current.question}</Text>
            {Object.entries(state.current.options).map(([key, text]) => {
              const active = key === selected;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => setSelected(key)}
                  disabled={sending}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>{active && <View style={styles.radioDot} />}</View>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {showDebrief && (
          <View style={styles.debrief}>
            <Text style={styles.debriefScore}>
              {state.score}/{state.total_steps} bonnes décisions
            </Text>
            {xpGained > 0 && <Text style={styles.debriefXp}>+{xpGained} XP</Text>}
            <Text style={styles.debriefTitle}>À retenir</Text>
            {state.debrief.map((point, i) => (
              <View key={i} style={styles.point}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottom + 12 }]}>
        {lastResult ? (
          <TouchableOpacity style={styles.primary} onPress={next} accessibilityRole="button">
            <Text style={styles.primaryText}>{state.finished ? 'Voir le débriefing' : 'Étape suivante'}</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.onAction} />
          </TouchableOpacity>
        ) : state.current ? (
          <TouchableOpacity
            style={[styles.primary, (!selected || sending) && styles.disabled]}
            onPress={submit}
            disabled={!selected || sending}
            accessibilityRole="button"
            accessibilityState={{ disabled: !selected || sending, busy: sending }}
          >
            {sending ? <ActivityIndicator color={colors.onAction} /> : <Text style={styles.primaryText}>Valider ma décision</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primary} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.primaryText}>Terminer</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
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
    headerText: { flex: 1, gap: 2 },
    title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textSecondary },
    progress: { paddingHorizontal: 20, paddingBottom: 10 },
    content: { gap: 12, paddingHorizontal: 20 },
    file: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: colors.tintPrimary },
    fileHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fileTitle: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
    fileText: { fontSize: 15, lineHeight: 22, color: colors.textPrimary },
    overline: { fontSize: 11, fontWeight: '700', color: colors.primaryText },
    past: { gap: 6, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    pastSituation: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    pastQuestion: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    pastAnswer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pastAnswerText: { flex: 1, fontSize: 14, color: colors.textPrimary },
    current: { gap: 10 },
    situation: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textPrimary,
      padding: 14,
      borderRadius: 14,
      borderLeftWidth: 4,
      borderLeftColor: colors.primaryDark,
      backgroundColor: colors.surface,
    },
    question: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: colors.textPrimary },
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
    optionActive: { borderColor: colors.primaryDark, backgroundColor: colors.tintPrimary },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: { borderColor: colors.primaryDark },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primaryDark },
    optionText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.textPrimary },
    optionTextActive: { fontWeight: '600', color: colors.primaryText },
    result: { gap: 8, padding: 16, borderRadius: 16, borderWidth: 1.5 },
    resultGood: { borderColor: colors.success, backgroundColor: colors.tintSuccess },
    resultBad: { borderColor: colors.danger, backgroundColor: colors.tintDanger },
    resultTitle: { fontSize: 17, fontWeight: '700' },
    resultChoice: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    resultText: { fontSize: 15, lineHeight: 22, color: colors.textPrimary },
    resultExplanation: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    debrief: { gap: 10, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    debriefScore: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
    debriefXp: { fontSize: 15, fontWeight: '700', color: colors.successText, textAlign: 'center' },
    debriefTitle: { marginTop: 6, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    point: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    pointText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.textPrimary },
    error: { fontSize: 14, color: colors.dangerText },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
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
    primaryText: { fontSize: 16, fontWeight: '600', color: colors.onAction },
    disabled: { opacity: 0.5 },
  });
}
