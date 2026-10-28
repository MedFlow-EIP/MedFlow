import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { getAuthHeaders } from '../utils/authHeaders';
import { ProgressBar } from './ui/progress';

export type AIUsage = {
  kind: 'chat' | 'process' | 'case';
  used: number;
  limit: number;
  /** Date (ISO) à laquelle un appel redevient possible, si une limite est atteinte. */
  blocked_until: string | null;
};

const LABELS: Record<AIUsage['kind'], { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  chat: { label: 'Messages à l’assistant', icon: 'chatbubbles-outline' },
  process: { label: 'Imports de cours', icon: 'cloud-upload-outline' },
  case: { label: 'Cas cliniques', icon: 'medkit-outline' },
};

/** « 14 h 32 », ou « demain 9 h 05 » quand ce n'est pas aujourd'hui. */
export function availableAt(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const time = `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
  return date.toDateString() === now.toDateString() ? time : `demain ${time}`;
}

/** Ce qu'il reste d'IA sur 24 h glissantes : chat, imports, cas cliniques. */
export function AIUsageCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [usage, setUsage] = useState<AIUsage[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
          const res = await fetch(`${API_URL}/api/ai/usage`, { headers: await getAuthHeaders(user) });
          const data = await res.json();
          if (active && Array.isArray(data?.usage)) setUsage(data.usage);
        } catch {
          // Hors ligne : la carte reste cachée, rien de bloquant.
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!usage) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={20} color={colors.primaryDark} />
        <Text style={styles.title} accessibilityRole="header">Ton IA sur 24 h</Text>
      </View>

      {usage.map((u) => {
        const { label, icon } = LABELS[u.kind] ?? { label: u.kind, icon: 'sparkles-outline' };
        const left = Math.max(0, u.limit - u.used);
        const ratio = u.limit > 0 ? (u.used / u.limit) * 100 : 0;
        const low = !!u.blocked_until || left <= Math.ceil(u.limit * 0.1);
        return (
          <View
            key={u.kind}
            style={styles.row}
            accessible
            accessibilityLabel={
              u.blocked_until
                ? `${label} : limite atteinte, de nouveau disponible à ${availableAt(u.blocked_until)}`
                : `${label} : ${left} restant${left > 1 ? 's' : ''} sur ${u.limit}`
            }
          >
            <View style={styles.rowTop}>
              <Ionicons name={icon} size={16} color={colors.textSecondary} />
              <Text style={styles.label}>{label}</Text>
              <Text style={[styles.count, low && { color: colors.warningText }]}>
                {u.used} / {u.limit}
              </Text>
            </View>
            <ProgressBar progress={ratio} height={6} color={low ? colors.warning : colors.primary} />
            {!!u.blocked_until && (
              <Text style={styles.blocked}>Limite atteinte · de nouveau disponible à {availableAt(u.blocked_until)}</Text>
            )}
          </View>
        );
      })}

      <Text style={styles.hint}>Chaque utilisation se libère 24 h plus tard.</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    row: { gap: 6 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    label: { flex: 1, fontSize: 14, color: colors.textPrimary },
    count: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] },
    blocked: { fontSize: 13, color: colors.warningText },
    hint: { fontSize: 12, color: colors.textSecondary },
  });
}
