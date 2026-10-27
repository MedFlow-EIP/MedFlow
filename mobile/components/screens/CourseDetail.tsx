import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { getAuthHeaders } from '../../utils/authHeaders';
import { API_URL } from '@/services/api';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { LogBox } from "react-native";
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { CourseTabs, CourseTab, FlashcardList, QuizList, SummaryCard } from '../course/CourseContent';
import { OfflineBanner } from '../course/OfflineBanner';
import { EditCourseSheet } from '../course/EditCourseSheet';
import { StateView } from '../ui/StateView';
import { useScreenInsets } from '../navigation/constants';
import { courseCacheName, readOffline, saveOffline } from '../../utils/offlineCache';

LogBox.ignoreLogs([
  "Support for defaultProps will be removed",
]);

export type RootStackParamList = {
  Dashboard: undefined;
  CourseDetail: { courseId: string };
  Lesson: { path: any; lesson: any };
};

type Props = NativeStackScreenProps<RootStackParamList, 'CourseDetail'>;

const formatDate = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  return isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export function CourseDetailScreen({ route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();

  const { courseId } = route.params;
  const navigation = useNavigation();

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<CourseTab>('resume');
  const [offline, setOffline] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const loadCourse = async () => {
    const user = auth.currentUser;
    try {
      setLoading(true);
      if (!user) return;

      const res = await fetch(`${API_URL}/api/course/${courseId}`, {
        headers: await getAuthHeaders(user),
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setCourse(data);
      setOffline(false);
      saveOffline(user.uid, courseCacheName(courseId), data);
    } catch (e) {
      // Pas de réseau (ou serveur indisponible) : on relit la copie locale.
      const cached = user ? await readOffline<any>(user.uid, courseCacheName(courseId)) : null;
      if (cached) {
        setCourse(cached);
        setOffline(true);
      } else {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCourse();
    }, [courseId])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primaryDark} accessibilityLabel="Chargement du cours" />
      </View>
    );
  }

  if (!course) {
    // Supprimé (404) ou pas de réseau sans copie hors ligne : jamais d'écran vide.
    return notFound ? (
      <StateView
        icon="document-outline"
        tone="neutral"
        title="Cours introuvable"
        subtitle="Il a peut-être été supprimé."
        primary={{ label: 'Retour', onPress: () => navigation.goBack() }}
        onClose={() => navigation.goBack()}
      />
    ) : (
      <StateView
        icon="cloud-offline-outline"
        tone="neutral"
        title="Impossible de charger le cours"
        subtitle="Vérifie ta connexion puis réessaie."
        primary={{ label: 'Réessayer', onPress: () => loadCourse() }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  const flashcards = Array.isArray(course.flashcards) ? course.flashcards : [];
  const quiz = Array.isArray(course.quiz) ? course.quiz : [];
  const meta = [formatDate(course.created_at), `${flashcards.length} flashcards`, quiz.length ? '1 quiz' : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom + 24 }]} showsVerticalScrollIndicator={false}>
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

          <View style={styles.headerText}>
            <Text style={styles.headerTitle} accessibilityRole="header">
              {course.nom}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="document-text" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>{meta}</Text>
            </View>
            {Array.isArray(course.tags) && course.tags.length > 0 && (
              <View style={styles.tags}>
                {course.tags.map((tag: string) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Hors ligne : modification impossible, le bouton est masqué. */}
          {!offline && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setEditing(true)}
              accessibilityLabel="Modifier le cours"
              accessibilityRole="button"
            >
              <Ionicons name="create-outline" size={21} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        {offline && <OfflineBanner />}

        <CourseTabs value={tab} onChange={setTab} />

        {/* « Réviser ce cours » toujours visible sous les onglets */}
        <TouchableOpacity
          style={styles.reviseButton}
          onPress={() => (navigation as any).navigate('Revision', { courseId })}
          accessibilityRole="button"
          accessibilityLabel="Réviser ce cours"
        >
          <Ionicons name="flash-outline" size={20} color={colors.onAction} />
          <Text style={styles.reviseButtonText}>Réviser ce cours</Text>
        </TouchableOpacity>

        {tab === 'resume' && <SummaryCard html={course.summary || ''} />}

        {tab === 'flashcards' && <FlashcardList cards={flashcards} />}

        {tab === 'quiz' && (
          <>
            <View style={styles.keyInfo}>
              <Ionicons name="flash-outline" size={18} color={colors.primaryText} />
              <Text style={styles.keyInfoText}>
                Corrigé du quiz. Pour t’entraîner, appuie sur « Réviser ce cours ».
              </Text>
            </View>
            <QuizList questions={quiz} mode="key" />
          </>
        )}
      </ScrollView>

      <EditCourseSheet
        visible={editing}
        courseId={courseId}
        title={course.nom || ''}
        flashcards={flashcards}
        tags={Array.isArray(course.tags) ? course.tags : []}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          setCourse(updated);
          setEditing(false);
          const uid = auth.currentUser?.uid;
          if (uid) saveOffline(uid, courseCacheName(courseId), updated);
        }}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },

    content: {
      paddingHorizontal: 20,
      gap: 16,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },

    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerText: {
      flex: 1,
      gap: 4,
    },

    headerTitle: {
      fontSize: 21,
      lineHeight: 27,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    metaText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },

    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
    },
    tag: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.tintPrimary,
    },
    tagText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryText,
    },
    reviseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.action,
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderRadius: 14,
    },

    reviseButtonText: {
      color: colors.onAction,
      fontSize: 16,
      fontWeight: '600',
    },

    keyInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.tintPrimary,
    },

    keyInfoText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
      color: colors.primaryText,
    },
  });
}
