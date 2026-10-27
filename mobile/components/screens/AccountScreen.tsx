import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Share,
} from "react-native";
import { auth } from "../../firebaseConfig";
import { signOut } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/services/api";
import { useFocusEffect } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";
import { getAuthHeaders } from "../../utils/authHeaders";
import { scheduleReminderIfNeeded } from "../../utils/streakNotifications";

import { useScreenInsets } from '../navigation/constants';
import { appAlert } from '../../utils/appAlert';
import { unregisterPushNotifications } from '../../utils/pushNotifications';
import { logEvent } from '../../utils/analytics';

// Formulaire de retour des testeurs (beta test) ; la carte n'apparaît que s'il est défini.
const FEEDBACK_URL = process.env.EXPO_PUBLIC_FEEDBACK_URL ?? '';

type Badge = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  unlocked: boolean;
  unlockedAt: string | null;
  currentValue: number;
  threshold: number;
  progress: number;
};

type ActivityItem = {
  type: "lesson_completed" | "badge_unlocked" | string;
  title: string;
  detail: string;
  xpGained: number;
  createdAt: string;
};

/** Assombrit une couleur #rrggbb (factor < 1). */
function darken(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * factor));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffDays = Math.floor(diffH / 24);
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function AccountScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, tabBarHeight } = useScreenInsets();

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = auth.currentUser;

  const [stats, setStats] = useState({
    streak: 0,
    xp: 0,
    rank: 1,
    league: { id: "bronze", name: "Bronze", color: "#cd7f32", nextLeagueName: null as string | null, xpToNextLeague: 0 },
  });

  const [badges, setBadges] = useState<Badge[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);

  const loadBadgesAndActivity = async () => {
    if (!user) return;
    try {
      const headers = await getAuthHeaders(user);
      const [badgesRes, activityRes, friendsRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/api/badges`, { headers }),
        fetch(`${API_URL}/api/activity?limit=10`, { headers }),
        fetch(`${API_URL}/api/friends`, { headers }),
        fetch(`${API_URL}/api/friends/requests`, { headers }),
      ]);
      const badgesData = await badgesRes.json();
      const activityData = await activityRes.json();
      const friendsData = await friendsRes.json();
      const requestsData = await requestsRes.json();
      setBadges(Array.isArray(badgesData.badges) ? badgesData.badges : []);
      setActivity(Array.isArray(activityData.activity) ? activityData.activity : []);
      setFriendsCount(Array.isArray(friendsData.friends) ? friendsData.friends.length : 0);
      setPendingFriendRequests(
        Array.isArray(requestsData.received) ? requestsData.received.length : 0
      );
    } catch (err) {
      console.error("Erreur chargement badges/activité:", err);
    }
  };

  const handleLogout = async () => {
    appAlert(
      "Déconnexion",
      "Tu veux vraiment te déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Se déconnecter", 
          style: "destructive",
          onPress: async () => {
            try {
              // Ce téléphone ne doit plus recevoir les notifications de ce compte.
              if (auth.currentUser) await unregisterPushNotifications(auth.currentUser);
              await signOut(auth);
            } catch (error) {
              appAlert("Erreur", "Impossible de se déconnecter");
            }
          }
        }
      ]
    );
  };

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      appAlert("Erreur", "Impossible d'ouvrir le lien");
    }
  };

  const sendEmail = async () => {
    const email = "medflow.app.contact@gmail.com";
    const subject = "Contact depuis l'application MedFlow";

    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    try {
      await Linking.openURL(url);
    } catch {
      appAlert(
        "Erreur",
        "Aucune application mail configurée sur cet appareil"
      );
    }
  };

  useFocusEffect(
    useCallback(() => {

      if (!user) return;

      const loadAccount = async () => {
        try {
          const res = await fetch(`${API_URL}/api/account`, {
            headers: await getAuthHeaders(user),
          });

          const data = await res.json();

          setStats({
            xp: data.stats.xp,
            streak: data.stats.streak,
            rank: data.stats.rank,
            league: data.stats.league,
          });
          scheduleReminderIfNeeded(data?.stats?.lastActivity ?? null);
        } catch (err) {
          console.error("Erreur chargement compte", err);
        }
      };

      loadAccount();
      loadBadgesAndActivity();

    }, [user])
  );

  const shareApp = async () => {
    try {
      await Share.share({
        message: "Je révise mes cours de médecine avec MedFlow : résumés, flashcards et quiz générés par IA. https://www.instagram.com/med_flowapp/",
      });
    } catch {
      // Partage annulé : rien à faire.
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textPrimary }}>Aucun utilisateur connecté</Text>
      </View>
    );
  }

  // Date abrégée pour que la puce tienne sur une ligne.
  const joinedDate = new Date(user.metadata.creationTime || "").toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Texte de la puce de ligue : couleur de la ligue assombrie, lisible sur sa teinte claire (ex. bronze #cd7f32 → #9a5f26).
  const leagueText = isDark ? stats.league.color : darken(stats.league.color, 0.75);

  const initials = (user.displayName || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const statCards: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    tint: string;
    value: string;
    label: string;
    onPress?: () => void;
    a11y?: string;
  }[] = [
    { icon: "flame", iconColor: colors.warning, tint: colors.tintWarning, value: String(stats.streak), label: "Jours de série" },
    { icon: "star", iconColor: colors.primaryDark, tint: colors.tintPrimary, value: String(stats.xp), label: "XP totaux" },
    {
      icon: "trophy",
      iconColor: colors.success,
      tint: colors.tintSuccess,
      value: `#${stats.rank}`,
      label: "Classement",
      onPress: () => navigation.navigate("Leaderboard"),
      a11y: `Classement, rang numéro ${stats.rank}`,
    },
    {
      icon: "people",
      iconColor: colors.textPrimary,
      tint: colors.surfaceAlt,
      value: String(friendsCount),
      label: "Amis",
      onPress: () => navigation.navigate("Friends" as never),
      a11y: `Amis, ${friendsCount}${pendingFriendRequests > 0 ? `, ${pendingFriendRequests} demande${pendingFriendRequests > 1 ? "s" : ""} en attente` : ""}`,
    },
  ];

  const renderStatCard = (card: (typeof statCards)[number]) => {
    const content = (
      <>
        <View style={[styles.statIcon, { backgroundColor: card.tint }]}>
          <Ionicons name={card.icon} size={22} color={card.iconColor} />
        </View>
        <View style={styles.statText}>
          <Text style={styles.statNumber}>{card.value}</Text>
          <Text style={styles.statLabel}>{card.label}</Text>
        </View>
        {card.label === "Amis" && pendingFriendRequests > 0 && (
          <View style={styles.friendsBadge}>
            <Text style={styles.friendsBadgeText}>{pendingFriendRequests}</Text>
          </View>
        )}
      </>
    );
    return card.onPress ? (
      <TouchableOpacity
        key={card.label}
        style={styles.statCard}
        onPress={card.onPress}
        accessibilityRole="button"
        accessibilityLabel={card.a11y}
      >
        {content}
      </TouchableOpacity>
    ) : (
      <View key={card.label} style={styles.statCard} accessible accessibilityLabel={`${card.label} : ${card.value}`}>
        {content}
      </View>
    );
  };

  const socials: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; url: string }[] = [
    { label: "Instagram", icon: "logo-instagram", color: "#E1306C", url: "https://www.instagram.com/med_flowapp/" },
    { label: "LinkedIn", icon: "logo-linkedin", color: "#0A66C2", url: "https://www.linkedin.com/company/medflow-app/" },
    {
      label: "Product Hunt",
      icon: "rocket-outline",
      color: "#da552f",
      url: "https://www.producthunt.com/products/medflow-3?launch=medflow-2",
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: top, paddingBottom: tabBarHeight + 40 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={shareApp}
            accessibilityRole="button"
            accessibilityLabel="Partager MedFlow"
          >
            <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate("Settings")}
            accessibilityRole="button"
            accessibilityLabel="Réglages"
          >
            <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Profil */}
        <View style={styles.profile}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => navigation.navigate("Settings")}
            accessibilityRole="button"
            accessibilityLabel="Changer la photo de profil"
          >
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} accessible={false} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.warning }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color={colors.onAction} />
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{user.displayName || "Utilisateur"}</Text>
          <Text style={styles.email}>{user.email}</Text>

          {/* Puces qui passent à la ligne au lieu de déborder */}
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: stats.league.color + "26" }]}>
              <Ionicons name="ribbon" size={14} color={leagueText} />
              <Text style={[styles.chipText, styles.leagueText, { color: leagueText }]}>Ligue {stats.league.name}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.tintPrimary }]}>
              <Ionicons name="calendar" size={14} color={colors.primaryDark} />
              <Text style={[styles.chipText, { color: colors.primaryText }]}>Membre depuis le {joinedDate}</Text>
            </View>
          </View>

          {stats.league.nextLeagueName && (
            <Text style={styles.nextLeagueHint}>
              Plus que {stats.league.xpToNextLeague} XP pour la ligue {stats.league.nextLeagueName}
            </Text>
          )}
        </View>

        {/* Stats en grille 2 × 2 */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>{statCards.slice(0, 2).map(renderStatCard)}</View>
          <View style={styles.statsRow}>{statCards.slice(2).map(renderStatCard)}</View>
        </View>

        {/* Badges */}
        <Text style={styles.sectionTitle} accessibilityRole="header">Badges</Text>
        <View style={styles.badgesGrid}>
          {badges.map((badge) => (
            <View key={badge.id} style={[styles.badgeCard, !badge.unlocked && styles.badgeCardLocked]}>
              <View
                style={[
                  styles.badgeIcon,
                  { backgroundColor: badge.unlocked ? badge.color + "20" : colors.surface },
                ]}
              >
                <Ionicons
                  name={badge.unlocked ? badge.icon : "lock-closed"}
                  size={badge.unlocked ? 26 : 22}
                  color={badge.unlocked ? badge.color : colors.muted}
                />
              </View>
              <Text style={[styles.badgeName, !badge.unlocked && styles.badgeNameLocked]} numberOfLines={1}>
                {badge.title}
              </Text>
              <Text style={styles.badgeDescription} numberOfLines={2}>
                {badge.description}
              </Text>
              {!badge.unlocked && (
                <>
                  <View style={styles.badgeProgressTrack}>
                    <View
                      style={[
                        styles.badgeProgressFill,
                        { width: `${badge.progress * 100}%`, backgroundColor: colors.warning },
                      ]}
                    />
                  </View>
                  <Text style={styles.badgeProgressText}>
                    {badge.currentValue}/{badge.threshold}
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>

        {/* Activité récente */}
        <Text style={styles.sectionTitle} accessibilityRole="header">Activité récente</Text>
        {activity.length === 0 ? (
          <Text style={styles.emptyActivityText}>Termine une leçon pour voir ton activité ici.</Text>
        ) : (
          <View style={styles.listCard}>
            {activity.map((item, index) => {
              const isBadge = item.type === "badge_unlocked";
              const isQuest = item.type === "quest_completed" || item.type.startsWith("streak_freeze");
              return (
                <View key={index} style={[styles.activityRow, index > 0 && styles.rowDivider]}>
                  <View
                    style={[
                      styles.activityIcon,
                      {
                        backgroundColor: isBadge ? colors.tintWarning : isQuest ? colors.tintSuccess : colors.tintPrimary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        isBadge
                          ? "trophy"
                          : item.type.startsWith("streak_freeze")
                          ? "shield-checkmark"
                          : item.type === "mock_exam"
                          ? "timer"
                          : item.type === "challenge"
                          ? "flash"
                          : item.type === "clinical_case"
                          ? "medkit"
                          : isQuest
                          ? "flag"
                          : "school"
                      }
                      size={22}
                      color={isBadge ? colors.warning : isQuest ? colors.success : colors.primaryDark}
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activityTime}>
                      {item.detail ? `${item.detail} · ` : ""}
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                  {item.xpGained > 0 && (
                    <View style={styles.activityXp}>
                      <Ionicons name="star" size={14} color={colors.warning} />
                      <Text style={styles.activityXpText}>+{item.xpGained} XP</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Actions rapides */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={shareApp} accessibilityRole="button">
            <View style={[styles.quickActionIcon, { backgroundColor: colors.tintSuccess }]}>
              <Ionicons name="share-social-outline" size={22} color={colors.success} />
            </View>
            <Text style={styles.quickActionText}>Partager</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={sendEmail} accessibilityRole="button">
            <View style={[styles.quickActionIcon, { backgroundColor: colors.tintWarning }]}>
              <Ionicons name="help-buoy-outline" size={22} color={colors.warning} />
            </View>
            <Text style={styles.quickActionText}>Aide</Text>
          </TouchableOpacity>
        </View>

        {/* À propos */}
        <Text style={styles.sectionTitle} accessibilityRole="header">À propos de MedFlow</Text>
        <Text style={styles.aboutText}>
          MedFlow accompagne les étudiants en médecine dans leurs révisions grâce à des cours interactifs,
          des flashcards et des outils d’apprentissage assistés par IA.
        </Text>

        {!!FEEDBACK_URL && (
          <TouchableOpacity
            style={[styles.contactCard, { marginBottom: 12 }]}
            onPress={() => {
              logEvent('feedback_opened');
              openLink(FEEDBACK_URL);
            }}
            accessibilityRole="link"
            accessibilityLabel="Donner mon avis sur MedFlow"
          >
            <View style={[styles.contactIcon, { backgroundColor: colors.tintPrimary }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primaryDark} />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Donner mon avis</Text>
              <Text style={styles.contactSubtitle}>5 minutes pour nous aider à améliorer MedFlow</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.contactCard}
          onPress={sendEmail}
          accessibilityRole="button"
          accessibilityLabel="Nous contacter, medflow.app.contact@gmail.com"
        >
          <View style={[styles.contactIcon, { backgroundColor: colors.tintPrimary }]}>
            <Ionicons name="mail-outline" size={22} color={colors.primaryDark} />
          </View>
          <View style={styles.contactContent}>
            <Text style={styles.contactTitle}>Nous contacter</Text>
            <Text style={styles.contactSubtitle}>medflow.app.contact@gmail.com</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle} accessibilityRole="header">Suivez-nous</Text>
        <View style={styles.listCard}>
          {socials.map((social, index) => (
            <TouchableOpacity
              key={social.label}
              style={[styles.socialRow, index > 0 && styles.rowDivider]}
              onPress={() => openLink(social.url)}
              accessibilityRole="link"
              accessibilityLabel={social.label}
            >
              <Ionicons name={social.icon} size={24} color={social.color} />
              <Text style={styles.socialText}>{social.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Déconnexion : bouton rouge clair, bien au-dessus de la barre d'onglets */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.dangerText} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    scrollContent: {
      paddingHorizontal: 20,
      gap: 22,
    },

    header: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
    },

    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    profile: {
      alignItems: "center",
      gap: 6,
      marginTop: -10,
    },

    avatarWrap: {
      width: 112,
      height: 112,
      marginBottom: 6,
    },

    avatar: {
      width: 112,
      height: 112,
      borderRadius: 56,
      alignItems: "center",
      justifyContent: "center",
    },

    avatarText: {
      fontSize: 38,
      fontWeight: "700",
      color: colors.onAction,
    },

    cameraBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 3,
      borderColor: colors.surface,
      backgroundColor: colors.action,
      alignItems: "center",
      justifyContent: "center",
    },

    name: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },

    email: {
      fontSize: 15,
      color: colors.textSecondary,
    },

    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      marginTop: 4,
    },

    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },

    chipText: {
      fontSize: 13,
      fontWeight: "500",
    },

    leagueText: {
      fontWeight: "600",
      color: colors.textPrimary,
    },

    nextLeagueHint: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.textSecondary,
      textAlign: "center",
    },

    statsGrid: {
      gap: 12,
    },

    statsRow: {
      flexDirection: "row",
      gap: 12,
    },

    statCard: {
      flex: 1,
      gap: 10,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    statIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },

    statText: {
      gap: 2,
    },

    statNumber: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    statLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.textSecondary,
    },

    friendsBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },

    friendsBadgeText: {
      color: colors.onAction,
      fontSize: 12,
      fontWeight: "700",
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: -8,
    },

    badgesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },

    badgeCard: {
      flexBasis: "47%",
      flexGrow: 1,
      alignItems: "center",
      gap: 8,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    badgeCardLocked: {
      backgroundColor: colors.surfaceAlt,
    },

    badgeIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },

    badgeName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    badgeNameLocked: {
      color: colors.textSecondary,
    },

    badgeDescription: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      textAlign: "center",
    },

    badgeProgressTrack: {
      alignSelf: "stretch",
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: "hidden",
    },

    badgeProgressFill: {
      height: "100%",
      borderRadius: 3,
    },

    badgeProgressText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },

    emptyActivityText: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    listCard: {
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    activityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
    },

    activityIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },

    activityContent: {
      flex: 1,
      gap: 2,
    },

    activityTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },

    activityTime: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    activityXp: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.tintWarning,
    },

    activityXpText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.warningText,
    },

    quickActions: {
      flexDirection: "row",
      gap: 12,
    },

    quickAction: {
      flex: 1,
      alignItems: "center",
      gap: 8,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    quickActionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },

    quickActionText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },

    aboutText: {
      fontSize: 15,
      lineHeight: 23,
      color: colors.textSecondary,
    },

    contactCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    contactIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },

    contactContent: {
      flex: 1,
      gap: 2,
    },

    contactTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },

    contactSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    socialRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
    },

    socialText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      color: colors.textPrimary,
    },

    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderRadius: 14,
      backgroundColor: colors.tintDanger,
    },

    logoutText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.dangerText,
    },
  });
}
