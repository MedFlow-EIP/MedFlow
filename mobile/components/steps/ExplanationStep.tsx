import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image, ScrollView, ImageSourcePropType } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";
import { StepOverline, StepPrimaryButton, makeStepStyles } from "./StepShared";

interface Props {
  title: string;
  explanation: string;
  /** Points clés affichés en liste sous l'explication. */
  points?: string[];
  image?: ImageSourcePropType | string;
  onContinue: () => void;
}

export function ExplanationStep({ title, explanation, points, image, onContinue }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const step = useMemo(() => makeStepStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={step.scroll} showsVerticalScrollIndicator={false}>
        <StepOverline icon="bulb-outline" label="À COMPRENDRE" />
        <Text style={styles.title} accessibilityRole="header">{title}</Text>

        {image ? (
          <Image
            source={typeof image === "string" ? { uri: image } : image}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={`Illustration : ${title}`}
          />
        ) : null}

        <Text style={styles.text}>{explanation}</Text>

        {points && points.length > 0 && (
          <View style={styles.pointsCard}>
            {points.map((point) => (
              <View key={point} style={styles.pointRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <StepPrimaryButton label="Continuer" onPress={onContinue} />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: -8,
    },
    text: {
      fontSize: 16,
      lineHeight: 25,
      color: colors.textPrimary,
    },
    image: {
      width: "100%",
      height: 200,
      borderRadius: 16,
      backgroundColor: "#ffffff",
    },
    pointsCard: {
      gap: 12,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pointRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    pointText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textPrimary,
    },
  });
}
