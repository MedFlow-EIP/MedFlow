import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { getAuthHeaders } from '../utils/authHeaders';
import { ProgressBar } from './ui/progress';

export type SpecialtyStat = {
  tag: string;
  courses: number;
  questions: number;
  mastered: number;
  mastery: number;
  due_today: number;
  answers: number;
  accuracy: number | null;
};

/**
 * Progression par spécialité (F69) : part des cartes maîtrisées, cartes dues
 * aujourd'hui et taux de bonnes réponses. Rien n'est affiché sans cours.
 */
export function SpecialtyStats() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stats, setStats] = useState<SpecialtyStat[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
          const res = await fetch(`${API_URL}/api/stats/specialties`, { headers: await getAuthHeaders(user) });
          if (!res.ok) return;
          const data = await res.json();
          if (active && Array.isArray(data?.specialties)) setStats(data.specialties);
        } catch {
          // Section secondaire : silencieuse hors ligne.
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (stats.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">Par spécialité</Text>
      {stats.map((s) => (
        <View
          key={s.tag}
          style={styles.card}
          accessible
          accessibilityLabel={`${s.tag} : ${s.mastery} % maîtrisé, ${s.due_today} cartes à revoir aujourd'hui${
            s.accuracy !== null ? `, ${s.accuracy} % de bonnes réponses` : ''
          }`}
        >
          <View style={styles.row}>
            <Text style={styles.tag} numberOfLines={1}>{s.tag}</Text>
            <Text style={styles.mastery}>{s.mastery} %</Text>
          </View>
          <ProgressBar progress={s.mastery} height={8} color={colors.success} />
          <Text style={styles.meta}>
            {s.mastered}/{s.questions} maîtrisées · {s.due_today} à revoir
            {s.accuracy !== null ? ` · ${s.accuracy} % de réussite` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      gap: 10,
      marginTop: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    card: {
      gap: 8,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    tag: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    mastery: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.successText,
    },
    meta: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });
}
