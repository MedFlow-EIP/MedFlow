import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

interface Option {
  id: string;
  text: string;
}

interface Props {
  question: string;
  options: Option[];
  correctId: string;
  timeLimit: number;
  onComplete: (correct: boolean) => void;
}

export function SpeedChallengeStep({
  question,
  options,
  correctId,
  timeLimit,
  onComplete,
}: Props) {
  const [time, setTime] = useState(timeLimit);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    if (answered) return;

    const timer = setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          clearInterval(timer);
          setAnswered(true);
          setShowFeedback(true);
          
          setTimeout(() => {
            onComplete(false);
          }, 1500);
          
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [answered]);

  const select = (id: string) => {
    if (answered) return;
    
    setSelectedId(id);
    setAnswered(true);
    setShowFeedback(true);

    const correct = id === correctId;
    
    setTimeout(() => {
      onComplete(correct);
    }, 1500);
  };

  const timerColor = time <= 3 ? "#ef4444" : "#111827";

  return (
    <View style={styles.container}>
      {/* Timer dans une card */}
      <View style={styles.card}>
        <Text style={[styles.timer, { color: timerColor }]}>⏱ {time}s</Text>
      </View>

      {/* Question dans une card */}
      <View style={[styles.card, { marginTop: 12, marginBottom: 20 }]}>
        <Text style={styles.question}>⚡ {question}</Text>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {options.map((o) => {
          const isSelected = selectedId === o.id;
          const isCorrect = o.id === correctId;

          let borderColor = "#e5e7eb";
          let backgroundColor = "#ffffff";
          let textColor = "#111827";
          
          if (answered) {
            if (isCorrect) {
              borderColor = "#10b981";
              backgroundColor = "#f0fdf4";
            } else if (isSelected && !isCorrect) {
              borderColor = "#ef4444";
              backgroundColor = "#fef2f2";
            }
          }

          return (
            <Pressable
              key={o.id}
              style={[
                styles.option,
                { 
                  borderColor,
                  backgroundColor,
                }
              ]}
              onPress={() => select(o.id)}
              disabled={answered}
            >
              <View style={styles.optionContent}>
                <Text style={[styles.optionText, { color: textColor }]}>
                  {o.text}
                </Text>
                {answered && isCorrect && (
                  <Text style={styles.checkIcon}>✓</Text>
                )}
                {answered && isSelected && !isCorrect && (
                  <Text style={styles.crossIcon}>✗</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Feedback */}
      {showFeedback && selectedId && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.feedback}>
          <View style={[
            styles.feedbackCard,
            { backgroundColor: selectedId === correctId ? "#10b981" : "#ef4444" }
          ]}>
            <Text style={styles.feedbackText}>
              {selectedId === correctId ? "✓ Correct !" : "✗ Try again!"}
            </Text>
            {selectedId !== correctId && (
              <Text style={[styles.feedbackText, { fontSize: 14, marginTop: 8, opacity: 0.9 }]}>
                {options.find(o => o.id === correctId)?.text}
              </Text>
            )}
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
    alignItems: "center",
  },
  timer: {
    fontSize: 48,
    fontWeight: "700",
  },
  question: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 8,
  },
  option: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#ffffff",
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
  checkIcon: {
    fontSize: 20,
    color: "#10b981",
    fontWeight: "700",
  },
  crossIcon: {
    fontSize: 20,
    color: "#ef4444",
    fontWeight: "700",
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
    textAlign: "center",
  },
});