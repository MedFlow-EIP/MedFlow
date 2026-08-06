import { useState } from "react";
import { auth } from "../firebase";
import { updatePassword, updateProfile } from "firebase/auth";
import {
  Upload,
  Save,
  Lock,
  User,
  Mail,
  CheckCircle,
  XCircle,
} from "lucide-react";

export default function UserSettings() {
  const user = auth.currentUser;
  const [fullName, setFullName] = useState(user?.displayName || "");
  const [email] = useState(user?.email || "");
  const [photo, setPhoto] = useState(
    user?.photoURL || "/images/default-avatar.png"
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const rules = [
    { label: "Au moins 8 caractères", check: (pw) => pw.length >= 8 },
    { label: "1 majuscule", check: (pw) => /[A-Z]/.test(pw) },
    { label: "1 minuscule", check: (pw) => /[a-z]/.test(pw) },
    { label: "1 chiffre", check: (pw) => /\d/.test(pw) },
    {
      label: "1 caractère spécial",
      check: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw),
    },
  ];

  const isPasswordValid = rules.every((rule) => rule.check(newPassword));
  const doPasswordsMatch =
    newPassword && confirmPassword && newPassword === confirmPassword;

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await updateProfile(user, { displayName: fullName, photoURL: photo });
      setMessage("Profil mis à jour ✅");
    } catch (err) {
      setMessage("Erreur : " + err.message);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (!isPasswordValid || !doPasswordsMatch) {
      setMessage("⚠️ Le mot de passe ne respecte pas les règles.");
      return;
    }
    try {
      await updatePassword(user, newPassword);
      setMessage("Mot de passe mis à jour ✅");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setMessage("Erreur : " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-6 flex justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-3xl p-8 space-y-10">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Paramètres du compte
        </h2>

        {/* Photo de profil */}
        <div className="flex flex-col items-center space-y-4">
          <img
            src={photo}
            alt="Photo de profil"
            className="w-24 h-24 rounded-full object-cover border"
          />
          <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition">
            <Upload className="w-4 h-4" />
            Changer de photo
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => setPhoto(reader.result);
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
        </div>

        {/* Infos personnelles */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <User className="w-5 h-5" /> Informations personnelles
          </h3>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nom complet"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
            <Mail className="w-5 h-5" />
            <span>{email}</span>
          </div>
          <button
            onClick={handleSaveProfile}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Sauvegarder
          </button>
        </div>

        {/* Mot de passe */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Lock className="w-5 h-5" /> Sécurité
          </h3>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmer le mot de passe"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          />

          {/* Checklist des règles */}
          <div className="space-y-1 text-sm mt-2">
            {rules.map((rule, i) => {
              const valid = rule.check(newPassword);
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 ${
                    valid ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {valid ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <span>{rule.label}</span>
                </div>
              );
            })}
            {confirmPassword && (
              <div
                className={`flex items-center gap-2 ${
                  doPasswordsMatch ? "text-green-500" : "text-red-500"
                }`}
              >
                {doPasswordsMatch ? (
                  <CheckCircle size={16} />
                ) : (
                  <XCircle size={16} />
                )}
                <span>
                  {doPasswordsMatch
                    ? "Les mots de passe correspondent"
                    : "Les mots de passe ne correspondent pas"}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleChangePassword}
            disabled={!isPasswordValid || !doPasswordsMatch}
            className={`px-6 py-2 rounded-md text-white transition ${
              isPasswordValid && doPasswordsMatch
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Mettre à jour le mot de passe
          </button>
        </div>

        {/* Abonnement */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Abonnement
          </h3>
          <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
            <p>
              Votre abonnement actuel : <span className="font-bold">Gratuit</span>
            </p>
            <button className="mt-3 px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition">
              Passer en Premium
            </button>
          </div>
        </div>

        {message && (
          <p className="text-center text-sm text-green-500 dark:text-green-400 mt-4">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
