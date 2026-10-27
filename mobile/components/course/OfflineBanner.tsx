import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

/** Bandeau affiché quand l'écran montre la copie locale d'un cours, faute de réseau. */
export function OfflineBanner({
  message = 'Hors ligne : version enregistrée sur ton téléphone.',
}: {
  message?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warningText} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.tintWarning,
    },
    text: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: colors.warningText,
    },
  });
}
