import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Lesson } from '../types';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Largeur du bloc d'un nœud (cercle + titre), centré sur la colonne. */
export const LESSON_NODE_WIDTH = 220;

/** Diamètre du cercle selon l'état : la leçon disponible est mise en avant. */
export function lessonNodeSize(status: Lesson['status']) {
  if (status === 'available') return 104;
  if (status === 'completed') return 92;
  return 84;
}

const RING = 8;

const GRADIENTS: Record<Lesson['status'], [string, string]> = {
  completed: ['#FFD700', '#FFA500'],
  available: ['#3B82F6', '#8B5CF6'],
  locked: ['#CBD5E1', '#CBD5E1'],
};

interface LessonNodeProps extends Lesson {
  onPress: () => void;
  /** XP rapportés par la leçon, affichés dans la pastille de la leçon disponible. */
  xp?: number;
}

export function LessonNode({ title, type, status, xp, onPress }: LessonNodeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status !== 'available') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status]);

  const size = lessonNodeSize(status);
  const iconName: IconName = type === 'review' ? 'refresh' : type === 'test' ? 'trophy' : 'school';
  const typeLabel = type === 'lesson' ? 'Leçon' : type === 'review' ? 'Révision' : 'Test';
  const isLocked = status === 'locked';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={isLocked}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel} ${title}${
        status === 'completed' ? ', complétée' : isLocked ? ', verrouillée' : ', disponible'
      }`}
      accessibilityState={{ disabled: isLocked }}
    >
      <Animated.View
        style={[
          styles.ring,
          { width: size + RING * 2, height: size + RING * 2, borderRadius: (size + RING * 2) / 2 },
          { transform: [{ scale: pulse }] },
        ]}
      >
        <LinearGradient
          colors={GRADIENTS[status]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={iconName} size={Math.round(size * 0.45)} color="#ffffff" />
        </LinearGradient>

        {status === 'completed' && (
          <View style={[styles.badge, styles.badgeCompleted]}>
            <Ionicons name="checkmark" size={16} color="#ffffff" />
          </View>
        )}
        {status === 'available' && (
          <View style={[styles.badge, styles.badgePlay]}>
            <Ionicons name="play" size={22} color={colors.primaryDark} />
          </View>
        )}
        {isLocked && (
          <View style={[styles.badge, styles.badgeLocked]}>
            <Ionicons name="lock-closed" size={15} color="#ffffff" />
          </View>
        )}
      </Animated.View>

      <View style={styles.label}>
        <Text style={[styles.title, isLocked && styles.titleLocked]} numberOfLines={2}>
          {title}
        </Text>
        {status === 'completed' && (
          <View style={[styles.chip, { backgroundColor: colors.tintSuccess }]}>
            <Ionicons name="checkmark" size={14} color={colors.successText} />
            <Text style={[styles.chipText, { color: colors.successText }]}>Complété</Text>
          </View>
        )}
        {status === 'available' && (
          <View style={[styles.chip, { backgroundColor: colors.tintPrimary }]}>
            <Text style={[styles.chipText, { color: colors.primaryText }]}>
              {xp ? `${typeLabel} · ${xp} XP` : typeLabel}
            </Text>
          </View>
        )}
        {isLocked && (
          <View style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>Verrouillé</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: LESSON_NODE_WIDTH,
      alignItems: 'center',
    },
    ring: {
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 6,
    },
    badge: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
    },
    // Pastille check en haut à droite (remplace le ruban de 8 px).
    badgeCompleted: {
      top: 2,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.success,
      borderColor: '#ffffff',
    },
    // Badge play 46 px avec icône 22 px (au lieu de 24/12).
    badgePlay: {
      bottom: 4,
      right: -4,
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: '#ffffff',
      borderColor: colors.primaryDark,
    },
    badgeLocked: {
      bottom: 8,
      right: 2,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.muted,
      borderColor: '#ffffff',
    },
    label: {
      marginTop: 6,
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: colors.background,
      maxWidth: LESSON_NODE_WIDTH,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    titleLocked: {
      color: colors.textSecondary,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
