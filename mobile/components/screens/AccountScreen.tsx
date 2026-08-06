import React, { useCallback, useEffect, useState } from "react";
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

const { width, height } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 70;

type Achievement = {
  id: number;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  progress?: number;
};

type Badge = {
  id: number;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

type RecentActivity = {
  id: number;
  title: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  xp?: number;
};

export function AccountScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = auth.currentUser;

  const [stats, setStats] = useState({
    streak: 7,
    xp: 420,
    league: "Silver League",
    rank: "#1,234",
    level: 12,
    nextLevelXp: 500,
  });

  const [badges, setBadges] = useState<Badge[]>([
    { id: 1, name: "January Hero", icon: "trophy", color: "#f59e0b" },
    { id: 2, name: "Study Master", icon: "flame", color: "#ef4444" },
    { id: 3, name: "Early Bird", icon: "sunny", color: "#fbbf24" },
    { id: 4, name: "Quiz King", icon: "school", color: "#8b5cf6" },
  ]);

  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: 1, title: "Premier cours", icon: "school", color: "#3b82f6", progress: 100 },
    { id: 2, title: "10 sessions", icon: "flash", color: "#10b981", progress: 70 },
    { id: 3, title: "Série de 7 jours", icon: "flame", color: "#f59e0b", progress: 45 },
  ]);

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([
    { id: 1, title: "Quiz Anatomie", time: "Il y a 2 heures", icon: "help-circle", color: "#3b82f6", xp: 50 },
    { id: 2, title: "Leçon de cardiologie", time: "Hier", icon: "heart", color: "#ef4444", xp: 30 },
    { id: 3, title: "Flashcards pharmacologie", time: "Hier", icon: "document-text", color: "#8b5cf6", xp: 25 },
  ]);

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
            headers: {
              "X-User-UID": user.uid,
              "X-User-Name": user.displayName ?? "",
              "X-User-Avatar": user.photoURL ?? "",
            },
          });

          const data = await res.json();

          setStats({
            xp: data.stats.xp,
            streak: data.stats.streak,
            league: "Silver League",
            rank: "#1,234",
            level: 12,
            nextLevelXp: 500,
          });
        } catch (err) {
          console.error("Erreur chargement compte", err);
        }
      };

      loadAccount();

    }, [user])
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Aucun utilisateur connecté</Text>
      </View>
    );
  }

  const joinedDate = new Date(user.metadata.creationTime || "").toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const progressToNextLevel = (stats.xp / stats.nextLevelXp) * 100;

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
              color="#6b7280"
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
                colors={['#3b82f6', '#2563eb']}
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
            <BlurView intensity={40} tint="light" style={styles.badge}>
              <Ionicons name="calendar" size={14} color="#3b82f6" />
              <Text style={styles.badgeText}>Membre depuis le {joinedDate}</Text>
            </BlurView>
          </View>
        </View>

        {/* Stats Cards */}
        {/* <View style={styles.statsGrid}>
          <LinearGradient
            colors={['#eff6ff', '#dbeafe']}
            style={styles.statCard}
          >
            <Ionicons name="flame" size={28} color="#3b82f6" />
            <Text style={styles.statNumber}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Jours de série</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#fef3c7', '#fde68a']}
            style={styles.statCard}
          >
            <Ionicons name="star" size={28} color="#f59e0b" />
            <Text style={styles.statNumber}>{stats.xp}</Text>
            <Text style={styles.statLabel}>XP totaux</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#f0fdf4', '#dcfce7']}
            style={styles.statCard}
          >
            <Ionicons name="trophy" size={28} color="#10b981" />
            <Text style={styles.statNumber}>{stats.rank}</Text>
            <Text style={styles.statLabel}>Classement</Text>
          </LinearGradient>
        </View> */}

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

        {/* Badges Section */}
        {/* <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
            {badges.map((badge) => (
              <View key={badge.id} style={styles.badgeItem}>
                <LinearGradient
                  colors={[badge.color + '20', badge.color + '10']}
                  style={styles.badgeIcon}
                >
                  <Ionicons name={badge.icon} size={32} color={badge.color} />
                </LinearGradient>
                <Text style={styles.badgeName}>{badge.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View> */}

        {/* Achievements Section */}
        {/* <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Succès</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {achievements.map((achievement) => (
            <BlurView key={achievement.id} intensity={60} tint="light" style={styles.achievementCard}>
              <LinearGradient
                colors={[achievement.color + '20', achievement.color + '10']}
                style={styles.achievementIcon}
              >
                <Ionicons name={achievement.icon} size={24} color={achievement.color} />
              </LinearGradient>
              <View style={styles.achievementContent}>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <View style={styles.achievementProgress}>
                  <View style={styles.achievementProgressBar}>
                    <LinearGradient
                      colors={[achievement.color, achievement.color + '80']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.achievementProgressFill, 
                        { width: achievement.progress ? `${achievement.progress}%` : '0%' }
                      ]}
                    />
                  </View>
                  <Text style={styles.achievementProgressText}>{achievement.progress}%</Text>
                </View>
              </View>
            </BlurView>
          ))}
        </View> */}

        {/* Recent Activity */}
        {/* <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activité récente</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {recentActivities.map((activity) => (
            <BlurView key={activity.id} intensity={60} tint="light" style={styles.activityCard}>
              <LinearGradient
                colors={[activity.color + '20', activity.color + '10']}
                style={styles.activityIcon}
              >
                <Ionicons name={activity.icon} size={22} color={activity.color} />
              </LinearGradient>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </View>
              {activity.xp && (
                <LinearGradient
                  colors={['#fef3c7', '#fde68a']}
                  style={styles.activityXp}
                >
                  <Ionicons name="star" size={16} color="#f59e0b" />
                  <Text style={styles.activityXpText}>+{activity.xp} XP</Text>
                </LinearGradient>
              )}
            </BlurView>
          ))}
        </View> */}

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
              color="#3b82f6"
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
          <LinearGradient
            colors={['#fee2e2', '#fecaca']}
            style={styles.logoutGradient}
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={[styles.bottomSpacing, { height: TAB_BAR_HEIGHT + 20 }]} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
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
    backgroundColor: "#ffffff",
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
    borderColor: "#ffffff",
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
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  avatarText: {
    fontSize: 40,
    fontWeight: "600",
    color: "#ffffff",
  },

  editProfileButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#3b82f6",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },

  name: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  email: {
    fontSize: 14,
    color: "#6b7280",
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
    color: "#4b5563",
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
  },

  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 12,
    color: "#6b7280",
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
    color: "#111827",
    marginBottom: 4,
  },

  levelXp: {
    fontSize: 14,
    color: "#6b7280",
  },

  levelPercentage: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3b82f6",
  },

  progressBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
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
    color: "#111827",
  },

  seeAllText: {
    fontSize: 14,
    color: "#3b82f6",
    fontWeight: "500",
  },

  badgesScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },

  badgeItem: {
    alignItems: "center",
    marginRight: 16,
    width: 80,
  },

  badgeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  badgeName: {
    fontSize: 12,
    color: "#4b5563",
    textAlign: "center",
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
    color: "#111827",
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
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },

  achievementProgressFill: {
    height: "100%",
    borderRadius: 3,
  },

  achievementProgressText: {
    fontSize: 12,
    color: "#6b7280",
    width: 35,
  },

  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    overflow: 'hidden',
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
    color: "#111827",
    marginBottom: 4,
  },

  activityTime: {
    fontSize: 12,
    color: "#6b7280",
  },

  activityXp: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },

  activityXpText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f59e0b",
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
    color: "#6b7280",
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
  },

  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },

  bottomSpacing: {
    width: '100%',
  },

  aboutText: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 16,
  },

  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
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
    color: "#111827",
  },

  contactSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },


  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 15,
    borderRadius: 14,
    marginTop: 10,
  },

  socialText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
});