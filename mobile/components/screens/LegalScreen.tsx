import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useScreenInsets } from '../navigation/constants';

// Ce que l'IA fait (et ne fait pas), et ce que MedFlow garde de l'étudiant.
// Accessible avant l'inscription et depuis le compte.
const SECTIONS: { title: string; icon: keyof typeof Ionicons.glyphMap; lines: string[] }[] = [
  {
    title: 'Avertissement médical',
    icon: 'medkit-outline',
    lines: [
      'MedFlow est un outil de révision. Les résumés, cartes, questions, cas cliniques et réponses du chat sont générés par une intelligence artificielle à partir de tes cours : ils peuvent contenir des erreurs.',
      'Vérifie toujours avec ton cours et tes enseignants. MedFlow ne donne pas d’avis médical et ne doit pas servir à soigner ou conseiller un patient.',
      'Tu repères une erreur ? Utilise « Signaler une erreur » : on s’en sert pour améliorer le contenu.',
    ],
  },
  {
    title: 'Ce que MedFlow garde',
    icon: 'folder-open-outline',
    lines: [
      'Ton compte : email, nom affiché et photo de profil (connexion gérée par Firebase, de Google).',
      'Tes cours : les documents importés et les révisions générées.',
      'Ta progression : réponses, série, XP, examens, amis et défis.',
      'Tes conversations avec l’assistant.',
      'Des données d’usage (écrans ouverts, étapes comme un import ou une révision), analysées sans ton nom pour améliorer l’app.',
      'Ton jeton de notification, si tu acceptes les notifications.',
    ],
  },
  {
    title: 'Traitement par l’IA',
    icon: 'sparkles-outline',
    lines: [
      'Le texte de tes cours, tes questions et tes pièces jointes sont envoyés à Google Vertex AI (Gemini) pour générer tes révisions et les réponses du chat.',
    ],
  },
  {
    title: 'Tes droits',
    icon: 'shield-checkmark-outline',
    lines: [
      'Paramètres > Exporter mes données : tu récupères toutes tes données.',
      'Paramètres > Supprimer mon compte : ton compte et toutes tes données sont effacés.',
      'Une question ? Écris-nous à medflow.app.contact@gmail.com.',
    ],
  },
];

export function LegalScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation();
  const { top, bottom } = useScreenInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom + 24 }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Confidentialité et avertissement</Text>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name={section.icon} size={20} color={colors.primaryDark} />
            <Text style={styles.cardTitle} accessibilityRole="header">{section.title}</Text>
          </View>
          {section.lines.map((line) => (
            <Text key={line} style={styles.line}>{line}</Text>
          ))}
        </View>
      ))}

      <Text style={styles.footer}>MedFlow est un projet étudiant de l’EIP Epitech.</Text>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, gap: 16 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.textPrimary },
    card: {
      gap: 10,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
    line: { fontSize: 15, lineHeight: 22, color: colors.textPrimary },
    footer: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  });
}
