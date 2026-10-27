import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { useScreenInsets } from '../navigation/constants';
import { StateView } from '../ui/StateView';

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
  const { top: insetTop, bottom: insetBottom } = useScreenInsets();
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
      <View style={[styles.container, styles.centered, { paddingTop: insetTop }]}>
        <ActivityIndicator size="large" color={colors.primaryDark} accessibilityLabel="Chargement des cartes maîtrisées" />
      </View>
    );
  }

  if (error) {
    return (
      <StateView
        icon="cloud-offline-outline"
        tone="neutral"
        title="Impossible de charger les cartes maîtrisées"
        subtitle="Vérifie ta connexion puis réessaie."
        primary={{ label: 'Réessayer', onPress: load }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  if (items.length === 0) {
    return (
      <StateView
        icon="trophy-outline"
        tone="warning"
        title="Pas encore de carte maîtrisée"
        subtitle="Une carte apparaît ici une fois bien sue plusieurs fois de suite — continue à réviser régulièrement !"
        primary={{ label: 'Réviser maintenant', onPress: () => navigation.navigate('Revision') }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insetTop }]}>
      <FlatList
        data={groupedItems}
        keyExtractor={(g) => g.course_id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insetBottom + 24 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Retour"
              >
                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle} accessibilityRole="header">Cartes maîtrisées</Text>
            </View>

            <View style={styles.summary}>
              <View style={styles.summaryIcon}>
                <Ionicons name="trophy" size={26} color={colors.warning} />
              </View>
              <View style={styles.summaryText}>
                <Text style={styles.countLabel}>
                  {items.length} carte{items.length > 1 ? 's' : ''} maîtrisée{items.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.summaryHint}>Elles reviendront de moins en moins souvent.</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item: group }) => (
          <View style={styles.courseGroup}>
            <View style={styles.groupHeader}>
              <Text style={styles.courseGroupTitle}>{group.course_nom}</Text>
              <View style={styles.groupCount}>
                <Text style={styles.groupCountText}>{group.items.length}</Text>
              </View>
            </View>
            <View style={styles.card}>
              {group.items.map((m, i) => (
                <TouchableOpacity
                  key={m.item_index}
                  style={[styles.resultRow, i > 0 && styles.rowDivider]}
                  onPress={() => navigation.navigate('CourseDetail', { courseId: m.course_id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.question}, prochaine révision dans ${m.interval_days} jours`}
                >
                  <View style={styles.resultBody}>
                    <Text style={styles.resultQuestion} numberOfLines={3}>{m.question}</Text>
                    <View style={styles.chips}>
                      <View style={[styles.chip, { backgroundColor: colors.tintPrimary }]}>
                        <Ionicons name="calendar-outline" size={13} color={colors.primaryText} />
                        <Text style={[styles.chipText, { color: colors.primaryText }]}>Dans {m.interval_days} j</Text>
                      </View>
                      <View style={[styles.chip, { backgroundColor: colors.tintSuccess }]}>
                        <Ionicons name="checkmark-done" size={13} color={colors.successText} />
                        <Text style={[styles.chipText, { color: colors.successText }]}>{m.repetitions}× de suite</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
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
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: 20,
      gap: 20,
    },
    headerBlock: {
      gap: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
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
    headerTitle: {
      flex: 1,
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    summary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    summaryIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.tintWarning,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryText: {
      flex: 1,
      gap: 2,
    },
    countLabel: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    summaryHint: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    courseGroup: {
      gap: 10,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    courseGroupTitle: {
      flexShrink: 1,
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    groupCount: {
      minWidth: 24,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
    },
    groupCountText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    card: {
      paddingHorizontal: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    resultBody: {
      flex: 1,
      gap: 8,
    },
    resultQuestion: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
