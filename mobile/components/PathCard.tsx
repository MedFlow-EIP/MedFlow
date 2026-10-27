import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Path } from '../types';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

interface PathCardProps extends Path {
  onPress: () => void;
  index?: number;
  /** Parcours en cours : carte héros (bordure bleue + ombre) avec la prochaine leçon et un bouton plein. */
  isHero?: boolean;
  /** Titre de la prochaine leçon disponible, affiché sur la carte héros. */
  nextLessonTitle?: string;
  /** Condition de déblocage affichée sous un parcours verrouillé (ex. « Termine Anatomie pour débloquer »). */
  unlockHint?: string;
}

export function PathCard({
  title,
  description,
  progress,
  totalLessons,
  completedLessons,
  isLocked,
  comingSoon = false,
  color,
  emoji,
  onPress,
  index = 0,
  isHero = false,
  nextLessonTitle,
  unlockHint,
}: PathCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const progressPercentage = Math.min(100, Math.max(0, progress));
  const isDone = progressPercentage === 100;
  const ctaLabel = progressPercentage === 0 ? 'Commencer le parcours' : 'Continuer la leçon';

  if (isLocked) {
    return (
      <Animated.View entering={FadeInUp.delay(index * 100).springify()}>
        <View
          style={[styles.card, styles.cardLocked]}
          accessible
          accessibilityLabel={
            comingSoon
              ? `${title}, bientôt disponible`
              : `${title}, verrouillé. ${unlockHint ?? ''} ${completedLessons} sur ${totalLessons} leçons`
          }
        >
          <View style={styles.header}>
            <View style={[styles.iconContainer, styles.iconContainerLocked, { backgroundColor: color + '1A' }]}>
              <Text style={styles.emojiLocked}>{emoji}</Text>
            </View>
            <View style={styles.headerContentLocked}>
              <Text style={styles.titleLocked}>{title}</Text>
              <Text style={styles.descriptionLocked}>{description}</Text>
            </View>
            <Ionicons name="lock-closed" size={20} color={colors.muted} />
          </View>
          {comingSoon ? (
            <View style={styles.soonChip}>
              <Ionicons name="time-outline" size={14} color={colors.primaryText} />
              <Text style={styles.soonText}>Bientôt disponible</Text>
            </View>
          ) : (
            <Text style={styles.unlockHint}>
              {unlockHint ? `${unlockHint} · ` : ''}
              {completedLessons}/{totalLessons} leçons
            </Text>
          )}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(index * 100).springify()}>
      <TouchableOpacity
        style={[styles.card, isHero && styles.cardHero]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${completedLessons} sur ${totalLessons} leçons complétées`}
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: color + '1A' }]}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
          <View style={styles.headerContent}>
            <Text style={[styles.title, isHero && styles.titleHero]}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
        </View>

        <View style={styles.progressHeader}>
          <View style={styles.progressInfo}>
            <Ionicons name="document-text" size={14} color={colors.textSecondary} />
            <Text style={styles.progressText}>
              {completedLessons}/{totalLessons} leçons
            </Text>
          </View>
          <Text style={styles.percentage}>{Math.round(progressPercentage)} %</Text>
        </View>

        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
        </View>

        {isDone && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.successText} />
            <Text style={styles.completedText}>Terminé</Text>
          </View>
        )}

        {isHero && !isDone && (
          <>
            {nextLessonTitle ? (
              <View style={styles.nextLesson}>
                <Text style={styles.nextLessonLabel}>Prochaine leçon :</Text>
                <Text style={styles.nextLessonTitle} numberOfLines={1}>
                  {nextLessonTitle}
                </Text>
              </View>
            ) : null}
            <View style={styles.cta}>
              <Ionicons name="play" size={20} color={colors.onAction} />
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            </View>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 18,
      gap: 12,
    },
    cardHero: {
      borderWidth: 2,
      borderColor: colors.action,
      padding: 20,
      gap: 16,
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 6,
    },
    cardLocked: {
      gap: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    iconContainer: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainerLocked: {
      width: 48,
      height: 48,
      opacity: 0.75,
    },
    emoji: {
      fontSize: 28,
    },
    emojiLocked: {
      fontSize: 26,
    },
    headerContent: {
      flex: 1,
      gap: 4,
    },
    headerContentLocked: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    titleHero: {
      fontSize: 19,
      fontWeight: '700',
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    // Verrouillé : grisé mais lisible (contraste ≥ 4.5:1), plus d'opacité globale.
    titleLocked: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    descriptionLocked: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    soonChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.tintPrimary,
    },
    soonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryText,
    },
    unlockHint: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    progressText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    percentage: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.action,
    },
    progressBarBackground: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: colors.action,
    },
    nextLesson: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    nextLessonLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    nextLessonTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    cta: {
      height: 54,
      borderRadius: 14,
      backgroundColor: colors.action,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    ctaText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.onAction,
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    completedText: {
      fontSize: 13,
      color: colors.successText,
      fontWeight: '600',
    },
  });
}
