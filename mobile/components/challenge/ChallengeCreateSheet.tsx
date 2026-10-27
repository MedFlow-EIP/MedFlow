import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../../utils/network';
import { useScreenInsets } from '../navigation/constants';

type CourseChoice = { id: string; nom: string; quiz?: number };

// Même minimum que le backend (routes/challenges.py).
const MIN_QUESTIONS = 3;

/** Choix du cours et du nombre de questions pour défier un ami. */
export function ChallengeCreateSheet({
  friend,
  onClose,
  onCreated,
}: {
  friend: { uid: string; displayName: string } | null;
  onClose: () => void;
  onCreated: (challengeId: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useScreenInsets();

  const [courses, setCourses] = useState<CourseChoice[] | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = async () => {
    setCourses(null);
    setCourseId(null);
    setError(null);
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/dashboard?per_page=100`, { headers: await getAuthHeaders(user) });
      const data = await readJsonOrThrow<{ cours: CourseChoice[] }>(res, 'Impossible de charger tes cours.');
      const playable = (data.cours || []).filter((c) => (c.quiz ?? 0) >= MIN_QUESTIONS);
      setCourses(playable);
      setCourseId(playable[0]?.id ?? null);
    } catch (err) {
      setCourses([]);
      setError(errorMessage(err, 'Impossible de charger tes cours.'));
    }
  };

  const create = async () => {
    const user = auth.currentUser;
    if (!user || !friend || !courseId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/challenges`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_uid: friend.uid, course_id: courseId, count }),
      });
      const data = await readJsonOrThrow<{ id: number }>(res, 'Impossible de créer le défi.');
      onCreated(data.id);
    } catch (err) {
      setError(errorMessage(err, 'Impossible de créer le défi.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!friend} transparent animationType="slide" onShow={loadCourses} onRequestClose={() => !busy && onClose()}>
      <Pressable style={styles.overlay} onPress={() => !busy && onClose()} accessibilityLabel="Fermer">
        <Pressable style={[styles.sheet, { paddingBottom: bottom + 16 }]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">Défier {friend?.displayName}</Text>
          <Text style={styles.subtitle}>
            Vous répondez aux mêmes questions, chacun de votre côté. Le meilleur score gagne 20 XP.
          </Text>

          {!!error && (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.counts} accessibilityRole="radiogroup">
            {[5, 10].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.count, n === count && styles.countActive]}
                onPress={() => setCount(n)}
                accessibilityRole="radio"
                accessibilityState={{ checked: n === count }}
              >
                <Text style={[styles.countText, n === count && styles.countTextActive]}>{n} questions</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {courses === null ? (
              <ActivityIndicator color={colors.primaryDark} accessibilityLabel="Chargement des cours" />
            ) : courses.length === 0 ? (
              <Text style={styles.empty}>Il te faut un cours avec au moins {MIN_QUESTIONS} questions de quiz.</Text>
            ) : (
              courses.map((c) => {
                const active = c.id === courseId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.course, active && styles.courseActive]}
                    onPress={() => setCourseId(c.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={active ? colors.primaryDark : colors.textSecondary}
                    />
                    <Text style={styles.courseName} numberOfLines={2}>{c.nom}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.primary, (!courseId || busy) && styles.disabled]}
            onPress={create}
            disabled={!courseId || busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: !courseId || busy, busy }}
          >
            {busy ? <ActivityIndicator color={colors.onAction} /> : <Text style={styles.primaryText}>Lancer le défi</Text>}
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
      maxHeight: '85%',
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
    counts: {
      flexDirection: 'row',
      gap: 10,
    },
    count: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    countActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.tintPrimary,
    },
    countText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    countTextActive: {
      fontWeight: '700',
      color: colors.primaryText,
    },
    list: {
      flexGrow: 0,
    },
    listContent: {
      gap: 8,
    },
    empty: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    course: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    courseActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.tintPrimary,
    },
    courseName: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
    },
    primary: {
      height: 54,
      borderRadius: 14,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onAction,
    },
    disabled: {
      opacity: 0.5,
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
