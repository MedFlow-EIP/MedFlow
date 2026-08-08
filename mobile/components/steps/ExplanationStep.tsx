import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";

interface Props {
  title: string;
  explanation: string;
  image?: string;
  onContinue: () => void;
}

export function ExplanationStep({
  title,
  explanation,
  image,
  onContinue,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>💡 {title}</Text>

        {image && (
          <Image
            source={{ uri: image }}
            style={styles.image}
            resizeMode="contain"
          />
        )}

        <Text style={styles.text}>{explanation}</Text>
      </View>

      <Pressable style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>Continuer</Text>
      </Pressable>
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

    title: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 16,
    },

    text: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 24,
    },

    image: {
      width: "100%",
      height: 200,
      borderRadius: 12,
      marginBottom: 16,
    },

    button: {
      marginTop: 24,
      backgroundColor: colors.textPrimary,
      padding: 16,
      borderRadius: 12,
    },

    buttonText: {
      textAlign: "center",
      color: colors.background,
      fontWeight: "600",
      fontSize: 16,
    },
  });
}