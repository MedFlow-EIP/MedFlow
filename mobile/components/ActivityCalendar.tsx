import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { getAuthHeaders } from '../utils/authHeaders';

export type CalendarDay = { date: string; count: number };
type CalendarData = { days: CalendarDay[]; active_days: number; total: number; best_run: number };

const GAP = 3;

/** Intensité 0 à 4 selon le nombre d'activités du jour. */
export function activityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}

/**
 * Colonnes de 7 jours (lundi en haut), la première complétée par des cases
 * vides pour que chaque ligne corresponde toujours au même jour de la semaine.
 */
export function toWeeks(days: CalendarDay[]): (CalendarDay | null)[][] {
  if (days.length === 0) return [];
  const [y, m, d] = days[0].date.split('-').map(Number);
  const offset = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const cells: (CalendarDay | null)[] = [...Array(offset).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const formatDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

/** Calendrier d'activité façon GitHub : une case par jour, plus foncée quand on a beaucoup révisé. */
export function ActivityCalendar() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [data, setData] = useState<CalendarData | null>(null);
  const [selected, setSelected] = useState<CalendarDay | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
          const res = await fetch(`${API_URL}/api/activity/calendar`, { headers: await getAuthHeaders(user) });
          if (!res.ok) return;
          const json = await res.json();
          if (active && Array.isArray(json?.days)) setData(json);
        } catch {
          // Section secondaire : rien à afficher hors ligne.
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!data) return null;

  const weeks = toWeeks(data.days);
  // Largeur de la carte (écran - marges) répartie entre les semaines.
  const cell = Math.max(10, Math.floor((width - 40 - 32 - GAP * (weeks.length - 1)) / weeks.length));
  const levelColors = [colors.surfaceAlt, colors.tintPrimaryStrong, colors.primary, colors.primaryDark, colors.primaryText];

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">Ton activité</Text>
      <Text style={styles.summary}>
        {data.active_days} jour{data.active_days > 1 ? 's' : ''} actif{data.active_days > 1 ? 's' : ''} sur 18 semaines
        {data.best_run > 1 ? ` · meilleure suite : ${data.best_run} jours` : ''}
      </Text>

      <View style={styles.grid}>
        {weeks.map((week, w) => (
          <View key={w} style={styles.column}>
            {week.map((day, i) =>
              day ? (
                <TouchableOpacity
                  key={day.date}
                  onPress={() => setSelected(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDay(day.date)} : ${day.count} activité${day.count > 1 ? 's' : ''}`}
                  style={[
                    styles.cell,
                    { width: cell, height: cell, backgroundColor: levelColors[activityLevel(day.count)] },
                    selected?.date === day.date && styles.cellSelected,
                  ]}
                />
              ) : (
                <View key={`e${i}`} style={{ width: cell, height: cell }} />
              )
            )}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.detail} accessibilityLiveRegion="polite">
          {selected
            ? `${formatDay(selected.date)} : ${selected.count} activité${selected.count > 1 ? 's' : ''}`
            : 'Touche une case pour voir le détail'}
        </Text>
        <View style={styles.legend} importantForAccessibility="no-hide-descendants">
          <Text style={styles.legendText}>Moins</Text>
          {levelColors.map((c, i) => (
            <View key={i} style={[styles.legendCell, { backgroundColor: c }]} />
          ))}
          <Text style={styles.legendText}>Plus</Text>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: 10,
      marginTop: 20,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    summary: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    grid: {
      flexDirection: 'row',
      gap: GAP,
    },
    column: {
      gap: GAP,
    },
    cell: {
      borderRadius: 3,
    },
    cellSelected: {
      borderWidth: 2,
      borderColor: colors.textPrimary,
    },
    footer: {
      gap: 8,
    },
    detail: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      gap: 4,
    },
    legendText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    legendCell: {
      width: 11,
      height: 11,
      borderRadius: 2,
    },
  });
}
