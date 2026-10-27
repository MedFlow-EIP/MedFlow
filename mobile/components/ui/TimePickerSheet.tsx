import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useScreenInsets } from '../navigation/constants';

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** « 9h », « 21h30 » : format court utilisé dans les textes. */
export const formatReminderTime = (hour: number, minute: number) =>
  minute === 0 ? `${hour}h` : `${hour}h${pad2(minute)}`;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const ITEM_HEIGHT = 48;
const LIST_HEIGHT = ITEM_HEIGHT * 4;

const PRESETS: { label: string; icon: keyof typeof Ionicons.glyphMap; hour: number; minute: number }[] = [
  { label: 'Matin', icon: 'sunny-outline', hour: 8, minute: 0 },
  { label: 'Midi', icon: 'restaurant-outline', hour: 12, minute: 30 },
  { label: 'Soir', icon: 'partly-sunny-outline', hour: 19, minute: 0 },
  { label: 'Nuit', icon: 'moon-outline', hour: 21, minute: 30 },
];

/**
 * Feuille du bas pour choisir une heure : raccourcis + deux colonnes
 * (heures, minutes par pas de 5) où l'on touche directement la valeur.
 */
export function TimePickerSheet({
  visible,
  title,
  hour,
  minute,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  hour: number;
  minute: number;
  onCancel: () => void;
  onConfirm: (hour: number, minute: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useScreenInsets();

  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute - (minute % 5));
  const hoursRef = useRef<ScrollView>(null);
  const minutesRef = useRef<ScrollView>(null);

  // À chaque ouverture : repart de la valeur actuelle et la centre dans les colonnes.
  useEffect(() => {
    if (!visible) return;
    const startMinute = minute - (minute % 5);
    setH(hour);
    setM(startMinute);
    setTimeout(() => {
      hoursRef.current?.scrollTo({ y: Math.max(0, (hour - 1) * ITEM_HEIGHT), animated: false });
      minutesRef.current?.scrollTo({ y: Math.max(0, (startMinute / 5 - 1) * ITEM_HEIGHT), animated: false });
    }, 0);
  }, [visible]);

  const pick = (nextH: number, nextM: number) => {
    setH(nextH);
    setM(nextM);
    hoursRef.current?.scrollTo({ y: Math.max(0, (nextH - 1) * ITEM_HEIGHT), animated: true });
    minutesRef.current?.scrollTo({ y: Math.max(0, (nextM / 5 - 1) * ITEM_HEIGHT), animated: true });
  };

  const renderColumn = (
    ref: React.RefObject<ScrollView>,
    values: number[],
    selected: number,
    onSelect: (v: number) => void,
    unit: string
  ) => (
    <View style={styles.column}>
      <ScrollView ref={ref} style={{ height: LIST_HEIGHT }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {values.map((v) => {
          const active = v === selected;
          return (
            <TouchableOpacity
              key={v}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => onSelect(v)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${v} ${unit}`}
            >
              <Text style={[styles.itemText, active && styles.itemTextActive]}>{pad2(v)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { paddingBottom: bottom + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.preview} accessibilityLiveRegion="polite">
            {pad2(h)}:{pad2(m)}
          </Text>

          <View style={styles.presets}>
            {PRESETS.map((p) => {
              const active = p.hour === h && p.minute === m;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.preset, active && styles.presetActive]}
                  onPress={() => pick(p.hour, p.minute)}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.label}, ${formatReminderTime(p.hour, p.minute)}`}
                >
                  <Ionicons name={p.icon} size={18} color={active ? colors.primaryText : colors.textSecondary} />
                  <Text style={[styles.presetLabel, active && { color: colors.primaryText }]}>{p.label}</Text>
                  <Text style={[styles.presetTime, active && { color: colors.primaryText }]}>
                    {p.hour}:{pad2(p.minute)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.columns}>
            <View style={styles.columnWrap}>
              <Text style={styles.columnLabel}>Heure</Text>
              {renderColumn(hoursRef, HOURS, h, setH, 'heures')}
            </View>
            <Text style={styles.colon}>:</Text>
            <View style={styles.columnWrap}>
              <Text style={styles.columnLabel}>Minutes</Text>
              {renderColumn(minutesRef, MINUTES, m, setM, 'minutes')}
            </View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onCancel} accessibilityRole="button">
              <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.action }]}
              onPress={() => onConfirm(h, m)}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, { color: colors.onAction }]}>Valider</Text>
            </TouchableOpacity>
          </View>
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
      gap: 16,
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
      textAlign: 'center',
    },
    preview: {
      fontSize: 44,
      fontWeight: '700',
      color: colors.primaryText,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      marginTop: -8,
    },
    presets: {
      flexDirection: 'row',
      gap: 8,
    },
    preset: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    presetActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.tintPrimary,
    },
    presetLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    presetTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    columns: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    columnWrap: {
      flex: 1,
      gap: 6,
    },
    columnLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    column: {
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
      padding: 4,
    },
    colon: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 20,
    },
    item: {
      height: ITEM_HEIGHT,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemActive: {
      backgroundColor: colors.action,
    },
    itemText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    itemTextActive: {
      color: colors.onAction,
    },
    buttons: {
      flexDirection: 'row',
      gap: 10,
    },
    button: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonSecondary: {
      backgroundColor: colors.surfaceAlt,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
