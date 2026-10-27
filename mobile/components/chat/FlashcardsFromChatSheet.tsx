import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../../utils/network';
import { useScreenInsets } from '../navigation/constants';

type CourseChoice = { id: string; nom: string };

// Même identifiant que le backend (routes/courses.py : NOTES_COURSE_ID).
const NOTES_COURSE_ID = 'notes-assistant';

type Props = {
  /** Réponse de l'assistant à transformer ; la feuille est ouverte quand non nul. */
  text: string | null;
  onClose: () => void;
  onAdded: (count: number, courseName: string) => void;
};

/**
 * « Créer des flashcards » sous une réponse du chat : l'IA en tire 3 cartes,
 * ajoutées au cours choisi (ou à « Notes de l'assistant »).
 */
export function FlashcardsFromChatSheet({ text, onClose, onAdded }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useScreenInsets();

  const [courses, setCourses] = useState<CourseChoice[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!text) return;
    setError(null);
    setBusyId(null);
    setCourses(null);
    loadCourses();
  }, [text]);

  const loadCourses = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/dashboard?per_page=100`, {
        headers: await getAuthHeaders(user),
      });
      const data = await readJsonOrThrow<{ cours: CourseChoice[] }>(res, 'Impossible de charger tes cours.');
      setCourses((data.cours || []).filter((c) => c.id !== NOTES_COURSE_ID));
    } catch (err) {
      setCourses([]);
      setError(errorMessage(err, 'Impossible de charger tes cours.'));
    }
  };

  const addTo = async (courseId: string | null) => {
    const user = auth.currentUser;
    if (!user || !text || busyId) return;
    setBusyId(courseId ?? NOTES_COURSE_ID);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/api/flashcards/from-text`,
        {
          method: 'POST',
          headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
          body: JSON.stringify(courseId ? { text, course_id: courseId } : { text }),
        },
        60_000
      );
      const data = await readJsonOrThrow<{ added: unknown[]; course_nom: string }>(
        res,
        'Impossible de créer les flashcards.'
      );
      onAdded(data.added.length, data.course_nom);
    } catch (err) {
      setError(errorMessage(err, 'Impossible de créer les flashcards.'));
    } finally {
      setBusyId(null);
    }
  };

  const close = () => {
    if (!busyId) onClose();
  };

  const renderChoice = (id: string | null, title: string, subtitle: string, icon: keyof typeof Ionicons.glyphMap) => {
    const key = id ?? NOTES_COURSE_ID;
    return (
      <TouchableOpacity
        key={key}
        style={styles.choice}
        onPress={() => addTo(id)}
        disabled={!!busyId}
        accessibilityRole="button"
        accessibilityLabel={`Ajouter à ${title}`}
      >
        <View style={styles.choiceIcon}>
          <Ionicons name={icon} size={20} color={colors.primaryDark} />
        </View>
        <View style={styles.choiceText}>
          <Text style={styles.choiceTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.choiceSubtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        {busyId === key ? (
          <ActivityIndicator color={colors.primaryDark} accessibilityLabel="Création en cours" />
        ) : (
          <Ionicons name="add-circle-outline" size={22} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={!!text} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close} accessibilityLabel="Fermer">
        <Pressable style={[styles.sheet, { paddingBottom: bottom + 16 }]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">Créer des flashcards</Text>
          <Text style={styles.subtitle}>L’IA tire 3 cartes de cette réponse. Où les ranger ?</Text>

          {!!error && (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {renderChoice(null, 'Notes de l’assistant', 'Un cours rassemblant tes cartes du chat', 'sparkles-outline')}
            {courses === null ? (
              <ActivityIndicator style={styles.loader} color={colors.primaryDark} accessibilityLabel="Chargement de tes cours" />
            ) : (
              courses.map((c) => renderChoice(c.id, c.nom, 'Ajouter à ce cours', 'book-outline'))
            )}
          </ScrollView>

          <TouchableOpacity style={styles.cancel} onPress={close} disabled={!!busyId} accessibilityRole="button">
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 10,
      paddingHorizontal: 20,
      gap: 12,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    list: {
      flexGrow: 0,
    },
    listContent: {
      gap: 8,
    },
    loader: {
      marginVertical: 16,
    },
    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 60,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    choiceIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    choiceText: {
      flex: 1,
      gap: 2,
    },
    choiceTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    choiceSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    error: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.tintDanger,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.dangerText,
    },
    cancel: {
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
}
