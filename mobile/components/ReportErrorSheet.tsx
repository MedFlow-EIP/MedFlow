import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { getAuthHeaders } from '../utils/authHeaders';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../utils/network';
import { useScreenInsets } from './navigation/constants';

export type ReportTarget = {
  kind: 'summary' | 'flashcard' | 'quiz' | 'chat' | 'case';
  /** Le contenu jugé faux, tel qu'affiché. */
  excerpt: string;
  courseId?: string;
};

/**
 * « Signaler une erreur » sur un contenu généré par l'IA. Les signalements
 * mesurent la confiance dans le contenu (hypothèse du beta test).
 */
export function ReportErrorSheet({
  target,
  onClose,
  onSent,
}: {
  target: ReportTarget | null;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useScreenInsets();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setComment('');
    setError(null);
    setSent(false);
  }, [target]);

  const close = () => {
    if (!busy) onClose();
  };

  const send = async () => {
    const user = auth.currentUser;
    if (!user || !target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/reports`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: target.kind,
          excerpt: target.excerpt.slice(0, 2000),
          comment: comment.trim(),
          course_id: target.courseId,
        }),
      });
      await readJsonOrThrow(res, 'Le signalement n’a pas pu être envoyé.');
      setSent(true);
      onSent?.();
    } catch (err) {
      setError(errorMessage(err, 'Le signalement n’a pas pu être envoyé.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={close} accessibilityLabel="Fermer">
          <Pressable style={[styles.sheet, { paddingBottom: bottom + 16 }]} onPress={() => {}}>
            <View style={styles.handle} />
            {sent ? (
              <View style={styles.done} accessibilityLiveRegion="polite">
                <Ionicons name="checkmark-circle" size={40} color={colors.successText} />
                <Text style={styles.title}>Merci, c’est noté</Text>
                <Text style={styles.subtitle}>Ton signalement nous aide à rendre le contenu plus fiable.</Text>
                <TouchableOpacity style={styles.primary} onPress={onClose} accessibilityRole="button">
                  <Text style={styles.primaryText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.title} accessibilityRole="header">Signaler une erreur</Text>
                <Text style={styles.excerpt} numberOfLines={4}>{target?.excerpt}</Text>
                <TextInput
                  style={styles.input}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Qu’est-ce qui est faux ? (facultatif)"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={1000}
                  accessibilityLabel="Ce qui est faux, facultatif"
                />
                {!!error && (
                  <View style={styles.error} accessibilityLiveRegion="polite">
                    <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.primary}
                  onPress={send}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ busy }}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.onAction} />
                  ) : (
                    <Text style={styles.primaryText}>Envoyer le signalement</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancel} onPress={close} disabled={busy} accessibilityRole="button">
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 10,
      paddingHorizontal: 20,
      gap: 12,
    },
    handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border },
    title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    subtitle: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
    excerpt: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.background,
    },
    input: {
      minHeight: 88,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 15,
      color: colors.textPrimary,
      textAlignVertical: 'top',
    },
    error: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.tintDanger,
    },
    errorText: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.dangerText },
    primary: {
      height: 52,
      alignSelf: 'stretch',
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.action,
    },
    primaryText: { fontSize: 16, fontWeight: '600', color: colors.onAction },
    cancel: { height: 48, alignItems: 'center', justifyContent: 'center' },
    cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    done: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  });
}
