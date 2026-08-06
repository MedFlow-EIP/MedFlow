import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Lesson } from '../types';

const { width } = Dimensions.get('window');

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface LessonNodeProps extends Lesson {
  color: string;
  onPress: () => void;
  index?: number;
  isLast?: boolean;
  isFirst?: boolean;
}

export function LessonNode({
  title,
  type,
  status,
  stars,
  position,
  color,
  onPress,
  index = 0,
  isLast = false,
  isFirst = false,
}: LessonNodeProps) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const completedGlowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      if (currentStatus === 'completed') {
        Animated.sequence([
          Animated.timing(completedGlowAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(1000),
          Animated.timing(completedGlowAnim, {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [currentStatus])
  );

  useEffect(() => {
    if (currentStatus === 'available') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }

    if (currentStatus === 'completed') {
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.elastic(1),
        useNativeDriver: true,
      }).start();
    }
  }, [currentStatus]);

  const getIconConfig = (): { 
    name: IconName; 
    bg: string[];
    color: string;
  } => {
    switch (type) {
      case 'lesson':
        return { 
          name: 'school', 
          bg: ['#4158D0', '#C850C0'],
          color: '#ffffff',
        };
      case 'review':
        return { 
          name: 'refresh', 
          bg: ['#FF8008', '#FFC837'],
          color: '#ffffff',
        };
      case 'test':
        return { 
          name: 'trophy', 
          bg: ['#8E2DE2', '#4A00E0'],
          color: '#ffffff',
        };
      default:
        return { 
          name: 'document-text', 
          bg: ['#00B4DB', '#0083B0'],
          color: '#ffffff',
        };
    }
  };

  const getStatusColors = () => {
    switch (currentStatus) {
      case 'completed':
        return {
          border: ['#FFD700', '#FFA500'],
          glow: '#FFD700',
          icon: '#ffffff',
        };
      case 'available':
        return {
          border: ['#FF6B6B', '#4ECDC4'],
          glow: color,
          icon: '#ffffff',
        };
      case 'locked':
        return {
          border: ['#95a5a6', '#7f8c8d'],
          glow: '#95a5a6',
          icon: '#bdc3c7',
        };
      default:
        return {
          border: ['#95a5a6', '#7f8c8d'],
          glow: '#95a5a6',
          icon: '#bdc3c7',
        };
    }
  };

  const getPositionStyle = () => {
    const randomOffset = Math.sin(index * 0.5) * 10;
    switch (position) {
      case 'left':
        return {
          transform: [
            { translateX: -30 + randomOffset },
            { translateY: Math.sin(index) * 5 },
          ],
        };
      case 'right':
        return {
          transform: [
            { translateX: 30 - randomOffset },
            { translateY: Math.cos(index) * 5 },
          ],
        };
      default:
        return {
          transform: [
            { translateY: Math.sin(index * 0.5) * 8 },
          ],
        };
    }
  };

  const iconConfig = getIconConfig();
  const statusColors = getStatusColors();
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '10deg'],
  });

  return (
    <Animated.View 
      style={[
        styles.container, 
        getPositionStyle(),
        !isLast && styles.withConnector,
        isFirst && styles.firstNode,
      ]}
    >
      {!isLast && currentStatus !== 'locked' && (
        <Animated.View 
          style={[
            styles.connector,
            {
              backgroundColor: currentStatus === 'completed' ? '#FFD700' : color,
              transform: [{ scaleY: scaleAnim }],
            },
          ]} 
        />
      )}

      {currentStatus === 'completed' && (
        <>
          <Animated.View
            style={[
              styles.completedGlow,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.8],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.completedGlowLarge,
              {
                opacity: completedGlowAnim,
              },
            ]}
          />
        </>
      )}

      {currentStatus === 'available' && (
        <Animated.View
          style={[
            styles.glowEffect,
            {
              opacity: glowAnim,
              backgroundColor: statusColors.glow,
            },
          ]}
        />
      )}

      <TouchableOpacity
        onPress={onPress}
        disabled={currentStatus === 'locked'}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.nodeWrapper,
            {
              transform: [
                { scale: currentStatus === 'available' ? scaleAnim : 1 },
                { translateY: bounceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10],
                })},
              ],
            },
          ]}
        >
          {currentStatus === 'completed' && (
            <LinearGradient
              colors={['rgba(255,215,0,0.4)', 'rgba(255,165,0,0.2)']}
              style={styles.completedOverlay}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}

          <LinearGradient
            colors={statusColors.border}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.outerRing}
          />

          <LinearGradient
            colors={currentStatus === 'locked' 
              ? ['#bdc3c7', '#95a5a6']
              : currentStatus === 'completed'
              ? ['#FFD700', '#FFA500']
              : iconConfig.bg
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.node}
          >
            {currentStatus === 'completed' && (
              <>
                <Animated.View style={[styles.particle, styles.particle1, { transform: [{ rotate: spin }] }]} />
                <Animated.View style={[styles.particle, styles.particle2, { transform: [{ rotate: spin }] }]} />
                <Animated.View style={[styles.particle, styles.particle3, { transform: [{ rotate: spin }] }]} />
                <Animated.View style={[styles.particle, styles.particle4, { transform: [{ rotate: spin }] }]} />
              </>
            )}

            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Ionicons 
                name={iconConfig.name}
                size={36} 
                color={statusColors.icon}
              />
            </Animated.View>

            {currentStatus === 'completed' && stars > 0 && (
              <BlurView intensity={80} style={styles.starsBadge}>
                <View style={styles.starsRow}>
                  {[1, 2, 3].map((i) => (
                    <Ionicons
                      key={i}
                      name="star"
                      size={12}
                      color={i <= stars ? '#FFD700' : '#ffffff80'}
                    />
                  ))}
                </View>
              </BlurView>
            )}

            {currentStatus === 'locked' && (
              <BlurView intensity={60} style={styles.lockContainer}>
                <Ionicons name="lock-closed" size={20} color="#ffffff" />
              </BlurView>
            )}

            {currentStatus === 'available' && (
              <BlurView intensity={60} style={styles.availableBadge}>
                <Ionicons name="play" size={12} color="#ffffff" />
              </BlurView>
            )}
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>

      <BlurView intensity={40} tint="light" style={[
        styles.titleContainer,
        currentStatus === 'completed' && styles.titleContainerCompleted
      ]}>
        <Text 
          style={[
            styles.title, 
            currentStatus === 'locked' && styles.titleLocked,
            currentStatus === 'completed' && styles.titleCompleted
          ]} 
          numberOfLines={2}
        >
          {title}
        </Text>
      </BlurView>

      <View style={[
        styles.typeIndicator, 
        { 
          backgroundColor: currentStatus === 'completed' 
            ? '#FFD700' + '30'
            : color + '30' 
        }
      ]}>
        <Text style={[
          styles.typeText, 
          { 
            color: currentStatus === 'completed' 
              ? '#FFD700' 
              : color 
          }
        ]}>
          {type === 'lesson' ? 'Leçon' : type === 'review' ? 'Révision' : 'Test'}
        </Text>
      </View>

      {currentStatus === 'completed' && (
        <View style={styles.completedRibbon}>
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.completedRibbonGradient}
          >
            <Text style={styles.completedRibbonText}>✅ Complété</Text>
          </LinearGradient>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 120,
    marginBottom: 30,
    position: 'relative',
  },
  withConnector: {
    marginBottom: 40,
  },
  firstNode: {
    marginTop: 20,
  },
  connector: {
    position: 'absolute',
    bottom: -30,
    width: 4,
    height: 30,
    borderRadius: 2,
    zIndex: -1,
  },
  glowEffect: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.3,
    zIndex: -2,
  },
  completedGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFD700',
    opacity: 0.3,
    zIndex: -2,
  },
  completedGlowLarge: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFD700',
    opacity: 0.1,
    zIndex: -3,
  },
  nodeWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  outerRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 50,
    opacity: 0.5,
  },
  node: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  completedOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 45,
    zIndex: 1,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
  },
  particle1: {
    top: -10,
    right: 10,
  },
  particle2: {
    bottom: -10,
    left: 20,
  },
  particle3: {
    top: 20,
    left: -10,
  },
  particle4: {
    bottom: 20,
    right: -10,
  },
  starsBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  lockContainer: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  availableBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  titleContainer: {
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
    marginTop: 4,
    maxWidth: 100,
  },
  titleContainerCompleted: {
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  titleLocked: {
    color: '#9ca3af',
  },
  titleCompleted: {
    color: '#FFD700',
  },
  typeIndicator: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  completedRibbon: {
    position: 'absolute',
    top: -5,
    right: -15,
    transform: [{ rotate: '15deg' }],
  },
  completedRibbonGradient: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  completedRibbonText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
  },
});