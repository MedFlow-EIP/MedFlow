import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { LessonNode, LESSON_NODE_WIDTH, lessonNodeSize } from '../../components/LessonNode';
import { Lesson, Path } from '../../types';
import { getAuth } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { useScreenInsets } from '../navigation/constants';

interface PathScreenProps {
  route: any;
  navigation: any;
}

type Stats = {
  xp: number;
  streak: number;
};

// Géométrie du zigzag : 2 colonnes fixes de part et d'autre du centre, et un
// tracé courbe qui passe par le centre de chaque nœud (plus de ligne cassée).
const COLUMN_OFFSET = 65;
const ROW_HEIGHT = 180;
const FIRST_CENTER_Y = 70;
const CURVE = 100;

export function PathScreen({ route, navigation }: PathScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const { top, bottom } = useScreenInsets();

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
  const safeLessons = Array.isArray(lessons) ? lessons : [];
  const completedCount = safeLessons.filter((l) => l.status === 'completed').length;

  const handleLessonPress = (lesson: Lesson) => {
    if (lesson.status !== 'locked') {
      navigation.navigate('Lesson', { path, lesson });
    }
  };

  const centers = safeLessons.map((_, i) => ({
    x: width / 2 + (i % 2 === 0 ? -COLUMN_OFFSET : COLUMN_OFFSET),
    y: FIRST_CENTER_Y + i * ROW_HEIGHT,
  }));
  const trackHeight = safeLessons.length > 0 ? FIRST_CENTER_Y + (safeLessons.length - 1) * ROW_HEIGHT + 140 : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: top }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>

          {stats && (
            <View style={styles.statsRow}>
              <View style={styles.statChip} accessible accessibilityLabel={`${stats.xp} points d'expérience`}>
                <Ionicons name="star-outline" size={16} color={colors.primaryText} />
                <Text style={[styles.statChipText, { color: colors.primaryText }]}>{stats.xp} XP</Text>
              </View>
              <View style={styles.statChip} accessible accessibilityLabel={`Série de ${stats.streak} jours`}>
                <Ionicons name="flame-outline" size={16} color={colors.warningText} />
                <Text style={[styles.statChipText, { color: colors.warningText }]}>{stats.streak} j</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.levelText}>Niveau {completedCount + 1}</Text>
        <Text style={styles.pathTitle} accessibilityRole="header">{path.title}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 24 }]}
      >
        <View style={{ height: trackHeight }}>
          <Svg width={width} height={trackHeight} style={StyleSheet.absoluteFill}>
            {centers.slice(1).map((to, i) => {
              const from = centers[i];
              const done = safeLessons[i + 1].status !== 'locked';
              return (
                <SvgPath
                  key={i}
                  d={`M${from.x} ${from.y} C${from.x} ${from.y + CURVE} ${to.x} ${to.y - CURVE} ${to.x} ${to.y}`}
                  stroke={done ? '#FFC300' : '#CBD5E1'}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeDasharray={done ? undefined : '0.5 14'}
                  fill="none"
                />
              );
            })}
          </Svg>

          {safeLessons.map((lesson, i) => {
            const half = lessonNodeSize(lesson.status) / 2 + 8;
            return (
              <View
                key={lesson.id}
                style={[
                  styles.node,
                  { left: centers[i].x - LESSON_NODE_WIDTH / 2, top: centers[i].y - half },
                ]}
              >
                <LessonNode {...lesson} onPress={() => handleLessonPress(lesson)} />
              </View>
            );
          })}
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
      backgroundColor: colors.tintPrimary,
      paddingHorizontal: 20,
      paddingBottom: 20,
      gap: 14,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    statChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    statChipText: {
      fontSize: 13,
      fontWeight: '600',
    },
    levelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryText,
    },
    pathTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 24,
    },
    node: {
      position: 'absolute',
    },
  });
}
