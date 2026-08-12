import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/card';
import { ProgressBar } from './ui/progress';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

interface ProgressDashboardProps {
  totalLessons: number;
  completedLessons: number;
  totalXP: number;
  currentStreak?: number;
  weeklyGoal?: number;
  weeklyProgress?: number;
}

export function ProgressDashboard({
  totalLessons,
  completedLessons,
  totalXP,
  currentStreak,
  weeklyGoal,
  weeklyProgress,
}: ProgressDashboardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const completionPercentage =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const hasStreak = typeof currentStreak === 'number';
  const hasWeeklyGoal =
    typeof weeklyGoal === 'number' && weeklyGoal > 0 && typeof weeklyProgress === 'number';
  const weeklyPercentage = hasWeeklyGoal
    ? Math.round((weeklyProgress! / weeklyGoal!) * 100)
    : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.statsGrid} testID="stats-section">
        <View
          style={[styles.statCard, { backgroundColor: colors.surfaceAlt }]}
          accessible={true}
          accessibilityLabel={`${totalXP} points XP`}
        >
          <View style={[styles.statIconBadge, { backgroundColor: colors.tintPrimary }]}>
            <Ionicons name="star-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.statNumber}>{totalXP}</Text>
          <Text style={styles.statLabel}>Points XP</Text>
        </View>

        <View
          style={[styles.statCard, { backgroundColor: colors.surfaceAlt }]}
          accessible={true}
          accessibilityLabel={`${completedLessons} leçons complétées`}
        >
          <View style={[styles.statIconBadge, { backgroundColor: colors.tintSuccess }]}>
            <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
          </View>
          <Text style={styles.statNumber}>{completedLessons}</Text>
          <Text style={styles.statLabel}>Leçons complétées</Text>
        </View>

        {hasStreak && (
          <View
            style={[styles.statCard, { backgroundColor: colors.surfaceAlt }]}
            accessible={true}
            accessibilityLabel={`${currentStreak} jours de série`}
          >
            <View style={[styles.statIconBadge, { backgroundColor: colors.tintWarning }]}>
              <Ionicons name="flame-outline" size={24} color={colors.warning} />
            </View>
            <Text style={styles.statNumber}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Jours de série</Text>
          </View>
        )}
      </View>

      <Card
        style={styles.progressCard}
        testID="progress-card"
        accessible={true}
        accessibilityLabel={`Progression globale, ${completionPercentage}%, ${completedLessons} leçons complétées sur ${totalLessons}`}
      >
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Progression globale</Text>
          <Text style={styles.progressPercentage}>{completionPercentage}%</Text>
        </View>
        <ProgressBar progress={completionPercentage} color={colors.primary} height={12} />
        <Text style={styles.progressSubtext}>
          {completedLessons} leçons complétées sur {totalLessons}
        </Text>
      </Card>

      {hasWeeklyGoal && (
        <Card
          style={styles.progressCard}
          accessible={true}
          accessibilityLabel={`Objectif hebdomadaire, ${weeklyPercentage}%, ${weeklyProgress} sur ${weeklyGoal} leçons cette semaine`}
        >
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Objectif hebdomadaire</Text>
            <Text style={styles.progressPercentage}>{weeklyPercentage}%</Text>
          </View>
          <ProgressBar progress={weeklyPercentage} color={colors.success} height={12} />
          <Text style={styles.progressSubtext}>
            {weeklyProgress} / {weeklyGoal} leçons cette semaine
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 4,
    },
    statCard: {
      flex: 1,
      minWidth: '48%',
      padding: 16,
      borderRadius: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    statIconBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    statNumber: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 8,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    progressCard: {
      marginBottom: 16,
      padding: 16,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    progressTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    progressPercentage: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    progressSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
    },
  });
}