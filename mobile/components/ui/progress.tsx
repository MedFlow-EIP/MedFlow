import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ progress, color, height = 8 }: ProgressBarProps) {
  const { colors } = useTheme();
  const fillColor = color ?? colors.primary;
  const clamped = Math.min(Math.max(progress, 0), 100);

  return (
    <View
      style={[styles.container, { height, backgroundColor: colors.border }]}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      accessibilityLabel={`Progression : ${Math.round(clamped)}%`}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped}%`,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 100,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 100,
  },
});