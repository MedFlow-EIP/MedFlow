import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Switch,
  Alert,
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
import {LinearGradient} from "expo-linear-gradient";

export function SettingsScreen() {
  const navigation = useNavigation();
  const user = auth.currentUser;

  const [fullName, setFullName] = useState(user?.displayName || "");
  const [photo, setPhoto] = useState<string | null>(user?.photoURL || null);

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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
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
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      {/* HEADER */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 20,
          paddingTop: 40,
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#111827" />
        </TouchableOpacity>

        <Text style={{ fontSize: 18, fontWeight: "700" }}>
          Paramètres
        </Text>

        <View style={{ width: 26 }} />
      </View>

      {/* PROFILE CARD */}
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{
              width: 90,
              height: 90,
              borderRadius: 45,
            }}
          />
        ) : (
          <LinearGradient
            colors={["#3b82f6", "#2563eb"]}
            style={{
              width: 90,
              height: 90,
              borderRadius: 45,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 34,
                fontWeight: "700",
                color: "white",
              }}
            >
              {user?.displayName
                ? user.displayName.charAt(0).toUpperCase()
                : "U"}
            </Text>
          </LinearGradient>
        )}

        {/* <TouchableOpacity onPress={pickImage}>
          <Text style={{ color: "#3b82f6", marginTop: 8 }}>
            Changer la photo
          </Text>
        </TouchableOpacity> */}
      </View>
      <View style={{ padding: 20, paddingTop: 0 }}>
          <Text>Nom</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            style={{
              backgroundColor: "#f3f4f6",
              padding: 12,
              borderRadius: 10,
              marginTop: 6,
            }}
          />

          <Text style={{ marginTop: 10 }}>Email</Text>
          <TextInput
            value={user?.email || ""}
            editable={false}
            style={{
              backgroundColor: "#e5e7eb",
              padding: 12,
              borderRadius: 10,
              marginTop: 6,
            }}
          />

          <TouchableOpacity
            onPress={handleSaveProfile}
            style={{
              backgroundColor: "#3b82f6",
              padding: 12,
              borderRadius: 10,
              marginTop: 12,
            }}
          >
            <Text
              style={{
                color: "white",
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              Sauvegarder
            </Text>
          </TouchableOpacity>
      </View>

      {/* SECURITY */}
      <View style={{ padding: 20, paddingTop: 0 }}>
        <View
          style={{
            backgroundColor: "white",
            padding: 16,
            borderRadius: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 10 }}>
            Sécurité
          </Text>

          <TextInput
            placeholder="Nouveau mot de passe"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            style={{
              backgroundColor: "#f3f4f6",
              padding: 12,
              borderRadius: 10,
              marginBottom: 10,
            }}
          />

          <TextInput
            placeholder="Confirmer le mot de passe"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={{
              backgroundColor: "#f3f4f6",
              padding: 12,
              borderRadius: 10,
            }}
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
              <View
                key={i}
                style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}
              >
                <Ionicons
                  name={r.ok ? "checkmark-circle" : "close-circle"}
                  size={18}
                  color={r.ok ? "#22c55e" : "#ef4444"}
                />
                <Text style={{ marginLeft: 8 }}>{r.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleUpdatePassword}
            style={{
              backgroundColor:
                isPasswordValid && passwordsMatch ? "#22c55e" : "#9ca3af",
              padding: 12,
              borderRadius: 10,
              marginTop: 12,
            }}
            disabled={!isPasswordValid || !passwordsMatch}
          >
            <Text style={{ color: "white", textAlign: "center" }}>
              Mettre à jour le mot de passe
            </Text>
          </TouchableOpacity>
        </View>

        {/* APP SETTINGS */}
        {/* <View
          style={{
            backgroundColor: "white",
            padding: 16,
            borderRadius: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 10 }}>
            Application
          </Text> */}

          {/* DARK MODE */}
          {/* <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
              alignItems: "center",
            }}
          >
            <Text>Mode sombre</Text>
            <Switch value={darkMode} onValueChange={setDarkMode} />
          </View> */}

          {/* NOTIFICATIONS */}
          {/* <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
              alignItems: "center",
            }}
          >
            <Text>Notifications</Text>
            <Switch value={notifications} onValueChange={setNotifications} />
          </View>
        </View> */}

        {/* SUBSCRIPTION */}
        {/* <View
          style={{
            backgroundColor: "white",
            padding: 16,
            borderRadius: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700" }}>
            Abonnement
          </Text>

          <Text style={{ marginTop: 6, color: "#6b7280" }}>
            Plan actuel : Gratuit
          </Text>

          <TouchableOpacity
            style={{
              marginTop: 10,
              backgroundColor: "#7c3aed",
              padding: 12,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "white", textAlign: "center" }}>
              Passer en Premium
            </Text>
          </TouchableOpacity>
        </View> */}

        {/* LOGOUT */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: "#ef4444",
            padding: 14,
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              color: "white",
              textAlign: "center",
              fontWeight: "600",
            }}
          >
            Se déconnecter
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },

  section: {
    padding: 20,
    paddingTop: 0,
  },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111827",
  },

  input: {
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
  },

  inputDisabled: {
    backgroundColor: "#e5e7eb",
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
    color: "#6b7280",
  },

  primaryButton: {
    backgroundColor: "#3b82f6",
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },

  primaryButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
  },

  successButton: {
    backgroundColor: "#22c55e",
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },

  dangerButton: {
    backgroundColor: "#ef4444",
    padding: 14,
    borderRadius: 12,
  },

  premiumButton: {
    backgroundColor: "#7c3aed",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },

  center: {
    alignItems: "center",
    marginBottom: 16,
  },

  link: {
    color: "#3b82f6",
    marginTop: 8,
    fontWeight: "500",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
};