import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

export type UnlockedBadge = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

interface BadgeUnlockModalProps {
  badges: UnlockedBadge[];
  onDismiss: () => void;
}

export function BadgeUnlockModal({ badges, onDismiss }: BadgeUnlockModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [index, setIndex] = React.useState(0);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const visible = badges.length > 0;
  const badge = badges[index];

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    scaleAnim.setValue(0);
    rotateAnim.setValue(0);
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: false,
        friction: 5,
        tension: 60,
      }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [visible, index]);

  if (!visible || !badge) return null;

  const isLast = index === badges.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDismiss();
    } else {
      setIndex(index + 1);
    }
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-8deg', '8deg'],
  });

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {badges.length > 1 && (
            <Text style={styles.counter}>
              {index + 1} / {badges.length}
            </Text>
          )}

          <Text style={styles.eyebrow}>Badge débloqué !</Text>

          <Animated.View
            style={[
              styles.iconCircle,
              {
                backgroundColor: badge.color + '20',
                transform: [{ scale: scaleAnim }, { rotate: rotation }],
              },
            ]}
          >
            <Ionicons name={badge.icon} size={48} color={badge.color} />
          </Animated.View>

          <Text style={styles.title}>{badge.title}</Text>
          <Text style={styles.description}>{badge.description}</Text>

          <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{isLast ? 'Super !' : 'Suivant'}</Text>
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
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 28,
      alignItems: 'center',
      width: '100%',
      maxWidth: 340,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    counter: {
      position: 'absolute',
      top: 16,
      right: 18,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    eyebrow: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 16,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
    button: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 14,
      width: '100%',
      alignItems: 'center',
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}