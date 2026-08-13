import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import RenderHTML from 'react-native-render-html';
import { LogBox } from "react-native";
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

LogBox.ignoreLogs([
  "Support for defaultProps will be removed",
]);

type Tab = 'resume' | 'flashcards' | 'quiz';

export type RootStackParamList = {
  Dashboard: undefined;
  CourseDetail: { courseId: string };
  Lesson: { path: any; lesson: any };
};

type Props = NativeStackScreenProps<RootStackParamList, 'CourseDetail'>;

export function CourseDetailScreen({ route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { courseId } = route.params;
  const navigation = useNavigation();

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('resume');

  const { width } = useWindowDimensions();

  const loadCourse = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      const res = await fetch(`${API_URL}/api/course/${courseId}`, {
        headers: { 'X-User-UID': user.uid },
      });

      const data = await res.json();
      setCourse(data);
    } catch (e) {
      console.error(e);
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
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Chargement du cours" />
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textPrimary }}>Aucun cours trouvé</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {course.nom}
        </Text>

        <View style={{ width: 24 }} />
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        <TabButton label="Résumé" active={tab === 'resume'} onPress={() => setTab('resume')} colors={colors} styles={styles} />
        <TabButton label="Flashcards" active={tab === 'flashcards'} onPress={() => setTab('flashcards')} colors={colors} styles={styles} />
        <TabButton label="Quiz" active={tab === 'quiz'} onPress={() => setTab('quiz')} colors={colors} styles={styles} />
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {tab === 'resume' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Résumé</Text>
            <RenderHTML
              contentWidth={width}
              source={{ html: course.summary || "" }}
              baseStyle={{ color: colors.textSecondary }}
            />
          </View>
        )}

        {tab === 'flashcards' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Flashcards</Text>

            {(course.flashcards || []).map((fc: any, i: number) => (
              <View key={i} style={styles.itemCard}>
                <Text style={styles.q}>Q: {fc.question}</Text>
                <Text style={styles.a}>A: {fc.answer}</Text>
              </View>
            ))}
          </View>
        )}

        {tab === 'quiz' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Quiz</Text>

            {(course.quiz || []).map((q: any, i: number) => (
              <View key={i} style={styles.itemCard}>
                <Text style={styles.q}>{q.question}</Text>

                {Object.entries(q.options || {}).map(([k, v]) => {
                    const isCorrect = k === q.correct;

                    return (
                        <View
                        key={k}
                        style={[
                            styles.option,
                            isCorrect && styles.correctOption,
                        ]}
                        >
                        <Text
                            style={[
                            styles.optionKey,
                            isCorrect && styles.correctText,
                            ]}
                        >
                            {k}
                        </Text>

                        <Text
                            style={[
                            styles.optionValue,
                            isCorrect && styles.correctText,
                            ]}
                        >
                            {String(v)}
                        </Text>
                        </View>
                    );
                    })}
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- UI ---------------- */

function TabButton({ label, active, onPress, colors, styles }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
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

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 30,
      paddingBottom: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    tabs: {
      flexDirection: 'row',
      margin: 12,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 4,
    },

    tabButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },

    tabActive: {
      backgroundColor: colors.primary,
    },

    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },

    tabTextActive: {
      color: colors.onAccent,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
    },

    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 10,
      color: colors.textPrimary,
    },

    text: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },

    itemCard: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      marginBottom: 10,
    },

    q: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },

    a: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    option: {
      flexDirection: 'row',
      marginTop: 6,
    },

    optionKey: {
      fontWeight: '700',
      marginRight: 6,
      color: colors.primary,
    },

    optionValue: {
      color: colors.textSecondary,
      flex: 1,
    },
    correctOption: {
      backgroundColor: colors.tintSuccess,
      borderRadius: 10,
      padding: 8,
    },

    correctText: {
      color: colors.success,
      fontWeight: '700',
    },
  });
}