import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { StepFeedback, StepOption, StepOverline, StepPrimaryButton, makeStepStyles } from "./StepShared";

interface QuizOption {
  id: string;
  text: string;
}

interface QuickQuizCardsProps {
  question: string;
  options: QuizOption[];
  correctId: string;
  explanation?: string;
  onComplete: (correct: boolean) => void;
}

export function QuickQuizCardsStep({ question, options, correctId, explanation, onComplete }: QuickQuizCardsProps) {
  const { colors } = useTheme();
  const step = useMemo(() => makeStepStyles(colors), [colors]);
  const [selected, setSelected] = useState<string | null>(null);

  const answered = selected !== null;
  const isCorrect = selected === correctId;
  const correctText = options.find((o) => o.id === correctId)?.text;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={step.scroll} showsVerticalScrollIndicator={false}>
        <StepOverline icon="help-circle-outline" label="QUIZ" />
        <Text style={[step.question, { marginTop: -8 }]} accessibilityRole="header">{question}</Text>

        <View style={step.options}>
          {options.map((option) => (
            <StepOption
              key={option.id}
              text={option.text}
              disabled={answered}
              onPress={() => setSelected(option.id)}
              state={
                !answered
                  ? "idle"
                  : option.id === correctId
                  ? "correct"
                  : option.id === selected
                  ? "incorrect"
                  : "dimmed"
              }
            />
          ))}
        </View>

        {answered && (
          <StepFeedback
            correct={isCorrect}
            title={isCorrect ? "Bonne réponse !" : `Bonne réponse : ${correctText}`}
            explanation={explanation}
          />
        )}
      </ScrollView>

      {answered && <StepPrimaryButton label="Continuer" onPress={() => onComplete(isCorrect)} />}
    </View>
  );
}
