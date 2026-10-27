import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";

import { API_URL } from "@/services/api";
import * as DocumentPicker from "expo-document-picker";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../../firebaseConfig";
import { getAuthHeaders } from "../../utils/authHeaders";
import { logScreenView } from "../../utils/analytics";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";
import {
  CourseTabs,
  CourseTab,
  FlashcardList,
  QuizList,
  SummaryCard,
} from "../course/CourseContent";
import { useScreenInsets } from "../navigation/constants";
import { appAlert } from '../../utils/appAlert';

const formatSize = (bytes?: number) =>
  bytes ? `${(bytes / 1024 / 1024).toFixed(2).replace(".", ",")} Mo` : "";

const AI_OUTPUTS = [
  { title: "Un résumé structuré", detail: "titres, définitions, points clés" },
  { title: "Des flashcards", detail: "révisées ensuite en répétition espacée" },
  { title: "Un quiz", detail: "pour vérifier que c’est acquis" },
];

export function UploadCourseScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();

  useEffect(() => {
    logScreenView('UploadCourseScreen');
  }, []);

  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<CourseTab>("resume");

  const navigation = useNavigation<any>();

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

  const removeFile = () => {
    setFile(null);
    setData(null);
    setError("");
  };

  const handleGenerate = async () => {
    if (!file) return;

    const user = auth.currentUser;
    if (!user) {
      appAlert("Erreur", "Vous devez être connecté");
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
        headers: await getAuthHeaders(user),
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Erreur serveur");
      }

      setData({
        resume: result.summary,
        flashcards: Array.isArray(result.flashcards) ? result.flashcards : [],
        quiz: Array.isArray(result.quiz) ? result.quiz : [],
        courseId: result.id,
        courseName: result.nom,
      });

      setActiveTab("resume");
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const generateLabel = loading
    ? "Analyse du PDF…"
    : data
    ? "Régénérer le contenu"
    : "Générer le contenu";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom + 110 }]} showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>

          {data ? (
            <Text style={styles.titleGenerated} accessibilityRole="header">Contenu généré</Text>
          ) : (
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header">Importer un cours</Text>
              <Text style={styles.subtitle}>PDF → résumé, flashcards & quiz IA</Text>
            </View>
          )}
        </View>

        {!data && (
          <>
            {/* ZONE D'IMPORT : entièrement cliquable */}
            <TouchableOpacity
              style={styles.dropZone}
              onPress={pickDocument}
              accessibilityRole="button"
              accessibilityLabel={file ? "Changer de PDF" : "Importer un PDF"}
            >
              <View style={styles.dropIcon}>
                <Ionicons name="cloud-upload-outline" size={30} color={colors.primaryDark} />
              </View>
              <Text style={styles.dropTitle}>{file ? "Changer de PDF" : "Importer un PDF"}</Text>
              <Text style={styles.dropHint}>PDF · 20 Mo max · analyse automatique par IA</Text>
            </TouchableOpacity>

            {/* FICHIER SÉLECTIONNÉ */}
            {file && (
              <View style={styles.fileCard}>
                <View style={styles.fileIcon}>
                  <Ionicons name="document-text" size={22} color={colors.success} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                  <Text style={styles.fileSize}>{formatSize(file.size)} · prêt à être analysé</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={removeFile}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Retirer le fichier"
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* CE QUE L'IA VA GÉNÉRER */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>L’IA va générer</Text>
              {AI_OUTPUTS.map((item) => (
                <View key={item.title} style={styles.infoRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <View style={styles.infoText}>
                    <Text style={styles.infoItemTitle}>{item.title}</Text>
                    <Text style={styles.infoItemDetail}>{item.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ERREUR */}
        {!!error && (
          <View style={styles.errorCard} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={20} color={colors.dangerText} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* RÉSULTAT */}
        {data && (
          <>
            <View style={styles.savedBanner} accessibilityLiveRegion="polite">
              <View style={styles.savedIcon}>
                <Ionicons name="checkmark" size={16} color="#ffffff" />
              </View>
              <View style={styles.savedText}>
                <Text style={styles.savedTitle}>Cours enregistré</Text>
                <Text style={styles.savedDetail}>Retrouve-le dans tes stats, rubrique « Mes cours ».</Text>
              </View>
              {data.courseId ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate("CourseDetail", { courseId: data.courseId })}
                  style={styles.savedLink}
                  accessibilityRole="link"
                  accessibilityLabel="Voir le cours dans Mes cours"
                >
                  <Text style={styles.savedLinkText}>Voir</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.courseTitle}>{data.courseName}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="document-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>
                {file?.name} · {data.flashcards.length} flashcards · 1 quiz
              </Text>
            </View>

            <CourseTabs value={activeTab} onChange={setActiveTab} />

            {activeTab === "resume" && <SummaryCard html={data.resume} />}
            {activeTab === "flashcards" && <FlashcardList cards={data.flashcards} />}
            {activeTab === "quiz" && <QuizList questions={data.quiz} mode="answer" />}
          </>
        )}
      </ScrollView>

      {/* BARRE D'ACTIONS FIXE */}
      <View style={[styles.actionBar, { paddingBottom: bottom + 12 }]}>
        {data ? (
          <>
            <TouchableOpacity
              style={[styles.secondaryBtn, loading && styles.btnDisabled]}
              onPress={handleGenerate}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Régénérer le contenu"
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryText} accessibilityLabel="Génération en cours" />
              ) : (
                <Ionicons name="sync-outline" size={18} color={colors.primaryText} />
              )}
              <Text style={styles.secondaryBtnText}>{loading ? "Analyse…" : "Régénérer"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate("Revision", { courseId: data.courseId })}
              accessibilityRole="button"
            >
              <Ionicons name="play" size={18} color={colors.onAction} />
              <Text style={styles.primaryBtnText}>Réviser ce cours</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, (!file || loading) && styles.btnDisabled]}
            onPress={handleGenerate}
            disabled={!file || loading}
            accessibilityRole="button"
            accessibilityLabel={generateLabel}
            accessibilityState={{ disabled: !file || loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color={colors.onAction} accessibilityLabel="Génération en cours" />
            ) : (
              <Ionicons name="flash-outline" size={20} color={colors.onAction} />
            )}
            <Text style={styles.primaryBtnText}>{generateLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
      paddingHorizontal: 20,
      gap: 16,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 4,
    },

    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    headerText: {
      flex: 1,
      gap: 4,
    },

    title: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    titleGenerated: {
      flex: 1,
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    dropZone: {
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 28,
      borderRadius: 20,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.primary,
      backgroundColor: colors.tintPrimary,
    },

    dropIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },

    dropTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.primaryText,
    },

    dropHint: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
    },

    fileCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingLeft: 14,
      paddingRight: 8,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    fileIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.tintSuccess,
      alignItems: "center",
      justifyContent: "center",
    },

    fileInfo: {
      flex: 1,
      gap: 2,
    },

    fileName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },

    fileSize: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    removeBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },

    infoCard: {
      gap: 12,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    infoTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },

    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },

    infoText: {
      flex: 1,
      gap: 1,
    },

    infoItemTitle: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.textPrimary,
    },

    infoItemDetail: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    errorCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.tintDanger,
    },

    errorText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: colors.dangerText,
    },

    savedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.tintSuccess,
    },

    savedIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },

    savedText: {
      flex: 1,
      gap: 2,
    },

    savedTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.successText,
    },

    savedDetail: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.successText,
    },

    savedLink: {
      minHeight: 44,
      justifyContent: "center",
      paddingLeft: 4,
    },

    savedLinkText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.successText,
    },

    courseTitle: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: -8,
    },

    metaText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "500",
      color: colors.textSecondary,
    },

    actionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 14,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    primaryBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: colors.action,
    },

    primaryBtnText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.onAction,
    },

    secondaryBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 15,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.primaryDark,
      backgroundColor: colors.surface,
    },

    secondaryBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.primaryText,
    },

    btnDisabled: {
      opacity: 0.5,
    },
  });
}
