import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { ProgressDashboard } from '../../components/ProgressDashboard';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';

type ProgressData = {
  totalLessons: number;
  completedLessons: number;
  totalXP: number;
  currentStreak: number;
};

export function ProgressScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation();

  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setError(false);
    try {
      const headers = await getAuthHeaders(user);

      const [accountRes, pathsRes] = await Promise.all([
        fetch(`${API_URL}/api/account`, { headers }),
        fetch(`${API_URL}/api/paths`, { headers }),
      ]);

      if (!accountRes.ok || !pathsRes.ok) {
        throw new Error(`account=${accountRes.status} paths=${pathsRes.status}`);
      }

      const account = await accountRes.json();
      const pathsData = await pathsRes.json();
      const paths: Array<{ totalLessons: number; completedLessons: number }> =
        pathsData.paths ?? [];

      const totalLessons = paths.reduce((sum, p) => sum + (p.totalLessons ?? 0), 0);
      const completedLessons = paths.reduce(
        (sum, p) => sum + (p.completedLessons ?? 0),
        0
      );

      setData({
        totalLessons,
        completedLessons,
        totalXP: account?.stats?.xp ?? 0,
        currentStreak: account?.stats?.streak ?? 0,
      });
    } catch (e) {
      console.error('Erreur chargement progression:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Votre progression</Text>
            <Text style={styles.subtitle}>Suivi de tes leçons et de ton XP</Text>
          </View>
        </View>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.content}>
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.warning} />
            <Text style={styles.stateTitle}>Impossible de charger ta progression</Text>
            <Text style={styles.stateText}>
              Vérifie ta connexion et réessaie dans un instant.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={load}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.retryGradient}
              >
                <Ionicons name="refresh" size={18} color={colors.textInverse} />
                <Text style={styles.retryText}>Réessayer</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!loading && !error && data && data.totalLessons === 0 && (
        <View style={styles.content}>
          <View style={styles.stateCard}>
            <Ionicons name="stats-chart-outline" size={48} color={colors.muted} />
            <Text style={styles.stateTitle}>Pas encore de progression</Text>
            <Text style={styles.stateText}>
              Importe un cours pour commencer à suivre tes leçons et ton XP ici.
            </Text>
          </View>
        </View>
      )}

      {!loading && !error && data && data.totalLessons > 0 && (
        <View style={styles.content}>
          <ProgressDashboard
            totalLessons={data.totalLessons}
            completedLessons={data.completedLessons}
            totalXP={data.totalXP}
            currentStreak={data.currentStreak}
          />
        </View>
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
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
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
    content: {
      flex: 1,
      padding: 20,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    stateCard: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: colors.surface,
      borderRadius: 16,
      gap: 12,
    },
    stateTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    stateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 8,
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    retryGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    retryText: {
      color: colors.textInverse,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}