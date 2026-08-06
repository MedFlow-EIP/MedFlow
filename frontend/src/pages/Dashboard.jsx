import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  Flame, Star, Trophy, ChevronRight, Filter,
  GraduationCap, HelpCircle, X, ChevronLeft, Pencil, Check
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  MEDICAL_SUBJECTS,
  getSubject,
  getAllSubjects,
  detectSubject,
  groupCoursesBySubject,
} from "../utils/medicalSubjects";

// ─── LocalStorage : persister les assignations manuelles ─────────────────────
const LS_KEY = "medflow_subject_assignments";
const loadAssignments = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
};
const saveAssignment = (courseId, subjectId) => {
  const all = loadAssignments();
  all[courseId] = subjectId;
  localStorage.setItem(LS_KEY, JSON.stringify(all));
};

// ─── Subject Picker Modal ─────────────────────────────────────────────────────
function SubjectPickerModal({ course, currentSubjectId, onSelect, onClose }) {
  const subjects = getAllSubjects();
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.45)" }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 10001,
        width: "min(600px, calc(100vw - 2rem))",
        background: "white", borderRadius: "20px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "1.5rem 1.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111827", margin: 0 }}>
                🏷️ Assigner une matière
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#6b7280", marginTop: "4px", maxWidth: "380px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {course.nom}
              </p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "1.4rem", lineHeight: 1, padding: "2px 6px" }}>✕</button>
          </div>
        </div>

        {/* Grid of subjects */}
        <div style={{
          padding: "1.25rem 1.5rem",
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.6rem",
          maxHeight: "420px", overflowY: "auto",
        }}>
          {subjects.map((subject) => {
            const isSelected = subject.id === currentSubjectId;
            return (
              <button
                key={subject.id}
                onClick={() => onSelect(subject.id)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: "6px", padding: "12px 8px",
                  borderRadius: "12px",
                  border: isSelected ? `2px solid ${subject.colorHex}` : "2px solid #f1f5f9",
                  background: isSelected ? subject.colorLightHex : "#fafafa",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  position: "relative",
                }}
              >
                {/* Color dot top-right when selected */}
                {isSelected && (
                  <div style={{
                    position: "absolute", top: "6px", right: "6px",
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: subject.colorHex,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Check style={{ width: "10px", height: "10px", color: "white" }} />
                  </div>
                )}
                {/* Icon circle */}
                <div style={{
                  width: "42px", height: "42px", borderRadius: "12px",
                  background: subject.colorLightHex,
                  border: `1px solid ${subject.colorBorderHex}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.3rem",
                }}>
                  {subject.icon}
                </div>
                <span style={{
                  fontSize: "0.72rem", fontWeight: 600,
                  color: isSelected ? subject.colorHex : "#374151",
                  textAlign: "center", lineHeight: 1.2,
                }}>
                  {subject.nom}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ padding: "0.9rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: "8px",
            background: "#f1f5f9", border: "none",
            color: "#374151", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer",
          }}>
            Fermer
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Subject Badge inline ─────────────────────────────────────────────────────
function SubjectBadge({ subjectId, onEdit }) {
  const subject = getSubject(subjectId);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        padding: "2px 10px 2px 7px",
        borderRadius: "999px",
        fontSize: "0.72rem", fontWeight: 600,
        background: subject.colorLightHex,
        color: subject.colorHex,
        border: `1px solid ${subject.colorBorderHex}`,
      }}>
        <span style={{ fontSize: "0.85rem" }}>{subject.icon}</span>
        {subject.nom}
      </span>
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Changer la matière"
          style={{
            background: "#f1f5f9", border: "1px solid #e2e8f0", cursor: "pointer",
            color: "#64748b", padding: "5px 8px", display: "flex", alignItems: "center",
            borderRadius: "7px", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#374151"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; }}
        >
          <Pencil style={{ width: "14px", height: "14px" }} />
        </button>
      )}
    </div>
  );
}

// ─── Filter pills ─────────────────────────────────────────────────────────────
function FilterPills({ subjects, activeCount, filterSubject, setFilterSubject, total }) {
  return (
    <div style={{
      display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "1.25rem",
    }}>
      {/* "Tous" pill */}
      <button
        onClick={() => setFilterSubject("all")}
        style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          padding: "5px 14px", borderRadius: "999px", border: "none",
          fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
          background: filterSubject === "all" ? "#3b82f6" : "#f1f5f9",
          color: filterSubject === "all" ? "white" : "#374151",
          transition: "all 0.15s",
        }}
      >
        🗂️ Tous ({total})
      </button>
      {subjects.map((subject) => {
        const isActive = filterSubject === subject.id;
        return (
          <button
            key={subject.id}
            onClick={() => setFilterSubject(subject.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "5px 12px", borderRadius: "999px",
              border: `1.5px solid ${isActive ? subject.colorHex : subject.colorBorderHex}`,
              fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
              background: isActive ? subject.colorHex : subject.colorLightHex,
              color: isActive ? "white" : subject.colorHex,
              transition: "all 0.15s",
            }}
          >
            <span>{subject.icon}</span>
            {subject.nom} ({activeCount[subject.id] || 0})
          </button>
        );
      })}
    </div>
  );
}

// ─── Tutorial Steps ────────────────────────────────────────────────────────────
const TUTORIAL_STEPS = [
  {
    title: "👋 Bienvenue sur MedFlow !",
    description: "Voici votre tableau de bord. Vous y retrouvez vos cours, votre avancement, vos badges et plus encore. Ce tutoriel vous guide en 8 étapes.",
    highlight: "tuto-header",
  },
  {
    title: "🔥 Streak & Points XP",
    description: "La flamme orange = nombre de sessions complétées. L'étoile jaune = vos points XP (10 pts par flashcard). Révisez chaque jour pour faire monter ces chiffres !",
    highlight: "tuto-scores",
  },
  {
    title: "📝 Examen Blanc Médical",
    description: "Un QCM de 20 questions sur 4 spécialités : Cardiologie, Pneumologie, Neurologie, Gastro. Durée ~30 min, noté sur 20. Idéal pour se préparer aux partiels.",
    highlight: "tuto-exam",
  },
  {
    title: "🏷️ Matières & couleurs",
    description: "Chaque cours est automatiquement classé dans une matière médicale grâce à l'IA. Utilisez les boutons colorés en haut pour filtrer par spécialité. Cliquez sur ✏️ pour changer la matière d'un cours manuellement.",
    highlight: "tuto-paths",
  },
  {
    title: "📚 Parcours d'apprentissage",
    description: "Cliquez sur un cours pour démarrer une session : d'abord les flashcards, puis le quiz. La barre de progression suit votre avancement (objectif : 10 sessions par cours).",
    highlight: "tuto-paths",
  },
  {
    title: "📊 Votre progression",
    description: "Suivez vos XP, jours de série, progression globale et objectif hebdomadaire. Le calendrier montre vos jours d'activité récents.",
    highlight: "tuto-progress",
  },
  {
    title: "🏅 Badges",
    description: "Débloquez des badges en révisant : 'Premier pas' dès votre 1ère session, 'Série de 7' après 7 sessions, 'Rapide' avec 50 flashcards maîtrisées.",
    highlight: "tuto-badges",
  },
  {
    title: "🎉 C'est parti !",
    description: "Importez votre premier cours PDF via le menu, l'IA génère résumé + flashcards + quiz en quelques secondes. Bonne étude !",
    highlight: null,
  },
];

// ─── Highlight Ring ────────────────────────────────────────────────────────────
function HighlightRing({ targetId }) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    if (!targetId) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    const compute = () => {
      const r = el.getBoundingClientRect();
      setBox({ top: r.top + window.scrollY - 6, left: r.left + window.scrollX - 6, width: r.width + 12, height: r.height + 12 });
    };
    compute();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute);
    return () => { window.removeEventListener("resize", compute); window.removeEventListener("scroll", compute); };
  }, [targetId]);
  if (!box) return null;
  return <div style={{ position: "absolute", top: box.top, left: box.left, width: box.width, height: box.height, borderRadius: "14px", border: "3px solid #3b82f6", boxShadow: "0 0 0 5px rgba(59,130,246,0.25)", animation: "tutoPulse 1.5s ease-in-out infinite", pointerEvents: "none", zIndex: 9999 }} />;
}

// ─── Tutorial Overlay ──────────────────────────────────────────────────────────
function TutorialOverlay({ onClose }) {
  const [step, setStep] = useState(0);
  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;
  const btnStyle = (disabled) => ({
    display: "flex", alignItems: "center", gap: "6px",
    padding: "10px 20px", borderRadius: "10px",
    border: "1.5px solid #e5e7eb",
    background: disabled ? "#f9fafb" : "white",
    color: disabled ? "#d1d5db" : "#374151",
    fontSize: "0.95rem", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  });
  const primaryBtn = {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "10px 28px", borderRadius: "10px", border: "none",
    background: "linear-gradient(to right,#3b82f6,#6366f1)",
    color: "white", fontSize: "0.95rem", fontWeight: 700,
    cursor: "pointer", boxShadow: "0 4px 14px rgba(59,130,246,0.4)",
  };
  return (
    <>
      <style>{`@keyframes tutoPulse{0%,100%{box-shadow:0 0 0 5px rgba(59,130,246,0.35)}50%{box-shadow:0 0 0 12px rgba(59,130,246,0.10)}}`}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.28)" }} onClick={onClose} />
      {current.highlight && <HighlightRing targetId={current.highlight} />}
      <div style={{ position: "fixed", bottom: "2.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 99999, width: "min(680px,calc(100vw - 2rem))" }}>
        <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 25px 60px rgba(0,0,0,0.25)", border: "1px solid #dbeafe", overflow: "hidden" }}>
          <div style={{ height: "5px", background: "#e5e7eb" }}>
            <div style={{ height: "100%", width: `${((step + 1) / TUTORIAL_STEPS.length) * 100}%`, background: "linear-gradient(to right,#3b82f6,#6366f1)", transition: "width 0.4s ease" }} />
          </div>
          <div style={{ padding: "2rem 2.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#3b82f6", background: "#eff6ff", padding: "4px 14px", borderRadius: "999px" }}>
                Étape {step + 1} / {TUTORIAL_STEPS.length}
              </span>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "1.5rem", lineHeight: 1, padding: "4px" }}>✕</button>
            </div>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#111827", marginBottom: "0.75rem", lineHeight: 1.3 }}>{current.title}</h3>
            <p style={{ fontSize: "1rem", color: "#4b5563", lineHeight: 1.7, marginBottom: "2rem" }}>{current.description}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <button onClick={() => setStep(s => s - 1)} disabled={step === 0} style={btnStyle(step === 0)}>← Précédent</button>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {TUTORIAL_STEPS.map((_, i) => (
                  <button key={i} onClick={() => setStep(i)} style={{ height: "8px", width: i === step ? "20px" : "8px", borderRadius: "999px", background: i === step ? "#3b82f6" : "#d1d5db", border: "none", cursor: "pointer", padding: 0, transition: "all 0.2s" }} />
                ))}
              </div>
              {isLast
                ? <button onClick={onClose} style={primaryBtn}>Terminer 🎉</button>
                : <button onClick={() => setStep(s => s + 1)} style={primaryBtn}>Suivant →</button>
              }
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardNew() {
  const [_user, setUser] = useState(null);
  const [_profile, setProfile] = useState(null);
  const [cours, setCours] = useState([]);
  const [stats, setStats] = useState({ cours: 0, flashcards: 0, sessions: 0 });
  const [filterSubject, setFilterSubject] = useState("all");
  const [showTutorial, setShowTutorial] = useState(false);
  const [assignments, setAssignments] = useState(loadAssignments);
  const [pickerCourse, setPickerCourse] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) { setCours([]); setStats({ cours: 0, flashcards: 0, sessions: 0 }); setProfile(null); return; }
      fetch(`${import.meta.env.VITE_API_URL}/api/dashboard`, {
        headers: { "X-User-UID": currentUser.uid, "X-User-Name": currentUser.displayName || "", "X-User-Avatar": currentUser.photoURL || "" },
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setCours(data.cours || []);
          setStats(data.stats || { cours: 0, flashcards: 0, sessions: 0 });
          setProfile(data.user || null);
        })
        .catch(err => console.error("Erreur dashboard:", err));
    });
    return () => unsubscribe();
  }, []);

  const handleAssign = (courseId, subjectId) => {
    saveAssignment(courseId, subjectId);
    setAssignments(prev => ({ ...prev, [courseId]: subjectId }));
    setPickerCourse(null);
  };

  // Enrich courses: manual assignment > auto-detection from name
  const enrichedCours = cours.map(c => ({
    ...c,
    subject: assignments[c.id] || detectSubject(c.nom),
  }));

  const activityData = Array(49).fill(0).map(() => Math.random() > 0.6 ? 1 : 0);

  const filteredCours = filterSubject === "all"
    ? enrichedCours
    : enrichedCours.filter(c => c.subject === filterSubject);

  const groupedCourses = groupCoursesBySubject(filteredCours);

  // Count courses per subject (for filter pills)
  const countBySubject = {};
  enrichedCours.forEach(c => {
    countBySubject[c.subject] = (countBySubject[c.subject] || 0) + 1;
  });
  // Only subjects that actually have courses
  const activeSubjects = getAllSubjects().filter(s => countBySubject[s.id] > 0);

  const badges = [
    { icon: "🎯", name: "Premier pas", unlocked: stats.sessions > 0 },
    { icon: "🔥", name: "Série de 7", unlocked: stats.sessions >= 7 },
    { icon: "⚡", name: "Rapide", unlocked: stats.flashcards >= 50 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
      {pickerCourse && (
        <SubjectPickerModal
          course={pickerCourse}
          currentSubjectId={pickerCourse.subject}
          onSelect={(subjectId) => handleAssign(pickerCourse.id, subjectId)}
          onClose={() => setPickerCourse(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div id="tuto-header" className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">MedFlow</h1>
              <p className="text-gray-600 dark:text-gray-300">Votre parcours médical</p>
            </div>
            <div className="flex items-center gap-3">
              <div id="tuto-scores" className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 px-4 py-2 rounded-full">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="font-bold text-orange-600 dark:text-orange-400">{stats.sessions}</span>
                </div>
                <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/30 px-4 py-2 rounded-full">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="font-bold text-yellow-600 dark:text-yellow-400">{stats.flashcards * 10}</span>
                </div>
              </div>
              <button
                onClick={() => setShowTutorial(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-full font-medium hover:bg-blue-50 dark:hover:bg-gray-700 transition shadow-sm text-sm"
              >
                <HelpCircle className="w-4 h-4" /> Tutoriel
              </button>
            </div>
          </div>
        </div>

        {/* ── Examen Blanc ── */}
        <div id="tuto-exam" className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl shadow-lg p-6 border-2 border-purple-200 dark:border-purple-800 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-purple-900 dark:text-purple-300 mb-2">📝 Examen Blanc Médical</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">Testez vos connaissances avec un QCM complet de 20 questions organisées en 4 blocs thématiques</p>
              <div className="flex flex-wrap gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                {["🫀 Cardiologie", "🫁 Pneumologie", "🧠 Neurologie", "🔬 Gastro-entérologie"].map(t => (
                  <span key={t} className="bg-white dark:bg-gray-800 px-3 py-1 rounded-full">{t}</span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => navigate("/examen-blanc")} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition shadow-md">
                  🎓 Commencer l'examen blanc
                </button>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>⏱️ ~30 minutes</span><span>•</span><span>📊 Note sur 20</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left col ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Learning Paths */}
            <div id="tuto-paths" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Parcours d'apprentissage</h2>
              </div>

              {/* Filter pills — only shown when courses exist */}
              {enrichedCours.length > 0 && (
                <FilterPills
                  subjects={activeSubjects}
                  activeCount={countBySubject}
                  filterSubject={filterSubject}
                  setFilterSubject={setFilterSubject}
                  total={enrichedCours.length}
                />
              )}

              {enrichedCours.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Commencez votre parcours</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">Uploadez votre premier cours pour débuter</p>
                  <button onClick={() => navigate("/upload")} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition">
                    📂 Uploader un cours
                  </button>
                </div>
              ) : filteredCours.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Aucun cours dans cette matière.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(groupedCourses).map(([subjectId, subjectCourses]) => {
                    const subject = getSubject(subjectId);
                    return (
                      <div key={subjectId}>
                        {/* Subject section header */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          marginBottom: "12px",
                          paddingBottom: "10px",
                          borderBottom: `2px solid ${subject.colorBorderHex}`,
                        }}>
                          <div style={{
                            width: "36px", height: "36px", borderRadius: "10px",
                            background: subject.colorLightHex,
                            border: `1px solid ${subject.colorBorderHex}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.1rem",
                          }}>
                            {subject.icon}
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, color: subject.colorHex, fontSize: "0.95rem" }}>
                              {subject.nom}
                            </span>
                            <span style={{ fontSize: "0.78rem", color: "#9ca3af", marginLeft: "8px" }}>
                              {subjectCourses.length} cours
                            </span>
                          </div>
                        </div>

                        {/* Course cards */}
                        <div className="space-y-3">
                          {subjectCourses.map((course) => {
                            const progress = course.sessions > 0 ? Math.min((course.sessions / 10) * 100, 100) : 0;
                            return (
                              <div
                                key={course.id}
                                className="rounded-xl p-5 shadow-sm hover:shadow-md transition cursor-pointer border"
                                style={{
                                  background: subject.colorLightHex,
                                  borderColor: subject.colorBorderHex,
                                }}
                                onClick={() => navigate(`/revision?mode=course&id=${course.id}`)}
                              >
                                <div className="flex items-start gap-4">
                                  {/* Icon */}
                                  <div style={{
                                    width: "52px", height: "52px", borderRadius: "14px",
                                    background: "white",
                                    border: `1.5px solid ${subject.colorBorderHex}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "1.6rem", flexShrink: 0,
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                                  }}>
                                    {subject.icon}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    {/* Title + badge */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                                        {course.nom}
                                      </h3>
                                      <div style={{ flexShrink: 0 }}>
                                        <SubjectBadge
                                          subjectId={course.subject}
                                          onEdit={() => setPickerCourse(course)}
                                        />
                                      </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div style={{ height: "6px", background: "rgba(0,0,0,0.08)", borderRadius: "999px", overflow: "hidden", marginBottom: "6px" }}>
                                      <div style={{
                                        height: "100%",
                                        width: `${progress}%`,
                                        background: subject.colorHex,
                                        borderRadius: "999px",
                                        transition: "width 0.5s ease",
                                      }} />
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                                        {course.sessions || 0}/10 sessions • {Math.round(progress)}%
                                      </span>
                                      <ChevronRight style={{ width: "16px", height: "16px", color: subject.colorHex }} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {enrichedCours.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🚀 Actions rapides</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <button onClick={() => navigate("/revision?mode=all")} className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition shadow-md text-left">
                    <div className="text-2xl mb-2">🎯</div>
                    <div className="font-semibold">Révision globale</div>
                    <div className="text-sm opacity-90">Tous les cours</div>
                  </button>
                  <button onClick={() => navigate("/upload")} className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition shadow-md text-left">
                    <div className="text-2xl mb-2">📚</div>
                    <div className="font-semibold">Nouveau cours</div>
                    <div className="text-sm opacity-90">Ajouter un PDF</div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right col ── */}
          <div className="space-y-6">

            {/* Progress */}
            <div id="tuto-progress" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Votre progression</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-4 text-center">
                  <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{stats.flashcards * 10}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Points XP</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4 text-center">
                  <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.sessions}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Jours de série</div>
                </div>
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progression globale</span>
                  <span className="text-sm font-bold text-blue-600">{stats.cours > 0 ? Math.round((stats.sessions / (stats.cours * 10)) * 100) : 0}%</span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500" style={{ width: `${stats.cours > 0 ? Math.round((stats.sessions / (stats.cours * 10)) * 100) : 0}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{stats.sessions} leçons complétées sur {stats.cours * 10}</p>
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Objectif hebdomadaire</span>
                  <span className="text-sm font-bold text-green-600">60%</span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500" style={{ width: "60%" }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">6 / 10 leçons cette semaine</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Activité récente</h4>
                <div className="grid grid-cols-7 gap-1.5">
                  {activityData.map((active, idx) => (
                    <div key={idx} className={`aspect-square rounded ${active ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`} title={active ? "Actif" : "Inactif"} />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>Inactif</span>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-200 rounded-sm" />
                    <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                  </div>
                  <span>Actif</span>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div id="tuto-badges" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Badges récents</h3>
              <div className="grid grid-cols-3 gap-4">
                {badges.map((badge, idx) => (
                  <div key={idx} className={`text-center ${badge.unlocked ? "opacity-100" : "opacity-30 grayscale"}`}>
                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-2 ${badge.unlocked ? "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg" : "bg-gray-200 dark:bg-gray-700"}`}>
                      {badge.icon}
                    </div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{badge.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
              <h3 className="text-lg font-bold mb-4">📊 Statistiques</h3>
              <div className="space-y-3">
                {[
                  { label: "Cours", value: stats.cours },
                  { label: "Flashcards", value: stats.flashcards },
                  { label: "Sessions", value: stats.sessions },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm opacity-90">{label}</span>
                    <span className="text-xl font-bold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}