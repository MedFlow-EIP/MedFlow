import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from '../../utils/authHeaders';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { AvatarBubble } from '../../components/AvatarBubble';
import { useScreenInsets } from '../navigation/constants';
import { appAlert } from '../../utils/appAlert';
import { ChallengeSection } from '../challenge/ChallengeSection';
import { checkSocialNotifications } from '../../utils/socialNotifications';
import { ChallengeCreateSheet } from '../challenge/ChallengeCreateSheet';

type SearchResult = {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  friendshipStatus: 'none' | 'friends' | 'request_sent' | 'request_received';
};

type Friend = {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  streak: number;
};

type PendingRequest = {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
};

export function FriendsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top: insetTop, bottom: insetBottom } = useScreenInsets();
  const navigation = useNavigation<any>();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [received, setReceived] = useState<PendingRequest[]>([]);
  const [sent, setSent] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // Ami à défier (feuille de création ouverte quand non nul).
  const [challengeTarget, setChallengeTarget] = useState<Friend | null>(null);
  const [challengesKey, setChallengesKey] = useState(0);

  const loadAll = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const headers = await getAuthHeaders(user);
      const [friendsRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/api/friends`, { headers }),
        fetch(`${API_URL}/api/friends/requests`, { headers }),
      ]);
      const friendsData = await friendsRes.json();
      const requestsData = await requestsRes.json();
      setFriends(Array.isArray(friendsData.friends) ? friendsData.friends : []);
      setReceived(Array.isArray(requestsData.received) ? requestsData.received : []);
      setSent(Array.isArray(requestsData.sent) ? requestsData.sent : []);
      // Demande acceptée ou refusée : la pastille de l'onglet Compte suit.
      checkSocialNotifications(user);
    } catch (err) {
      console.error('Erreur chargement amis:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAll();
    }, [loadAll])
  );

  const runSearch = async (text: string) => {
    setQuery(text);
    const user = auth.currentUser;
    if (!user || text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `${API_URL}/api/users/search?q=${encodeURIComponent(text.trim())}`,
        { headers: await getAuthHeaders(user) }
      );
      const data = await res.json();
      setSearchResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      console.error('Erreur recherche:', err);
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (targetUid: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: targetUid }),
      });
      await runSearch(query);
      await loadAll();
    } catch (err) {
      console.error('Erreur envoi demande:', err);
    }
  };

  const respondRequest = async (requesterUid: string, accept: boolean) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/friends/respond`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: requesterUid, accept }),
      });
      await loadAll();
    } catch (err) {
      console.error('Erreur réponse demande:', err);
    }
  };

  const removeFriend = async (targetUid: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/friends/${targetUid}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(user),
      });
      await loadAll();
      await runSearch(query);
    } catch (err) {
      console.error('Erreur suppression ami:', err);
    }
  };

  const confirmRemoveFriend = (targetUid: string, name: string) => {
    appAlert('Retirer cet ami ?', `${name} ne sera plus dans ta liste d'amis ni dans ton classement entre amis.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => removeFriend(targetUid) },
    ]);
  };

  const renderSearchButton = (result: SearchResult) => {
    switch (result.friendshipStatus) {
      case 'friends':
        return (
          <View style={styles.statusPill}>
            <Ionicons name="checkmark" size={14} color={colors.successText} />
            <Text style={[styles.statusPillText, { color: colors.successText }]}>Ami</Text>
          </View>
        );
      case 'request_sent':
        return (
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>Demande envoyée</Text>
          </View>
        );
      case 'request_received':
        return (
          <TouchableOpacity
            style={styles.smallAcceptButton}
            onPress={() => respondRequest(result.uid, true)}
            accessibilityRole="button"
            accessibilityLabel={`Accepter la demande de ${result.displayName}`}
          >
            <Text style={styles.smallAcceptButtonText}>Accepter</Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => sendRequest(result.uid)}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${result.displayName} en ami`}
          >
            <Ionicons name="person-add" size={16} color={colors.primary} />
          </TouchableOpacity>
        );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insetTop }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={8}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">Amis</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={runSearch}
          placeholder="Nom ou email exact…"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Rechercher un ami par nom"
          style={styles.searchInput}
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Recherche en cours" />}
      </View>

      {query.trim().length >= 2 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={[styles.listContent, { paddingBottom: insetBottom + 16 }]}
          ListEmptyComponent={
            !searching ? <Text style={styles.emptyText}>Aucun résultat</Text> : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <AvatarBubble uri={item.avatarUrl} displayName={item.displayName} size={34} />
                <Text style={styles.rowName} numberOfLines={1}>{item.displayName}</Text>
              </View>
              {renderSearchButton(item)}
            </View>
          )}
        />
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Chargement des amis" />
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => 'x'}
          renderItem={null}
          contentContainerStyle={[styles.listContent, { paddingBottom: insetBottom + 16 }]}
          ListHeaderComponent={
            <>
              {received.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle} accessibilityRole="header">Demandes reçues</Text>
                  {received.map((r) => (
                    <View key={r.uid} style={styles.row}>
                      <View style={styles.rowLeft}>
                        <AvatarBubble uri={r.avatarUrl} displayName={r.displayName} size={34} />
                        <Text style={styles.rowName} numberOfLines={1}>{r.displayName}</Text>
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={styles.smallAcceptButton}
                          onPress={() => respondRequest(r.uid, true)}
                          accessibilityRole="button"
                          accessibilityLabel={`Accepter la demande de ${r.displayName}`}
                        >
                          <Text style={styles.smallAcceptButtonText}>Accepter</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.smallDeclineButton}
                          onPress={() => respondRequest(r.uid, false)}
                          accessibilityRole="button"
                          accessibilityLabel={`Refuser la demande de ${r.displayName}`}
                        >
                          <Ionicons name="close" size={16} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {sent.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle} accessibilityRole="header">Demandes envoyées</Text>
                  {sent.map((s) => (
                    <View key={s.uid} style={styles.row}>
                      <View style={styles.rowLeft}>
                        <AvatarBubble uri={s.avatarUrl} displayName={s.displayName} size={34} />
                        <Text style={styles.rowName} numberOfLines={1}>{s.displayName}</Text>
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>En attente</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <ChallengeSection refreshKey={challengesKey} />

              <View style={styles.section}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  Tes amis {friends.length > 0 ? `(${friends.length})` : ''}
                </Text>
                {friends.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Recherche un nom ci-dessus pour ajouter ton premier ami.
                  </Text>
                ) : (
                  friends.map((f) => (
                    <View key={f.uid} style={styles.row}>
                      <View style={styles.rowLeft}>
                        <AvatarBubble uri={f.avatarUrl} displayName={f.displayName} size={34} />
                        <View style={styles.rowTexts}>
                          <Text style={styles.rowName} numberOfLines={1}>{f.displayName}</Text>
                          <Text style={styles.rowSubtext}>
                            {f.xp} XP · {f.streak}j de série
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => setChallengeTarget(f)}
                        style={styles.challengeButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Défier ${f.displayName}`}
                      >
                        <Ionicons name="flash-outline" size={16} color={colors.primaryText} />
                        <Text style={styles.challengeButtonText}>Défier</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmRemoveFriend(f.uid, f.displayName)}
                        style={styles.removeButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Retirer ${f.displayName} de tes amis`}
                      >
                        <Ionicons name="person-remove-outline" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </>
          }
        />
      )}

      <ChallengeCreateSheet
        friend={challengeTarget}
        onClose={() => setChallengeTarget(null)}
        onCreated={(challengeId) => {
          setChallengeTarget(null);
          setChallengesKey((k) => k + 1);
          // Le créateur joue tout de suite ; son ami jouera de son côté.
          navigation.navigate('Challenge', { challengeId });
        }}
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
    challengeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.tintPrimary,
    },
    challengeButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primaryText,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
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
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
      marginLeft: 12,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      margin: 16,
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.textPrimary,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    listContent: {
      padding: 16,
      paddingTop: 8,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    rowName: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    rowTexts: {
      flex: 1,
    },
    removeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    rowSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 12,
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    requestActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    smallAcceptButton: {
      backgroundColor: colors.action,
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    smallAcceptButtonText: {
      color: colors.onAction,
      fontSize: 12,
      fontWeight: '700',
    },
    smallDeclineButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.tintDanger,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}