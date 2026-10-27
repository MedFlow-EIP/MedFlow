import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { auth } from '../../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { AuthButton, AuthError, AuthField, AuthLayout, AuthLink, authErrorMessage } from '../auth/AuthKit';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';

export function RegisterScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Remplis tous les champs.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Le nom est connu du backend dès la première requête (classement, recherche d'amis).
      await updateProfile(user, { displayName: `${firstName.trim()} ${lastName.trim()}` });
      // L'IA est réservée aux emails vérifiés : le lien part tout de suite.
      sendEmailVerification(user).catch(() => {
        // Non bloquant : le bandeau de l'accueil permet de le renvoyer.
      });
    } catch (e: any) {
      setError(authErrorMessage(e?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Crée ton compte"
      subtitle="Importe tes cours et révise avec des flashcards et des quiz générés par l’IA."
      onBack={() => navigation.goBack()}
      footer={<AuthLink text="Déjà un compte ?" action="Se connecter" onPress={() => navigation.navigate('Login')} />}
    >
      <View style={styles.row}>
        <View style={styles.half}>
          <AuthField
            label="Prénom"
            icon="person-outline"
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
            textContentType="givenName"
          />
        </View>
        <View style={styles.half}>
          <AuthField
            label="Nom"
            icon="person-outline"
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
            textContentType="familyName"
          />
        </View>
      </View>
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
      />
      <AuthField
        label="Mot de passe"
        icon="lock-closed-outline"
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="6 caractères minimum"
        autoComplete="password-new"
        textContentType="newPassword"
      />
      <AuthField
        label="Confirmer le mot de passe"
        icon="lock-closed-outline"
        secure
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        autoComplete="password-new"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleRegister}
      />

      <AuthError message={error} />
      <AuthButton label="Créer mon compte" loading={loading} onPress={handleRegister} />
      <GoogleSignInButton />
    </AuthLayout>
  );
}

function makeStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    half: {
      flex: 1,
    },
  });
}
