import React, { useMemo, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";

interface AnatomyPart {
  id: string;
  x: number;
  y: number;
}

interface VisualDiscoveryProps {
  question: string;
  imageUrl: string;
  parts: AnatomyPart[];
  correctId: string;
  onComplete: (correct: boolean) => void;
}

export function VisualDiscovery({ question, imageUrl, parts, correctId, onComplete }: VisualDiscoveryProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [selected, setSelected] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleTap = (id: string) => {
    if (showFeedback) return;
    setSelected(id);
    setShowFeedback(true);
    const isCorrect = id === correctId;
    setTimeout(() => onComplete(isCorrect), 1200);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.question}>🔍 {question}</Text>
        
        <View style={styles.imageWrapper}>
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
          {parts.map(part => {
            const isSelected = selected === part.id;
            const isCorrect = part.id === correctId;

            let borderColor = colors.primary;
            let backgroundColor = colors.primary;
            let opacity = 0.6;
            
            if (showFeedback) {
              if (isCorrect) {
                borderColor = colors.success;
                backgroundColor = colors.success;
                opacity = 1;
              } else if (isSelected && !isCorrect) {
                borderColor = colors.danger;
                backgroundColor = colors.danger;
                opacity = 1;
              } else {
                opacity = 0.3;
              }
            }

            return (
              <TouchableOpacity
                key={part.id}
                onPress={() => handleTap(part.id)}
                style={[
                  styles.part,
                  { 
                    left: `${part.x}%`, 
                    top: `${part.y}%`,
                    borderColor,
                    backgroundColor,
                    opacity,
                  }
                ]}
                disabled={showFeedback}
              />
            );
          })}
        </View>
      </View>

      {showFeedback && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.feedback}>
          <View style={[
            styles.feedbackCard,
            { backgroundColor: selected === correctId ? colors.success : colors.danger }
          ]}>
            <Text style={styles.feedbackText}>
              {selected === correctId ? "✓ Correct !" : "✗ Try again!"}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.surface,
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    question: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 16,
      textAlign: "center",
    },
    imageWrapper: {
      alignItems: "center",
      justifyContent: "center",
    },
    image: {
      width: "100%",
      height: 300,
      borderRadius: 12,
    },
    part: {
      position: "absolute",
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 3,
      transform: [{ translateX: -22 }, { translateY: -22 }],
    },
    feedback: {
      marginTop: 20,
    },
    feedbackCard: {
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
    },
    feedbackText: {
      color: colors.textInverse,
      fontWeight: "600",
      fontSize: 16,
    },
  });
}