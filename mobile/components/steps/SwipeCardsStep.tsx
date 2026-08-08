import React, { useMemo, useState } from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";

interface Card {
  id: string;
  concept: string;
  image: string;
}

interface SwipeCardsStepProps {
  cards: Card[];
  onComplete: () => void;
}

export function SwipeCardsStep({ cards, onComplete }: SwipeCardsStepProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const isLastCard = currentIndex === cards.length - 1;
  const currentCard = cards[currentIndex];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Quick Learning</Text>

      <View style={styles.cardContainer}>
        <Image source={{ uri: currentCard.image }} style={styles.image} resizeMode="contain" />
        <Text style={styles.concept}>{currentCard.concept}</Text>
      </View>

      {/* Indicators */}
      <View style={styles.indicators}>
        {cards.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex ? styles.activeDot : undefined,
            ]}
          />
        ))}
      </View>

      {/* Navigation */}
      <View style={styles.navRow}>
        <Pressable
          style={[styles.navButton, currentIndex === 0 && styles.disabled]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textInverse} />
        </Pressable>

        {isLastCard && (
          <Pressable style={styles.continueButton} onPress={onComplete}>
            <Text style={styles.continueText}>Got it! →</Text>
          </Pressable>
        )}

        <Pressable
          style={[
            styles.navButton,
            isLastCard && styles.disabled,
          ]}
          onPress={handleNext}
          disabled={isLastCard}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.textInverse} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { 
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      backgroundColor: colors.background,
    },
    header: { 
      fontSize: 24, 
      fontWeight: "700", 
      marginBottom: 16,
      color: colors.textPrimary,
    },
    cardContainer: {
      width: "100%",
      backgroundColor: colors.tintPrimary,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
      marginBottom: 16,
    },
    image: { 
      width: "100%", 
      height: 180, 
      borderRadius: 12, 
      marginBottom: 12,
    },
    concept: { 
      fontSize: 18, 
      fontWeight: "600", 
      textAlign: "center",
      color: colors.textPrimary,
    },
    indicators: { 
      flexDirection: "row", 
      gap: 8, 
      marginBottom: 20,
    },
    dot: { 
      width: 8, 
      height: 8, 
      borderRadius: 4, 
      backgroundColor: colors.muted,
    },
    activeDot: { 
      width: 16, 
      backgroundColor: colors.primary,
    },
    navRow: { 
      flexDirection: "row", 
      justifyContent: "space-between", 
      width: "100%", 
      alignItems: "center",
    },
    navButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    disabled: { 
      backgroundColor: colors.muted,
    },
    continueButton: {
      flex: 1,
      marginHorizontal: 12,
      paddingVertical: 14,
      backgroundColor: colors.success,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    continueText: { 
      color: colors.textInverse, 
      fontWeight: "700",
    },
  });
}