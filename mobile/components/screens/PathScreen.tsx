import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LessonNode } from '../../components/LessonNode';
import { Lesson, Path } from '../../types';
import { getAuth } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';

interface PathScreenProps {
  route: any;
  navigation: any;
}

type Stats = {
  xp: number;
  streak: number;
};

export function PathScreen({ route, navigation }: PathScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { path }: { path: Path } = route.params;

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const user = getAuth().currentUser;

  const loadStats = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/account`, {
        headers: await getAuthHeaders(user),
      });
      const data = await res.json();
      setStats({
        xp: data?.stats?.xp ?? 0,
        streak: data?.stats?.streak ?? 0,
      });
    } catch (err) {
      console.error('Erreur chargement stats:', err);
    }
  };

  const loadLessons = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/lessons/${path.id}`, {
        headers: await getAuthHeaders(user),
      });
      const data = await res.json();
      setLessons(data.lessons);
    } catch (err) {
      console.error(err);
    }
  };

  const loadPathsForHome = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/paths`, {
        headers: await getAuthHeaders(user),
      });
      const data = await res.json();
      navigation.getParent()?.setParams({ updatedPaths: data.paths });
    } catch (err) {
      console.error(err);
    }
  };

  // Se rafraîchit à chaque fois qu'on revient sur cet écran — notamment au
  // retour de LessonScreen une fois une leçon réellement terminée (la
  // complétion ne se fait plus au tap, mais à la fin de la leçon).
  useFocusEffect(
    useCallback(() => {
      loadLessons();
      loadStats();
      loadPathsForHome();
    }, [path, user])
  );

  // Dérivé de `lessons` (rafraîchi à chaque focus), pas de `path` qui vient
  // de route.params et reste figé à l'état du moment où on est arrivé sur
  // cet écran — sinon le niveau affiché ne bouge jamais après une leçon.
  const completedCount = lessons.filter((l) => l.status === 'completed').length;

  const handleLessonPress = (lesson: Lesson) => {
    if (lesson.status !== 'locked') {
      navigation.navigate('Lesson', { path, lesson });
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: path.color + '15' }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Ionicons name="star" size={14} color={colors.primary} />
              <Text style={styles.statBadgeText}>{stats.xp} XP</Text>
            </View>
            <View style={styles.statBadge}>
              <Ionicons name="flame" size={14} color={colors.warning} />
              <Text style={styles.statBadgeText}>{stats.streak}j</Text>
            </View>
          </View>
        )}

        <View style={styles.headerContent}>
          <Text style={styles.levelText}>Niveau {completedCount + 1}</Text>
          <Text style={styles.pathTitle}>{path.title}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.pathContainer}>
          <View style={styles.connectingLine} />

          {lessons.map((lesson) => (
            <View key={lesson.id} style={styles.lessonWrapper}>
              <LessonNode
                {...lesson}
                color={path.color}
                onPress={() => handleLessonPress(lesson)}
              />
            </View>
          ))}
        </View>
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
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerContent: {
      alignItems: 'center',
    },
    levelText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    pathTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingVertical: 32,
      paddingBottom: 100,
    },
    pathContainer: {
      position: 'relative',
      paddingHorizontal: 20,
    },
    connectingLine: {
      position: 'absolute',
      left: '50%',
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: colors.border,
      marginLeft: -1.5,
      zIndex: -1,
    },
    lessonWrapper: {
      marginBottom: 32,
      alignItems: 'center',
    },
    headerLeft: {
      position: 'absolute',
      left: 20,
      top: 60,
      zIndex: 2,
    },
    statsRow: {
      position: 'absolute',
      right: 20,
      top: 58,
      zIndex: 2,
      flexDirection: 'row',
      gap: 8,
    },
    statBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 1,
    },
    statBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
}