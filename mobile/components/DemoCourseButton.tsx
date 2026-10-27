import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { auth } from '../firebaseConfig';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from '../utils/authHeaders';
import { appAlert } from '../utils/appAlert';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../utils/network';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

/**
 * « Essayer avec un cours d'exemple » : ajoute un cours déjà généré et
 * l'ouvre, pour découvrir l'app sans attendre l'import d'un premier PDF.
 */
export function DemoCourseButton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const [busy, setBusy] = useState(false);

  const addDemo = async () => {
    const user = auth.currentUser;
    if (!user || busy) return;
    setBusy(true);
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/courses/demo`, {
        method: 'POST',
        headers: await getAuthHeaders(user),
      });
      const data = await readJsonOrThrow<{ course_id: string }>(res, 'Le cours d’exemple n’a pas pu être ajouté.');
      navigation.navigate('CourseDetail', { courseId: data.course_id });
    } catch (err) {
      appAlert('Cours d’exemple', errorMessage(err, 'Le cours d’exemple n’a pas pu être ajouté.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={addDemo}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Essayer avec un cours d’exemple"
      accessibilityState={{ busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.primaryText} />
      ) : (
        <Ionicons name="sparkles-outline" size={18} color={colors.primaryText} />
      )}
      <Text style={styles.text}>Essayer avec un cours d’exemple</Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      alignSelf: 'center',
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 18,
      minHeight: 48,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primaryText,
    },
    text: { fontSize: 15, fontWeight: '600', color: colors.primaryText },
  });
}
