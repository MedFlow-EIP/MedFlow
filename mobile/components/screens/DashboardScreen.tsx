import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { getAuthHeaders } from '../../utils/authHeaders';
import { scheduleRevisionReminder } from '../../utils/revisionNotifications';
import { API_URL } from '@/services/api';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { OfflineBanner } from '../course/OfflineBanner';
import { useScreenInsets } from '../navigation/constants';
import {
  DASHBOARD_CACHE_NAME,
  courseCacheName,
  readOffline,
  removeOffline,
  saveOffline,
} from '../../utils/offlineCache';
import { appAlert } from '../../utils/appAlert';
import { countdownLabel, syncExamReminders } from '../../utils/examReminders';
import { flushRevisionQueue } from '../../utils/offlineRevision';
import type { Exam } from './ExamsScreen';
import { formatLongDate } from '../ui/DatePickerSheet';

type Stats = {
  totalCourses: number;
  totalFlashcards: number;
  totalSessions: number;
  avgScore: number | null;
};

type CourseSummary = {
  id: string;
  nom: string;
  flashcards?: number;
  quiz?: number;
  created_at?: string;
  tags?: string[];
};

type DueItem = { course_id: string; course_nom: string };

type ForecastDay = {
  date: string;
  count: number;
  /** Détail par cours (API /api/revision/forecast). */
  courses?: { course_id: string; course_nom: string; count: number }[];
};

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BAR_MAX_HEIGHT = 84;

const formatShortDate = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

