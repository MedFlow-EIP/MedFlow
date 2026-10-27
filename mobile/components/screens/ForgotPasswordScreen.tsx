import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { AuthButton, AuthError, AuthField, AuthLayout, AuthLink, authErrorMessage } from '../auth/AuthKit';

export function ForgotPasswordScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError('Renseigne l’email de ton compte.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (e: any) {
      // Pas de distinction « compte inexistant » : on ne révèle pas quels emails ont un compte.
      if (e?.code === 'auth/user-not-found') setSent(true);
      else setError(authErrorMessage(e?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Entre l’email de ton compte : on t’envoie un lien pour en choisir un nouveau."
      onBack={() => navigation.goBack()}
      footer={<AuthLink text="Tu t’en souviens ?" action="Se connecter" onPress={() => navigation.navigate('Login')} />}
    >
      {sent ? (
        <View style={styles.sent} accessibilityLiveRegion="polite">
          <View style={styles.sentIcon}>
            <Ionicons name="mail-open-outline" size={28} color={colors.success} />
          </View>
          <Text style={styles.sentTitle}>Vérifie ta boîte mail</Text>
          <Text style={styles.sentText}>
            Si un compte existe pour {email.trim()}, un lien de réinitialisation vient d’y être envoyé. Pense à regarder
            dans les spams.
          </Text>
          <AuthButton label="Retour à la connexion" onPress={() => navigation.navigate('Login')} />
        </View>
      ) : (
        <>
          <AuthField
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="prenom.nom@email.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={handleResetPassword}
          />
          <AuthError message={error} />
          <AuthButton label="Envoyer le lien" loading={loading} onPress={handleResetPassword} />
        </>
      )}
    </AuthLayout>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sent: {
      alignItems: 'center',
      gap: 10,
    },
    sentIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.tintSuccess,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sentTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sentText: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
  });
}
