import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Path } from '../types';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface PathCardProps extends Path {
  onPress: () => void;
  index?: number;
}

export function PathCard({
  title,
  description,
  progress,
  totalLessons,
  completedLessons,
  isLocked,
  color,
  emoji,
  onPress,
  index = 0,
}: PathCardProps) {
  const progressPercentage = Math.min(100, Math.max(0, progress));

  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 100).springify()}
      style={styles.wrapper}
    >
      <TouchableOpacity
        style={[styles.card, isLocked && styles.locked]}
        onPress={onPress}
        disabled={isLocked}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={isLocked 
            ? ['#f8fafc', '#f1f5f9']
            : ['#ffffff', '#f8fafc']
          }
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            
            <View style={styles.headerContent}>
              <Text style={[styles.title, isLocked && styles.titleLocked]}>
                {title}
              </Text>
              <Text style={[styles.description, isLocked && styles.descriptionLocked]}>
                {description}
              </Text>
            </View>

            {isLocked ? (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={20} color="#94a3b8" />
              </View>
            ) : (
              <View style={[styles.arrowBadge, { backgroundColor: color }]}>
                <Ionicons name="arrow-forward" size={20} color="#ffffff" />
              </View>
            )}
          </View>

          {/* Progress Section */}
          <View style={styles.footer}>
            <View style={styles.progressHeader}>
              <View style={styles.progressInfo}>
                <Ionicons name="document-text" size={14} color="#64748b" />
                <Text style={styles.progressText}>
                  {completedLessons}/{totalLessons} leçons
                </Text>
              </View>
              <Text style={[styles.percentage, { color }]}>
                {Math.round(progressPercentage)}%
              </Text>
            </View>

            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${progressPercentage}%`,
                    backgroundColor: color,
                  }
                ]} 
              />
            </View>

            {!isLocked && progressPercentage < 100 && (
              <Text style={[styles.continueText, { color }]}>
                {progressPercentage === 0 ? 'Commencer' : 'Continuer'} →
              </Text>
            )}

            {progressPercentage === 100 && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.completedText}>Terminé</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  locked: {
    opacity: 0.7,
  },
  gradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 26,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  titleLocked: {
    color: '#64748b',
  },
  description: {
    fontSize: 13,
    color: '#64748b',
  },
  descriptionLocked: {
    color: '#94a3b8',
  },
  lockBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  percentage: {
    fontSize: 15,
    fontWeight: '600',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  continueText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  completedText: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '500',
  },
});