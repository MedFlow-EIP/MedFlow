import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
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
  const navigation = useNavigation();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [received, setReceived] = useState<PendingRequest[]>([]);
  const [sent, setSent] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

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

  const renderSearchButton = (result: SearchResult) => {
    switch (result.friendshipStatus) {
      case 'friends':
        return (
          <View style={styles.statusPill}>
            <Ionicons name="checkmark" size={14} color={colors.success} />
            <Text style={[styles.statusPillText, { color: colors.success }]}>Ami</Text>
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
          >
            <Text style={styles.smallAcceptButtonText}>Accepter</Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity style={styles.addButton} onPress={() => sendRequest(result.uid)}>
            <Ionicons name="person-add" size={16} color={colors.primary} />
          </TouchableOpacity>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={8}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Amis</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={runSearch}
          placeholder="Rechercher un nom..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {query.trim().length >= 2 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !searching ? <Text style={styles.emptyText}>Aucun résultat</Text> : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <AvatarBubble uri={item.avatarUrl} displayName={item.displayName} size={34} />
                <Text style={styles.rowName}>{item.displayName}</Text>
              </View>
              {renderSearchButton(item)}
            </View>
          )}
        />
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => 'x'}
          renderItem={null}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {received.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Demandes reçues</Text>
                  {received.map((r) => (
                    <View key={r.uid} style={styles.row}>
                      <View style={styles.rowLeft}>
                        <AvatarBubble uri={r.avatarUrl} displayName={r.displayName} size={34} />
                        <Text style={styles.rowName}>{r.displayName}</Text>
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={styles.smallAcceptButton}
                          onPress={() => respondRequest(r.uid, true)}
                        >
                          <Text style={styles.smallAcceptButtonText}>Accepter</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.smallDeclineButton}
                          onPress={() => respondRequest(r.uid, false)}
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
                  <Text style={styles.sectionTitle}>Demandes envoyées</Text>
                  {sent.map((s) => (
                    <View key={s.uid} style={styles.row}>
                      <View style={styles.rowLeft}>
                        <AvatarBubble uri={s.avatarUrl} displayName={s.displayName} size={34} />
                        <Text style={styles.rowName}>{s.displayName}</Text>
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>En attente</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
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
                        <View>
                          <Text style={styles.rowName}>{f.displayName}</Text>
                          <Text style={styles.rowSubtext}>
                            {f.xp} XP · {f.streak}j de série
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => removeFriend(f.uid)} hitSlop={8}>
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
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingTop: 25,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
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
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    rowName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
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
      width: 34,
      height: 34,
      borderRadius: 17,
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
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
    },
    smallAcceptButtonText: {
      color: colors.textInverse,
      fontSize: 12,
      fontWeight: '700',
    },
    smallDeclineButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.tintDanger,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}