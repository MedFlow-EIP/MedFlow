import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

/** Rappel affiché tant que l'email du compte (email + mot de passe) n'est
 * pas vérifié : l'assistant IA et la génération de cours en dépendent. */
export function EmailVerificationBanner() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = auth.currentUser;
  const [verified, setVerified] = useState(!!user?.emailVerified);
  const [busy, setBusy] = useState<'send' | 'check' | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!user || verified || !user.email) return null;

  const resend = async () => {
    setBusy('send');
    try {
      await sendEmailVerification(user);
      setInfo(`Email envoyé à ${user.email}.`);
    } catch (e: any) {
      setInfo(
        e?.code === 'auth/too-many-requests'
          ? 'Email déjà envoyé, patiente quelques minutes.'
          : "L'email n'a pas pu être envoyé."
      );
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    setBusy('check');
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        // Nouveau token : le serveur doit voir email_verified=true tout de suite.
        await auth.currentUser.getIdToken(true);
        setVerified(true);
      } else {
        setInfo("Pas encore vérifié : clique sur le lien reçu par email.");
      }
    } catch {
      setInfo('Vérification impossible, réessaie.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Ionicons name="mail-unread-outline" size={22} color={colors.warningText} />
        <View style={styles.texts}>
          <Text style={styles.title}>Vérifie ton adresse email</Text>
          <Text style={styles.body}>
            {info ?? "Clique sur le lien reçu par email pour débloquer l'assistant IA et l'import de cours."}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondary} onPress={resend} disabled={!!busy} accessibilityRole="button">
          {busy === 'send' ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.secondaryText}>Renvoyer</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.primary} onPress={check} disabled={!!busy} accessibilityRole="button">
          {busy === 'check' ? <ActivityIndicator color={colors.onAction} /> : <Text style={styles.primaryText}>J'ai vérifié</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.tintWarning,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    texts: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    secondary: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    primary: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.onAction,
    },
  });
}
