import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  FadeIn,
  FadeOut,
  SlideInUp,
} from 'react-native-reanimated';

import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { AIChatScreen } from '../screens/AIChatScreen';
import { UploadCourseScreen } from '../screens/UploadCourseScreen';
import { PathScreen } from '../screens/PathScreen';
import { LessonScreen } from '../screens/LessonScreen';
import { CourseDetailScreen } from '../screens/CourseDetail';
import { SettingsScreen } from '../screens/SettingsScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { TutorialScreen } from '../screens/TutorialScreen';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useTutorial } from '../../context/TutorialContext';
import { navigationRef } from '../../navigationRef';
import { isFirstTimeUser } from '../../utils/firstTime';

const { width, height } = Dimensions.get('window');
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  AIChat: undefined;
  CourseDetail: { courseId: string };
  UploadCourse: undefined;
  LessonScreen: { path: any; lesson: any };
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Path: undefined;
  Lesson: { path: any; lesson: any };
  Settings: undefined;
  Progress: undefined;
  Leaderboard: undefined;
  Friends: undefined;
  Auth: undefined;
};

type MainTabParamList = {
  Home: undefined;
  Dashboard: undefined;
  AIChat: undefined;
  Account: undefined;
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const stackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const addButtonScale = useSharedValue(1);
  const modalOpacity = useSharedValue(0);

  const openAddModal = () => {
    setAddModalVisible(true);
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
  };

  const goToUploadCourse = () => {
    setAddModalVisible(false);
    stackNavigation.navigate('UploadCourse');
  };

  const isFocused = (routeName: string) => {
    const route = state.routes[state.index];
    return route.name === routeName;
  };

  return (
    <>
      <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={styles.bottomNav}>
        {/* Accueil */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Home')}
          accessibilityRole="tab"
          accessibilityState={{ selected: isFocused('Home') }}
          accessibilityLabel="Accueil"
        >
          <View style={[
            styles.navIconContainer,
            isFocused('Home') && styles.navIconActive
          ]}>
            <Ionicons 
              name={isFocused('Home') ? "home" : "home-outline"} 
              size={22} 
              color={isFocused('Home') ? colors.textInverse : colors.textSecondary} 
            />
          </View>
          <Text style={[
            styles.navText,
            isFocused('Home') && styles.navTextActive
          ]}>
            Accueil
          </Text>
        </TouchableOpacity>

        {/* IA Chat */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('AIChat')}
          accessibilityRole="tab"
          accessibilityState={{ selected: isFocused('AIChat') }}
          accessibilityLabel="Assistant IA"
        >
          <View style={[
            styles.navIconContainer,
            isFocused('AIChat') && styles.navIconActive
          ]}>
            <Ionicons 
              name={isFocused('AIChat') ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} 
              size={22} 
              color={isFocused('AIChat') ? colors.textInverse : colors.textSecondary} 
            />
          </View>
          <Text style={[
            styles.navText,
            isFocused('AIChat') && styles.navTextActive
          ]}>
            IA Chat
          </Text>
        </TouchableOpacity>

        {/* Bouton Ajouter central */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={openAddModal}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Ajouter du contenu"
        >
          <View style={styles.addButtonContainer}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButton}
            >
              <Ionicons name="add" size={28} color={colors.textInverse} />
            </LinearGradient>
          </View>
          <Text style={styles.navText}>Ajouter</Text>
        </TouchableOpacity>

        {/* Dashboard */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Dashboard')}
          accessibilityRole="tab"
          accessibilityState={{ selected: isFocused('Dashboard') }}
          accessibilityLabel="Dashboard"
        >
          <View style={[
            styles.navIconContainer,
            isFocused('Dashboard') && styles.navIconActive
          ]}>
            <Ionicons 
              name={isFocused('Dashboard') ? "grid" : "grid-outline"} 
              size={22} 
              color={isFocused('Dashboard') ? colors.textInverse : colors.textSecondary} 
            />
          </View>
          <Text style={[
            styles.navText,
            isFocused('Dashboard') && styles.navTextActive
          ]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        {/* Compte */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Account')}
          accessibilityRole="tab"
          accessibilityState={{ selected: isFocused('Account') }}
          accessibilityLabel="Compte"
        >
          <View style={[
            styles.navIconContainer,
            isFocused('Account') && styles.navIconActive
          ]}>
            <Ionicons 
              name={isFocused('Account') ? "person" : "person-outline"} 
              size={22} 
              color={isFocused('Account') ? colors.textInverse : colors.textSecondary} 
            />
          </View>
          <Text style={[
            styles.navText,
            isFocused('Account') && styles.navTextActive
          ]}>
            Compte
          </Text>
        </TouchableOpacity>
      </BlurView>

      <Modal
        visible={addModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeAddModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          onPress={closeAddModal} 
          activeOpacity={1}
        >
          <View style={styles.addModalContent}>
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.modalBlur}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ajouter du contenu</Text>
                <TouchableOpacity
                  onPress={closeAddModal}
                  style={styles.modalClose}
                  accessibilityLabel="Fermer"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.optionButton} 
                onPress={goToUploadCourse}
              >
                <LinearGradient
                  colors={[colors.tintPrimary, colors.tintPrimary]}
                  style={styles.optionIcon}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                </LinearGradient>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Uploader un cours</Text>
                  <Text style={styles.optionDescription}>
                    Importez vos cours PDF ou documents
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>

              <View style={styles.modalFooter}>
                <Text style={styles.modalFooterText}>
                  Créez votre propre parcours d'apprentissage
                </Text>
              </View>
            </BlurView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ----------------- Main Tabs -----------------
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="AIChat" component={AIChatScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

// ----------------- Auth Stack -----------------
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

// ----------------- Main App Navigator -----------------
export function AppNavigator() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { visible: tutorialVisible, hide: hideTutorial, show: showTutorial } = useTutorial();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Vérifié une fois par session (au login), pas à chaque focus d'écran —
  // maintenant que TutorialScreen est monté ici et non plus dans HomeScreen,
  // ce composant ne re-render pas à chaque changement d'onglet.
  useEffect(() => {
    if (user) {
      isFirstTimeUser().then((firstTime) => {
        if (firstTime) showTutorial();
      });
    }
  }, [user]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color={colors.textInverse} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="AIChat" component={AIChatScreen} />
            <Stack.Screen name="UploadCourse" component={UploadCourseScreen} />
            <Stack.Screen name="Path" component={PathScreen} />
            <Stack.Screen name="Lesson" component={LessonScreen} />
            <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Progress" component={ProgressScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Friends" component={FriendsScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>

      {/* Monté ICI, en dehors de tout Tab.Screen/Stack.Screen : react-native-screens
          détache les écrans inactifs de l'arbre natif pour optimiser les perfs, ce
          qui faisait disparaître le Modal du tutoriel dès qu'on changeait d'onglet
          quand il vivait à l'intérieur de HomeScreen. À ce niveau, il ne peut
          jamais être détaché. */}
      {user && (
        <TutorialScreen
          visible={tutorialVisible}
          onComplete={hideTutorial}
          navigation={navigationRef}
        />
      )}
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bottomNav: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 8,
      height: 70,
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },

    navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    navIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
      backgroundColor: 'transparent',
    },

    navIconActive: {
      backgroundColor: colors.primary,
    },

    navText: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    navTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },

    addButtonContainer: {
      marginTop: -20,
      marginBottom: 4,
    },

    addButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },

    addModalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },

    modalBlur: {
      padding: 20,
    },

    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },

    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    modalClose: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },

    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },

    optionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },

    optionTextContainer: {
      flex: 1,
    },

    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },

    optionDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    modalFooter: {
      marginTop: 16,
      alignItems: 'center',
    },

    modalFooterText: {
      fontSize: 12,
      color: colors.muted,
    },

    loadingContainer: {
      flex: 1,
    },

    loadingGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },

    loadingText: {
      fontSize: 16,
      color: colors.textInverse,
      fontWeight: '500',
    },
  });
}