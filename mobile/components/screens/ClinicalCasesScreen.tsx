import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { StateView } from '../ui/StateView';

type CaseSummary = {
  id: number;
  title: string;
  source_label: string;
  total_steps: number;
  answered: number;
  score: number;
  finished: boolean;
};

type CourseChoice = { id: string; nom: string };

const DIFFICULTIES = [
  { value: 'facile', label: 'Facile' },
  { value: 'normal', label: 'Normal' },
  { value: 'difficile', label: 'Difficile' },
] as const;

// Génération d'un cas complet : jusqu'à ~1 min avec le modèle Pro.
const CREATE_TIMEOUT_MS = 120_000;

/** Liste des cas cliniques (à reprendre / terminés) et création d'un nouveau cas. */
export function ClinicalCasesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [presetCourse, setPresetCourse] = useState<string | undefined>(undefined);

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoadError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/cases`, { headers: await getAuthHeaders(user) });
      setCases((await readJsonOrThrow<{ cases: CaseSummary[] }>(res, 'Impossible de charger tes cas.')).cases);
    } catch (err) {
      setLoadError(errorMessage(err, 'Impossible de charger tes cas.'));
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  // Ouvert depuis un cours : création directe sur ce cours.
  useEffect(() => {
    const courseId = route.params?.courseId;
    if (courseId) {
      setPresetCourse(courseId);
      setCreating(true);
      navigation.setParams({ courseId: undefined });
    }
  }, [route.params?.courseId]);

  const remove = (c: CaseSummary) => {
    appAlert('Supprimer ce cas ?', `« ${c.title} »`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const user = auth.currentUser;
          if (!user) return;
          try {
            const res = await fetchWithTimeout(`${API_URL}/api/cases/${c.id}`, {
              method: 'DELETE',
              headers: await getAuthHeaders(user),
            });
            await readJsonOrThrow(res, 'Suppression impossible.');
            setCases((prev) => (prev || []).filter((x) => x.id !== c.id));
          } catch (err) {
            appAlert('Suppression impossible', errorMessage(err, 'Réessaie dans un instant.'));
          }
        },
      },
    ]);
  };

  if (loadError && !cases) {
    return (
      <StateView
        icon="cloud-offline-outline"
        tone="neutral"
        title="Impossible de charger tes cas"
        subtitle={loadError}
        primary={{ label: 'Réessayer', onPress: load }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">Cas cliniques</Text>
      </View>

      {cases === null ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primaryDark} accessibilityLabel="Chargement" />
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={[styles.list, { paddingBottom: bottom + 110 }]}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Ionicons name="medkit-outline" size={20} color={colors.primaryText} />
              <Text style={styles.introText}>
                Un patient, des décisions à prendre à chaque étape, et un retour sur chacun de tes choix.
              </Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>Aucun cas pour l’instant : crée le premier.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('ClinicalCase', { caseId: item.id })}
              onLongPress={() => remove(item)}
              accessibilityRole="button"
              accessibilityHint="Appui long pour supprimer"
            >
              <View style={[styles.rowIcon, item.finished && styles.rowIconDone]}>
                <Ionicons
                  name={item.finished ? 'checkmark' : 'play'}
                  size={18}
                  color={item.finished ? colors.onAction : colors.primaryDark}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.source_label} ·{' '}
                  {item.finished
                    ? `${item.score}/${item.total_steps} bonnes décisions`
                    : `étape ${item.answered + 1}/${item.total_steps}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        />
      )}

      <View style={[styles.actionBar, { paddingBottom: bottom + 12 }]}>
        <TouchableOpacity style={styles.primary} onPress={() => setCreating(true)} accessibilityRole="button">
          <Ionicons name="add" size={22} color={colors.onAction} />
          <Text style={styles.primaryText}>Nouveau cas clinique</Text>
        </TouchableOpacity>
      </View>

      <NewCaseSheet
        visible={creating}
        presetCourseId={presetCourse}
        onClose={() => {
          setCreating(false);
          setPresetCourse(undefined);
        }}
        onCreated={(caseId) => {
          setCreating(false);
          setPresetCourse(undefined);
          navigation.navigate('ClinicalCase', { caseId });
        }}
      />
    </View>
  );
}

