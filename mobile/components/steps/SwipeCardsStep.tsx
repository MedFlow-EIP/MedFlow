import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, PanResponder } from "react-native";
import Animated, { FadeInRight, FadeInLeft } from "react-native-reanimated";
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";
import { StepOverline, StepPrimaryButton, makeStepStyles } from "./StepShared";

interface Card {
  id: string;
  concept: string;
  detail?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface SwipeCardsStepProps {
  title?: string;
  cards: Card[];
  onComplete: () => void;
}

const SWIPE_DISTANCE = 50;

export function SwipeCardsStep({ title = "À retenir", cards, onComplete }: SwipeCardsStepProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const step = useMemo(() => makeStepStyles(colors), [colors]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const indexRef = useRef(0);
  indexRef.current = currentIndex;

  const goTo = (next: number) => {
    if (next < 0 || next > cards.length - 1) return;
    setDirection(next > indexRef.current ? 1 : -1);
    setCurrentIndex(next);
  };

  // Glisser vers la gauche = carte suivante, vers la droite = précédente.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_, g) => {
          if (g.dx < -SWIPE_DISTANCE) goTo(indexRef.current + 1);
          else if (g.dx > SWIPE_DISTANCE) goTo(indexRef.current - 1);
        },
      }),
    [cards.length]
  );

  const isLastCard = currentIndex === cards.length - 1;
  const card = cards[currentIndex];

  return (
    <View style={styles.container}>
      <View style={[step.scroll, styles.content]}>
        <StepOverline icon="albums-outline" label={`CARTE ${currentIndex + 1}/${cards.length}`} />
        <Text style={styles.title} accessibilityRole="header">{title}</Text>

        <View {...pan.panHandlers}>
          <Animated.View
            key={card.id}
            entering={direction === 1 ? FadeInRight.duration(200) : FadeInLeft.duration(200)}
            style={styles.card}
            accessible
            accessibilityLabel={`${card.concept}. ${card.detail ?? ''}`}
            accessibilityHint="Glisse à gauche ou à droite pour changer de carte"
          >
            <View style={styles.iconCircle}>
              <Ionicons name={card.icon ?? "bookmark-outline"} size={30} color={colors.primaryDark} />
            </View>
            <Text style={styles.concept}>{card.concept}</Text>
            {!!card.detail && <Text style={styles.detail}>{card.detail}</Text>}
          </Animated.View>
        </View>

        <View style={styles.navRow}>
          <Pressable
            style={[styles.navButton, currentIndex === 0 && styles.navDisabled]}
            onPress={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            accessibilityRole="button"
            accessibilityLabel="Carte précédente"
            accessibilityState={{ disabled: currentIndex === 0 }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.indicators}>
            {cards.map((c, i) => (
              <View key={c.id} style={[styles.dot, i === currentIndex && styles.activeDot]} />
            ))}
          </View>

          <Pressable
            style={[styles.navButton, isLastCard && styles.navDisabled]}
            onPress={() => goTo(currentIndex + 1)}
            disabled={isLastCard}
            accessibilityRole="button"
            accessibilityLabel="Carte suivante"
            accessibilityState={{ disabled: isLastCard }}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <StepPrimaryButton
        label={isLastCard ? "J’ai compris" : "Carte suivante"}
        onPress={isLastCard ? onComplete : () => goTo(currentIndex + 1)}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: -8,
    },
    card: {
      minHeight: 260,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: 24,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.action,
      backgroundColor: colors.surface,
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 6,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.tintPrimary,
      alignItems: "center",
      justifyContent: "center",
    },
    concept: {
      fontSize: 21,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },
    detail: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.textSecondary,
      textAlign: "center",
    },
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    navButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    navDisabled: {
      opacity: 0.4,
    },
    indicators: {
      flexDirection: "row",
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    activeDot: {
      width: 20,
      backgroundColor: colors.action,
    },
  });
}
