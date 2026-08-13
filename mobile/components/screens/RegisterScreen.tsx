import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { auth } from '../../firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

export function RegisterScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`
      });

      Alert.alert('Succès', 'Compte créé avec succès !');
    } catch (error: any) {
      let errorMessage = 'Une erreur est survenue';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Cet email est déjà utilisé';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email invalide';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Inscription non activée';
          break;
        case 'auth/weak-password':
          errorMessage = 'Mot de passe trop faible';
          break;
      }
      Alert.alert('Erreur d\'inscription', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background */}
      <LinearGradient
        colors={[colors.background, colors.surface]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View 
          entering={FadeInDown.delay(200).springify()}
          style={styles.header}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.iconContainer}
          >
            <Ionicons name="medical" size={40} color={colors.onAccent} />
          </LinearGradient>
          <Text style={styles.title} accessibilityRole="header">Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez notre plateforme médicale</Text>
        </Animated.View>

        {/* Formulaire */}
        <Animated.View 
          entering={FadeInUp.delay(400).springify()}
          style={styles.form}
        >
          {/* Prénom */}
          <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Prénom" 
              placeholderTextColor={colors.muted}
              value={firstName} 
              onChangeText={setFirstName} 
              autoCapitalize="words"
            />
          </BlurView>

          {/* Nom */}
          <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Nom" 
              placeholderTextColor={colors.muted}
              value={lastName} 
              onChangeText={setLastName} 
              autoCapitalize="words"
            />
          </BlurView>

          {/* Email */}
          <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Email" 
              placeholderTextColor={colors.muted}
              value={email} 
              onChangeText={setEmail} 
              autoCapitalize="none" 
              keyboardType="email-address"
            />
          </BlurView>

          {/* Mot de passe */}
          <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Mot de passe" 
              placeholderTextColor={colors.muted}
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color={colors.muted} 
              />
            </TouchableOpacity>
          </BlurView>

          {/* Confirmation mot de passe */}
          <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Confirmer le mot de passe" 
              placeholderTextColor={colors.muted}
              value={confirmPassword} 
              onChangeText={setConfirmPassword} 
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              accessibilityRole="button"
              accessibilityLabel={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              <Ionicons 
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color={colors.muted} 
              />
            </TouchableOpacity>
          </BlurView>

          {/* Bouton d'inscription */}
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleRegister} 
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={loading ? 'Inscription en cours' : "S'inscrire"}
            accessibilityState={{ disabled: loading }}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              {loading ? (
                <Text style={styles.buttonText}>Inscription...</Text>
              ) : (
                <>
                  <Text style={styles.buttonText}>S'inscrire</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.onAccent} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Lien vers connexion */}
          <TouchableOpacity 
            style={styles.linkButton} 
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            accessibilityLabel="Déjà un compte ? Se connecter"
          >
            <Text style={styles.linkText}>
              Déjà un compte ? <Text style={styles.linkTextBold}>Se connecter</Text>
            </Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>
            En créant un compte, vous acceptez nos{' '}
            <Text style={styles.termsLink}>conditions d'utilisation</Text> et notre{' '}
            <Text style={styles.termsLink}>politique de confidentialité</Text>
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors, isDarkBg: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    form: {
      gap: 16,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isDarkBg ? 'rgba(28,31,41,0.7)' : 'rgba(255,255,255,0.7)',
      borderWidth: 1,
      borderColor: isDarkBg ? 'rgba(50,54,71,0.6)' : 'rgba(229,231,235,0.5)',
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      height: 52,
      fontSize: 15,
      color: colors.textPrimary,
    },
    button: {
      marginTop: 8,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonGradient: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: colors.onAccent,
      fontSize: 16,
      fontWeight: '600',
    },
    linkButton: {
      alignItems: 'center',
      marginTop: 16,
    },
    linkText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    linkTextBold: {
      color: colors.primary,
      fontWeight: '600',
    },
    termsText: {
      textAlign: 'center',
      fontSize: 12,
      color: colors.muted,
      marginTop: 24,
      lineHeight: 18,
    },
    termsLink: {
      color: colors.primary,
      fontWeight: '500',
    },
  });
}