function NewCaseSheet({
  visible,
  presetCourseId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  presetCourseId?: string;
  onClose: () => void;
  onCreated: (caseId: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useScreenInsets();

  const [courses, setCourses] = useState<CourseChoice[] | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<string>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onShow = async () => {
    setError(null);
    setTopic('');
    setCourseId(presetCourseId ?? null);
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/dashboard?per_page=100`, { headers: await getAuthHeaders(user) });
      const data = await readJsonOrThrow<{ cours: CourseChoice[] }>(res, 'Impossible de charger tes cours.');
      setCourses(data.cours || []);
    } catch (err) {
      setCourses([]);
      setError(errorMessage(err, 'Impossible de charger tes cours.'));
    }
  };

  const create = async () => {
    const user = auth.currentUser;
    if (!user || busy) return;
    if (!courseId && topic.trim().length < 3) {
      setError('Choisis un cours ou écris un sujet.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/api/cases`,
        {
          method: 'POST',
          headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
          body: JSON.stringify(courseId ? { course_id: courseId, difficulty } : { topic: topic.trim(), difficulty }),
        },
        CREATE_TIMEOUT_MS
      );
      const data = await readJsonOrThrow<{ id: number }>(res, 'Le cas n’a pas pu être créé.');
      onCreated(data.id);
    } catch (err) {
      setError(errorMessage(err, 'Le cas n’a pas pu être créé.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={onShow} onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={() => !busy && onClose()} accessibilityLabel="Fermer">
          <Pressable style={[styles.sheet, { paddingBottom: bottom + 16 }]} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle} accessibilityRole="header">Nouveau cas clinique</Text>

            {!!error && (
              <View style={styles.error} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {busy ? (
              <View style={styles.busy} accessibilityLiveRegion="polite">
                <ActivityIndicator size="large" color={colors.primaryDark} />
                <Text style={styles.busyText}>Préparation du patient… (environ 30 secondes)</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>À partir d’un de tes cours</Text>
                <ScrollView style={styles.courseList} contentContainerStyle={styles.courseListContent}>
                  {courses === null ? (
                    <ActivityIndicator color={colors.primaryDark} accessibilityLabel="Chargement des cours" />
                  ) : courses.length === 0 ? (
                    <Text style={styles.empty}>Aucun cours importé : écris un sujet ci-dessous.</Text>
                  ) : (
                    courses.map((c) => {
                      const active = c.id === courseId;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.choice, active && styles.choiceActive]}
                          onPress={() => {
                            setCourseId(active ? null : c.id);
                            setTopic('');
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: active }}
                        >
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={active ? colors.primaryDark : colors.textSecondary}
                          />
                          <Text style={styles.choiceText} numberOfLines={2}>{c.nom}</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

                <Text style={styles.label}>Ou sur un sujet</Text>
                <TextInput
                  value={topic}
                  onChangeText={(t) => {
                    setTopic(t);
                    if (t) setCourseId(null);
                  }}
                  maxLength={150}
                  placeholder="Ex. Douleur abdominale aiguë"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  accessibilityLabel="Sujet du cas clinique"
                />

                <View style={styles.segment} accessibilityRole="radiogroup">
                  {DIFFICULTIES.map((d) => {
                    const active = d.value === difficulty;
                    return (
                      <TouchableOpacity
                        key={d.value}
                        style={[styles.segmentItem, active && styles.segmentItemActive]}
                        onPress={() => setDifficulty(d.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{d.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity style={styles.primary} onPress={create} accessibilityRole="button">
                  <Ionicons name="medkit-outline" size={20} color={colors.onAction} />
                  <Text style={styles.primaryText}>Créer le cas</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
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
    title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
    loader: { marginTop: 40 },
    list: { gap: 10, paddingHorizontal: 20 },
    intro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      marginBottom: 4,
      borderRadius: 14,
      backgroundColor: colors.tintPrimary,
    },
    introText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.primaryText },
    empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowIconDone: { backgroundColor: colors.success },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    rowMeta: { fontSize: 13, color: colors.textSecondary },
    actionBar: {
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
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      maxHeight: '90%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 10,
      paddingHorizontal: 20,
      gap: 12,
    },
    handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border },
    sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    courseList: { flexGrow: 0, maxHeight: 220 },
    courseListContent: { gap: 8 },
    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    choiceActive: { borderColor: colors.primaryDark, backgroundColor: colors.tintPrimary },
    choiceText: { flex: 1, fontSize: 15, color: colors.textPrimary },
    input: {
      minHeight: 50,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      fontSize: 15,
      color: colors.textPrimary,
    },
    segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.surfaceAlt },
    segmentItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
    segmentItemActive: { backgroundColor: colors.surface },
    segmentText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
    segmentTextActive: { fontWeight: '600', color: colors.primaryText },
    busy: { alignItems: 'center', gap: 12, paddingVertical: 32 },
    busyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.tintDanger },
    errorText: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.dangerText },
  });
}
