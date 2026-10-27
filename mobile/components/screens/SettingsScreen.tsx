import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  updateProfile,
  updatePassword,
  signOut,
} from "firebase/auth";
import { auth } from "../../firebaseConfig";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";
import { resetTutorial } from "../../utils/firstTime";
import {
  isStreakReminderEnabled,
  enableStreakReminders,
  disableStreakReminders,
  sendTestNotification,
} from "../../utils/streakNotifications";
import {
  isRevisionReminderEnabled,
  enableRevisionReminders,
  disableRevisionReminders,
  sendTestRevisionNotification,
  getRevisionReminderHour,
  setRevisionReminderHour,
  scheduleRevisionReminder,
} from "../../utils/revisionNotifications";
import { getAuthHeaders } from "../../utils/authHeaders";
import { API_URL } from "@/services/api";
import { useTutorial } from "../../context/TutorialContext";
import { navigationRef } from "../../navigationRef";
import { appAlert } from '../../utils/appAlert';
import { useScreenInsets } from '../navigation/constants';

export function SettingsScreen() {
  const navigation = useNavigation();
  const user = auth.currentUser;
  const { colors, preference, setPreference } = useTheme();
  const { show: showTutorial } = useTutorial();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();

  const [fullName, setFullName] = useState(user?.displayName || "");
  const [photo, setPhoto] = useState<string | null>(user?.photoURL || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [streakRemindersOn, setStreakRemindersOn] = useState(false);
  const [revisionRemindersOn, setRevisionRemindersOn] = useState(false);
  const [reminderHour, setReminderHour] = useState(9);

  useEffect(() => {
    isStreakReminderEnabled().then(setStreakRemindersOn);
    isRevisionReminderEnabled().then(setRevisionRemindersOn);
    getRevisionReminderHour().then(setReminderHour);
  }, []);

  const handleToggleStreakReminders = async (value: boolean) => {
    if (value) {
      const user = auth.currentUser;
      let lastActivity: string | null = null;
      if (user) {
        try {
          const res = await fetch(`${API_URL}/api/account`, {
            headers: await getAuthHeaders(user),
          });
          const data = await res.json();
          lastActivity = data?.stats?.lastActivity ?? null;
        } catch {
          // Pas grave si ça échoue : on planifie quand même, juste sans
          // savoir si l'utilisateur a déjà été actif aujourd'hui.
        }
      }
      const granted = await enableStreakReminders(lastActivity);
      if (!granted) {
        appAlert(
          "Permission refusée",
          "Active les notifications pour MedFlow dans les réglages de ton téléphone pour utiliser cette fonctionnalité."
        );
        return;
      }
      setStreakRemindersOn(true);
    } else {
      await disableStreakReminders();
      setStreakRemindersOn(false);
    }
  };

  const handleToggleRevisionReminders = async (value: boolean) => {
    if (value) {
      const user = auth.currentUser;
      let dueToday = 0;
      if (user) {
        try {
          const res = await fetch(`${API_URL}/api/revision/forecast?days=1`, {
            headers: await getAuthHeaders(user),
          });
          const data = await res.json();
          dueToday = data?.forecast?.[0]?.count ?? 0;
        } catch {
          // Pas grave si ça échoue : on active quand même, le rappel se
          // mettra à jour dès le prochain chargement du forecast.
        }
      }
      const granted = await enableRevisionReminders(dueToday);
      if (!granted) {
        appAlert(
          "Permission refusée",
          "Active les notifications pour MedFlow dans les réglages de ton téléphone pour utiliser cette fonctionnalité."
        );
        return;
      }
      setRevisionRemindersOn(true);
    } else {
      await disableRevisionReminders();
      setRevisionRemindersOn(false);
    }
  };

  const handleSelectReminderHour = async (hour: number) => {
    await setRevisionReminderHour(hour);
    setReminderHour(hour);
    // Si un rappel est déjà programmé, le remettre à jour tout de suite
    // avec la nouvelle heure plutôt que d'attendre le prochain chargement
    // du forecast (Dashboard/écran Révision).
    if (revisionRemindersOn) {
      const user = auth.currentUser;
      if (user) {
        try {
          const res = await fetch(`${API_URL}/api/revision/forecast?days=1`, {
            headers: await getAuthHeaders(user),
          });
          const data = await res.json();
          const dueToday = data?.forecast?.[0]?.count ?? 0;
          await scheduleRevisionReminder(dueToday);
        } catch {
          // Pas grave si ça échoue : se remettra à jour au prochain chargement.
        }
      }
    }
  };

  const handleTestNotification = async () => {
    const sent = await sendTestNotification();
    if (sent) {
      appAlert("C'est parti", "Tu devrais recevoir une notification dans 5 secondes.");
    } else {
      appAlert(
        "Permission refusée",
        "Active les notifications pour MedFlow dans les réglages de ton téléphone."
      );
    }
  };

  const handleTestRevisionNotification = async () => {
    const sent = await sendTestRevisionNotification();
    if (sent) {
      appAlert("C'est parti", "Tu devrais recevoir une notification de révision dans 5 secondes.");
    } else {
      appAlert(
        "Permission refusée",
        "Active les notifications pour MedFlow dans les réglages de ton téléphone."
      );
    }
  };

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(false);

  // ---------------- PASSWORD RULES ----------------
  const rules = useMemo(
    () => [
      { label: "8 caractères minimum", test: (v: string) => v.length >= 8 },
      { label: "1 majuscule", test: (v: string) => /[A-Z]/.test(v) },
      { label: "1 minuscule", test: (v: string) => /[a-z]/.test(v) },
      { label: "1 chiffre", test: (v: string) => /\d/.test(v) },
      {
        label: "1 caractère spécial",
        test: (v: string) => /[!@#$%^&*(),.?":{}|<>]/.test(v),
      },
    ],
    []
  );

  const isPasswordValid = rules.every((r) => r.test(newPassword));
  const passwordsMatch =
    newPassword &&
    confirmPassword &&
    newPassword === confirmPassword;

  // ---------------- IMAGE PICKER ----------------
  const pickImage = async () => {
    if (!user) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    // Aperçu instantané avec l'URI locale, le temps que l'upload se termine.
    setPhoto(asset.uri);

    try {
      setUploadingPhoto(true);

      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType =
        ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: `avatar.${ext}`,
        type: mimeType,
      } as any);

      const response = await fetch(`${API_URL}/api/account/avatar`, {
        method: 'POST',
        headers: await getAuthHeaders(user),
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erreur serveur (${response.status})`);
      }

      // Remplace l'aperçu local par la vraie URL du backend — c'est celle-là
      // qui sera persistée sur le profil Firebase (photoURL).
      setPhoto(data.avatarUrl);
    } catch (e: any) {
      appAlert("Erreur", "Impossible d'uploader la photo : " + e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ---------------- UPDATE PROFILE ----------------
  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);

      await updateProfile(user, {
        displayName: fullName,
        photoURL: photo,
      });

      appAlert("Succès", "Profil mis à jour");
    } catch (e: any) {
      appAlert("Erreur", e.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UPDATE PASSWORD ----------------
  const handleUpdatePassword = async () => {
    if (!user) return;

    if (!isPasswordValid) {
      appAlert("Erreur", "Mot de passe non valide");
      return;
    }

    if (!passwordsMatch) {
      appAlert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }

    try {
      setLoading(true);

      await updatePassword(user, newPassword);

      setNewPassword("");
      setConfirmPassword("");

      appAlert("Succès", "Mot de passe mis à jour");
    } catch (e: any) {
      appAlert("Erreur", e.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- LOGOUT ----------------
  const handleReplayTutorial = async () => {
    await resetTutorial();
    if (navigationRef.isReady()) {
      navigationRef.navigate('MainTabs', { screen: 'Home' });
    }
    showTutorial();
  };

  const handleResetProgress = () => {
    appAlert(
      "Réinitialiser la progression",
      "XP, streak, leçons, badges et activité seront remis à zéro. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réinitialiser",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            try {
              const res = await fetch(`${API_URL}/api/account/reset-progress`, {
                method: "POST",
                headers: await getAuthHeaders(user),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              appAlert("C'est fait", "Ta progression a été réinitialisée.");
            } catch (e: any) {
              appAlert("Erreur", "Impossible de réinitialiser : " + e.message);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e: any) {
      appAlert("Erreur", e.message);
    }
  };

  const passwordRules = [
    { label: "8 caractères", ok: newPassword.length >= 8 },
    { label: "1 majuscule", ok: /[A-Z]/.test(newPassword) },
    { label: "1 minuscule", ok: /[a-z]/.test(newPassword) },
    { label: "1 chiffre", ok: /\d/.test(newPassword) },
    { label: "1 caractère spécial", ok: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) },
  ];

  const renderRow = ({
    icon,
    tint,
    iconColor,
    title,
    subtitle,
    onPress,
    right,
    danger,
    first,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    tint: string;
    iconColor: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    right?: React.ReactNode;
    danger?: boolean;
    first?: boolean;
  }) => {
    const content = (
      <>
        <View style={[styles.rowIcon, { backgroundColor: tint }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, danger && { color: colors.dangerText }]}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
        {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} /> : null)}
      </>
    );
    return onPress ? (
      <TouchableOpacity
        style={[styles.row, !first && styles.rowDivider]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {content}
      </TouchableOpacity>
    ) : (
      <View style={[styles.row, !first && styles.rowDivider]}>{content}</View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Réglages</Text>
      </View>

      {/* PROFIL */}
      <View style={styles.card}>
        <View style={styles.profileTop}>
          <View style={styles.avatarWrapper}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatar} accessibilityLabel="Photo de profil actuelle" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={pickImage}
              disabled={uploadingPhoto}
              style={styles.editAvatarButton}
              accessibilityRole="button"
              accessibilityLabel="Changer la photo de profil"
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.onAction} accessibilityLabel="Envoi de la photo en cours" />
              ) : (
                <Ionicons name="camera" size={16} color={colors.onAction} />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>{user?.displayName || "Utilisateur"}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Nom</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            accessibilityLabel="Nom"
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={styles.inputDisabledText} numberOfLines={1} accessibilityLabel="Email (non modifiable)">
              {user?.email || ""}
            </Text>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
          </View>
        </View>

        <TouchableOpacity onPress={handleSaveProfile} style={styles.primaryButton} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Sauvegarder</Text>
        </TouchableOpacity>
      </View>

      {/* APPARENCE */}
      <Text style={styles.sectionLabel}>Apparence</Text>
      <View style={styles.appearanceToggle} accessibilityRole="radiogroup">
        {(
          [
            { key: 'system', label: 'Système', icon: 'phone-portrait-outline' },
            { key: 'light', label: 'Clair', icon: 'sunny-outline' },
            { key: 'dark', label: 'Sombre', icon: 'moon-outline' },
          ] as const
        ).map((option) => {
          const active = preference === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setPreference(option.key)}
              style={[styles.appearanceOption, active && styles.appearanceOptionActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Ionicons name={option.icon} size={16} color={active ? colors.primaryText : colors.textSecondary} />
              <Text style={[styles.appearanceText, active && styles.appearanceTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* NOTIFICATIONS */}
      <Text style={styles.sectionLabel}>Notifications</Text>
      <View style={styles.listCard}>
        {renderRow({
          first: true,
          icon: 'flame-outline',
          tint: colors.tintWarning,
          iconColor: colors.warning,
          title: 'Rappels de streak',
          subtitle: "Un rappel le soir si tu n'as pas encore révisé",
          right: (
            <Switch
              value={streakRemindersOn}
              onValueChange={handleToggleStreakReminders}
              trackColor={{ false: colors.border, true: colors.action }}
              thumbColor="#ffffff"
              accessibilityLabel="Rappels de série"
              accessibilityRole="switch"
              accessibilityState={{ checked: streakRemindersOn }}
            />
          ),
        })}
        {renderRow({
          icon: 'school-outline',
          tint: colors.tintPrimary,
          iconColor: colors.primaryDark,
          title: 'Rappels de révision',
          subtitle: `Un rappel à ${reminderHour}h avec le nombre de cartes à réviser`,
          right: (
            <Switch
              value={revisionRemindersOn}
              onValueChange={handleToggleRevisionReminders}
              trackColor={{ false: colors.border, true: colors.action }}
              thumbColor="#ffffff"
              accessibilityLabel="Rappels de révision"
              accessibilityRole="switch"
              accessibilityState={{ checked: revisionRemindersOn }}
            />
          ),
        })}
        {revisionRemindersOn && (
          <View style={styles.hourPickerRow}>
            {[7, 9, 12, 18, 21].map((hour) => (
              <TouchableOpacity
                key={hour}
                onPress={() => handleSelectReminderHour(hour)}
                style={[styles.hourChip, reminderHour === hour && styles.hourChipActive]}
                accessibilityRole="button"
                accessibilityLabel={`Rappel à ${hour} heures`}
                accessibilityState={{ selected: reminderHour === hour }}
              >
                <Text style={[styles.hourChipText, reminderHour === hour && styles.hourChipTextActive]}>
                  {hour}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* SÉCURITÉ */}
      <Text style={styles.sectionLabel}>Sécurité</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Changer de mot de passe</Text>
        <TextInput
          placeholder="Nouveau mot de passe"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Nouveau mot de passe"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
        />
        <TextInput
          placeholder="Confirmer le mot de passe"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Confirmer le nouveau mot de passe"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
        />

        <View style={styles.rules}>
          {passwordRules.map((r) => (
            <View key={r.label} style={[styles.ruleChip, { backgroundColor: r.ok ? colors.tintSuccess : colors.surfaceAlt }]}>
              <Ionicons
                name={r.ok ? "checkmark-circle" : "ellipse-outline"}
                size={14}
                color={r.ok ? colors.successText : colors.textSecondary}
              />
              <Text style={[styles.ruleText, { color: r.ok ? colors.successText : colors.textSecondary }]}>{r.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleUpdatePassword}
          style={[styles.primaryButton, !(isPasswordValid && passwordsMatch) && styles.buttonDisabled]}
          disabled={!isPasswordValid || !passwordsMatch}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isPasswordValid || !passwordsMatch }}
        >
          <Text style={styles.primaryButtonText}>Mettre à jour le mot de passe</Text>
        </TouchableOpacity>
      </View>

      {/* AIDE */}
      <Text style={styles.sectionLabel}>Aide</Text>
      <View style={styles.listCard}>
        {renderRow({
          first: true,
          icon: 'play-circle-outline',
          tint: colors.tintPrimary,
          iconColor: colors.primaryDark,
          title: 'Revoir le tutoriel',
          onPress: handleReplayTutorial,
        })}
      </View>

      {/* AVANCÉ */}
      <Text style={styles.sectionLabel}>Avancé</Text>
      <View style={styles.listCard}>
        {renderRow({
          first: true,
          icon: 'notifications-outline',
          tint: colors.tintPrimary,
          iconColor: colors.primaryDark,
          title: 'Tester une notification (5s)',
          onPress: handleTestNotification,
        })}
        {renderRow({
          icon: 'school-outline',
          tint: colors.tintWarning,
          iconColor: colors.warning,
          title: 'Tester une notification de révision (5s)',
          onPress: handleTestRevisionNotification,
        })}
        {renderRow({
          icon: 'refresh-circle-outline',
          tint: colors.tintDanger,
          iconColor: colors.danger,
          title: 'Réinitialiser XP / progression',
          subtitle: 'XP, série, leçons et badges remis à zéro',
          onPress: handleResetProgress,
          danger: true,
        })}
      </View>

      {/* DÉCONNEXION */}
      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} accessibilityRole="button">
        <Ionicons name="log-out-outline" size={20} color={colors.dangerText} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      gap: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 12,
      marginLeft: 4,
    },
    card: {
      gap: 14,
      padding: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    listCard: {
      paddingHorizontal: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 64,
      paddingVertical: 12,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    rowSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    profileTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    avatarWrapper: {
      width: 72,
      height: 72,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    avatarPlaceholder: {
      backgroundColor: colors.warning,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 28,
      fontWeight: "700",
      color: "#ffffff",
    },
    editAvatarButton: {
      position: "absolute",
      right: -4,
      bottom: -4,
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 3,
      borderColor: colors.surface,
      backgroundColor: colors.action,
      alignItems: "center",
      justifyContent: "center",
    },
    profileText: {
      flex: 1,
      gap: 2,
    },
    profileName: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    profileEmail: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    field: {
      gap: 6,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    input: {
      minHeight: 50,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      fontSize: 16,
      color: colors.textPrimary,
    },
    inputDisabled: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.surfaceAlt,
    },
    inputDisabledText: {
      flex: 1,
      fontSize: 16,
      color: colors.textSecondary,
    },
    primaryButton: {
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.action,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.onAction,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    rules: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    ruleChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    ruleText: {
      fontSize: 12,
      fontWeight: "600",
    },
    appearanceToggle: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
    },
    appearanceOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 44,
      borderRadius: 11,
    },
    appearanceOptionActive: {
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    appearanceText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    appearanceTextActive: {
      fontWeight: '600',
      color: colors.primaryText,
    },
    hourPickerRow: {
      flexDirection: "row",
      gap: 8,
      paddingBottom: 14,
      marginTop: -2,
    },
    hourChip: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    hourChipActive: {
      backgroundColor: colors.action,
    },
    hourChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    hourChipTextActive: {
      color: colors.onAction,
    },
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 52,
      marginTop: 16,
      borderRadius: 14,
      backgroundColor: colors.tintDanger,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.dangerText,
    },
  });
}
