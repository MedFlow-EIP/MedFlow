import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  BookOpen, 
  Trophy, 
  Lock, 
  CheckCircle, 
  Star,
  ArrowLeft
} from "lucide-react";

export default function CoursePath() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [_user, setUser] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && courseId) {
        loadCourse(currentUser);
      }
    });
    return () => unsubscribe();
  }, [courseId]);

  const loadCourse = async (currentUser) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/course/${courseId}`, {
        headers: {
          "X-User-UID": currentUser.uid,
          "X-User-Name": currentUser.displayName || "",
          "X-User-Avatar": currentUser.photoURL || "",
        },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCourse(data);
    } catch (err) {
      console.error("Erreur chargement cours:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300">Cours introuvable</p>
        </div>
      </div>
    );
  }

  // Créer les checkpoints basés sur le contenu du cours
  const checkpoints = [
    { 
      id: 1, 
      type: "revision", 
      title: "Révision 1", 
      completed: course.sessions >= 1,
      stars: 3,
      icon: "🔄"
    },
    { 
      id: 2, 
      type: "lesson", 
      title: course.nom || "Leçon principale", 
      completed: course.sessions >= 2,
      stars: 3,
      icon: "📚"
    },
    { 
      id: 3, 
      type: "lesson", 
      title: "Approfondissement", 
      completed: course.sessions >= 3,
      stars: 0,
      icon: "📚",
      locked: course.sessions < 2
    },
    { 
      id: 4, 
      type: "test", 
      title: "Test 1", 
      completed: course.sessions >= 4,
      stars: 0,
      icon: "🏆",
      locked: course.sessions < 3
    },
    { 
      id: 5, 
      type: "lesson", 
      title: "Concepts avancés", 
      completed: course.sessions >= 5,
      stars: 0,
      icon: "📚",
      locked: course.sessions < 4
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-2xl mx-auto px-4">
        
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>
          
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Niveau {Math.floor((course.sessions || 0) / 2) + 1}
            </p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {course.nom}
            </h1>
          </div>
        </div>

        {/* Learning Path */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gray-200 dark:bg-gray-700 -z-10" />

          <div className="space-y-8 pb-20">
            {checkpoints.map((checkpoint, idx) => {
              const isLeft = idx % 2 === 0;
              const isCompleted = checkpoint.completed;
              const isLocked = checkpoint.locked;

              return (
                <div
                  key={checkpoint.id}
                  className={`flex items-center ${
                    isLeft ? "flex-row" : "flex-row-reverse"
                  } gap-8`}
                >
                  {/* Content Card */}
                  <div className={`flex-1 ${isLeft ? "text-right" : "text-left"}`}>
                    <div
                      className={`inline-block bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition cursor-pointer ${
                        isLocked ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      onClick={() => {
                        if (!isLocked) {
                          navigate(`/revision?mode=course&id=${courseId}`);
                        }
                      }}
                    >
                      <div className={`flex items-center gap-3 ${isLeft ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                          isCompleted 
                            ? "bg-gradient-to-br from-green-400 to-green-600"
                            : isLocked
                            ? "bg-gray-200 dark:bg-gray-700"
                            : "bg-gradient-to-br from-blue-400 to-blue-600"
                        }`}>
                          {isLocked ? "🔒" : checkpoint.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            {checkpoint.title}
                          </h3>
                          {checkpoint.stars > 0 && (
                            <div className={`flex gap-1 mt-1 ${isLeft ? "justify-end" : "justify-start"}`}>
                              {[...Array(checkpoint.stars)].map((_, i) => (
                                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Center Icon */}
                  <div className="relative z-10">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${
                      isCompleted
                        ? "bg-gradient-to-br from-green-400 to-green-600"
                        : isLocked
                        ? "bg-gray-300 dark:bg-gray-700"
                        : "bg-gradient-to-br from-blue-500 to-blue-600"
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-8 h-8 text-white" />
                      ) : isLocked ? (
                        <Lock className="w-8 h-8 text-gray-500" />
                      ) : checkpoint.type === "test" ? (
                        <Trophy className="w-8 h-8 text-white" />
                      ) : (
                        <BookOpen className="w-8 h-8 text-white" />
                      )}
                    </div>
                    
                    {/* Progress Ring for active checkpoint */}
                    {!isCompleted && !isLocked && (
                      <div className="absolute inset-0 -m-1">
                        <svg className="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="48"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray="60 240"
                            className="text-blue-400"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Spacer for alignment */}
                  <div className="flex-1" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Action */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => navigate(`/revision?mode=course&id=${courseId}`)}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition shadow-lg"
            >
              Continuer l'apprentissage
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}