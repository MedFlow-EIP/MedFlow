import React from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";

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

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },

  text: {
    fontSize: 16,
    color: "#6b7280",
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
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 12,
  },

  buttonText: {
    textAlign: "center",
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});