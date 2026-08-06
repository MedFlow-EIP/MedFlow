import React, { useEffect, useState } from 'react';
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
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.center}>
        <Text>Aucun cours trouvé</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {course.nom}
        </Text>

        <View style={{ width: 24 }} />
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        <TabButton label="Résumé" active={tab === 'resume'} onPress={() => setTab('resume')} />
        <TabButton label="Flashcards" active={tab === 'flashcards'} onPress={() => setTab('flashcards')} />
        <TabButton label="Quiz" active={tab === 'quiz'} onPress={() => setTab('quiz')} />
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {tab === 'resume' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Résumé</Text>
            <RenderHTML
              contentWidth={width}
              source={{ html: course.summary || "" }}
            />
          </View>
        )}

        {tab === 'flashcards' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Flashcards</Text>

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
            <Text style={styles.sectionTitle}>Quiz</Text>

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

function TabButton({ label, active, onPress }: any) {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef0f4',
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },

  tabs: {
    flexDirection: 'row',
    margin: 12,
    backgroundColor: '#eef2ff',
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
    backgroundColor: '#3b82f6',
  },

  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },

  tabTextActive: {
    color: '#fff',
  },

  card: {
    backgroundColor: '#fff',
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
    color: '#0f172a',
  },

  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },

  itemCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
  },

  q: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },

  a: {
    fontSize: 13,
    color: '#475569',
  },

  option: {
    flexDirection: 'row',
    marginTop: 6,
  },

  optionKey: {
    fontWeight: '700',
    marginRight: 6,
    color: '#3b82f6',
  },

  optionValue: {
    color: '#334155',
    flex: 1,
  },
  correctOption: {
  backgroundColor: '#dcfce7',
  borderRadius: 10,
  padding: 8,
},

correctText: {
  color: '#16a34a',
  fontWeight: '700',
},
});