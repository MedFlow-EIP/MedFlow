import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Switch,
  Alert,
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
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/colors";
import { resetTutorial } from "../../utils/firstTime";
import {
  isStreakReminderEnabled,
  enableStreakReminders,
  disableStreakReminders,
  sendTestNotification,
} from "../../utils/streakNotifications";
import { getAuthHeaders } from "../../utils/authHeaders";
import { API_URL } from "@/services/api";
import { useTutorial } from "../../context/TutorialContext";
import { navigationRef } from "../../navigationRef";

export function SettingsScreen() {
  const navigation = useNavigation();
  const user = auth.currentUser;
  const { colors, preference, setPreference } = useTheme();
  const { show: showTutorial } = useTutorial();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [fullName, setFullName] = useState(user?.displayName || "");
  const [photo, setPhoto] = useState<string | null>(user?.photoURL || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [streakRemindersOn, setStreakRemindersOn] = useState(false);

  useEffect(() => {
    isStreakReminderEnabled().then(setStreakRemindersOn);
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
        Alert.alert(
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

  const handleTestNotification = async () => {
    const sent = await sendTestNotification();
    if (sent) {
      Alert.alert("C'est parti", "Tu devrais recevoir une notification dans 5 secondes.");
    } else {
      Alert.alert(
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
      Alert.alert("Erreur", "Impossible d'uploader la photo : " + e.message);
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

      Alert.alert("Succès", "Profil mis à jour");
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UPDATE PASSWORD ----------------
  const handleUpdatePassword = async () => {
    if (!user) return;

    if (!isPasswordValid) {
      Alert.alert("Erreur", "Mot de passe non valide");
      return;
    }

    if (!passwordsMatch) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }

    try {
      setLoading(true);

      await updatePassword(user, newPassword);

      setNewPassword("");
      setConfirmPassword("");

      Alert.alert("Succès", "Mot de passe mis à jour");
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
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
    Alert.alert(
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
              Alert.alert("C'est fait", "Ta progression a été réinitialisée.");
            } catch (e: any) {
              Alert.alert("Erreur", "Impossible de réinitialiser : " + e.message);
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
      Alert.alert("Erreur", e.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Paramètres</Text>

        <View style={{ width: 26 }} />
      </View>

      {/* APPARENCE */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Apparence</Text>
        <View style={styles.appearanceToggle}>
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
              >
                <Ionicons
                  name={option.icon}
                  size={16}
                  color={active ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.appearanceText, active && styles.appearanceTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* AIDE */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Aide</Text>
        <TouchableOpacity onPress={handleReplayTutorial} style={styles.replayButton}>
          <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.replayButtonText}>Revoir le tutoriel</Text>
        </TouchableOpacity>
      </View>

      {/* NOTIFICATIONS */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.notifRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitle}>Rappels de streak</Text>
            <Text style={styles.notifSubtitle}>
              Un rappel le soir si tu n'as pas encore révisé
            </Text>
          </View>
          <Switch
            value={streakRemindersOn}
            onValueChange={handleToggleStreakReminders}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>

      {/* DEBUG */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Debug</Text>
        <TouchableOpacity onPress={handleResetProgress} style={styles.debugButton}>
          <Ionicons name="refresh-circle-outline" size={20} color={colors.danger} />
          <Text style={styles.debugButtonText}>Réinitialiser XP / progression</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleTestNotification}
          style={[styles.debugButton, { marginTop: 10, backgroundColor: colors.tintPrimary }]}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
          <Text style={[styles.debugButtonText, { color: colors.primary }]}>
            Tester une notification (5s)
          </Text>
        </TouchableOpacity>
      </View>

      {/* PROFILE CARD */}
      <View style={styles.profileCenter}>
        <View style={styles.avatarWrapper}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {user?.displayName
                  ? user.displayName.charAt(0).toUpperCase()
                  : "U"}
              </Text>
            </LinearGradient>
          )}

          <TouchableOpacity
            onPress={pickImage}
            disabled={uploadingPhoto}
            style={styles.editAvatarButton}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Ionicons name="camera" size={16} color={colors.textInverse} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>Nom</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
          placeholderTextColor={colors.muted}
        />

        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Email</Text>
        <TextInput
          value={user?.email || ""}
          editable={false}
          style={styles.inputDisabled}
        />

        <TouchableOpacity onPress={handleSaveProfile} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Sauvegarder</Text>
        </TouchableOpacity>
      </View>

      {/* SECURITY */}
      <View style={styles.section}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sécurité</Text>

          <TextInput
            placeholder="Nouveau mot de passe"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            style={[styles.input, { marginBottom: 10 }]}
          />

          <TextInput
            placeholder="Confirmer le mot de passe"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
          />

          {/* PASSWORD RULES */}
          <View style={{ marginTop: 10 }}>
            {[
              { label: "8 caractères", ok: newPassword.length >= 8 },
              { label: "1 majuscule", ok: /[A-Z]/.test(newPassword) },
              { label: "1 minuscule", ok: /[a-z]/.test(newPassword) },
              { label: "1 chiffre", ok: /\d/.test(newPassword) },
              {
                label: "1 caractère spécial",
                ok: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
              },
            ].map((r, i) => (
              <View key={i} style={styles.ruleRow}>
                <Ionicons
                  name={r.ok ? "checkmark-circle" : "close-circle"}
                  size={18}
                  color={r.ok ? colors.success : colors.danger}
                />
                <Text style={styles.ruleText}>{r.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleUpdatePassword}
            style={[
              styles.successButton,
              !(isPasswordValid && passwordsMatch) && styles.buttonDisabled,
            ]}
            disabled={!isPasswordValid || !passwordsMatch}
          >
            <Text style={styles.successButtonText}>
              Mettre à jour le mot de passe
            </Text>
          </TouchableOpacity>
        </View>

        {/* APP SETTINGS */}
        {/* <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Application
          </Text> */}

          {/* DARK MODE */}
          {/* <View style={styles.row}>
            <Text style={{ color: colors.textPrimary }}>Mode sombre</Text>
            <Switch value={darkMode} onValueChange={setDarkMode} />
          </View> */}

          {/* NOTIFICATIONS */}
          {/* <View style={styles.row}>
            <Text style={{ color: colors.textPrimary }}>Notifications</Text>
            <Switch value={notifications} onValueChange={setNotifications} />
          </View>
        </View> */}

        {/* SUBSCRIPTION */}
        {/* <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Abonnement
          </Text>

          <Text style={{ marginTop: 6, color: colors.textSecondary }}>
            Plan actuel : Gratuit
          </Text>

          <TouchableOpacity style={styles.premiumButton}>
            <Text style={styles.primaryButtonText}>
              Passer en Premium
            </Text>
          </TouchableOpacity>
        </View> */}

        {/* LOGOUT */}
        <TouchableOpacity onPress={handleLogout} style={styles.dangerButton}>
          <Text style={styles.primaryButtonText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      paddingTop: 40,
    },

    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    section: {
      padding: 20,
      paddingTop: 0,
    },

    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
    },

    appearanceToggle: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },

    appearanceOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 9,
      backgroundColor: 'transparent',
    },

    appearanceOptionActive: {
      backgroundColor: colors.surface,
    },

    appearanceText: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
    },

    appearanceTextActive: {
      fontWeight: '600',
      color: colors.textPrimary,
    },

    replayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
    },

    replayButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    debugButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.tintDanger,
      borderRadius: 12,
      padding: 14,
    },

    debugButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.danger,
    },

    notifRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 12,
    },

    notifTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    notifSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },

    profileCenter: {
      alignItems: "center",
      marginBottom: 16,
    },

    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
      alignItems: "center",
      justifyContent: "center",
    },

    avatarText: {
      fontSize: 34,
      fontWeight: "700",
      color: colors.textInverse,
    },

    avatarWrapper: {
      position: "relative",
    },

    editAvatarButton: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },

    formSection: {
      padding: 20,
      paddingTop: 0,
    },

    fieldLabel: {
      color: colors.textPrimary,
    },

    input: {
      backgroundColor: colors.surfaceAlt,
      padding: 12,
      borderRadius: 10,
      marginTop: 6,
      color: colors.textPrimary,
    },

    inputDisabled: {
      backgroundColor: colors.surfaceAlt,
      padding: 12,
      borderRadius: 10,
      marginTop: 6,
      color: colors.textSecondary,
      opacity: 0.7,
    },

    primaryButton: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 10,
      marginTop: 12,
    },

    primaryButtonText: {
      color: colors.textInverse,
      textAlign: "center",
      fontWeight: "600",
    },

    card: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },

    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 10,
      color: colors.textPrimary,
    },

    ruleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },

    ruleText: {
      marginLeft: 8,
      color: colors.textSecondary,
    },

    successButton: {
      backgroundColor: colors.success,
      padding: 12,
      borderRadius: 10,
      marginTop: 12,
    },

    successButtonText: {
      color: colors.textInverse,
      textAlign: "center",
      fontWeight: "600",
    },

    buttonDisabled: {
      backgroundColor: colors.muted,
    },

    dangerButton: {
      backgroundColor: colors.danger,
      padding: 14,
      borderRadius: 12,
    },

    premiumButton: {
      backgroundColor: colors.secondary,
      padding: 14,
      borderRadius: 12,
      marginTop: 10,
    },

    link: {
      color: colors.primary,
      marginTop: 8,
      fontWeight: "500",
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10,
    },
  });
}