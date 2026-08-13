import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import { API_URL } from "@/services/api";
import * as DocumentPicker from "expo-document-picker";
import RenderHTML from "react-native-render-html";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../../firebaseConfig";
import { logScreenView } from "../../utils/analytics";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";

export function UploadCourseScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    logScreenView('UploadCourseScreen');
  }, []);

  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("resume");
  const [quizAnswers, setQuizAnswers] = useState<any>({});
  const [quizValidation, setQuizValidation] = useState(false);

  const { width } = useWindowDimensions();
  const navigation = useNavigation();

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setFile(result.assets[0]);
      setData(null);
      setError("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    if (!file) return;

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Erreur", "Vous devez être connecté");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: "application/pdf",
      } as any);

      formData.append("uid", user.uid);

      const response = await fetch(`${API_URL}/api/process`, {
        method: "POST",
        headers: {
          "X-User-UID": user.uid,
          "X-User-Name": user.displayName || "",
          "X-User-Avatar": user.photoURL || "",
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Erreur serveur");
      }

      setData({
        resume: result.summary,
        flashcards: result.flashcards,
        quiz: result.quiz,
        courseId: result.id,
        courseName: result.nom,
      });

      setQuizAnswers({});
      setQuizValidation(false);
      setActiveTab("resume");
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 10, marginTop: 30 }}>
          <Text style={styles.title}>Importer un cours</Text>
          <Text style={styles.subtitle}>
            PDF → résumé, flashcards & quiz IA
          </Text>
        </View>
      </View>

      {/* UPLOAD CARD */}
      <TouchableOpacity style={styles.uploadCard} onPress={pickDocument}>
        <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
        <Text style={styles.uploadText}>
          {file ? "Changer de PDF" : "Importer un PDF"}
        </Text>
        <Text style={styles.uploadHint}>
          Analyse automatique par IA
        </Text>
      </TouchableOpacity>

      {/* FILE */}
      {file && (
        <View style={styles.fileCard}>
          <Ionicons name="document-text" size={20} color={colors.success} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.fileName}>{file.name}</Text>
            <Text style={styles.fileSize}>
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </Text>
          </View>
        </View>
      )}

      {/* GENERATE */}
      {file && (
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} accessibilityLabel="Génération en cours" />
          ) : (
            <Text style={styles.generateText}>
              Générer le contenu
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* ERROR */}
      {!!error && <Text style={styles.error}>{error}</Text>}

      {/* RESULT */}
      {data && (
        <View style={{ marginTop: 25 }}>
          <Text style={styles.success}>
            {data.courseName}
          </Text>

          {/* TABS */}
          <View style={styles.tabs}>
            {["resume", "flashcards", "quiz"].map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabButton,
                  activeTab === tab && styles.activeTab,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}
                >
                  {tab === "resume"
                    ? "Résumé"
                    : tab === "flashcards"
                    ? "Flashcards"
                    : "Quiz"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* RESUME */}
          {activeTab === "resume" && (
            <View style={styles.card}>
              <RenderHTML
                contentWidth={width}
                source={{ html: data.resume }}
                baseStyle={{ color: colors.textSecondary }}
              />
            </View>
          )}

          {/* FLASHCARDS */}
          {activeTab === "flashcards" && (
            <View>
              {data.flashcards.map((card: any, i: number) => (
                <View key={i} style={styles.flashcard}>
                  <Text style={styles.question}>{card.question}</Text>
                  <Text style={styles.answer}>{card.answer}</Text>
                </View>
              ))}
            </View>
          )}

          {/* QUIZ */}
          {activeTab === "quiz" && (
            <View>
              {data.quiz.map((q: any, i: number) => (
                <View key={i} style={styles.quizBox}>
                  <Text style={styles.question}>{q.question}</Text>

                  {Object.entries(q.options).map(([key, value]: any) => {
                    const isCorrect = key === q.correct;
                    const isSelected = quizAnswers[i] === key;

                    let bg = colors.surfaceAlt;

                    if (quizValidation) {
                      if (isCorrect) bg = colors.success;
                      else if (isSelected) bg = colors.danger;
                    } else if (isSelected) {
                      bg = colors.primary;
                    }

                    // bg peut être un fond neutre (surfaceAlt) ou un fond
                    // accentué (primary/success/danger) selon l'état — la
                    // couleur du texte doit suivre, sinon le texte devient
                    // illisible sur le fond neutre clair (blanc sur quasi-blanc).
                    const optionTextColor =
                      bg === colors.surfaceAlt ? colors.textPrimary : colors.onAccent;

                    return (
                      <TouchableOpacity
                        key={key}
                        disabled={quizValidation}
                        onPress={() =>
                          setQuizAnswers({
                            ...quizAnswers,
                            [i]: key,
                          })
                        }
                        style={[styles.optionButton, { backgroundColor: bg }]}
                      >
                        <Text style={[styles.optionText, { color: optionTextColor }]}>
                          {key}. {value}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {!quizValidation && (
                <TouchableOpacity
                  style={styles.validateBtn}
                  onPress={() => setQuizValidation(true)}
                >
                  <Text style={styles.generateText}>Valider</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

/* ---------------- STYLE ---------------- */

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      padding: 20,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
      gap: 12,
    },

    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
      marginTop: 30,
      marginLeft: 10,
    },

    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },

    uploadCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 22,
      alignItems: "center",
      marginBottom: 16,
      gap: 12,
      alignSelf: "center",
      width: "95%",

      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 10,
      elevation: 2,
    },

    uploadTitle: {
      marginTop: 10,
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    uploadHint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },

    fileBox: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,

      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },

    fileCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      padding: 14,
      borderRadius: 16,
      marginTop: 12,
      gap: 12,
      alignSelf: "center",
      width: "95%",

      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },

    fileName: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 14,
    },

    fileSize: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },

    generateBtn: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 16,
      alignSelf: "center",
      gap: 12,
      width: "95%",

      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 3,
    },

    generateText: {
      color: colors.onAccent,
      fontWeight: "700",
      fontSize: 15,
    },

    primaryBtn: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 16,

      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 3,
      
    },

    primaryText: {
      color: colors.onAccent,
      fontWeight: "700",
    },

    error: {
      color: colors.danger,
      marginTop: 10,
      fontWeight: "500",
    },

    success: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 12,
      textAlign: "center",
      color: colors.textPrimary,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,

      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
      gap: 12,
      alignSelf: "center",
      width: "95%",
    },

    flashcard: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,

      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
      gap: 12,
      alignSelf: "center",
      width: "95%",
    },

    question: {
      color: colors.textPrimary,
      fontWeight: "700",
      marginBottom: 6,
      
    },

    answer: {
      color: colors.textSecondary,
    },

    quizBox: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 16,
      marginBottom: 20,

      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
      gap: 12,
      alignSelf: "center",
      width: "95%",
    },

    optionButton: {
      padding: 12,
      borderRadius: 10,
      marginTop: 8,
    },

    optionText: {
      fontWeight: "600",
    },

    uploadText: {
      color: colors.textPrimary,
      fontWeight: "700",
      marginTop: 10,
      fontSize: 16,
    },

    tabs: {
      flexDirection: "row",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 4,
      marginTop: 10,
      marginBottom: 16,
      gap: 12,
      alignSelf: "center",
      width: "95%",
    },

    tabButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },

    activeTab: {
      backgroundColor: colors.primary,
    },

    tabText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },

    tabTextActive: {
      color: colors.onAccent,
    },

    validateBtn: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 16,
      marginBottom: 20,

      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 3,
    },

    validateText: {
      color: colors.onAccent,
      fontWeight: "700",
      fontSize: 15,
    },
  });
}