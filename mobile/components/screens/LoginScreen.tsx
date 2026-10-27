import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { auth } from '../../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { AuthButton, AuthError, AuthField, AuthLayout, AuthLink, authErrorMessage } from '../auth/AuthKit';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';

export function LoginScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Renseigne ton email et ton mot de passe.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      setError(authErrorMessage(e?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Bon retour !"
      subtitle="Connecte-toi pour reprendre tes révisions."
      footer={<AuthLink text="Pas encore de compte ?" action="S’inscrire" onPress={() => navigation.navigate('Register')} />}
    >
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
        returnKeyType="next"
      />
      <AuthField
        label="Mot de passe"
        icon="lock-closed-outline"
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="Ton mot de passe"
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />

      <TouchableOpacity
        style={styles.forgot}
        onPress={() => navigation.navigate('ForgotPassword')}
        accessibilityRole="button"
        accessibilityLabel="Mot de passe oublié ?"
      >
        <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
      </TouchableOpacity>

      <AuthError message={error} />
      <AuthButton label="Se connecter" loading={loading} onPress={handleLogin} />
      <GoogleSignInButton />
    </AuthLayout>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    forgot: {
      alignSelf: 'flex-end',
      minHeight: 32,
      justifyContent: 'center',
      marginTop: -6,
    },
    forgotText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryText,
    },
  });
}
