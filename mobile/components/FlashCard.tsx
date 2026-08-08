import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

interface FlashCardProps {
  question: string;
  answer: string;
  color: string;
}

const { width } = Dimensions.get('window');

export function FlashCard({ question, answer, color }: FlashCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [isFlipped, setIsFlipped] = useState(false);
  const rotation = useSharedValue(0);

  const handleFlip = () => {
    rotation.value = withTiming(isFlipped ? 0 : 180, { duration: 300 });
    setIsFlipped(!isFlipped);
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(rotation.value, [0, 180], [0, 180]);
    return {
      transform: [{ rotateY: `${rotateValue}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(rotation.value, [0, 180], [180, 360]);
    return {
      transform: [{ rotateY: `${rotateValue}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  return (
    <TouchableOpacity
      onPress={handleFlip}
      activeOpacity={0.9}
      style={styles.container}
    >
      <View style={styles.cardWrapper}>
        <Animated.View
          style={[
            styles.card,
            styles.cardFront,
            { borderColor: color },
            frontAnimatedStyle,
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.badge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.badgeText, { color }]}>Question</Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.questionText}>{question}</Text>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.tapHint}>👆 Appuyez pour révéler la réponse</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            styles.cardBack,
            { backgroundColor: color },
            backAnimatedStyle,
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.badgeWhite}>
              <Text style={styles.badgeTextWhite}>Réponse</Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.answerText}>{answer}</Text>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.tapHintWhite}>👆 Appuyez pour voir la question</Text>
          </View>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: '100%',
      minHeight: 400,
    },
    cardWrapper: {
      position: 'relative',
      width: '100%',
      minHeight: 400,
    },
    card: {
      position: 'absolute',
      width: '100%',
      minHeight: 400,
      borderRadius: 20,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5,
    },
    cardFront: {
      backgroundColor: colors.surface,
      borderWidth: 2,
    },
    cardBack: {
      backgroundColor: colors.primary,
    },
    cardHeader: {
      marginBottom: 24,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    badgeWhite: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    badgeTextWhite: {
      fontSize: 12,
      fontWeight: '600',
      color: '#ffffff',
    },
    cardContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    questionText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
      lineHeight: 30,
    },
    answerText: {
      fontSize: 18,
      color: '#ffffff',
      textAlign: 'center',
      lineHeight: 28,
    },
    cardFooter: {
      marginTop: 24,
    },
    tapHint: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
    tapHintWhite: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
    },
  });
}