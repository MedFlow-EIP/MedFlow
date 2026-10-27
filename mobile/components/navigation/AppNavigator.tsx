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
  Pressable,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
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
import { RevisionScreen } from '../screens/RevisionScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { MasteredScreen } from '../screens/MasteredScreen';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useTutorial } from '../../context/TutorialContext';
import { navigationRef } from '../../navigationRef';
import { isFirstTimeUser } from '../../utils/firstTime';
import { TAB_BAR_HEIGHT, useScreenInsets } from './constants';

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
  Revision: { courseId?: string; startMode?: 'scheduled' | 'practice' | 'leeches' } | undefined;
  Search: undefined;
  Mastered: undefined;
  Auth: undefined;
};

type MainTabParamList = {
  Home: undefined;
  Dashboard: undefined;
  AIChat: undefined;
  Account: undefined;
};

const TABS: {
  route: keyof MainTabParamList;
  label: string;
  a11y: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { route: 'Home', label: 'Accueil', a11y: 'Accueil', icon: 'home-outline', iconActive: 'home' },
  { route: 'AIChat', label: 'IA Chat', a11y: 'Assistant IA', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
  { route: 'Dashboard', label: 'Stats', a11y: 'Stats', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { route: 'Account', label: 'Compte', a11y: 'Compte', icon: 'person-outline', iconActive: 'person' },
];

const SHEET_DISMISS_DISTANCE = 80;

function CustomTabBar({ state, navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom, tabBarHeight } = useScreenInsets();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const stackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const sheetOffset = useRef(new RNAnimated.Value(0)).current;

  const openAddModal = () => {
    sheetOffset.setValue(0);
    setAddModalVisible(true);
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
  };

  const goToUploadCourse = () => {
    setAddModalVisible(false);
    stackNavigation.navigate('UploadCourse');
  };

  // Glisser la feuille vers le bas pour la fermer (poignée en haut).
  const sheetPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => sheetOffset.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > SHEET_DISMISS_DISTANCE || g.vy > 1.2) {
            closeAddModal();
          } else {
            RNAnimated.spring(sheetOffset, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [sheetOffset]
  );

  const isFocused = (routeName: string) => state.routes[state.index].name === routeName;

  const renderTab = (tab: (typeof TABS)[number]) => {
    const focused = isFocused(tab.route);
    return (
      <TouchableOpacity
        key={tab.route}
        style={styles.navItem}
        onPress={() => navigation.navigate(tab.route)}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.a11y}
      >
        <View style={[styles.navIndicator, focused && styles.navIndicatorActive]}>
          <Ionicons
            name={focused ? tab.iconActive : tab.icon}
            size={22}
            color={focused ? colors.onAction : colors.textSecondary}
          />
        </View>
        <Text style={[styles.navText, focused && styles.navTextActive]}>{tab.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View style={[styles.bottomNav, { height: tabBarHeight, paddingBottom: bottom }]}>
        {renderTab(TABS[0])}
        {renderTab(TABS[1])}

        {/* Bouton Ajouter central */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={openAddModal}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Ajouter du contenu"
        >
          <View style={styles.addButton}>
            <Ionicons name="add" size={28} color={colors.onAction} />
          </View>
          <Text style={styles.addText}>Ajouter</Text>
        </TouchableOpacity>

        {renderTab(TABS[2])}
        {renderTab(TABS[3])}
      </View>

      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAddModal}
      >
        <View style={styles.modalOverlay}>
          {/* Toucher n'importe où sur la zone assombrie ferme le menu */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeAddModal}
            accessibilityRole="button"
            accessibilityLabel="Fermer le menu"
          />
          <RNAnimated.View
            style={[styles.sheet, { paddingBottom: bottom + 22, transform: [{ translateY: sheetOffset }] }]}
            {...sheetPan.panHandlers}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter du contenu</Text>
              <TouchableOpacity
                onPress={closeAddModal}
                style={styles.modalClose}
                accessibilityLabel="Fermer"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={goToUploadCourse}
              accessibilityRole="button"
              accessibilityLabel="Uploader un cours"
            >
              <View style={styles.optionIcon}>
                <Ionicons name="cloud-upload-outline" size={26} color={colors.primaryDark} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Uploader un cours</Text>
                <Text style={styles.optionDescription}>
                  Importez vos cours PDF ou documents
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={styles.modalFooterText}>
              Créez votre propre parcours d’apprentissage
            </Text>
          </RNAnimated.View>
        </View>
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
          colors={[colors.action, colors.action]}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color={colors.onAction} accessibilityLabel="Chargement de l'application" />
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
            <Stack.Screen name="Revision" component={RevisionScreen} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="Mastered" component={MasteredScreen} />
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
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      paddingHorizontal: 8,
      // height / paddingBottom : calculés depuis les safe areas (useScreenInsets).
      height: TAB_BAR_HEIGHT,
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },

    navItem: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },

    navIndicator: {
      width: 56,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },

    navIndicatorActive: {
      backgroundColor: colors.action,
    },

    navText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    navTextActive: {
      color: colors.action,
      fontWeight: '600',
    },

    addButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.action,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 5,
    },

    addText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },

    // Feuille opaque plutôt que BlurView : meilleur contraste en clair comme en sombre.
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 10,
      paddingHorizontal: 20,
      gap: 18,
      alignItems: 'center',
    },

    sheetHandle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },

    modalHeader: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
    },

    optionIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    optionTextContainer: {
      flex: 1,
      gap: 3,
    },

    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    optionDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },

    modalFooterText: {
      alignSelf: 'stretch',
      textAlign: 'center',
      fontSize: 13,
      color: colors.textSecondary,
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
      color: colors.onAction,
      fontWeight: '500',
    },
  });
}