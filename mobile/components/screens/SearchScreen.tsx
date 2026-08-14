import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';

type SearchResult = {
  course_id: string;
  course_nom: string;
  match_type: 'course_name' | 'flashcard' | 'quiz';
  item_index?: number;
  snippet: string;
};

const MATCH_TYPE_LABEL: Record<SearchResult['match_type'], string> = {
  course_name: 'Cours',
  flashcard: 'Flashcard',
  quiz: 'Quiz',
};

const MATCH_TYPE_ICON: Record<SearchResult['match_type'], keyof typeof Ionicons.glyphMap> = {
  course_name: 'document-text-outline',
  flashcard: 'layers-outline',
  quiz: 'help-circle-outline',
};

const DEBOUNCE_MS = 350;

export function SearchScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (text: string) => {
    const user = auth.currentUser;
    if (!user || !text.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const headers = await getAuthHeaders(user);
      const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(text)}`, { headers });
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      console.error('Erreur recherche:', err);
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), DEBOUNCE_MS);
  };

  const groupedResults = useMemo(() => {
    const byCourse = new Map<string, { course_nom: string; items: SearchResult[] }>();
    for (const r of results) {
      const existing = byCourse.get(r.course_id);
      if (existing) {
        existing.items.push(r);
      } else {
        byCourse.set(r.course_id, { course_nom: r.course_nom, items: [r] });
      }
    }
    return Array.from(byCourse.entries()).map(([course_id, v]) => ({ course_id, ...v }));
  }, [results]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Recherche</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Rechercher dans tes cours, flashcards, quiz..."
          placeholderTextColor={colors.muted}
          accessibilityLabel="Rechercher"
          style={styles.searchInput}
          autoFocus
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Recherche en cours" />}
      </View>

      {searched && !loading && results.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>Aucun résultat pour "{query}"</Text>
        </View>
      )}

      <FlatList
        data={groupedResults}
        keyExtractor={(g) => g.course_id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: group }) => (
          <View style={styles.courseGroup}>
            <Text style={styles.courseGroupTitle}>{group.course_nom}</Text>
            {group.items.map((r, idx) => (
              <TouchableOpacity
                key={`${r.match_type}-${r.item_index ?? 'name'}-${idx}`}
                style={styles.resultRow}
                onPress={() => navigation.navigate('CourseDetail', { courseId: r.course_id })}
                accessibilityRole="button"
                accessibilityLabel={`${MATCH_TYPE_LABEL[r.match_type]} : ${r.snippet}`}
              >
                <Ionicons name={MATCH_TYPE_ICON[r.match_type]} size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultType}>{MATCH_TYPE_LABEL[r.match_type]}</Text>
                  <Text style={styles.resultSnippet} numberOfLines={2}>{r.snippet}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
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
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    listContent: {
      padding: 20,
      gap: 16,
    },
    courseGroup: {
      gap: 8,
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
    resultType: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '600',
      marginBottom: 2,
    },
    resultSnippet: {
      fontSize: 14,
      color: colors.textPrimary,
    },
  });
}