import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { API_URL } from '@/services/api';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { getAuthHeaders } from '../../utils/authHeaders';
import { googleSignInAvailable, useGoogleIdToken } from '../../utils/googleAuth';
import { useScreenInsets } from '../navigation/constants';

const LOST = [
  'Tes cours importés et leur contenu',
  'Ta progression, ton XP, tes badges et ta série',
  'Tes amis et tes conversations avec l’assistant',
];

/** Efface les données gardées sur le téléphone pour ce compte. */
async function clearLocalData(uid: string) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.includes(uid)));
  } catch {
    // Non bloquant : le compte est déjà supprimé côté serveur.
  }
}

/**
 * Suppression définitive du compte. Demande de se reconnecter (mot de passe
 * ou Google) : le serveur refuse si la dernière connexion date de plus de 5 min.
 */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useScreenInsets();
  const user = auth.currentUser;
  const usesPassword = !!user?.providerData?.some((p) => p.providerId === 'password');
  const usesGoogle = !!user?.providerData?.some((p) => p.providerId === 'google.com');

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setPassword('');
    setError(null);
    onClose();
  };

  const deleteWith = async (credential: AuthCredential) => {
    if (!user) return;
    try {
      await reauthenticateWithCredential(user, credential);
      // Token neuf : il porte la date de connexion que le serveur vérifie.
      await user.getIdToken(true);
      const res = await fetch(`${API_URL}/api/account`, {
        method: 'DELETE',
        headers: await getAuthHeaders(user),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Suppression impossible, réessaie.');
      }
      const uid = user.uid;
      await clearLocalData(uid);
      // Le compte n'existe plus : la navigation repart sur l'écran de connexion.
      await signOut(auth).catch(() => {});
    } catch (e: any) {
      setBusy(false);
      if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        setError('Mot de passe incorrect.');
      } else if (e?.code === 'auth/too-many-requests') {
        setError('Trop de tentatives. Réessaie dans quelques minutes.');
      } else if (e?.code === 'auth/network-request-failed') {
        setError('Pas de connexion internet.');
      } else {
        setError(e?.message && !e?.code ? e.message : 'Suppression impossible, réessaie.');
      }
    }
  };

  const google = useGoogleIdToken((result) => {
    if ('idToken' in result) {
      deleteWith(GoogleAuthProvider.credential(result.idToken));
    } else {
      setBusy(false);
      if ('error' in result) setError(result.error);
    }
  });

  const confirmWithPassword = () => {
    if (!user?.email || !password) {
      setError('Entre ton mot de passe pour confirmer.');
      return;
    }
    setError(null);
    setBusy(true);
    deleteWith(EmailAuthProvider.credential(user.email, password));
  };

  const confirmWithGoogle = () => {
    setError(null);
    setBusy(true);
    google.start().catch(() => {
      setBusy(false);
      setError('Connexion Google impossible.');
    });
  };

  const canUseGoogle = !usesPassword && usesGoogle && googleSignInAvailable;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={close} accessibilityLabel="Fermer">
          <Pressable style={[styles.sheet, { paddingBottom: bottom + 16 }]} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.iconCircle}>
              <Ionicons name="warning-outline" size={28} color={colors.dangerText} />
            </View>
            <Text style={styles.title} accessibilityRole="header">Supprimer mon compte</Text>
            <Text style={styles.subtitle}>Cette action est définitive. Tu perdras :</Text>

            <View style={styles.list}>
              {LOST.map((item) => (
                <View key={item} style={styles.listItem}>
                  <Ionicons name="close-circle" size={18} color={colors.dangerText} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>

            {usesPassword && (
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Ton mot de passe"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Mot de passe pour confirmer"
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                style={styles.input}
                editable={!busy}
                onSubmitEditing={confirmWithPassword}
              />
            )}

            {!usesPassword && !canUseGoogle && (
              <Text style={styles.hint}>
                Reconnecte-toi avec Google depuis l’application installée (APK) pour confirmer.
              </Text>
            )}

            {!!error && (
              <View style={styles.error} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.deleteButton, (busy || (!usesPassword && !canUseGoogle)) && styles.disabled]}
              onPress={usesPassword ? confirmWithPassword : confirmWithGoogle}
              disabled={busy || (!usesPassword && !canUseGoogle)}
              accessibilityRole="button"
              accessibilityState={{ busy, disabled: busy }}
            >
              {busy ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.deleteText}>
                  {usesPassword ? 'Supprimer définitivement' : 'Confirmer avec Google'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={close} disabled={busy} accessibilityRole="button">
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 10,
      paddingHorizontal: 20,
      gap: 14,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    iconCircle: {
      alignSelf: 'center',
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.tintDanger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    list: {
      gap: 8,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    listText: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
    },
    input: {
      minHeight: 52,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      fontSize: 16,
      color: colors.textPrimary,
    },
    hint: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    error: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.tintDanger,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.dangerText,
    },
    deleteButton: {
      height: 54,
      borderRadius: 14,
      backgroundColor: colors.dangerText,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: {
      opacity: 0.6,
    },
    deleteText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.surface,
    },
    cancelButton: {
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
}
