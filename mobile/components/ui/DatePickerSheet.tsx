import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useScreenInsets } from '../navigation/constants';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** Date locale → « AAAA-MM-JJ » (sans passer par l'UTC, qui décalerait d'un jour). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** « mardi 3 novembre » */
export function formatLongDate(iso: string): string {
  return fromIsoDate(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Feuille du bas avec un calendrier mensuel. Les jours avant ``minDate``
 * ne sont pas sélectionnables.
 */
export function DatePickerSheet({
  visible,
  title,
  value,
  minDate = new Date(),
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  value: string | null;
  minDate?: Date;
  onCancel: () => void;
  onConfirm: (isoDate: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useScreenInsets();

  const min = startOfDay(minDate);
  const [selected, setSelected] = useState<string | null>(value);
  const [month, setMonth] = useState(() => {
    const base = value ? fromIsoDate(value) : min;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!visible) return;
    setSelected(value);
    const base = value ? fromIsoDate(value) : min;
    setMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [visible]);

  // Cases du mois, semaines commençant le lundi ; null = case vide.
  const cells = useMemo(() => {
    const offset = (month.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const list: (Date | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (list.length % 7) list.push(null);
    return list;
  }, [month]);

  const canGoBack = month > new Date(min.getFullYear(), min.getMonth(), 1);
  const shiftMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  const todayIso = toIsoDate(new Date());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { paddingBottom: bottom + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">{title}</Text>

          <View style={styles.monthRow}>
            <TouchableOpacity
              style={[styles.navButton, !canGoBack && styles.disabled]}
              onPress={() => shiftMonth(-1)}
              disabled={!canGoBack}
              accessibilityRole="button"
              accessibilityLabel="Mois précédent"
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel} accessibilityLiveRegion="polite">
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </Text>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => shiftMonth(1)}
              accessibilityRole="button"
              accessibilityLabel="Mois suivant"
            >
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {WEEKDAYS.map((d, i) => (
              <Text key={`w${i}`} style={styles.weekday} importantForAccessibility="no" maxFontSizeMultiplier={1.4}>{d}</Text>
            ))}
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={styles.cell} />;
              const iso = toIsoDate(day);
              const disabled = day < min;
              const active = iso === selected;
              return (
                <TouchableOpacity
                  key={iso}
                  style={styles.cell}
                  onPress={() => setSelected(iso)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={formatLongDate(iso)}
                  accessibilityState={{ selected: active, disabled }}
                >
                  <View style={[styles.day, active && styles.dayActive, iso === todayIso && !active && styles.dayToday]}>
                    <Text
                      style={[styles.dayText, disabled && styles.dayTextDisabled, active && styles.dayTextActive]}
                      maxFontSizeMultiplier={1.4}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.confirm, !selected && styles.disabled]}
            onPress={() => selected && onConfirm(selected)}
            disabled={!selected}
            accessibilityRole="button"
          >
            <Text style={styles.confirmText}>{selected ? `Choisir le ${formatLongDate(selected)}` : 'Choisis un jour'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 10,
      paddingHorizontal: 20,
      gap: 14,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    navButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    monthLabel: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    weekday: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      paddingBottom: 6,
    },
    cell: {
      width: `${100 / 7}%`,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    day: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayActive: {
      backgroundColor: colors.action,
    },
    dayToday: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    dayText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    dayTextDisabled: {
      color: colors.muted,
    },
    dayTextActive: {
      fontWeight: '700',
      color: colors.onAction,
    },
    confirm: {
      height: 54,
      borderRadius: 14,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    confirmText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onAction,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
