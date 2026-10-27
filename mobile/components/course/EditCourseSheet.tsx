import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { appAlert } from '../../utils/appAlert';
import { useScreenInsets } from '../navigation/constants';
import type { Flashcard } from './CourseContent';
import { MAX_TAGS, MAX_TAG_CHARS, SPECIALTIES } from '../../utils/specialties';

// Mêmes limites que le backend (routes/courses.py).
const MAX_TITLE_CHARS = 120;
const MAX_CARD_CHARS = 1000;
const MAX_FLASHCARDS = 200;

type Props = {
  visible: boolean;
  courseId: string;
  title: string;
  flashcards: Flashcard[];
  tags: string[];
  onClose: () => void;
  /** Cours renvoyé par le serveur après enregistrement. */
  onSaved: (course: any) => void;
};

/**
 * Renommer un cours et corriger ses flashcards (l'IA se trompe parfois).
 * Le quiz n'est pas modifiable : le planning de révision dépend de ses questions.
 */
export function EditCourseSheet({ visible, courseId, title, flashcards, tags: initialTags, onClose, onSaved }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();

  const [name, setName] = useState(title);
  const [cards, setCards] = useState<Flashcard[]>(flashcards);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Repart du cours actuel à chaque ouverture.
  useEffect(() => {
    if (visible) {
      setName(title);
      setCards(flashcards.map((c) => ({ ...c })));
      setTags([...initialTags]);
      setCustomTag('');
      setError(null);
    }
  }, [visible]);

  const dirty =
    name.trim() !== title ||
    tags.join('|') !== initialTags.join('|') ||
    cards.length !== flashcards.length ||
    cards.some((c, i) => c.question !== flashcards[i]?.question || c.answer !== flashcards[i]?.answer);

  const updateCard = (index: number, field: keyof Flashcard, value: string) =>
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));

  const toggleTag = (tag: string) =>
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length >= MAX_TAGS ? prev : [...prev, tag]
    );

  const addCustomTag = () => {
    const tag = customTag.trim().replace(/s+/g, ' ');
    if (!tag) return;
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase()) && tags.length < MAX_TAGS) {
      setTags((prev) => [...prev, tag]);
    }
    setCustomTag('');
  };

  const removeCard = (index: number) => setCards((prev) => prev.filter((_, i) => i !== index));

  const addCard = () => {
    if (cards.length >= MAX_FLASHCARDS) return;
    setCards((prev) => [...prev, { question: '', answer: '' }]);
  };

  const close = () => {
    if (saving) return;
    if (!dirty) {
      onClose();
      return;
    }
    appAlert('Abandonner les modifications ?', 'Tes changements ne seront pas enregistrés.', [
      { text: 'Continuer à modifier', style: 'cancel' },
      { text: 'Abandonner', style: 'destructive', onPress: onClose },
    ]);
  };

  const save = async () => {
    const trimmedName = name.trim();
    const cleaned = cards.map((c) => ({ question: c.question.trim(), answer: c.answer.trim() }));
    if (!trimmedName) {
      setError('Le titre ne peut pas être vide.');
      return;
    }
    const incomplete = cleaned.findIndex((c) => !c.question || !c.answer);
    if (incomplete >= 0) {
      setError(`La carte ${incomplete + 1} doit avoir une question et une réponse.`);
      return;
    }

    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/course/${encodeURIComponent(courseId)}`, {
        method: 'PATCH',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: trimmedName, flashcards: cleaned, tags }),
      });
      onSaved(await readJsonOrThrow(res, 'Enregistrement impossible. Réessaie.'));
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible. Réessaie.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: top }]}>
          <TouchableOpacity style={styles.iconButton} onPress={close} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} accessibilityRole="header">Modifier le cours</Text>
          <TouchableOpacity
            style={[styles.saveButton, (!dirty || saving) && styles.disabled]}
            onPress={save}
            disabled={!dirty || saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: !dirty || saving, busy: saving }}
          >
            {saving ? (
              <ActivityIndicator color={colors.onAction} accessibilityLabel="Enregistrement" />
            ) : (
              <Text style={styles.saveText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          {!!error && (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Titre du cours</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={MAX_TITLE_CHARS}
            style={styles.input}
            placeholder="Titre du cours"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Titre du cours"
          />

          <View style={styles.sectionRow}>
            <Text style={styles.label}>Spécialités ({tags.length}/{MAX_TAGS})</Text>
          </View>
          <View style={styles.tagWrap}>
            {[...tags.filter((t) => !SPECIALTIES.includes(t)), ...SPECIALTIES].map((tag) => {
              const active = tags.includes(tag);
              const full = !active && tags.length >= MAX_TAGS;
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tag, active && styles.tagActive, full && styles.disabled]}
                  onPress={() => toggleTag(tag)}
                  disabled={full}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active, disabled: full }}
                >
                  {active && <Ionicons name="checkmark" size={14} color={colors.primaryText} />}
                  <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {tags.length < MAX_TAGS && (
            <View style={styles.customTagRow}>
              <TextInput
                value={customTag}
                onChangeText={setCustomTag}
                maxLength={MAX_TAG_CHARS}
                style={[styles.input, styles.flex]}
                placeholder="Autre tag (ex. Partiel S1)"
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={addCustomTag}
                accessibilityLabel="Ajouter un tag personnalisé"
              />
              <TouchableOpacity
                style={[styles.addTagButton, !customTag.trim() && styles.disabled]}
                onPress={addCustomTag}
                disabled={!customTag.trim()}
                accessibilityRole="button"
                accessibilityLabel="Ajouter ce tag"
              >
                <Ionicons name="add" size={22} color={colors.onAction} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.sectionRow}>
            <Text style={styles.label}>Flashcards ({cards.length})</Text>
          </View>

          {cards.map((card, index) => (
            <View key={index} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.overline}>CARTE {index + 1}</Text>
                <TouchableOpacity
                  style={styles.iconButtonSmall}
                  onPress={() => removeCard(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer la carte ${index + 1}`}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.dangerText} />
                </TouchableOpacity>
              </View>
              <TextInput
                value={card.question}
                onChangeText={(v) => updateCard(index, 'question', v)}
                maxLength={MAX_CARD_CHARS}
                multiline
                style={[styles.input, styles.multiline]}
                placeholder="Question"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel={`Question de la carte ${index + 1}`}
              />
              <TextInput
                value={card.answer}
                onChangeText={(v) => updateCard(index, 'answer', v)}
                maxLength={MAX_CARD_CHARS}
                multiline
                style={[styles.input, styles.multiline]}
                placeholder="Réponse"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel={`Réponse de la carte ${index + 1}`}
              />
            </View>
          ))}

          {cards.length < MAX_FLASHCARDS && (
            <TouchableOpacity style={styles.addButton} onPress={addCard} accessibilityRole="button">
              <Ionicons name="add" size={20} color={colors.primaryText} />
              <Text style={styles.addText}>Ajouter une carte</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonSmall: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButton: {
      minWidth: 112,
      height: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.onAction,
    },
    disabled: {
      opacity: 0.5,
    },
    content: {
      padding: 20,
      gap: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    sectionRow: {
      marginTop: 12,
    },
    input: {
      minHeight: 50,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      fontSize: 15,
      color: colors.textPrimary,
    },
    flex: {
      flex: 1,
    },
    tagWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tagActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.tintPrimary,
    },
    tagText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    tagTextActive: {
      fontWeight: '600',
      color: colors.primaryText,
    },
    customTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    addTagButton: {
      width: 50,
      height: 50,
      borderRadius: 12,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    multiline: {
      textAlignVertical: 'top',
    },
    card: {
      gap: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    overline: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: colors.tintPrimary,
    },
    addText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
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
  });
}
