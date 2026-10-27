import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { getAuthHeaders } from '../utils/authHeaders';
import { appAlert } from '../utils/appAlert';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../utils/network';
import { ProgressBar } from './ui/progress';

export type Quest = {
  id: string;
  period: 'daily' | 'weekly';
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  progress: number;
  target: number;
  xp: number;
  completed: boolean;
  claimed: boolean;
};

/** Quêtes du jour et de la semaine (F58), avec récupération de l'XP. */
export function QuestsCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/quests`, { headers: await getAuthHeaders(user) });
      const data = await readJsonOrThrow<{ quests: Quest[] }>(res, '');
      setQuests(data.quests);
    } catch {
      // Carte secondaire : on garde la dernière liste connue.
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const claim = async (quest: Quest) => {
    const user = auth.currentUser;
    if (!user || claiming) return;
    setClaiming(quest.id);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/quests/${quest.id}/claim`, {
        method: 'POST',
        headers: await getAuthHeaders(user),
      });
      await readJsonOrThrow(res, 'Récompense indisponible.');
      setQuests((prev) => prev.map((q) => (q.id === quest.id ? { ...q, claimed: true } : q)));
    } catch (err) {
      appAlert('Récompense indisponible', errorMessage(err, 'Réessaie dans un instant.'));
    } finally {
      setClaiming(null);
    }
  };

  if (quests.length === 0) return null;

  const shown = quests.filter((q) => q.period === period);
  const toClaim = (p: 'daily' | 'weekly') => quests.filter((q) => q.period === p && q.completed && !q.claimed).length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Quêtes</Text>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['daily', 'weekly'] as const).map((p) => {
            const active = p === period;
            const pending = toClaim(p);
            return (
              <TouchableOpacity
                key={p}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setPeriod(p)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${p === 'daily' ? 'Du jour' : 'De la semaine'}${pending ? `, ${pending} récompense à récupérer` : ''}`}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {p === 'daily' ? 'Jour' : 'Semaine'}
                </Text>
                {pending > 0 && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {shown.map((q) => (
        <View
          key={q.id}
          style={styles.row}
          accessible={!q.completed || q.claimed}
          accessibilityLabel={`${q.title}, ${q.progress} sur ${q.target}, ${q.xp} XP${q.claimed ? ', récupéré' : ''}`}
        >
          <View style={[styles.icon, q.claimed && styles.iconDone]}>
            <Ionicons name={q.claimed ? 'checkmark' : q.icon} size={18} color={q.claimed ? colors.onAction : colors.primaryDark} />
          </View>
          <View style={styles.body}>
            <Text style={[styles.questTitle, q.claimed && styles.questTitleDone]}>{q.title}</Text>
            <View style={styles.progressRow}>
              <View style={styles.flex}>
                <ProgressBar progress={(q.progress / q.target) * 100} height={6} color={colors.success} />
              </View>
              <Text style={styles.count}>{q.progress}/{q.target}</Text>
            </View>
          </View>
          {q.completed && !q.claimed ? (
            <TouchableOpacity
              style={styles.claim}
              onPress={() => claim(q)}
              disabled={claiming === q.id}
              accessibilityRole="button"
              accessibilityLabel={`Récupérer ${q.xp} XP pour ${q.title}`}
            >
              {claiming === q.id ? (
                <ActivityIndicator size="small" color={colors.onAction} />
              ) : (
                <Text style={styles.claimText}>+{q.xp} XP</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.xp}>{q.claimed ? 'Récupéré' : `${q.xp} XP`}</Text>
          )}
        </View>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    tabs: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 9,
    },
    tabActive: {
      backgroundColor: colors.surface,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    tabTextActive: {
      fontWeight: '600',
      color: colors.primaryText,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.warning,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconDone: {
      backgroundColor: colors.success,
    },
    body: {
      flex: 1,
      gap: 6,
    },
    questTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    questTitleDone: {
      color: colors.textSecondary,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    flex: {
      flex: 1,
    },
    count: {
      minWidth: 36,
      textAlign: 'right',
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    claim: {
      minWidth: 72,
      minHeight: 40,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    claimText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.onAction,
    },
    xp: {
      minWidth: 72,
      textAlign: 'right',
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
}
