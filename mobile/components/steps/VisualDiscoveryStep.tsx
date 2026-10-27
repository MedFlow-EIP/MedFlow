import React, { useMemo, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, ImageSourcePropType } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";
import { StepFeedback, StepOverline, StepPrimaryButton, makeStepStyles } from "./StepShared";

interface AnatomyPart {
  id: string;
  label: string;
  /** Position en % de l'image. */
  x: number;
  y: number;
}

interface VisualDiscoveryProps {
  question: string;
  image: ImageSourcePropType;
  /** Largeur / hauteur de l'image : le cadre a exactement ses proportions, les % tombent donc juste. */
  aspectRatio: number;
  parts: AnatomyPart[];
  correctId: string;
  explanation?: string;
  onComplete: (correct: boolean) => void;
}

const IMAGE_HEIGHT = 380;
const SPOT = 36;

export function VisualDiscovery({
  question,
  image,
  aspectRatio,
  parts,
  correctId,
  explanation,
  onComplete,
}: VisualDiscoveryProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const step = useMemo(() => makeStepStyles(colors), [colors]);
  const [selected, setSelected] = useState<string | null>(null);

  const answered = selected !== null;
  const isCorrect = selected === correctId;
  const correctLabel = parts.find((p) => p.id === correctId)?.label;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={step.scroll} showsVerticalScrollIndicator={false}>
        <StepOverline icon="scan-outline" label="REPÈRE ANATOMIQUE" />
        <Text style={[step.question, { marginTop: -8 }]} accessibilityRole="header">{question}</Text>

        {/* Fond blanc fixe : le schéma reste lisible en mode sombre. */}
        <View style={styles.frame}>
          <View style={{ height: IMAGE_HEIGHT, aspectRatio }}>
            <Image source={image} style={StyleSheet.absoluteFill} resizeMode="stretch" accessible={false} />
            {parts.map((part) => {
              const state = !answered
                ? "idle"
                : part.id === correctId
                ? "correct"
                : part.id === selected
                ? "incorrect"
                : "dimmed";
              const color =
                state === "correct" ? colors.success : state === "incorrect" ? colors.danger : colors.primaryDark;
              return (
                <View
                  key={part.id}
                  style={[styles.partWrap, { left: `${part.x}%`, top: `${part.y}%` }]}
                  pointerEvents="box-none"
                >
                  <TouchableOpacity
                    onPress={() => setSelected(part.id)}
                    disabled={answered}
                    style={[
                      styles.spot,
                      { borderColor: color, backgroundColor: color + "33", opacity: state === "dimmed" ? 0.35 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={answered ? part.label : `Zone ${parts.indexOf(part) + 1}`}
                  >
                    <View style={[styles.spotDot, { backgroundColor: color }]} />
                  </TouchableOpacity>
                  {answered && (state === "correct" || state === "incorrect") && (
                    <View style={[styles.label, { backgroundColor: color }]}>
                      <Text style={styles.labelText}>{part.label}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {answered && (
          <StepFeedback
            correct={isCorrect}
            title={isCorrect ? "Bien repéré !" : `C’était : ${correctLabel}`}
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
    frame: {
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "#ffffff",
      overflow: "hidden",
    },
    partWrap: {
      position: "absolute",
      width: 0,
      height: 0,
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
    },
    spot: {
      position: "absolute",
      width: SPOT,
      height: SPOT,
      borderRadius: SPOT / 2,
      borderWidth: 3,
      alignItems: "center",
      justifyContent: "center",
    },
    spotDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    label: {
      position: "absolute",
      top: SPOT / 2 + 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      minWidth: 90,
      alignItems: "center",
    },
    labelText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#ffffff",
    },
  });
}
