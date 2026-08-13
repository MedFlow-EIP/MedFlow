import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { getAuthHeaders } from '../../utils/authHeaders';
import { API_URL } from '@/services/api';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

type Stats = {
  totalCourses: number;
  totalFlashcards: number;
  totalSessions: number;
  avgScore: number | null;
};

type CourseSummary = {
  id: string;
  nom: string;
  // sessions: number;
};

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const user = auth.currentUser;
  const navigation = useNavigation<Nav>();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState<Stats>({
    totalCourses: 0,
    totalFlashcards: 0,
    totalSessions: 0,
    avgScore: null,
  });

  const loadCourses = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/dashboard`, {
        headers: await getAuthHeaders(user),
      });

      const data = await res.json();
      if (Array.isArray(data.cours)) {
        setCourses(data.cours);
      }
      if (data.stats) {
        setStats({
          totalCourses: data.stats.cours ?? 0,
          totalFlashcards: data.stats.flashcards ?? 0,
          totalSessions: data.stats.sessions ?? 0,
          avgScore: data.stats.detailed_sessions?.avg_score ?? null,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/course/${courseId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(user),
      });

      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const user = auth.currentUser;
      if (!user) return;

      const loadAll = async () => {
        setRefreshing(true);
        try {
          await Promise.all([loadCourses()]);
        } catch (e) {
          console.error(e);
        } finally {
          setRefreshing(false);
        }
      };

      loadAll();
    }, [user])
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textPrimary }}>Aucun utilisateur connecté</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title} accessibilityRole="header">Tableau de bord</Text>
          <Text style={styles.subtitle}>Vue d'ensemble de votre apprentissage</Text>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('Progress')}
          accessibilityRole="button"
          accessibilityLabel="Progression"
        >
          <Ionicons name="stats-chart-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        {/* <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="calendar-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View> */}
      </View>

      <View style={styles.statsStrip}>
        <View style={styles.statChip} accessible={true} accessibilityLabel={`${stats.totalCourses} cours`}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <Text style={styles.statChipValue}>{stats.totalCourses}</Text>
          <Text style={styles.statChipLabel}>Cours</Text>
        </View>
        <View style={styles.statChip} accessible={true} accessibilityLabel={`${stats.totalFlashcards} flashcards générées`}>
          <Ionicons name="layers-outline" size={18} color={colors.secondary} />
          <Text style={styles.statChipValue}>{stats.totalFlashcards}</Text>
          <Text style={styles.statChipLabel}>Flashcards</Text>
        </View>
        <View style={styles.statChip} accessible={true} accessibilityLabel={`${stats.totalSessions} sessions d'étude`}>
          <Ionicons name="school-outline" size={18} color={colors.success} />
          <Text style={styles.statChipValue}>{stats.totalSessions}</Text>
          <Text style={styles.statChipLabel}>Sessions</Text>
        </View>
        <View
          style={styles.statChip}
          accessible={true}
          accessibilityLabel={stats.avgScore !== null ? `Score moyen : ${Math.round(stats.avgScore)}%` : 'Score moyen : pas encore de données'}
        >
          <Ionicons name="trending-up-outline" size={18} color={colors.warning} />
          <Text style={styles.statChipValue}>
            {stats.avgScore !== null ? `${Math.round(stats.avgScore)}%` : '—'}
          </Text>
          <Text style={styles.statChipLabel}>Score moyen</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.reviseButton}
        onPress={() => navigation.navigate('Revision')}
        accessibilityRole="button"
        accessibilityLabel="Lancer une session de révision"
      >
        <Ionicons name="flash-outline" size={20} color={colors.onAccent} />
        <Text style={styles.reviseButtonText}>Réviser maintenant</Text>
      </TouchableOpacity>

      <View style={styles.courseSection}>
        <Text style={styles.sectionTitle} accessibilityRole="header">Mes cours</Text>
      </View>

  {courses.length === 0 ? (
  <Text style={styles.emptyText}>Aucun cours importé</Text>
) : (
  courses.map((course) => (
    <View key={course.id} style={styles.courseCardModern}>

      {/* LEFT (cliquable entier) */}
      <TouchableOpacity
        style={styles.courseLeft}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={course.nom}
        onPress={() =>
          navigation.navigate('CourseDetail', {
            courseId: course.id,
          })
        }
      >
        <View style={styles.courseIcon}>
          <Ionicons name="document-text" size={20} color={colors.primary} />
        </View>

        <View>
          <Text style={styles.courseTitle} numberOfLines={1}>
            {course.nom}
          </Text>
          {/* <Text style={styles.courseMeta}>
            {course.sessions || 0} sessions
          </Text> */}
        </View>
      </TouchableOpacity>

      {/* RIGHT actions */}
      <View style={styles.courseActions}>
        <TouchableOpacity
          onPress={() => handleDeleteCourse(course.id)}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel="Supprimer le cours"
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>

    </View>
    
  ))
)}

    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    header: {
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingTop: 25,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },

    headerIcons: {
      flexDirection: 'row',
      gap: 12,
    },

    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },

    courseSection: {
      marginBottom: 24,
      marginTop: 20,
    },

    sectionTitle: {
      marginLeft: 10,
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    statsStrip: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginTop: 16,
      gap: 10,
    },

    statChip: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      gap: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },

    statChipValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    statChipLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    courseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 14,
      borderRadius: 16,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      elevation: 2,
    },

    courseSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },

    courseCardModern: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',

      backgroundColor: colors.surface,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,

      marginBottom: 10,

      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
      gap: 12,
      alignSelf: "center",
      width: "95%",
    },

    courseLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },

    courseIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    courseTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      maxWidth: 200,
    },

    courseMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },

    courseActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    actionBtn: {
      padding: 8,
      borderRadius: 10,
    },

    emptyText: {
      textAlign: 'center',
      color: colors.muted,
      marginTop: 20,
      fontSize: 14,
    },

    reviseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      marginHorizontal: 20,
      marginTop: 16,
      paddingVertical: 14,
      borderRadius: 14,
    },

    reviseButtonText: {
      color: colors.onAccent,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}