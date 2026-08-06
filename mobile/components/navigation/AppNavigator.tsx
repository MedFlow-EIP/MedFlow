import React, { useEffect, useState, useRef } from 'react';
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

const { width, height } = Dimensions.get('window');
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

export type RootStackParamList = {
  MainTabs: undefined;
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
  Auth: undefined;
};

type MainTabParamList = {
  Home: undefined;
  Dashboard: undefined;
  AIChat: undefined;
  Account: undefined;
};

function CustomTabBar({ state, descriptors, navigation }: any) {
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
      <BlurView intensity={90} tint="light" style={styles.bottomNav}>
        {/* Accueil */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Home')}
        >
          <View style={[
            styles.navIconContainer,
            isFocused('Home') && styles.navIconActive
          ]}>
            <Ionicons 
              name={isFocused('Home') ? "home" : "home-outline"} 
              size={22} 
              color={isFocused('Home') ? "#ffffff" : "#6b7280"} 
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
        >
          <View style={[
            styles.navIconContainer,
            isFocused('AIChat') && styles.navIconActive
          ]}>
            <Ionicons 
              name={isFocused('AIChat') ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} 
              size={22} 
              color={isFocused('AIChat') ? "#ffffff" : "#6b7280"} 
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
        >
          <View style={styles.addButtonContainer}>
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButton}
            >
              <Ionicons name="add" size={28} color="#ffffff" />
            </LinearGradient>
          </View>
          <Text style={styles.navText}>Ajouter</Text>
        </TouchableOpacity>

        {/* Dashboard */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <View style={[
            styles.navIconContainer,
            isFocused('Dashboard') && styles.navIconActive
          ]}>
            <Ionicons 
              name={isFocused('Dashboard') ? "grid" : "grid-outline"} 
              size={22} 
              color={isFocused('Dashboard') ? "#ffffff" : "#6b7280"} 
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
        >
          <View style={[
            styles.navIconContainer,
            isFocused('Account') && styles.navIconActive
          ]}>
            <Ionicons 
              name={isFocused('Account') ? "person" : "person-outline"} 
              size={22} 
              color={isFocused('Account') ? "#ffffff" : "#6b7280"} 
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
            <BlurView intensity={80} tint="light" style={styles.modalBlur}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ajouter du contenu</Text>
                <TouchableOpacity onPress={closeAddModal} style={styles.modalClose}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.optionButton} 
                onPress={goToUploadCourse}
              >
                <LinearGradient
                  colors={['#dbeafe', '#eff6ff']}
                  style={styles.optionIcon}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color="#3b82f6" />
                </LinearGradient>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Uploader un cours</Text>
                  <Text style={styles.optionDescription}>
                    Importez vos cours PDF ou documents
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#3b82f6', '#2563eb']}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
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
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(229,231,235,0.5)',
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
    backgroundColor: '#3b82f6',
  },

  navText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },

  navTextActive: {
    color: '#3b82f6',
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
    shadowColor: '#3b82f6',
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
    color: '#111827',
  },

  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
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
    color: '#111827',
    marginBottom: 4,
  },

  optionDescription: {
    fontSize: 13,
    color: '#6b7280',
  },

  modalFooter: {
    marginTop: 16,
    alignItems: 'center',
  },

  modalFooterText: {
    fontSize: 12,
    color: '#9ca3af',
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
    color: '#ffffff',
    fontWeight: '500',
  },
});