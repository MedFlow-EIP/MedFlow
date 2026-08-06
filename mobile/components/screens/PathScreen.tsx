import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { LessonNode } from '../../components/LessonNode';
import { Lesson, Path } from '../../types';
import { getAuth } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native-gesture-handler';

interface PathScreenProps {
  route: any;
  navigation: any;
}

export function PathScreen({ route, navigation }: PathScreenProps) {
  const { path }: { path: Path } = route.params;

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const user = getAuth().currentUser;

  useEffect(() => {
    const loadLessons = async () => {
      if (!user) return;
      try {
        const res = await fetch(`${API_URL}/api/lessons/${path.id}`, {
          headers: {
            "X-User-UID": user.uid,
          },
        });
        const data = await res.json();
        setLessons(data.lessons);
      } catch (err) {
        console.error(err);
      }
    };
    loadLessons();
  }, [path, user]);

  const handleLessonPress = (lesson: Lesson) => {
    if (lesson.status !== 'locked') {
      navigation.navigate('Lesson', { path, lesson, });
    }
  };

  const handleLessonComplete = async (lesson: Lesson) => {
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/lessons/${path.id}/${lesson.id}/complete`, {
        method: "POST",
        headers: { "X-User-UID": user.uid },
      });

      const res = await fetch(`${API_URL}/api/lessons/${path.id}`, {
        headers: { "X-User-UID": user.uid },
      });
      const data = await res.json();
      setLessons(data.lessons);

      const homeRes = await fetch(`${API_URL}/api/paths`, {
        headers: { "X-User-UID": user.uid },
      });
      const homeData = await homeRes.json();
      navigation.getParent()?.setParams({ updatedPaths: homeData.paths });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: path.color + '15' }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerContent}>
          <Text style={styles.levelText}>Niveau {path.completedLessons + 1}</Text>
          <Text style={styles.pathTitle}>{path.title}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.pathContainer}>
          <View style={styles.connectingLine} />
          
          {lessons.map((lesson) => (
            <View key={lesson.id} style={styles.lessonWrapper}>
              <LessonNode
                {...lesson}
                color={path.color}
                onPress={async () => {
                  handleLessonPress(lesson);
                  await handleLessonComplete(lesson);
                }}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    alignItems: 'center',
  },
  levelText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  pathTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 32,
    paddingBottom: 100,
  },
  pathContainer: {
    position: 'relative',
    paddingHorizontal: 20,
  },
  connectingLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#e5e7eb',
    marginLeft: -1.5,
    zIndex: -1,
  },
  lessonWrapper: {
    marginBottom: 32,
    alignItems: 'center',
  },
  headerLeft: {
    position: 'absolute',
    left: 20,
    top: 60,
    zIndex: 2,
  },
});
