import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { googleSignInAvailable, useGoogleIdToken } from '../../utils/googleAuth';
import { AuthError, authErrorMessage } from './AuthKit';

/** « Continuer avec Google » + séparateur « ou ». Rien n'est affiché si
 * la connexion Google n'est pas disponible (iOS, Expo Go, non configurée). */
export function GoogleSignInButton() {
  if (!googleSignInAvailable) return null;
  return <GoogleSignInButtonInner />;
}

function GoogleSignInButtonInner() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = useGoogleIdToken(async (result) => {
    if (!('idToken' in result)) {
      setLoading(false);
      if ('error' in result) setError(result.error);
      return;
    }
    try {
      // La navigation bascule d'elle-même via onAuthStateChanged.
      await signInWithCredential(auth, GoogleAuthProvider.credential(result.idToken));
    } catch (e: any) {
      setError(
        e?.code === 'auth/account-exists-with-different-credential'
          ? 'Un compte existe déjà avec cet email : connecte-toi avec ton mot de passe.'
          : authErrorMessage(e?.code)
      );
      setLoading(false);
    }
  });

  const onPress = () => {
    setError(null);
    setLoading(true);
    google.start().catch(() => {
      setLoading(false);
      setError('Connexion Google impossible.');
    });
  };

  return (
    <>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.line} />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        disabled={!google.ready || loading}
        accessibilityRole="button"
        accessibilityLabel="Continuer avec Google"
        accessibilityState={{ disabled: !google.ready || loading, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
            <Text style={styles.buttonText}>Continuer avec Google</Text>
          </>
        )}
      </TouchableOpacity>
      <AuthError message={error} />
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    button: {
      height: 56,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
}
