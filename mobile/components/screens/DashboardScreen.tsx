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
import { API_URL } from '@/services/api';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

type Stats = {
  minutesToday: number;
  streak: number;
  avgScore: number;
  lessonsCompleted: number;
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
    minutesToday: 0,
    streak: 0,
    avgScore: 0,
    lessonsCompleted: 0,
  });

  const loadCourses = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/dashboard`, {
        headers: {
          'X-User-UID': user.uid,
          'X-User-Name': user.displayName ?? '',
          'X-User-Avatar': user.photoURL ?? '',
        },
      });

      const data = await res.json();
      if (Array.isArray(data.cours)) {
        setCourses(data.cours);
      }
    } catch (e) {
      console.error(e);
    }
  };

//   const loadStats = async () => {
//     const user = auth.currentUser;
//     if (!user) return;
//     try {
//       const res = await fetch(`${API_URL}/api/account`, {
//         headers: {
//           'X-User-UID': user.uid,
//         },
//       });

//       const data = await res.json();

//       setStats({
//         minutesToday: data.stats.today_minutes || 0,
//         streak: data.stats.sessions || 0,
//         avgScore: data.stats.avg_score || 0,
//         lessonsCompleted: data.stats.total_lessons || 0,
//       });
//     } catch (err) {
//       console.error(err);
//     }
// };

  const handleDeleteCourse = async (courseId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/course/${courseId}`, {
        method: 'DELETE',
        headers: {
          'X-User-UID': user.uid,
        },
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

      {/* <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Statistiques rapides</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="time-outline" size={28} color="#3b82f6" />
              <Text style={styles.statNumber}>{stats.minutesToday}</Text>
              <Text style={styles.statLabel}>Minutes aujourd'hui</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="flame-outline" size={28} color="#10b981" />
              <Text style={styles.statNumber}>{stats.streak}</Text>
              <Text style={styles.statLabel}>Jours de série</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="star-outline" size={28} color="#f59e0b" />
              <Text style={styles.statNumber}>{stats.avgScore}%</Text>
              <Text style={styles.statLabel}>Score moyen</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#fef2f2' }]}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#ef4444" />
              <Text style={styles.statNumber}>{stats.lessonsCompleted}</Text>
              <Text style={styles.statLabel}>Leçons terminées</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Focus du jour</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Modifier</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.focusCard}>
            <View style={styles.focusHeader}>
              <View style={[styles.focusIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="heart-outline" size={24} color="#3b82f6" />
              </View>
              <View style={styles.focusTitleContainer}>
                <Text style={styles.focusTitle}>Cardiologie</Text>
                <Text style={styles.focusSubtitle}>Système cardiovasculaire</Text>
              </View>
              <TouchableOpacity style={styles.playButton}>
                <Ionicons name="play" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '65%' }]} />
              </View>
              <Text style={styles.progressText}>65% complété</Text>
            </View>
            
            <Text style={styles.focusDescription}>
              Révision des pathologies cardiaques et médicaments associés
            </Text>
            
            <View style={styles.focusActions}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="document-text-outline" size={18} color="#3b82f6" />
                <Text style={styles.actionText}>Flashcards</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="help-circle-outline" size={18} color="#3b82f6" />
                <Text style={styles.actionText}>Quiz</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="time-outline" size={18} color="#3b82f6" />
                <Text style={styles.actionText}>Révision</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Activité récente</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Quiz Anatomie terminé</Text>
                <Text style={styles.activityTime}>Il y a 2 heures • Score: 85%</Text>
              </View>
              <Text style={styles.activityScore}>+50 XP</Text>
            </View>
            
            <View style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="flame" size={20} color="#f59e0b" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Série de 7 jours</Text>
                <Text style={styles.activityTime}>Continuez pour débloquer un badge</Text>
              </View>
              <Text style={styles.activityScore}>🔥</Text>
            </View>
            
            <View style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="book" size={20} color="#3b82f6" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Nouvelle leçon disponible</Text>
                <Text style={styles.activityTime}>Pharmacologie - Médicaments</Text>
              </View>
              <TouchableOpacity style={styles.startButton}>
                <Text style={styles.startButtonText}>Commencer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Actions rapides</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="add-circle" size={32} color="#0ea5e9" />
              </View>
              <Text style={styles.actionCardTitle}>Nouveau cours</Text>
              <Text style={styles.actionCardDesc}>Importer un PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="refresh" size={32} color="#10b981" />
              </View>
              <Text style={styles.actionCardTitle}>Révision flash</Text>
              <Text style={styles.actionCardDesc}>10 cartes aléatoires</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="trophy" size={32} color="#f59e0b" />
              </View>
              <Text style={styles.actionCardTitle}>Mes badges</Text>
              <Text style={styles.actionCardDesc}>5 nouveaux débloqués</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#fae8ff' }]}>
                <Ionicons name="stats-chart" size={32} color="#d946ef" />
              </View>
              <Text style={styles.actionCardTitle}>Statistiques</Text>
              <Text style={styles.actionCardDesc}>Voir détaillé</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.quoteCard}>
          <Ionicons name="sparkles" size={28} color="#8b5cf6" style={styles.quoteIcon} />
          <Text style={styles.quoteText}>
            "La répétition est la mère de l'apprentissage."
          </Text>
          <Text style={styles.quoteAuthor}>— Proverbe latin</Text>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView> */}
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

    scrollView: {
      flex: 1,
    },

    scrollContent: {
      padding: 20,
    },

    section: {
      marginBottom: 24,
    },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },

    sectionTitle: {
      marginLeft: 10,
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    seeAllText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },

    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },

    statCard: {
      flex: 1,
      minWidth: '48%',
      padding: 16,
      borderRadius: 16,
      alignItems: 'center',
      marginBottom: 12,
    },

    statNumber: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 8,
      marginBottom: 4,
    },

    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    focusCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },

    focusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },

    focusIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    focusTitleContainer: {
      flex: 1,
    },

    focusTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    focusSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },

    playButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    progressContainer: {
      marginBottom: 16,
    },

    progressBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },

    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
    },

    progressText: {
      fontSize: 12,
      color: colors.textSecondary,
    },

    focusDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },

    focusActions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
    },

    actionButton: {
      alignItems: 'center',
    },

    actionText: {
      fontSize: 12,
      color: colors.primary,
      marginTop: 4,
      fontWeight: '500',
    },

    activityList: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },

    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    activityIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    activityContent: {
      flex: 1,
    },

    activityTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },

    activityTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },

    activityScore: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.success,
    },

    startButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },

    startButtonText: {
      color: colors.onAccent,
      fontSize: 12,
      fontWeight: '600',
    },

    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },

    actionCard: {
      flex: 1,
      minWidth: '48%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },

    actionIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },

    actionCardTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 4,
    },

    actionCardDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    quoteCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 24,
    },

    quoteIcon: {
      marginBottom: 12,
    },

    quoteText: {
      fontSize: 16,
      fontStyle: 'italic',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 8,
    },

    quoteAuthor: {
      fontSize: 14,
      color: colors.muted,
      fontStyle: 'italic',
    },

    bottomSpacing: {
      height: 20,
    },

    courseSection: {
      marginBottom: 24,
      marginTop: 20,
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
  });
}