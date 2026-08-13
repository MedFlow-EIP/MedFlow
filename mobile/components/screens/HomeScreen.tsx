import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import { PathCard } from '../../components/PathCard';
import { Path } from '../../types';
import { getAuth } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/services/api';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '@/utils/authHeaders';

interface HomeScreenProps {
  navigation: any;
  route: any;
}

export function HomeScreen({ navigation, route }: HomeScreenProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [paths, setPaths] = useState<Path[]>([]);

  const [greeting, setGreeting] = useState('');
  const user = getAuth().currentUser;

  // useEffect(() => {
  //   const hour = new Date().getHours();
  //   if (hour < 12) setGreeting('Bonjour');
  //   else if (hour < 18) setGreeting('Bon après-midi');
  //   else setGreeting('Bonsoir');
  // }, []);

  useEffect(() => {
    if (Array.isArray(route.params?.updatedPaths)) {
      setPaths(route.params.updatedPaths);
    }
  }, [route.params?.updatedPaths]);

  useFocusEffect(
    useCallback(() => {
      const loadPaths = async () => {
        if (!user) return;
        try {
          const res = await fetch(`${API_URL}/api/paths`, {
            headers: await getAuthHeaders(user),
          });
          const data = await res.json();
          setPaths(Array.isArray(data.paths) ? data.paths : []);
        } catch (err) {
          console.error(err);
        }
      };
      loadPaths();
    }, [user])
  );

  const handlePathPress = (path: Path) => {
    if (!path.isLocked) {
      navigation.navigate('Path', { path });
    }
  };

  // Statistiques calculées
  const totalLessons = paths.reduce((acc, path) => acc + path.totalLessons, 0);
  const completedLessons = paths.reduce((acc, path) => acc + path.completedLessons, 0);
  const globalProgress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  const availablePaths = paths.filter(p => !p.isLocked).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.header}>
        <View>
          {/* <Text style={styles.greeting}>{greeting},</Text> */}
          <Text style={styles.userName}>{user?.displayName?.split(' ')[0] || 'Médecin'}</Text>
        </View>
        
        <View style={styles.headerRight}>
          {/* <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="search-outline" size={24} color="#4b5563" />
          </TouchableOpacity> */}
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Account')}
            accessibilityRole="button"
            accessibilityLabel="Mon profil"
          >
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.headerAvatar} accessible={false} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>
                  {user?.displayName?.charAt(0) || 'U'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </BlurView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Carte de bienvenue avec stats
        <LinearGradient
          colors={['#3b82f6', '#2563eb']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeCard}
        >
          <View style={styles.welcomeContent}>
            <Text style={styles.welcomeTitle}>Continuez votre apprentissage</Text>
            <Text style={styles.welcomeSubtitle}>
              {completedLessons} leçons complétées • {globalProgress.toFixed(0)}% du parcours
            </Text>
            
            <View style={styles.welcomeProgress}>
              <View style={styles.welcomeProgressBar}>
                <View style={[styles.welcomeProgressFill, { width: `${globalProgress}%` }]} />
              </View>
            </View>

            <View style={styles.welcomeStats}>
              <View style={styles.welcomeStat}>
                <Ionicons name="flame" size={20} color="#ffffff" />
                <Text style={styles.welcomeStatValue}>7</Text>
                <Text style={styles.welcomeStatLabel}>jours</Text>
              </View>
              <View style={styles.welcomeStatDivider} />
              <View style={styles.welcomeStat}>
                <Ionicons name="star" size={20} color="#ffffff" />
                <Text style={styles.welcomeStatValue}>420</Text>
                <Text style={styles.welcomeStatLabel}>XP</Text>
              </View>
              <View style={styles.welcomeStatDivider} />
              <View style={styles.welcomeStat}>
                <Ionicons name="trophy" size={20} color="#ffffff" />
                <Text style={styles.welcomeStatValue}>{availablePaths}</Text>
                <Text style={styles.welcomeStatLabel}>parcours</Text>
              </View>
            </View>
          </View>
        </LinearGradient> */}

        {/* Section Parcours */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Parcours d'apprentissage</Text>
            <TouchableOpacity>
              {/* <Text style={styles.seeAllText}>Tous</Text> */}
            </TouchableOpacity>
          </View>

          {paths.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyStateTitle}>Aucun parcours</Text>
              <Text style={styles.emptyStateText}>
                Commencez par importer un cours ou créer votre premier parcours
              </Text>
            </View>
          ) : (
            paths.map((path, index) => (
              <PathCard
                key={path.id}
                {...path}
                index={index}
                onPress={() => handlePathPress(path)}
              />
            ))
          )}
        </View>

        {/* Section Quick Actions
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.quickActionItem}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="add-circle" size={28} color="#3b82f6" />
              </View>
              <Text style={styles.quickActionLabel}>Importer</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionItem}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="flash" size={28} color="#10b981" />
              </View>
              <Text style={styles.quickActionLabel}>Révision</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionItem}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="stats-chart" size={28} color="#f59e0b" />
              </View>
              <Text style={styles.quickActionLabel}>Statistiques</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionItem}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#fae8ff' }]}>
                <Ionicons name="calendar" size={28} color="#d946ef" />
              </View>
              <Text style={styles.quickActionLabel}>Planning</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Conseil du jour */}
        {/* <BlurView intensity={60} tint="light" style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <Ionicons name="bulb-outline" size={24} color="#f59e0b" />
          </View>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Conseil du jour</Text>
            <Text style={styles.tipDescription}>
              Révisez vos flashcards avant de dormir pour une meilleure consolidation en mémoire.
            </Text>
          </View>
        </BlurView> */}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 10,
    },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    greeting: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    userName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
    },

    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },

    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },

    headerAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },

    headerAvatarPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerAvatarText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.onAccent,
    },

    scrollContent: {
      padding: 20,
    },

    welcomeCard: {
      borderRadius: 24,
      padding: 20,
      marginBottom: 24,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },

    welcomeContent: {
      gap: 12,
    },

    welcomeTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textInverse,
    },

    welcomeSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.9)',
    },

    welcomeProgress: {
      marginTop: 8,
    },

    welcomeProgressBar: {
      height: 6,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 3,
      overflow: 'hidden',
    },

    welcomeProgressFill: {
      height: '100%',
      backgroundColor: colors.textInverse,
      borderRadius: 3,
    },

    welcomeStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.2)',
    },

    welcomeStat: {
      alignItems: 'center',
      gap: 4,
    },

    welcomeStatValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textInverse,
    },

    welcomeStatLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
    },

    welcomeStatDivider: {
      width: 1,
      height: '100%',
      backgroundColor: 'rgba(255,255,255,0.2)',
    },

    section: {
      marginBottom: 24,
    },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    seeAllText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },

    emptyState: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: colors.surface,
      borderRadius: 16,
      gap: 12,
    },

    emptyStateTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    emptyStateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    quickActionsSection: {
      marginBottom: 24,
    },

    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 16,
    },

    quickActionItem: {
      flex: 1,
      minWidth: '22%',
      alignItems: 'center',
      gap: 8,
    },

    quickActionIcon: {
      width: 60,
      height: 60,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },

    quickActionLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    tipCard: {
      flexDirection: 'row',
      padding: 16,
      borderRadius: 16,
      gap: 12,
      overflow: 'hidden',
      marginBottom: 24,
      backgroundColor: 'rgba(255,255,255,0.7)',
    },

    tipIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.tintWarning,
      alignItems: 'center',
      justifyContent: 'center',
    },

    tipContent: {
      flex: 1,
    },

    tipTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },

    tipDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    bottomSpacing: {
      height: 20,
    },
  });
}