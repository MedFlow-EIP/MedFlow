import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useScreenInsets } from '../navigation/constants';

// Briques communes aux écrans Connexion / Inscription / Mot de passe oublié.

const LOGO = require('../../assets/icon.png');

/** Messages Firebase Auth traduits (y compris auth/invalid-credential des SDK récents). */
export function authErrorMessage(code?: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Adresse email invalide.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email ou mot de passe incorrect.';
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cet email.';
    case 'auth/weak-password':
      return 'Mot de passe trop faible (6 caractères minimum).';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessaie dans quelques minutes.';
    case 'auth/network-request-failed':
      return 'Pas de connexion internet.';
    case 'auth/operation-not-allowed':
      return 'Ce mode de connexion n’est pas activé.';
    default:
      return 'Une erreur est survenue. Réessaie.';
  }
}

export function AuthLayout({
  title,
  subtitle,
  onBack,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: top, paddingBottom: bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backSpacer} />
        )}

        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <Image source={LOGO} style={styles.logo} accessibilityLabel="MedFlow" />
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </Animated.View>

        <View style={styles.card}>{children}</View>

        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthField({
  label,
  icon,
  secure,
  ...inputProps
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
} & TextInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <Ionicons name={icon} size={20} color={focused ? colors.primaryDark : colors.textSecondary} />
        <TextInput
          {...inputProps}
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={secure && !visible}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setVisible((v) => !v)}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function AuthError({ message }: { message: string | null }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!message) return null;
  return (
    <Animated.View entering={FadeIn} style={styles.error} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
      <Text style={styles.errorText}>{message}</Text>
    </Animated.View>
  );
}

export function AuthButton({ label, loading, onPress }: { label: string; loading?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.buttonLoading]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!loading, busy: !!loading }}
    >
      {loading ? <ActivityIndicator color={colors.onAction} /> : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function AuthLink({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.link} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${text} ${action}`}>
      <Text style={styles.linkText}>
        {text} <Text style={styles.linkAction}>{action}</Text>
      </Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 20,
      gap: 20,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    backSpacer: {
      height: 24,
    },
    header: {
      alignItems: 'center',
      gap: 8,
    },
    logo: {
      width: 88,
      height: 88,
      borderRadius: 22,
      marginBottom: 8,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    card: {
      gap: 16,
      padding: 20,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    field: {
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingLeft: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    inputRowFocused: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      paddingVertical: 12,
      paddingRight: 14,
      fontSize: 16,
      color: colors.textPrimary,
    },
    eye: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
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
    button: {
      height: 56,
      borderRadius: 14,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonLoading: {
      opacity: 0.8,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onAction,
    },
    link: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    linkText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    linkAction: {
      fontWeight: '700',
      color: colors.primaryText,
    },
  });
}
