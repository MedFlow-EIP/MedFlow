import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { PathCard } from '../../components/PathCard';
import { Path } from '../../types';
import { getAuth } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/services/api';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '@/utils/authHeaders';
import { useScreenInsets } from '../navigation/constants';

interface HomeScreenProps {
  navigation: any;
  route: any;
}

export function HomeScreen({ navigation, route }: HomeScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, tabBarHeight } = useScreenInsets();

  const [paths, setPaths] = useState<Path[]>([]);
  const [streak, setStreak] = useState<number | null>(null);
  const [nextLessonTitle, setNextLessonTitle] = useState<string | undefined>();

  const user = getAuth().currentUser;
  const firstName = user?.displayName?.split(' ')[0] || 'Médecin';

  useEffect(() => {
    if (Array.isArray(route.params?.updatedPaths)) {
      setPaths(route.params.updatedPaths);
    }
  }, [route.params?.updatedPaths]);

  useFocusEffect(
    useCallback(() => {
      const loadPaths = async () => {
        if (!user) return;
        try {
          const res = await fetch(`${API_URL}/api/paths`, {
            headers: await getAuthHeaders(user),
          });
          const data = await res.json();
          setPaths(Array.isArray(data.paths) ? data.paths : []);
        } catch (err) {
          console.error(err);
        }
      };
      const loadStreak = async () => {
        if (!user) return;
        try {
          const res = await fetch(`${API_URL}/api/account`, {
            headers: await getAuthHeaders(user),
          });
          const data = await res.json();
          setStreak(typeof data?.stats?.streak === 'number' ? data.stats.streak : null);
        } catch (err) {
          console.error(err);
        }
      };
      loadPaths().then(loadStreak);
    }, [user])
  );

  // Parcours en cours = premier parcours débloqué non terminé : il devient la carte héros.
  const heroPath = paths.find((p) => !p.isLocked && p.progress < 100);

  useEffect(() => {
    if (!user || !heroPath) {
      setNextLessonTitle(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/lessons/${heroPath.id}`, {
          headers: await getAuthHeaders(user),
        });
        const data = await res.json();
        const next = Array.isArray(data?.lessons)
          ? data.lessons.find((l: any) => l.status === 'available')
          : undefined;
        if (!cancelled) setNextLessonTitle(next?.title);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, heroPath?.id]);

  const handlePathPress = (path: Path) => {
    if (!path.isLocked) {
      navigation.navigate('Path', { path });
    }
  };

  // Condition de déblocage explicite : le parcours précédent doit être terminé.
  const unlockHintFor = (index: number) => {
    const previous = paths[index - 1];
    return previous ? `Termine ${previous.title} pour débloquer` : undefined;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: top, paddingBottom: tabBarHeight + 24 }]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting} accessibilityRole="header">
              {`Bonjour, ${firstName}`}
            </Text>
            <Text style={styles.subtitle}>Prêt pour ta session du jour ?</Text>
          </View>
          {streak !== null && (
            <View
              style={styles.streakChip}
              accessible
              accessibilityLabel={`Série de ${streak} jour${streak > 1 ? 's' : ''}`}
            >
              <Ionicons name="flame" size={16} color={colors.warningText} />
              <Text style={styles.streakText}>{streak} j</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Parcours d'apprentissage
        </Text>

        {paths.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyStateTitle}>Aucun parcours</Text>
            <Text style={styles.emptyStateText}>
              Commencez par importer un cours ou créer votre premier parcours
            </Text>
          </View>
        ) : (
          paths.map((path, index) => (
            <PathCard
              key={path.id}
              {...path}
              index={index}
              isHero={path.id === heroPath?.id}
              nextLessonTitle={path.id === heroPath?.id ? nextLessonTitle : undefined}
              unlockHint={path.isLocked ? unlockHintFor(index) : undefined}
              onPress={() => handlePathPress(path)}
            />
          ))
        )}
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

    scrollContent: {
      paddingHorizontal: 20,
      gap: 20,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },

    headerText: {
      flex: 1,
      gap: 4,
    },

    greeting: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
    },

    streakChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.tintWarning,
    },

    streakText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.warningText,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    emptyState: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },

    emptyStateTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    emptyStateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}
