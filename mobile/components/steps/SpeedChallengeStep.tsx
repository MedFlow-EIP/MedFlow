import React, { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";
import { StepFeedback, StepOption, StepOverline, StepPrimaryButton, makeStepStyles } from "./StepShared";

interface Option {
  id: string;
  text: string;
}

interface Props {
  question: string;
  options: Option[];
  correctId: string;
  timeLimit: number;
  explanation?: string;
  onComplete: (correct: boolean) => void;
}

export function SpeedChallengeStep({ question, options, correctId, timeLimit, explanation, onComplete }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const step = useMemo(() => makeStepStyles(colors), [colors]);

  const [time, setTime] = useState(timeLimit);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const bar = useRef(new Animated.Value(1)).current;

  const answered = selectedId !== null || timedOut;

  useEffect(() => {
    if (answered) {
      bar.stopAnimation();
      return;
    }
    Animated.timing(bar, {
      toValue: 0,
      duration: time * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    const timer = setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          clearInterval(timer);
          setTimedOut(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [answered]);

  const isCorrect = selectedId === correctId;
  const correctText = options.find((o) => o.id === correctId)?.text;
  const urgent = time <= 3 && !answered;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={step.scroll} showsVerticalScrollIndicator={false}>
        <StepOverline icon="flash-outline" label="DÉFI CHRONO" />

        <View style={styles.timerRow} accessible accessibilityLabel={`${time} secondes restantes`}>
          <Ionicons name="timer-outline" size={22} color={urgent ? colors.dangerText : colors.textPrimary} />
          <Text style={[styles.timerText, urgent && { color: colors.dangerText }]}>{time} s</Text>
          <View style={styles.timerTrack}>
            <Animated.View
              style={[
                styles.timerFill,
                {
                  backgroundColor: urgent ? colors.danger : colors.warning,
                  width: bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                },
              ]}
            />
          </View>
        </View>

        <Text style={step.question} accessibilityRole="header">{question}</Text>

        <View style={step.options}>
          {options.map((o) => (
            <StepOption
              key={o.id}
              text={o.text}
              disabled={answered}
              onPress={() => setSelectedId(o.id)}
              state={
                !answered ? "idle" : o.id === correctId ? "correct" : o.id === selectedId ? "incorrect" : "dimmed"
              }
            />
          ))}
        </View>

        {answered && (
          <StepFeedback
            correct={isCorrect}
            title={
              timedOut
                ? `Temps écoulé ! Réponse : ${correctText}`
                : isCorrect
                ? `Bonne réponse, en ${timeLimit - time} s !`
                : `Bonne réponse : ${correctText}`
            }
            explanation={explanation}
          />
        )}
      </ScrollView>

      {answered && <StepPrimaryButton label="Continuer" onPress={() => onComplete(isCorrect)} />}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    timerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    timerText: {
      width: 44,
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    timerTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    timerFill: {
      height: "100%",
      borderRadius: 4,
    },
  });
}
