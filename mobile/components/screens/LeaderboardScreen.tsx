import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from '../../utils/authHeaders';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { AvatarBubble } from '../../components/AvatarBubble';

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  streak: number;
};

type Mode = 'global' | 'friends';

export function LeaderboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation();

  const [mode, setMode] = useState<Mode>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [yourUid, setYourUid] = useState<string | null>(null);
  const [yourRank, setYourRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (currentMode: Mode) => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setError(false);
    try {
      const headers = await getAuthHeaders(user);

      if (currentMode === 'global') {
        const res = await fetch(`${API_URL}/api/leaderboard?limit=50`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setYourUid(data.yourUid ?? null);
        setYourRank(data.yourRank ?? null);
      } else {
        const res = await fetch(`${API_URL}/api/friends/leaderboard`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: LeaderboardEntry[] = Array.isArray(data.entries) ? data.entries : [];
        setEntries(list);
        setYourUid(data.yourUid ?? null);
        const position = list.findIndex((e) => e.uid === data.yourUid);
        setYourRank(position >= 0 ? position + 1 : null);
      }
    } catch (err) {
      console.error('Erreur chargement classement:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load(mode);
    }, [load, mode])
  );

  const youAreInTopList = entries.some((e) => e.uid === yourUid);

  const getRankColor = (position: number) => {
    if (position === 1) return '#FFD700';
    if (position === 2) return '#C0C0C0';
    if (position === 3) return '#CD7F32';
    return colors.textSecondary;
  };

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const position = index + 1;
    const isYou = item.uid === yourUid;

    return (
      <View style={[styles.row, isYou && styles.rowHighlight]}>
        <View style={styles.rankContainer}>
          {position <= 3 ? (
            <Ionicons name="trophy" size={20} color={getRankColor(position)} />
          ) : (
            <Text style={styles.rankText}>#{position}</Text>
          )}
        </View>

        <AvatarBubble uri={item.avatarUrl} displayName={item.displayName} size={36} />

        <View style={styles.nameContainer}>
          <Text style={[styles.name, isYou && styles.nameYou]} numberOfLines={1}>
            {item.displayName}
            {isYou ? ' (toi)' : ''}
          </Text>
        </View>

        <View style={styles.streakContainer}>
          <Ionicons name="flame" size={14} color={colors.warning} />
          <Text style={styles.streakText}>{item.streak}</Text>
        </View>

        <Text style={styles.xpText}>{item.xp} XP</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={8}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Classement</Text>
          <Text style={styles.subtitle}>
            {mode === 'global' ? 'Les meilleurs par XP' : 'Toi et tes amis'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Friends' as never)}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="people-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleOption, mode === 'global' && styles.toggleOptionActive]}
          onPress={() => setMode('global')}
        >
          <Ionicons
            name="earth"
            size={16}
            color={mode === 'global' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.toggleText, mode === 'global' && styles.toggleTextActive]}>
            Global
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleOption, mode === 'friends' && styles.toggleOptionActive]}
          onPress={() => setMode('friends')}
        >
          <Ionicons
            name="people"
            size={16}
            color={mode === 'friends' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.toggleText, mode === 'friends' && styles.toggleTextActive]}>
            Amis
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.warning} />
          <Text style={styles.stateTitle}>Impossible de charger le classement</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => load(mode)}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && entries.length === 0 && mode === 'global' && (
        <View style={styles.centered}>
          <Ionicons name="trophy-outline" size={48} color={colors.muted} />
          <Text style={styles.stateTitle}>Personne au classement pour l'instant</Text>
          <Text style={styles.stateText}>
            Termine une leçon pour apparaître ici.
          </Text>
        </View>
      )}

      {!loading && !error && mode === 'friends' && entries.length <= 1 && (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={48} color={colors.muted} />
          <Text style={styles.stateTitle}>Pas encore d'amis ajoutés</Text>
          <Text style={styles.stateText}>
            Ajoute des amis pour te comparer à eux plutôt qu'à des inconnus.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.navigate('Friends' as never)}
          >
            <Text style={styles.retryText}>Ajouter des amis</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && entries.length > 0 && !(mode === 'friends' && entries.length <= 1) && (
        <>
          <FlatList
            data={entries}
            keyExtractor={(item) => item.uid}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {!youAreInTopList && yourRank !== null && (
            <View style={styles.yourRankBar}>
              <Text style={styles.yourRankText}>
                Ta position : #{yourRank}
              </Text>
            </View>
          )}
        </>
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingTop: 25,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
    toggleRow: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      margin: 16,
      marginBottom: 8,
      padding: 4,
      gap: 4,
    },
    toggleOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 9,
    },
    toggleOptionActive: {
      backgroundColor: colors.surface,
    },
    toggleText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    toggleTextActive: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      gap: 12,
    },
    stateTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    stateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
    },
    retryText: {
      color: colors.textInverse,
      fontWeight: '600',
    },
    listContent: {
      padding: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
      gap: 10,
    },
    rowHighlight: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    rankContainer: {
      width: 32,
      alignItems: 'center',
    },
    rankText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    nameContainer: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    nameYou: {
      color: colors.primary,
    },
    streakContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginRight: 4,
    },
    streakText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    xpText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
      minWidth: 64,
      textAlign: 'right',
    },
    yourRankBar: {
      backgroundColor: colors.surfaceAlt,
      paddingVertical: 12,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    yourRankText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
}