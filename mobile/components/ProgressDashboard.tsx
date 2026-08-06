import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card } from './ui/card';
import { ProgressBar } from './ui/progress';

interface ProgressDashboardProps {
  totalLessons: number;
  completedLessons: number;
  currentStreak: number;
  totalXP: number;
  weeklyGoal: number;
  weeklyProgress: number;
}

export function ProgressDashboard({
  totalLessons,
  completedLessons,
  currentStreak,
  totalXP,
  weeklyGoal,
  weeklyProgress,
}: ProgressDashboardProps) {
  const completionPercentage = Math.round((completedLessons / totalLessons) * 100);
  const weeklyPercentage = Math.round((weeklyProgress / weeklyGoal) * 100);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.statsGrid} testID="stats-section">
        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>⭐</Text>
          <Text style={styles.statValue}>{totalXP}</Text>
          <Text style={styles.statLabel}>Points XP</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statValue}>{currentStreak}</Text>
          <Text style={styles.statLabel}>Jours de série</Text>
        </Card>
      </View>

      <Card style={styles.progressCard} testID="progress-card">
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Progression globale</Text>
          <Text style={styles.progressPercentage}>{completionPercentage}%</Text>
        </View>
        <ProgressBar progress={completionPercentage} color="#3b82f6" height={12} />
        <Text style={styles.progressSubtext}>
          {completedLessons} leçons complétées sur {totalLessons}
        </Text>
      </Card>

      <Card style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Objectif hebdomadaire</Text>
          <Text style={styles.progressPercentage}>{weeklyPercentage}%</Text>
        </View>
        <ProgressBar progress={weeklyPercentage} color="#10b981" height={12} />
        <Text style={styles.progressSubtext}>
          {weeklyProgress} / {weeklyGoal} leçons cette semaine
        </Text>
      </Card>

      <Card style={styles.calendarCard}>
        <Text style={styles.calendarTitle}>Activité récente</Text>
        <View style={styles.calendar}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={styles.calendarColumn}>
              {Array.from({ length: 5 }).map((_, j) => {
                const isActive = Math.random() > 0.5;
                return (
                  <View
                    key={`${i}-${j}`}
                    style={[
                      styles.calendarDay,
                      isActive && styles.calendarDayActive,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
        <View style={styles.calendarLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotInactive]} />
            <Text style={styles.legendText}>Inactif</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotActive]} />
            <Text style={styles.legendText}>Actif</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.achievementCard}>
        <Text style={styles.achievementTitle}>Badges récents</Text>
        <View style={styles.badgesContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeEmoji}>🎯</Text>
            <Text style={styles.badgeName}>Premier pas</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeEmoji}>🔥</Text>
            <Text style={styles.badgeName}>Série de 7</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeEmoji}>⚡</Text>
            <Text style={styles.badgeName}>Rapide</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  statEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressCard: {
    marginBottom: 16,
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
    color: '#111827',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
  },
  progressSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  calendarCard: {
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  calendar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  calendarColumn: {
    flex: 1,
    gap: 4,
  },
  calendarDay: {
    aspectRatio: 1,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  calendarDayActive: {
    backgroundColor: '#3b82f6',
  },
  calendarLegend: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendDotInactive: {
    backgroundColor: '#e5e7eb',
  },
  legendDotActive: {
    backgroundColor: '#3b82f6',
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
  },
  achievementCard: {
    marginBottom: 24,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  badge: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  badgeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
});