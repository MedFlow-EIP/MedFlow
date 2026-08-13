import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

interface AvatarBubbleProps {
  uri?: string | null;
  displayName: string;
  size?: number;
}

export function AvatarBubble({ uri, displayName, size = 36 }: AvatarBubbleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, size), [colors, size]);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={styles.image}
        accessibilityLabel={`Photo de profil de ${displayName}`}
      />
    );
  }

  return (
    <View
      style={styles.fallback}
      accessible={true}
      accessibilityLabel={`Photo de profil de ${displayName}`}
    >
      <Text style={styles.fallbackText}>{displayName.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, size: number) {
  return StyleSheet.create({
    image: {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
    fallback: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fallbackText: {
      color: colors.onAccent,
      fontWeight: '700',
      fontSize: size * 0.42,
    },
  });
}