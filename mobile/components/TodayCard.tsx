import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { auth } from '../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { getAuthHeaders } from '../utils/authHeaders';
import { countdownLabel } from '../utils/examReminders';
import { DemoCourseButton } from './DemoCourseButton';

type RecentCourse = { id: string; nom: string; created_at?: string };
type NextExam = { title: string; days_left: number };
type Today = {
  questions: number;
  flashcards: number;
  courses: RecentCourse[];
  totalCourses: number;
  exam: NextExam | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

async function getJson(path: string, headers: Record<string, string>) {
  try {
    const res = await fetch(`${API_URL}${path}`, { headers });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Ce que l'étudiant vient faire chaque jour, en tête de l'accueil : réviser
 * les cartes du jour, voir son prochain examen et retrouver ses cours.
 */
export function TodayCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const [today, setToday] = useState<Today | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const user = auth.currentUser;
        if (!user) return;
        const headers = await getAuthHeaders(user);
        const [due, cards, dashboard, exams] = await Promise.all([
          getJson('/api/revision/due', headers),
          getJson('/api/flashcards/due', headers),
          getJson('/api/dashboard?per_page=100', headers),
          getJson('/api/exams', headers),
        ]);
        if (!active || !dashboard) return;
        const courses: RecentCourse[] = Array.isArray(dashboard.cours) ? dashboard.cours : [];
        setToday({
          questions: typeof due?.count === 'number' ? due.count : 0,
          flashcards: typeof cards?.total_due === 'number' ? cards.total_due : 0,
          courses: [...courses].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 3),
          totalCourses: dashboard.stats?.cours ?? courses.length,
          exam: Array.isArray(exams?.exams) ? exams.exams.find((e: NextExam) => e.days_left >= 0) ?? null : null,
        });
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!today) return null;

  // Pas encore de cours : un seul chemin, importer (ou essayer l'exemple).
  if (today.totalCourses === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">Commence ici</Text>
        <Text style={styles.text}>
          Importe un cours (PDF, photo, Word) : l’IA en tire un résumé, des flashcards et des questions.
        </Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => navigation.navigate('UploadCourse')}
          accessibilityRole="button"
        >
          <Ionicons name="cloud-upload-outline" size={20} color={colors.onAction} />
          <Text style={styles.primaryText}>Importer mon premier cours</Text>
        </TouchableOpacity>
        <DemoCourseButton />
      </View>
    );
  }

  const hasQuestions = today.questions > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">Aujourd’hui</Text>

      <TouchableOpacity
        style={[styles.primary, !hasQuestions && styles.primaryDone]}
        onPress={() => navigation.navigate('Revision')}
        accessibilityRole="button"
        accessibilityLabel={
          hasQuestions ? `Réviser, ${plural(today.questions, 'question')} aujourd’hui` : 'Tout est révisé, s’entraîner quand même'
        }
      >
        <Ionicons name={hasQuestions ? 'flash' : 'checkmark-circle'} size={20} color={hasQuestions ? colors.onAction : colors.successText} />
        <Text style={[styles.primaryText, !hasQuestions && { color: colors.successText }]}>
          {hasQuestions ? `Réviser · ${plural(today.questions, 'question')}` : 'Tout est révisé pour aujourd’hui'}
        </Text>
      </TouchableOpacity>

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.chip}
          onPress={() => navigation.navigate('FlashcardReview')}
          accessibilityRole="button"
          accessibilityLabel={`Flashcards, ${plural(today.flashcards, 'carte')} à revoir`}
        >
          <Ionicons name="albums-outline" size={18} color={colors.primaryText} />
          <Text style={styles.chipText}>Flashcards · {today.flashcards}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chip}
          onPress={() => navigation.navigate('Exams')}
          accessibilityRole="button"
          accessibilityLabel={today.exam ? `Prochain examen : ${today.exam.title}, ${countdownLabel(today.exam.days_left)}` : 'Ajouter mes examens'}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primaryText} />
          <Text style={styles.chipText} numberOfLines={1}>
            {today.exam ? `${today.exam.title} · ${countdownLabel(today.exam.days_left)}` : 'Mes examens'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.coursesHeader}>
        <Text style={styles.subtitle}>Mes derniers cours</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs', { screen: 'Dashboard' })}
          accessibilityRole="button"
          accessibilityLabel={`Voir mes ${today.totalCourses} cours`}
          hitSlop={8}
        >
          <Text style={styles.link}>Tout voir ({today.totalCourses})</Text>
        </TouchableOpacity>
      </View>
      {today.courses.map((course) => (
        <TouchableOpacity
          key={course.id}
          style={styles.course}
          onPress={() => navigation.navigate('CourseDetail', { courseId: course.id })}
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir le cours ${course.nom}`}
        >
          <Ionicons name="document-text-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.courseName} numberOfLines={1}>{course.nom}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: 12,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    text: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    primary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: colors.action,
    },
    primaryDone: { backgroundColor: colors.tintSuccess },
    primaryText: { fontSize: 16, fontWeight: '700', color: colors.onAction },
    row: { flexDirection: 'row', gap: 8 },
    chip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: colors.tintPrimary,
    },
    chipText: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: colors.primaryText },
    coursesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    subtitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    link: { fontSize: 14, fontWeight: '600', color: colors.primaryText },
    course: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.background,
    },
    courseName: { flex: 1, fontSize: 15, color: colors.textPrimary },
  });
}
