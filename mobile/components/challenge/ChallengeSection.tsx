import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { appAlert } from '../../utils/appAlert';
import { errorMessage, fetchWithTimeout, readJsonOrThrow } from '../../utils/network';

export type Challenge = {
  id: number;
  role: 'challenger' | 'opponent';
  friend_uid: string;
  friend_name: string;
  course_nom: string;
  total: number;
  status: 'pending' | 'done' | 'declined' | 'expired';
  my_score: number | null;
  their_score: number | null;
  outcome: 'win' | 'loss' | 'tie' | null;
  can_play: boolean;
};

/** Texte d'état d'un défi, du point de vue de l'utilisateur. */
export function challengeStatusText(c: Challenge): string {
  if (c.status === 'done') {
    const score = `${c.my_score} à ${c.their_score}`;
    return c.outcome === 'win' ? `Gagné ${score}` : c.outcome === 'loss' ? `Perdu ${score}` : `Égalité ${score}`;
  }
  if (c.status === 'declined') return c.role === 'challenger' ? 'Refusé' : 'Tu as refusé';
  if (c.status === 'expired') return 'Expiré';
  if (c.can_play) return c.role === 'opponent' ? 'À toi de jouer' : 'Tu n’as pas encore joué';
  return `En attente de ${c.friend_name}`;
}

/** Défis reçus et envoyés (F57), dans l'écran Amis. */
export function ChallengeSection({ refreshKey }: { refreshKey: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/challenges`, { headers: await getAuthHeaders(user) });
      const data = await readJsonOrThrow<{ challenges: Challenge[] }>(res, '');
      setChallenges(data.challenges);
    } catch {
      // Section secondaire : on garde la dernière liste connue.
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [refreshKey])
  );

  const decline = (c: Challenge) => {
    appAlert('Refuser le défi ?', `${c.friend_name} sera prévenu que tu as refusé.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser',
        style: 'destructive',
        onPress: async () => {
          const user = auth.currentUser;
          if (!user) return;
          try {
            const res = await fetchWithTimeout(`${API_URL}/api/challenges/${c.id}/decline`, {
              method: 'POST',
              headers: await getAuthHeaders(user),
            });
            await readJsonOrThrow(res, 'Impossible de refuser le défi.');
            load();
          } catch (err) {
            appAlert('Erreur', errorMessage(err, 'Impossible de refuser le défi.'));
          }
        },
      },
    ]);
  };

  // Les défis terminés depuis longtemps encombrent : on garde les 10 plus récents.
  const shown = challenges.slice(0, 10);
  if (shown.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">Défis</Text>
      {shown.map((c) => {
        const toPlay = c.can_play;
        const won = c.outcome === 'win';
        return (
          <View key={c.id} style={styles.row}>
            <View style={[styles.icon, toPlay && styles.iconToPlay, won && styles.iconWon]}>
              <Ionicons
                name={c.status === 'done' ? (won ? 'trophy' : 'flag') : 'flash'}
                size={18}
                color={toPlay ? colors.onAction : won ? colors.warning : colors.primaryDark}
              />
            </View>
            <View style={styles.texts}>
              <Text style={styles.name} numberOfLines={1}>
                {c.role === 'challenger' ? `Toi vs ${c.friend_name}` : `${c.friend_name} te défie`}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {c.course_nom} · {challengeStatusText(c)}
              </Text>
            </View>
            {toPlay && (
              <>
                {c.role === 'opponent' && (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => decline(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Refuser le défi de ${c.friend_name}`}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.play}
                  onPress={() => navigation.navigate('Challenge', { challengeId: c.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Jouer le défi contre ${c.friend_name}`}
                >
                  <Text style={styles.playText}>Jouer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      gap: 10,
      marginBottom: 20,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconToPlay: {
      backgroundColor: colors.action,
    },
    iconWon: {
      backgroundColor: colors.tintWarning,
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
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    play: {
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onAction,
    },
  });
}
