import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";

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

            let borderColor = "#e5e7eb";
            let backgroundColor = "#ffffff";
            let textColor = "#111827";
            
            if (showFeedback) {
              if (isCorrectOption) {
                borderColor = "#10b981";
                backgroundColor = "#f0fdf4";
                textColor = "#111827";
              } else if (isSelected && !isCorrectOption) {
                borderColor = "#ef4444";
                backgroundColor = "#fef2f2";
                textColor = "#111827";
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
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionText, { color: textColor }]}>
                    {option.text}
                  </Text>
                  {showFeedback && isCorrectOption && (
                    <MaterialIcons name="check-circle" size={24} color="#10b981" />
                  )}
                  {showFeedback && isSelected && !isCorrectOption && (
                    <MaterialIcons name="cancel" size={24} color="#ef4444" />
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
            { backgroundColor: selected === correctId ? "#10b981" : "#ef4444" }
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  question: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
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
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
});