import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { auth } from '../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { getAuthHeaders } from '../utils/authHeaders';

type CaseSummary = { id: number; title: string; finished: boolean; answered: number; total_steps: number };

/** Carte d'accueil : reprendre le cas clinique en cours, ou en commencer un. */
export function ClinicalCaseCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const [ongoing, setOngoing] = useState<CaseSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
          const res = await fetch(`${API_URL}/api/cases`, { headers: await getAuthHeaders(user) });
          if (!res.ok) return;
          const data = await res.json();
          const list: CaseSummary[] = Array.isArray(data?.cases) ? data.cases : [];
          if (active) setOngoing(list.find((c) => !c.finished) ?? null);
        } catch {
          // Carte secondaire : affichée sans « reprendre » hors ligne.
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        ongoing ? navigation.navigate('ClinicalCase', { caseId: ongoing.id }) : navigation.navigate('ClinicalCases')
      }
      accessibilityRole="button"
      accessibilityLabel={ongoing ? `Reprendre le cas clinique ${ongoing.title}` : 'Cas cliniques : mets-toi en situation'}
    >
      <View style={styles.icon}>
        <Ionicons name="medkit" size={22} color={colors.onAction} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{ongoing ? 'Reprendre ton cas clinique' : 'Cas cliniques'}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {ongoing
            ? `${ongoing.title} · étape ${ongoing.answered + 1}/${ongoing.total_steps}`
            : 'Un patient, tes décisions, et un retour sur chaque choix'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    icon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1, gap: 2 },
    title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    subtitle: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  });
}
