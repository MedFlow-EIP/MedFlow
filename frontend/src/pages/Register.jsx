import { useState } from "react";
import { CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function Register() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const rules = [
    { label: "Au moins 8 caractères", check: (pw) => pw.length >= 8 },
    { label: "1 majuscule", check: (pw) => /[A-Z]/.test(pw) },
    { label: "1 minuscule", check: (pw) => /[a-z]/.test(pw) },
    { label: "1 chiffre", check: (pw) => /\d/.test(pw) },
    { label: "1 caractère spécial", check: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
  ];

  const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const isPasswordValid = rules.every((rule) => rule.check(password));
  const doPasswordsMatch = password && confirmPassword && password === confirmPassword;
  const isFormValid = firstName && lastName && isValidEmail(email) && isPasswordValid && doPasswordsMatch;

  const getErrorMessage = (code) => {
    const errors = {
      "auth/email-already-in-use": "Cette adresse e-mail est déjà utilisée.",
      "auth/invalid-email": "Adresse e-mail invalide.",
      "auth/weak-password": "Mot de passe trop faible.",
      "auth/network-request-failed": "Erreur réseau. Vérifiez votre connexion.",
    };
    return errors[code] || "Une erreur est survenue.";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setError("");
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(userCredential.user, {
        displayName: `${firstName} ${lastName}`,
        photoURL: "/images/default-avatar.png",
      });

      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        firstName,
        lastName,
        email,
        displayName: `${firstName} ${lastName}`,
        photoURL: "/images/default-avatar.png",
        createdAt: serverTimestamp(),
        role: "user",
      });

      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    const provider = new GoogleAuthProvider();
    setError("");
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          role: "user",
        },
        { merge: true }
      );

      navigate("/dashboard");
    } catch {
      setError("Échec de l'inscription avec Google.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-8 w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
          Créer un compte
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Prénom"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full border px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            autoComplete="given-name"
          />
          <input
            type="text"
            placeholder="Nom"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full border px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            autoComplete="family-name"
          />
          <input
            type="email"
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            autoComplete="email"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border px-4 py-2 pr-10 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center text-gray-500 dark:text-gray-300"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {password.length > 0 && (
            <div className="space-y-1 text-sm mt-2">
              {rules.map((rule, i) => {
                const valid = rule.check(password);
                return (
                  <div key={i} className={`flex items-center gap-2 ${valid ? "text-green-500" : "text-red-500"}`}>
                    {valid ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirmer le mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border px-4 py-2 pr-10 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 flex items-center text-gray-500 dark:text-gray-300"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {confirmPassword && (
            <div className={`flex items-center gap-2 ${doPasswordsMatch ? "text-green-500" : "text-red-500"}`}>
              {doPasswordsMatch ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span>{doPasswordsMatch ? "Les mots de passe correspondent" : "Les mots de passe ne correspondent pas"}</span>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={!isFormValid || loading}
            className={`w-full py-2 rounded-lg text-white font-semibold transition ${
              isFormValid && !loading ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {loading ? "Chargement..." : "S'inscrire"}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
          <span className="px-3 text-gray-500 text-sm">OU</span>
          <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
        </div>

        <button
          onClick={handleGoogleRegister}
          className="w-full flex items-center justify-center gap-2 border py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FcGoogle size={20} />
          <span>S'inscrire avec Google</span>
        </button>

        <div className="mt-4 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            Déjà un compte ?{" "}
            <Link to="/login" className="text-blue-600 hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}