import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";

interface QuizOption {
  id: string;
  text: string;
}

interface QuickQuizCardsProps {
  question: string;
  options: QuizOption[];
  correctId: string;
  onComplete: (correct: boolean) => void;
}

export function QuickQuizCardsStep({ question, options, correctId, onComplete }: QuickQuizCardsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [selected, setSelected] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleSelect = (id: string) => {
    if (showFeedback) return;
    setSelected(id);
    setShowFeedback(true);
    const isCorrect = id === correctId;
    setTimeout(() => onComplete(isCorrect), 1200);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.question}>📝 {question}</Text>
        
        <View style={styles.optionsContainer}>
          {options.map(option => {
            const isSelected = selected === option.id;
            const isCorrectOption = option.id === correctId;

            let borderColor = colors.border;
            let backgroundColor = colors.surface;
            let textColor = colors.textPrimary;
            
            if (showFeedback) {
              if (isCorrectOption) {
                borderColor = colors.success;
                backgroundColor = colors.tintSuccess;
                textColor = colors.textPrimary;
              } else if (isSelected && !isCorrectOption) {
                borderColor = colors.danger;
                backgroundColor = colors.tintDanger;
                textColor = colors.textPrimary;
              }
            }

            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleSelect(option.id)}
                style={[
                  styles.option,
                  { 
                    borderColor,
                    backgroundColor,
                  }
                ]}
                disabled={showFeedback}
                accessibilityRole="button"
                accessibilityLabel={option.text}
                accessibilityState={{ disabled: showFeedback, selected: isSelected }}
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionText, { color: textColor }]}>
                    {option.text}
                  </Text>
                  {showFeedback && isCorrectOption && (
                    <MaterialIcons name="check-circle" size={24} color={colors.success} />
                  )}
                  {showFeedback && isSelected && !isCorrectOption && (
                    <MaterialIcons name="cancel" size={24} color={colors.danger} />
                  )}
                </View>
              </TouchableOpacity>
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
      marginBottom: 20,
      textAlign: "center",
    },
    optionsContainer: {
      gap: 12,
    },
    option: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    optionContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    optionText: {
      fontSize: 16,
      fontWeight: "500",
      flex: 1,
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