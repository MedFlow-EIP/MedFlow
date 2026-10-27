import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { appAlert } from '../../utils/appAlert';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../../utils/network';
import { CourseDocument, formatBytes, openCourseDocument } from '../../utils/courseDocuments';
import { useScreenInsets } from '../navigation/constants';
import { ProgressBar } from '../ui/progress';
import { StateView } from '../ui/StateView';

const iconFor = (mime: string): keyof typeof Ionicons.glyphMap =>
  mime.startsWith('image/') ? 'image' : mime.includes('presentation') ? 'easel' : mime.includes('word') ? 'document' : 'document-text';

const formatDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Liste des documents importés, à rouvrir dans la visionneuse du téléphone. */
export function DocumentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();
  const navigation = useNavigation<any>();

  const [docs, setDocs] = useState<CourseDocument[] | null>(null);
  const [usage, setUsage] = useState({ used: 0, max: 1 });
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/sources`, { headers: await getAuthHeaders(user) });
      const data = await readJsonOrThrow<{ documents: CourseDocument[]; used_bytes: number; max_bytes: number }>(
        res,
        'Impossible de charger tes documents.'
      );
      setDocs(data.documents);
      setUsage({ used: data.used_bytes, max: data.max_bytes });
    } catch (err) {
      setError(errorMessage(err, 'Impossible de charger tes documents.'));
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const open = async (doc: CourseDocument) => {
    const user = auth.currentUser;
    if (!user || opening) return;
    setOpening(doc.course_id);
    try {
      await openCourseDocument(user, doc);
    } catch (err) {
      appAlert('Ouverture impossible', errorMessage(err, 'Réessaie dans un instant.'));
    } finally {
      setOpening(null);
    }
  };

  if (error && !docs) {
    return (
      <StateView
        icon="cloud-offline-outline"
        tone="neutral"
        title="Impossible de charger tes documents"
        subtitle={error}
        primary={{ label: 'Réessayer', onPress: load }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">Mes documents</Text>
      </View>

      {docs === null ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primaryDark} accessibilityLabel="Chargement" />
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => d.course_id}
          contentContainerStyle={[styles.list, { paddingBottom: bottom + 24 }]}
          ListHeaderComponent={
            <View style={styles.usage}>
              <Text style={styles.usageText}>
                {formatBytes(usage.used) || '0 Ko'} utilisés sur {formatBytes(usage.max)}
              </Text>
              <ProgressBar progress={(usage.used / usage.max) * 100} height={6} color={colors.primaryDark} />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.emptyText}>Les documents que tu importes apparaîtront ici.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.main}
                onPress={() => open(item)}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${item.source_name}`}
              >
                <View style={styles.icon}>
                  {opening === item.course_id ? (
                    <ActivityIndicator size="small" color={colors.primaryDark} />
                  ) : (
                    <Ionicons name={iconFor(item.source_mime)} size={22} color={colors.primaryDark} />
                  )}
                </View>
                <View style={styles.texts}>
                  <Text style={styles.name} numberOfLines={1}>{item.source_name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[formatBytes(item.source_size), formatDate(item.created_at)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.courseButton}
                onPress={() => navigation.navigate('CourseDetail', { courseId: item.course_id })}
                accessibilityRole="button"
                accessibilityLabel={`Voir le cours ${item.nom}`}
              >
                <Ionicons name="school-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
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
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    loader: {
      marginTop: 40,
    },
    list: {
      gap: 10,
      paddingHorizontal: 20,
    },
    usage: {
      gap: 6,
      marginBottom: 6,
    },
    usageText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    empty: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    main: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    texts: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    meta: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    courseButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
