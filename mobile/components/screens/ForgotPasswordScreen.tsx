import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { auth } from '../../firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

export function ForgotPasswordScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Erreur', 'Veuillez entrer votre email');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      Alert.alert('Succès', 'Un email de réinitialisation a été envoyé');
    } catch (error: any) {
      let errorMessage = 'Une erreur est survenue';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Email invalide';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Aucun compte trouvé avec cet email';
          break;
      }
      
      Alert.alert('Erreur', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Retour"
        accessibilityRole="button"
      >
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Ionicons name="lock-open-outline" size={80} color={colors.primary} />
        <Text style={styles.title}>Mot de passe oublié</Text>
        <Text style={styles.subtitle}>
          Entrez votre email pour recevoir un lien de réinitialisation
        </Text>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={24} color={colors.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Votre email"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Votre email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!sent}
            />
          </View>

          {sent ? (
            <>
              <Text style={styles.successText}>
                ✅ Email envoyé ! Vérifiez votre boîte de réception.
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.buttonText}>Retour à la connexion</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Envoi...' : 'Envoyer le lien'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.linkText}>
              <Text style={styles.linkTextBold}>Retour à la connexion</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    backButton: {
      marginTop: 40,
      marginBottom: 20,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginTop: 20,
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 40,
      paddingHorizontal: 20,
    },
    form: {
      width: '100%',
      gap: 16,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      height: 56,
      fontSize: 16,
      color: colors.textPrimary,
    },
    button: {
      backgroundColor: colors.primary,
      height: 56,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.onAccent,
      fontSize: 16,
      fontWeight: '600',
    },
    successText: {
      color: colors.success,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 20,
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
  });
}