export function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, tabBarHeight } = useScreenInsets();
  const courseDotColors = [colors.primaryDark, colors.warning, colors.secondary, colors.success, colors.danger];

  const user = auth.currentUser;
  const navigation = useNavigation<Nav>();
  const [courses, setCourses] = useState<CourseSummary[]>([]);

  const [stats, setStats] = useState<Stats>({
    totalCourses: 0,
    totalFlashcards: 0,
    totalSessions: 0,
    avgScore: null,
  });
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [dueToday, setDueToday] = useState<DueItem[]>([]);
  const [offline, setOffline] = useState(false);
  const [nextExam, setNextExam] = useState<Exam | null>(null);
  // Filtre « Mes cours » par spécialité (null = tous).
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const applyDashboard = (data: any) => {
    if (Array.isArray(data?.cours)) {
      setCourses(data.cours);
    }
    if (data?.stats) {
      setStats({
        totalCourses: data.stats.cours ?? 0,
        totalFlashcards: data.stats.flashcards ?? 0,
        totalSessions: data.stats.sessions ?? 0,
        avgScore: data.stats.detailed_sessions?.avg_score ?? null,
      });
    }
  };

  // Télécharge en arrière-plan le contenu de chaque cours pour qu'il reste
  // consultable hors ligne, même s'il n'a jamais été ouvert.
  const prefetchCourses = async (user: NonNullable<typeof auth.currentUser>, list: CourseSummary[]) => {
    for (const course of list) {
      try {
        const res = await fetch(`${API_URL}/api/course/${course.id}`, {
          headers: await getAuthHeaders(user),
        });
        if (res.ok) await saveOffline(user.uid, courseCacheName(course.id), await res.json());
      } catch {
        return; // réseau perdu : on réessaiera au prochain affichage
      }
    }
  };

  const loadCourses = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/dashboard?per_page=100`, {
        headers: await getAuthHeaders(user),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyDashboard(data);
      setOffline(false);
      saveOffline(user.uid, DASHBOARD_CACHE_NAME, data);
      // Réponses données hors ligne : envoyées dès que le réseau revient.
      flushRevisionQueue(user).catch(() => {});
      if (Array.isArray(data.cours)) prefetchCourses(user, data.cours);

      // Récupère la prévision (7 jours) une seule fois : sert à la fois à
      // l'affichage et à rafraîchir le rappel de notification — best-effort,
      // ne doit jamais faire échouer le chargement du reste du Dashboard.
      try {
        const forecastRes = await fetch(`${API_URL}/api/revision/forecast?days=7`, {
          headers: await getAuthHeaders(user),
        });
        const forecastData = await forecastRes.json();
        const days = Array.isArray(forecastData?.forecast) ? forecastData.forecast : [];
        setForecast(days);
        const dueTodayCount = days[0]?.count ?? 0;
        await scheduleRevisionReminder(dueTodayCount);
      } catch {
        // Silencieux : la prévision n'est pas critique pour l'écran.
      }

      // Prochain examen (et rappels à jour) : best-effort aussi.
      try {
        const examsRes = await fetch(`${API_URL}/api/exams`, { headers: await getAuthHeaders(user) });
        const examsData = await examsRes.json();
        const exams: Exam[] = Array.isArray(examsData?.exams) ? examsData.exams : [];
        setNextExam(exams.find((e) => e.days_left >= 0) ?? null);
        syncExamReminders(exams);
      } catch {
        // Silencieux : la carte examen n'est pas critique.
      }

      // Cartes dues aujourd'hui, regroupées par cours sous le graphique.
      try {
        const dueRes = await fetch(`${API_URL}/api/revision/due`, {
          headers: await getAuthHeaders(user),
        });
        const dueData = await dueRes.json();
        setDueToday(Array.isArray(dueData?.items) ? dueData.items : []);
      } catch {
        // Silencieux : le détail du jour est un bonus.
      }
    } catch (e) {
      // Hors ligne : on affiche la dernière liste de cours connue.
      const cached = await readOffline<any>(user.uid, DASHBOARD_CACHE_NAME);
      if (cached) {
        applyDashboard(cached);
        setOffline(true);
      } else {
        console.error(e);
      }
    }
  };

  const deleteCourse = async (courseId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/course/${courseId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(user),
      });

      setCourses((prev) => prev.filter((c) => c.id !== courseId));
      removeOffline(user.uid, courseCacheName(courseId));
    } catch (e) {
      console.error(e);
    }
  };

  const confirmDeleteCourse = (course: CourseSummary) => {
    appAlert('Supprimer le cours', `« ${course.nom} » et ses flashcards seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteCourse(course.id) },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      const user = auth.currentUser;
      if (!user) return;
      loadCourses();
    }, [user])
  );

  const dueByCourse = useMemo(() => {
    const groups = new Map<string, { id: string; nom: string; count: number }>();
    for (const item of dueToday) {
      const group = groups.get(item.course_id) ?? { id: item.course_id, nom: item.course_nom, count: 0 };
      group.count += 1;
      groups.set(item.course_id, group);
    }
    return [...groups.values()];
  }, [dueToday]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textPrimary }}>Aucun utilisateur connecté</Text>
      </View>
    );
  }

  const maxCount = Math.max(1, ...forecast.map((d) => d.count));
  const dayLabel = (date: string, idx: number) =>
    idx === 0
      ? 'Auj.'
      : new Date(date + 'T12:00:00')
          .toLocaleDateString('fr-FR', { weekday: 'short' })
          .replace('.', '')
          .replace(/^./, (c) => c.toUpperCase());
  const selected = forecast[selectedDay];
  // Aujourd'hui : cartes dues réelles (nouvelles cartes incluses). Jours à venir : prévision SM-2 par cours.
  const selectedGroups =
    selectedDay === 0
      ? dueByCourse
      : (selected?.courses ?? []).map((c) => ({ id: c.course_id, nom: c.course_nom, count: c.count }));

  const kpis = [
    { icon: 'document-text-outline' as const, color: colors.primaryDark, value: String(stats.totalCourses), label: 'Cours' },
    { icon: 'layers-outline' as const, color: colors.secondary, value: String(stats.totalFlashcards), label: 'Flashcards' },
    { icon: 'school-outline' as const, color: colors.success, value: String(stats.totalSessions), label: 'Sessions' },
    {
      icon: 'trending-up-outline' as const,
      color: colors.warning,
      value: stats.avgScore !== null ? `${Math.round(stats.avgScore)} %` : '—',
      label: 'Score',
    },
  ];

  const allTags = [...new Set(courses.flatMap((c) => c.tags ?? []))].sort((a, b) => a.localeCompare(b, 'fr'));
  const visibleCourses = tagFilter ? courses.filter((c) => c.tags?.includes(tagFilter)) : courses;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: tabBarHeight + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header">Statistiques</Text>
            <Text style={styles.subtitle}>Ta progression en un coup d’œil</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Search')}
            accessibilityRole="button"
            accessibilityLabel="Rechercher"
          >
            <Ionicons name="search-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Progress')}
            accessibilityRole="button"
            accessibilityLabel="Statistiques avancées"
          >
            <Ionicons name="trending-up-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {offline && <OfflineBanner />}

        <View style={styles.kpiRow}>
          {kpis.map((kpi) => (
            <View key={kpi.label} style={styles.kpi} accessible accessibilityLabel={`${kpi.label} : ${kpi.value}`}>
              <Ionicons name={kpi.icon} size={20} color={kpi.color} />
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.reviseButton}
          onPress={() => navigation.navigate('Revision')}
          accessibilityRole="button"
          accessibilityLabel="Lancer une session de révision"
        >
          <Ionicons name="flash-outline" size={20} color={colors.onAction} />
          <Text style={styles.reviseButtonText}>Réviser maintenant</Text>
        </TouchableOpacity>

        <View style={styles.secondaryButtonsRow}>
          <TouchableOpacity
            style={[styles.secondaryChip, { backgroundColor: colors.tintWarning }]}
            onPress={() => navigation.navigate('Revision', { startMode: 'leeches' })}
            accessibilityRole="button"
            accessibilityLabel="Revoir les cartes difficiles"
          >
            <Ionicons name="warning-outline" size={16} color={colors.warningText} />
            <Text style={[styles.secondaryChipText, { color: colors.warningText }]}>Cartes difficiles</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryChip, { backgroundColor: colors.tintSuccess }]}
            onPress={() => navigation.navigate('Mastered')}
            accessibilityRole="button"
            accessibilityLabel="Voir les cartes maîtrisées"
          >
            <Ionicons name="trophy-outline" size={16} color={colors.successText} />
            <Text style={[styles.secondaryChipText, { color: colors.successText }]}>Cartes maîtrisées</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.mockExamButton}
          onPress={() => navigation.navigate('MockExam')}
          accessibilityRole="button"
          accessibilityLabel="Lancer un examen blanc"
        >
          <Ionicons name="timer-outline" size={20} color={colors.primaryText} />
          <Text style={styles.mockExamText}>Examen blanc</Text>
          <Text style={styles.mockExamHint}>chronométré, noté sur 20</Text>
        </TouchableOpacity>

        {/* Prochain examen : ses cours passent en priorité dans les révisions. */}
        <TouchableOpacity
          style={styles.examCard}
          onPress={() => navigation.navigate('Exams')}
          accessibilityRole="button"
          accessibilityLabel={
            nextExam
              ? `Prochain examen : ${nextExam.title}, ${countdownLabel(nextExam.days_left)}`
              : 'Ajouter mes examens'
          }
        >
          <View style={styles.examIcon}>
            <Ionicons name="calendar" size={20} color={colors.primaryDark} />
          </View>
          <View style={styles.examText}>
            {nextExam ? (
              <>
                <Text style={styles.examTitle} numberOfLines={1}>{nextExam.title}</Text>
                <Text style={styles.examMeta} numberOfLines={1}>
                  {formatLongDate(nextExam.exam_date)} · cours prioritaires en révision
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.examTitle}>Mes examens</Text>
                <Text style={styles.examMeta}>Ajoute tes partiels pour réviser les bons cours en premier</Text>
              </>
            )}
          </View>
          {nextExam ? (
            <View style={[styles.examBadge, nextExam.days_left <= 7 && { backgroundColor: colors.tintWarning }]}>
              <Text style={[styles.examBadgeText, nextExam.days_left <= 7 && { color: colors.warningText }]}>
                {countdownLabel(nextExam.days_left)}
              </Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {forecast.length > 0 && (
          <View style={styles.forecastCard}>
            <View style={styles.forecastHeader}>
              <Text style={styles.forecastTitle}>À réviser cette semaine</Text>
              <Text style={styles.forecastHint}>Touche un jour</Text>
            </View>

            <View style={styles.forecastRow}>
              {forecast.map((day, idx) => {
                const isSelected = idx === selectedDay;
                const barHeight = day.count === 0 ? 6 : Math.max(14, (day.count / maxCount) * BAR_MAX_HEIGHT);
                const label = dayLabel(day.date, idx);
                return (
                  <TouchableOpacity
                    key={day.date}
                    style={styles.forecastDay}
                    onPress={() => setSelectedDay(idx)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${label} : ${plural(day.count, 'carte')} à réviser`}
                  >
                    <Text style={[styles.forecastCount, isSelected && { color: colors.primaryText }]}>{day.count}</Text>
                    <View
                      style={[
                        styles.forecastBar,
                        {
                          height: barHeight,
                          backgroundColor:
                            day.count === 0 ? colors.border : isSelected ? colors.primaryDark : colors.tintPrimaryStrong,
                        },
                      ]}
                    />
                    <Text style={[styles.forecastDayLabel, isSelected && styles.forecastDayLabelSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selected && (
              <>
                <View style={styles.separator} />
                <Text style={styles.dayTitle}>
                  {selectedDay === 0 ? 'Aujourd’hui' : dayLabel(selected.date, selectedDay)} · {plural(selected.count, 'carte')}
                </Text>
                {selectedGroups.length === 0 ? (
                  <Text style={styles.dayHint}>Rien de prévu ce jour-là.</Text>
                ) : (
                  selectedGroups.map((group, i) => (
                    <TouchableOpacity
                      key={group.id}
                      style={styles.dueRow}
                      // Jour à venir : entraînement libre, sans avancer le planning de répétition.
                      onPress={() =>
                        navigation.navigate(
                          'Revision',
                          selectedDay === 0 ? { courseId: group.id } : { courseId: group.id, startMode: 'practice' }
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${selectedDay === 0 ? 'Réviser' : 'S’entraîner sur'} ${group.nom}, ${plural(group.count, 'carte')}`}
                    >
                      <View style={[styles.dueDot, { backgroundColor: courseDotColors[i % courseDotColors.length] }]} />
                      <Text style={styles.dueName}>{group.nom}</Text>
                      <Text style={styles.dueCount}>{plural(group.count, 'carte')}</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))
                )}
                {selectedDay !== 0 && selectedGroups.length > 0 && (
                  <Text style={styles.dayHint}>Touche un cours pour t’entraîner dessus en avance.</Text>
                )}
              </>
            )}
          </View>
        )}

        <View style={styles.coursesHeader}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Mes cours</Text>
          <Text style={styles.coursesCount}>{plural(courses.length, 'cours importé')}</Text>
        </View>

        {allTags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagFilters}
            accessibilityRole="tablist"
          >
            {[null, ...allTags].map((tag) => {
              const active = tagFilter === tag;
              return (
                <TouchableOpacity
                  key={tag ?? '__all'}
                  style={[styles.tagFilter, active && styles.tagFilterActive]}
                  onPress={() => setTagFilter(tag)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tagFilterText, active && styles.tagFilterTextActive]}>{tag ?? 'Tous'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {courses.length === 0 ? (
          <Text style={styles.emptyText}>Aucun cours importé</Text>
        ) : visibleCourses.length === 0 ? (
          <Text style={styles.emptyText}>Aucun cours dans cette spécialité</Text>
        ) : (
          visibleCourses.map((course) => {
            const meta = [
              course.tags?.length ? course.tags.join(', ') : '',
              course.flashcards !== undefined ? plural(course.flashcards, 'flashcard') : '',
              course.quiz ? '1 quiz' : '',
              formatShortDate(course.created_at),
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <View key={course.id} style={styles.courseCard}>
                <TouchableOpacity
                  style={styles.courseMain}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${course.nom}, ${meta}`}
                  onPress={() => navigation.navigate('CourseDetail', { courseId: course.id })}
                >
                  <View style={styles.courseIcon}>
                    <Ionicons name="document-text" size={22} color={colors.primaryDark} />
                  </View>
                  <View style={styles.courseText}>
                    <Text style={styles.courseTitle} numberOfLines={2}>{course.nom}</Text>
                    <Text style={styles.courseMeta}>{meta}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDeleteCourse(course)}
                  style={styles.deleteBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer le cours ${course.nom}`}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={styles.importButton}
          onPress={() => navigation.navigate('UploadCourse')}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color={colors.primaryText} />
          <Text style={styles.importButtonText}>Importer un PDF</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
      gap: 20,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    headerText: {
      flex: 1,
      gap: 4,
    },

    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    kpiRow: {
      flexDirection: 'row',
      gap: 10,
    },

    kpi: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 6,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    kpiValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    kpiLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },

    reviseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.action,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 14,
    },

    reviseButtonText: {
      color: colors.onAction,
      fontSize: 16,
      fontWeight: '600',
    },

    secondaryButtonsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: -8,
    },

    secondaryChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 44,
      borderRadius: 12,
    },

    tagFilters: {
      gap: 8,
      paddingRight: 8,
    },
    tagFilter: {
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tagFilterActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.tintPrimary,
    },
    tagFilterText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    tagFilterTextActive: {
      fontWeight: '600',
      color: colors.primaryText,
    },
    mockExamButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.primaryDark,
      backgroundColor: colors.surface,
    },
    mockExamText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
    },
    mockExamHint: {
      flex: 1,
      textAlign: 'right',
      fontSize: 13,
      color: colors.textSecondary,
    },
    examCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    examIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    examText: {
      flex: 1,
      gap: 2,
    },
    examTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    examMeta: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    examBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.tintPrimary,
    },
    examBadgeText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primaryText,
    },
    secondaryChipText: {
      fontSize: 13,
      fontWeight: '600',
    },

    forecastCard: {
      gap: 16,
      padding: 20,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    forecastHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    forecastTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    forecastHint: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },

    forecastRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },

    forecastDay: {
      alignItems: 'center',
      gap: 6,
      minWidth: 40,
    },

    forecastCount: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    forecastBar: {
      width: 28,
      borderRadius: 8,
    },

    forecastDayLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },

    forecastDayLabelSelected: {
      fontWeight: '700',
      color: colors.primaryText,
    },

    separator: {
      height: 1,
      backgroundColor: colors.border,
    },

    dayTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    dayHint: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    dueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      marginTop: -6,
    },

    dueDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },

    dueName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
    },

    dueCount: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    coursesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: -8,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    coursesCount: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },

    courseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 14,
      paddingRight: 8,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginTop: -8,
    },

    courseMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },

    courseIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    courseText: {
      flex: 1,
      gap: 3,
    },

    courseTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    courseMeta: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    // Zone tactile 44 px pour la suppression.
    deleteBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyText: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 14,
    },

    importButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: colors.tintPrimary,
      marginTop: -8,
    },

    importButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
    },
  });
}
