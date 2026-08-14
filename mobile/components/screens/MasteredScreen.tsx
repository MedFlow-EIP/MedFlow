import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';

type MasteredItem = {
  course_id: string;
  course_nom: string;
  item_index: number;
  question: string;
  interval_days: number;
  repetitions: number;
};

export function MasteredScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<MasteredItem[]>([]);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const headers = await getAuthHeaders(user);
      const res = await fetch(`${API_URL}/api/revision/mastered`, { headers });
      if (!res.ok) throw new Error('Erreur serveur');
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error('Erreur chargement cartes maîtrisées:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const groupedItems = useMemo(() => {
    const byCourse = new Map<string, { course_nom: string; items: MasteredItem[] }>();
    for (const item of items) {
      const existing = byCourse.get(item.course_id);
      if (existing) {
        existing.items.push(item);
      } else {
        byCourse.set(item.course_id, { course_nom: item.course_nom, items: [item] });
      }
    }
    return Array.from(byCourse.entries()).map(([course_id, v]) => ({ course_id, ...v }));
  }, [items]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Chargement des cartes maîtrisées" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Impossible de charger les cartes maîtrisées</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={load} accessibilityRole="button" accessibilityLabel="Réessayer">
            <Text style={styles.primaryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Cartes maîtrisées</Text>
        <View style={{ width: 24 }} />
      </View>

      {items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="trophy-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle} accessibilityRole="header">Pas encore de carte maîtrisée</Text>
          <Text style={styles.emptySubtitle}>
            Une carte apparaît ici une fois bien sue plusieurs fois de suite — continue à réviser régulièrement !
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedItems}
          keyExtractor={(g) => g.course_id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.countLabel}>
              {items.length} carte{items.length > 1 ? 's' : ''} maîtrisée{items.length > 1 ? 's' : ''}
            </Text>
          }
          renderItem={({ item: group }) => (
            <View style={styles.courseGroup}>
              <Text style={styles.courseGroupTitle}>{group.course_nom}</Text>
              {group.items.map((m) => (
                <TouchableOpacity
                  key={m.item_index}
                  style={styles.resultRow}
                  onPress={() => navigation.navigate('CourseDetail', { courseId: m.course_id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.question}, prochaine révision dans ${m.interval_days} jours`}
                >
                  <Ionicons name="trophy" size={18} color={colors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultQuestion} numberOfLines={2}>{m.question}</Text>
                    <Text style={styles.resultMeta}>
                      Revient dans {m.interval_days} jours · {m.repetitions} bonnes réponses de suite
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
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
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 8,
    },
    primaryButtonText: {
      color: colors.onAccent,
      fontWeight: '600',
      fontSize: 15,
    },
    listContent: {
      padding: 20,
      gap: 16,
    },
    countLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    courseGroup: {
      gap: 8,
      marginBottom: 8,
    },
    courseGroupTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 12,
    },
    resultQuestion: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    resultMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
}