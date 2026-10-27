import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { appAlert } from '../../utils/appAlert';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../../utils/network';
import { countdownLabel, syncExamReminders } from '../../utils/examReminders';
import { useScreenInsets } from '../navigation/constants';
import { DatePickerSheet, formatLongDate } from '../ui/DatePickerSheet';
import { StateView } from '../ui/StateView';

export type Exam = {
  id: number;
  title: string;
  exam_date: string;
  days_left: number;
  courses: { id: string; nom: string }[];
};

type CourseChoice = { id: string; nom: string };

export function ExamsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();
  const navigation = useNavigation<any>();

  const [exams, setExams] = useState<Exam[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      setLoadError(null);
      const res = await fetchWithTimeout(`${API_URL}/api/exams`, { headers: await getAuthHeaders(user) });
      const data = await readJsonOrThrow<{ exams: Exam[] }>(res, 'Impossible de charger tes examens.');
      setExams(data.exams);
      syncExamReminders(data.exams);
    } catch (err) {
      setLoadError(errorMessage(err, 'Impossible de charger tes examens.'));
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const remove = (exam: Exam) => {
    appAlert('Supprimer cet examen ?', `« ${exam.title} » et ses rappels seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const user = auth.currentUser;
          if (!user) return;
          try {
            const res = await fetchWithTimeout(`${API_URL}/api/exams/${exam.id}`, {
              method: 'DELETE',
              headers: await getAuthHeaders(user),
            });
            await readJsonOrThrow(res, 'Suppression impossible.');
            const next = (exams || []).filter((e) => e.id !== exam.id);
            setExams(next);
            syncExamReminders(next);
          } catch (err) {
            appAlert('Suppression impossible', errorMessage(err, 'Réessaie dans un instant.'));
          }
        },
      },
    ]);
  };

  if (loadError && !exams) {
    return (
      <StateView
        icon="cloud-offline-outline"
        tone="neutral"
        title="Impossible de charger tes examens"
        subtitle={loadError}
        primary={{ label: 'Réessayer', onPress: load }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  const upcoming = (exams || []).filter((e) => e.days_left >= 0);
  const past = (exams || []).filter((e) => e.days_left < 0).reverse();

  const renderExam = (exam: Exam) => {
    const soon = exam.days_left >= 0 && exam.days_left <= 7;
    const isPast = exam.days_left < 0;
    return (
      <View key={exam.id} style={[styles.card, isPast && styles.cardPast]}>
        <View style={styles.cardHeader}>
          <View style={[styles.countdown, soon ? styles.countdownSoon : isPast ? styles.countdownPast : null]}>
            <Text style={[styles.countdownText, soon && styles.countdownTextSoon]}>{countdownLabel(exam.days_left)}</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => remove(exam)}
            accessibilityRole="button"
            accessibilityLabel={`Supprimer l’examen ${exam.title}`}
          >
            <Ionicons name="trash-outline" size={19} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.examTitle}>{exam.title}</Text>
        <Text style={styles.examDate}>{formatLongDate(exam.exam_date)}</Text>
        {exam.courses.length > 0 ? (
          <View style={styles.chips}>
            {exam.courses.map((c) => (
              <View key={c.id} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>{c.nom}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noCourse}>Aucun cours lié</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom + 110 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title} accessibilityRole="header">Mes examens</Text>
        </View>

        <View style={styles.info}>
          <Ionicons name="flash-outline" size={18} color={colors.primaryText} />
          <Text style={styles.infoText}>
            Dans les 30 jours avant un examen, ses cours passent en premier dans tes révisions. Rappels à J-7 et la veille.
          </Text>
        </View>

        {exams === null ? (
          <ActivityIndicator style={styles.loader} color={colors.primaryDark} accessibilityLabel="Chargement" />
        ) : exams.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Aucun examen prévu</Text>
            <Text style={styles.emptyText}>Ajoute ton prochain partiel pour réviser les bons cours au bon moment.</Text>
          </View>
        ) : (
          <>
            {upcoming.map(renderExam)}
            {past.length > 0 && <Text style={styles.sectionLabel}>Passés</Text>}
            {past.map(renderExam)}
          </>
        )}
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: bottom + 12 }]}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => setAdding(true)} accessibilityRole="button">
          <Ionicons name="add" size={22} color={colors.onAction} />
          <Text style={styles.primaryText}>Ajouter un examen</Text>
        </TouchableOpacity>
      </View>

      <AddExamSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onCreated={(exam) => {
          setAdding(false);
          const next = [...(exams || []), exam].sort((a, b) => a.exam_date.localeCompare(b.exam_date));
          setExams(next);
          syncExamReminders(next, true);
        }}
      />
    </View>
  );
}

function AddExamSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (exam: Exam) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();

  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [courses, setCourses] = useState<CourseChoice[] | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setExamDate(null);
    setSelected(new Set());
    setError(null);
  };

  const loadCourses = async () => {
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

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    if (!title.trim()) return setError('Donne un nom à l’examen.');
    if (!examDate) return setError('Choisis la date de l’examen.');
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/exams`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), exam_date: examDate, course_ids: [...selected] }),
      });
      onCreated(await readJsonOrThrow<Exam>(res, 'Enregistrement impossible.'));
      reset();
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onShow={() => {
        reset();
        loadCourses();
      }}
      onRequestClose={() => !saving && onClose()}
    >
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheetHeader, { paddingTop: top }]}>
          <TouchableOpacity style={styles.iconButton} onPress={onClose} disabled={saving} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.sheetTitle} accessibilityRole="header">Nouvel examen</Text>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 110 }]} keyboardShouldPersistTaps="handled">
          {!!error && (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Nom de l’examen</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            placeholder="Ex. Partiel de cardiologie"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            accessibilityLabel="Nom de l’examen"
          />

          <Text style={styles.label}>Date</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setPickingDate(true)} accessibilityRole="button">
            <Ionicons name="calendar-outline" size={20} color={colors.primaryDark} />
            <Text style={[styles.dateText, !examDate && { color: colors.textSecondary }]}>
              {examDate ? formatLongDate(examDate) : 'Choisir une date'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Cours à réviser en priorité</Text>
          {courses === null ? (
            <ActivityIndicator color={colors.primaryDark} accessibilityLabel="Chargement des cours" />
          ) : courses.length === 0 ? (
            <Text style={styles.noCourse}>Importe d’abord un cours pour le lier à l’examen.</Text>
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
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.actionBar, { paddingBottom: bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabled]}
            onPress={save}
            disabled={saving}
            accessibilityRole="button"
            accessibilityState={{ busy: saving }}
          >
            {saving ? <ActivityIndicator color={colors.onAction} /> : <Text style={styles.primaryText}>Enregistrer l’examen</Text>}
          </TouchableOpacity>
        </View>

        <DatePickerSheet
          visible={pickingDate}
          title="Date de l’examen"
          value={examDate}
          onCancel={() => setPickingDate(false)}
          onConfirm={(iso) => {
            setExamDate(iso);
            setPickingDate(false);
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      gap: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
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
    loader: {
      marginTop: 32,
    },
    empty: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    sectionLabel: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    card: {
      gap: 6,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cardPast: {
      opacity: 0.6,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    countdown: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.tintPrimary,
    },
    countdownSoon: {
      backgroundColor: colors.tintWarning,
    },
    countdownPast: {
      backgroundColor: colors.surfaceAlt,
    },
    countdownText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primaryText,
    },
    countdownTextSoon: {
      color: colors.warningText,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    examTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    examDate: {
      fontSize: 14,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
    },
    chip: {
      maxWidth: '100%',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    noCourse: {
      fontSize: 14,
      color: colors.textSecondary,
    },
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
    primaryButton: {
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
    disabled: {
      opacity: 0.6,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 12,
      marginBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    input: {
      minHeight: 52,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      fontSize: 16,
      color: colors.textPrimary,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dateText: {
      fontSize: 16,
      color: colors.textPrimary,
      textTransform: 'capitalize',
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
