import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

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

            let borderColor = "#3b82f6";
            let backgroundColor = "#3b82f6";
            let opacity = 0.6;
            
            if (showFeedback) {
              if (isCorrect) {
                borderColor = "#10b981";
                backgroundColor = "#10b981";
                opacity = 1;
              } else if (isSelected && !isCorrect) {
                borderColor = "#ef4444";
                backgroundColor = "#ef4444";
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
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
});