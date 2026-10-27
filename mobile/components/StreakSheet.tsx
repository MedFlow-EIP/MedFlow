import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { useScreenInsets } from './navigation/constants';

/** Explication de la série et des protections de série. */
export function StreakSheet({
  visible,
  streak,
  freezes,
  maxFreezes,
  onClose,
}: {
  visible: boolean;
  streak: number;
  freezes: number;
  maxFreezes: number;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useScreenInsets();
  const daysToNext = 7 - (streak % 7);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { paddingBottom: bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.hero}>
            <Ionicons name="flame" size={40} color={colors.warning} />
            <Text style={styles.streak} accessibilityRole="header">
              {streak} jour{streak > 1 ? 's' : ''} de série
            </Text>
          </View>

          <View style={styles.freezes} accessible accessibilityLabel={`${freezes} protection${freezes > 1 ? 's' : ''} sur ${maxFreezes}`}>
            {Array.from({ length: maxFreezes }, (_, i) => (
              <View key={i} style={[styles.shield, i < freezes ? styles.shieldOn : styles.shieldOff]}>
                <Ionicons name="shield-checkmark" size={26} color={i < freezes ? colors.onAction : colors.muted} />
              </View>
            ))}
          </View>

          <Text style={styles.title}>Protections de série</Text>
          <Text style={styles.text}>
            Si tu manques un jour, une protection est utilisée automatiquement et ta série continue.
          </Text>
          <Text style={styles.text}>
            {freezes >= maxFreezes
              ? `Tu as le maximum (${maxFreezes}). Garde ta série pour les conserver.`
              : `Tu en gagnes une tous les 7 jours de série : la prochaine dans ${daysToNext} jour${daysToNext > 1 ? 's' : ''}.`}
          </Text>

          <TouchableOpacity style={styles.button} onPress={onClose} accessibilityRole="button">
            <Text style={styles.buttonText}>Compris</Text>
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
      paddingHorizontal: 24,
      gap: 12,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    hero: {
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    streak: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    freezes: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginVertical: 6,
    },
    shield: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shieldOn: {
      backgroundColor: colors.primaryDark,
    },
    shieldOff: {
      backgroundColor: colors.surfaceAlt,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    text: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    button: {
      height: 52,
      marginTop: 8,
      borderRadius: 14,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onAction,
    },
  });
}
