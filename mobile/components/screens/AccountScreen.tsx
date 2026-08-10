import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  Linking,
} from "react-native";
import { auth } from "../../firebaseConfig";
import { signOut } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/services/api";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";
import { getAuthHeaders } from "../../utils/authHeaders";
import { scheduleReminderIfNeeded } from "../../utils/streakNotifications";

const { width, height } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 70;

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

function getActivityIcon(type: string): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  if (type === "badge_unlocked") return { icon: "trophy", color: "#f59e0b" };
  if (type === "lesson_completed") return { icon: "book", color: "#3b82f6" };
  return { icon: "checkmark-circle", color: "#10b981" };
}

export function AccountScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Se déconnecter", 
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              Alert.alert("Erreur", "Impossible de se déconnecter");
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
      Alert.alert("Erreur", "Impossible d'ouvrir le lien");
    }
  };

  const sendEmail = async () => {
    const email = "medflow.app.contact@gmail.com";
    const subject = "Contact depuis l'application MedFlow";

    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
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

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textPrimary }}>Aucun utilisateur connecté</Text>
      </View>
    );
  }

  const joinedDate = new Date(user.metadata.creationTime || "").toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate("Settings")}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          {/* <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="share-outline" size={24} color="#6b7280" />
          </TouchableOpacity> */}
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileImageContainer}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.avatarPlaceholder}
              >
                <Text style={styles.avatarText}>
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                </Text>
              </LinearGradient>
            )}
            {/* <TouchableOpacity style={styles.editProfileButton}>
              <Ionicons name="camera" size={16} color="#ffffff" />
            </TouchableOpacity> */}
          </View>

          <Text style={styles.name}>{user.displayName || "Utilisateur"}</Text>
          <Text style={styles.email}>{user.email}</Text>
          
          <View style={styles.badgeContainer}>
            <View style={[styles.leagueBadge, { backgroundColor: stats.league.color + '25' }]}>
              <Ionicons name="ribbon" size={14} color={stats.league.color} />
              <Text style={[styles.leagueBadgeText, { color: stats.league.color }]}>
                Ligue {stats.league.name}
              </Text>
            </View>
            <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={styles.badge}>
              <Ionicons name="calendar" size={14} color={colors.primary} />
              <Text style={styles.badgeText}>Membre depuis le {joinedDate}</Text>
            </BlurView>
          </View>

          {stats.league.nextLeagueName && (
            <Text style={styles.nextLeagueHint}>
              Plus que {stats.league.xpToNextLeague} XP pour la ligue {stats.league.nextLeagueName}
            </Text>
          )}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.tintWarning }]}>
            <Ionicons name="flame" size={28} color={colors.warning} />
            <Text style={styles.statNumber}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Jours de série</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.tintPrimary }]}>
            <Ionicons name="star" size={28} color={colors.primary} />
            <Text style={styles.statNumber}>{stats.xp}</Text>
            <Text style={styles.statLabel}>XP totaux</Text>
          </View>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.tintSuccess }]}
            onPress={() => navigation.navigate("Leaderboard")}
          >
            <Ionicons name="trophy" size={28} color={colors.success} />
            <Text style={styles.statNumber}>#{stats.rank}</Text>
            <Text style={styles.statLabel}>Classement</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => navigation.navigate("Friends" as never)}
          >
            {pendingFriendRequests > 0 && (
              <View style={styles.friendsBadge}>
                <Text style={styles.friendsBadgeText}>{pendingFriendRequests}</Text>
              </View>
            )}
            <Ionicons name="people" size={28} color={colors.textPrimary} />
            <Text style={styles.statNumber}>{friendsCount}</Text>
            <Text style={styles.statLabel}>Amis</Text>
          </TouchableOpacity>
        </View>

        {/* Level Progress */}
        {/* <BlurView intensity={60} tint="light" style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={styles.levelInfo}>
              <Text style={styles.levelLabel}>Niveau {stats.level}</Text>
              <Text style={styles.levelXp}>{stats.xp} / {stats.nextLevelXp} XP</Text>
            </View>
            <Text style={styles.levelPercentage}>{Math.round(progressToNextLevel)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progressToNextLevel}%` }]}
            />
          </View>
        </BlurView> */}

        {/* Badges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Badges</Text>
          </View>

          <View style={styles.badgesGrid}>
            {badges.map((badge) => (
              <View
                key={badge.id}
                style={[styles.badgeGridItem, !badge.unlocked && styles.badgeGridItemLocked]}
              >
                <View
                  style={[
                    styles.badgeIcon,
                    {
                      backgroundColor: badge.unlocked
                        ? badge.color + "20"
                        : colors.surfaceAlt,
                    },
                  ]}
                >
                  <Ionicons
                    name={badge.unlocked ? badge.icon : "lock-closed"}
                    size={26}
                    color={badge.unlocked ? badge.color : colors.muted}
                  />
                </View>
                <Text
                  style={[styles.badgeName, !badge.unlocked && styles.badgeNameLocked]}
                  numberOfLines={1}
                >
                  {badge.title}
                </Text>
                <Text style={styles.badgeDescription} numberOfLines={2}>
                  {badge.description}
                </Text>
                {!badge.unlocked && (
                  <View style={styles.badgeProgressRow}>
                    <View style={styles.badgeProgressTrack}>
                      <View
                        style={[
                          styles.badgeProgressFill,
                          { width: `${badge.progress * 100}%`, backgroundColor: badge.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.badgeProgressText}>
                      {badge.currentValue}/{badge.threshold}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Activité récente */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activité récente</Text>
          </View>

          {activity.length === 0 ? (
            <Text style={styles.emptyActivityText}>
              Termine une leçon pour voir ton activité ici.
            </Text>
          ) : (
            activity.map((item, index) => {
              const { icon, color } = getActivityIcon(item.type);
              return (
                <View key={index} style={styles.activityCard}>
                  <View style={[styles.activityIcon, { backgroundColor: color + "20" }]}>
                    <Ionicons name={icon} size={22} color={color} />
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
                      <Ionicons name="star" size={16} color={colors.warning} />
                      <Text style={styles.activityXpText}>+{item.xpGained} XP</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Quick Actions */}
        {/* <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <LinearGradient
              colors={['#dbeafe', '#bfdbfe']}
              style={styles.quickActionIcon}
            >
              <Ionicons name="download-outline" size={24} color="#3b82f6" />
            </LinearGradient>
            <Text style={styles.quickActionText}>Exporter</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction}>
            <LinearGradient
              colors={['#dcfce7', '#bbf7d0']}
              style={styles.quickActionIcon}
            >
              <Ionicons name="share-social-outline" size={24} color="#10b981" />
            </LinearGradient>
            <Text style={styles.quickActionText}>Partager</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction}>
            <LinearGradient
              colors={['#fef3c7', '#fde68a']}
              style={styles.quickActionIcon}
            >
              <Ionicons name="help-buoy-outline" size={24} color="#f59e0b" />
            </LinearGradient>
            <Text style={styles.quickActionText}>Aide</Text>
          </TouchableOpacity>
        </View> */}

        {/* About MedFlow Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            À propos de MedFlow
          </Text>

          <Text style={styles.aboutText}>
            MedFlow accompagne les étudiants en médecine dans leurs révisions
            grâce à des cours interactifs, des flashcards et des outils
            d'apprentissage assistés par IA.
          </Text>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={sendEmail}
          >
            <Ionicons
              name="mail-outline"
              size={22}
              color={colors.primary}
            />

            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>
                Nous contacter
              </Text>

              <Text style={styles.contactSubtitle}>
                medflow.app.contact@gmail.com
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
            Suivez-nous
          </Text>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() =>
              openLink(
                "https://www.instagram.com/med_flowapp/"
              )
            }
          >
            <Ionicons
              name="logo-instagram"
              size={24}
              color="#E1306C"
            />

            <Text style={styles.socialText}>
              Instagram
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() =>
              openLink(
                "https://www.linkedin.com/company/medflow-app/"
              )
            }
          >
            <Ionicons
              name="logo-linkedin"
              size={24}
              color="#0A66C2"
            />

            <Text style={styles.socialText}>
              LinkedIn
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() =>
              openLink(
                "https://www.producthunt.com/products/medflow-3?launch=medflow-2"
              )
            }
          >
            <Ionicons
              name="rocket-outline"
              size={24}
              color="#da552f"
            />

            <Text style={styles.socialText}>
              Product Hunt
            </Text>
          </TouchableOpacity>

        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <View style={styles.logoutGradient}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.bottomSpacing, { height: TAB_BAR_HEIGHT + 20 }]} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    scrollContent: {
      paddingBottom: 20,
    },

    header: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: 20,
      paddingTop: 35,
      gap: 12,
    },

    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },

    profileCard: {
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 24,
    },

    profileImageContainer: {
      position: "relative",
      marginBottom: 16,
    },

    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 3,
      borderColor: colors.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },

    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: colors.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },

    avatarText: {
      fontSize: 40,
      fontWeight: "600",
      color: colors.textInverse,
    },

    editProfileButton: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: colors.primary,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.surface,
    },

    name: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },

    email: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },

    badgeContainer: {
      flexDirection: "row",
      gap: 8,
    },

    badge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
      overflow: 'hidden',
    },

    badgeText: {
      fontSize: 12,
      color: colors.textSecondary,
    },

    leagueBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },

    leagueBadgeText: {
      fontSize: 12,
      fontWeight: "700",
    },

    nextLeagueHint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
    },

    statsGrid: {
      flexDirection: "row",
      paddingHorizontal: 20,
      gap: 12,
      marginBottom: 20,
    },

    statCard: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      alignItems: "center",
      position: "relative",
    },

    friendsBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      zIndex: 1,
    },

    friendsBadgeText: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "700",
    },

    statNumber: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: 8,
      marginBottom: 4,
    },

    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
    },

    levelCard: {
      marginHorizontal: 20,
      marginBottom: 24,
      padding: 20,
      borderRadius: 16,
      overflow: 'hidden',
    },

    levelHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },

    levelInfo: {
      flex: 1,
    },

    levelLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 4,
    },

    levelXp: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    levelPercentage: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.primary,
    },

    progressBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: "hidden",
    },

    progressFill: {
      height: "100%",
      borderRadius: 4,
    },

    section: {
      marginBottom: 24,
      paddingHorizontal: 20,
    },

    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
    },

    seeAllText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: "500",
    },

    badgesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },

    badgeGridItem: {
      width: "47%",
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },

    badgeGridItemLocked: {
      opacity: 0.55,
    },

    badgeIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },

    badgeName: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },

    badgeNameLocked: {
      color: colors.textSecondary,
    },

    badgeDescription: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 2,
    },

    badgeProgressRow: {
      width: "100%",
      marginTop: 10,
      alignItems: "center",
    },

    badgeProgressTrack: {
      width: "100%",
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.surfaceAlt,
      overflow: "hidden",
    },

    badgeProgressFill: {
      height: "100%",
      borderRadius: 3,
    },

    badgeProgressText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textSecondary,
      marginTop: 4,
    },

    emptyActivityText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 20,
    },

    achievementCard: {
      flexDirection: "row",
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      overflow: 'hidden',
    },

    achievementIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    achievementContent: {
      flex: 1,
      justifyContent: "center",
    },

    achievementTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 8,
    },

    achievementProgress: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    achievementProgressBar: {
      flex: 1,
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: "hidden",
    },

    achievementProgressFill: {
      height: "100%",
      borderRadius: 3,
    },

    achievementProgressText: {
      fontSize: 12,
      color: colors.textSecondary,
      width: 35,
    },

    activityCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },

    activityIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    activityContent: {
      flex: 1,
    },

    activityTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 4,
    },

    activityTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },

    activityXp: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
      backgroundColor: colors.tintWarning,
    },

    activityXpText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.warning,
    },

    quickActions: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingHorizontal: 20,
      marginBottom: 24,
    },

    quickAction: {
      alignItems: "center",
    },

    quickActionIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },

    quickActionText: {
      fontSize: 12,
      color: colors.textSecondary,
    },

    logoutButton: {
      marginHorizontal: 20,
      marginBottom: 20,
      borderRadius: 12,
      overflow: 'hidden',
    },

    logoutGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      gap: 8,
      backgroundColor: colors.tintDanger,
    },

    logoutText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.danger,
    },

    bottomSpacing: {
      width: '100%',
    },

    aboutText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
      marginTop: 10,
      marginBottom: 16,
    },

    contactButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 14,
      marginBottom: 10,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },

    contactContent: {
      marginLeft: 12,
    },

    contactTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },

    contactSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },


    socialButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      padding: 15,
      borderRadius: 14,
      marginTop: 10,
    },

    socialText: {
      marginLeft: 12,
      fontSize: 15,
      fontWeight: "500",
      color: colors.textPrimary,
    },
  });
}