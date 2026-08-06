import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Flashcard from "../components/Flashcard";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function RevisionPage() {
  const [session, setSession] = useState(null);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("flashcards");
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [searchParams] = useSearchParams();
  const revisionMode = searchParams.get("mode") || "all";
  const courseId = searchParams.get("id");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    startSession();
  }, [authReady, user, revisionMode, courseId]);

  const startSession = () => {
    if (!user) return;
    setSession(null);
    setStep(0);
    setMode("flashcards");
    setScore(0);
    setAnswered(null);

    fetch(`${import.meta.env.VITE_API_URL}/api/revision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-UID": user.uid,
        "X-User-Name": user.displayName || "",
        "X-User-Avatar": user.photoURL || "",
      },
      body: JSON.stringify({
        mode: revisionMode,
        course_id: courseId,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setSession(data);
      })
      .catch(err => console.error("Erreur révision:", err));
  };

  const reportSessionCompletion = async () => {
    if (!user || !session) return;

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/session-done`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-UID": user.uid,
          "X-User-Name": user.displayName || "",
          "X-User-Avatar": user.photoURL || "",
        },
        body: JSON.stringify({
          mode: session.mode,
          course_id: session.course_id,
          score,
          total_questions: session.quiz?.length || 0,
        }),
      });
    } catch (err) {
      console.error("Erreur enregistrement session:", err);
    }
  };

  if (!session) return <p className="text-center mt-10">Chargement de la session...</p>;

  const handleFlashcard = () => {
    if (step + 1 < session.flashcards.length) {
      setStep(step + 1);
    } else {
      setStep(0);
      setMode("quiz");
    }
  };

  const handleAnswer = (choice, correct) => {
    setAnswered(choice);
    if (choice === correct) setScore(prev => prev + 1);
  };

  const nextQuestion = () => {
    if (step + 1 < session.quiz.length) {
      setStep(step + 1);
      setAnswered(null);
    } else {
      setMode("done");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-xl w-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        
        {/* 🔹 Flashcards */}
        {mode === "flashcards" && (
          <>
            <h2 className="text-xl font-bold mb-4">
              Flashcard {step + 1}/{session.flashcards.length}
            </h2>
            <Flashcard
              key={step}
              question={session.flashcards[step].question}
              answer={session.flashcards[step].answer}
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={handleFlashcard}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Suivant
              </button>
            </div>
          </>
        )}

        {/* 🔹 Quiz */}
        {mode === "quiz" && (
          <>
            <h2 className="text-xl font-bold mb-4">
              Question {step + 1}/{session.quiz.length}
            </h2>
            <p className="mb-3">{session.quiz[step].question}</p>
            <div className="space-y-2">
              {Object.entries(session.quiz[step].options).map(([key, opt]) => {
                let style = "w-full px-4 py-2 rounded-lg text-left bg-gray-200 dark:bg-gray-700";
                if (answered) {
                  if (key === session.quiz[step].correct) style = "w-full px-4 py-2 rounded-lg bg-green-500 text-white";
                  else if (answered === key) style = "w-full px-4 py-2 rounded-lg bg-red-500 text-white";
                }
                return (
                  <button
                    key={key}
                    onClick={() => !answered && handleAnswer(key, session.quiz[step].correct)}
                    className={style}
                    disabled={!!answered}
                  >
                    {key}. {opt}
                  </button>
                );
              })}
            </div>
            {answered && (
              <div className="flex justify-end mt-4">
                <button
                  onClick={nextQuestion}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}

        {/* 🔹 Fin */}
        {mode === "done" && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">🎉 Révision terminée !</h2>
            <p>Score : {score} / {session.quiz.length}</p>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={async () => {
                  await reportSessionCompletion();
                  startSession();
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg"
              >
                🔄 Faire une autre révision
              </button>
              <button
                onClick={async () => {
                  await reportSessionCompletion();
                  window.location.href="/dashboard";
                }}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg"
              >
                Retour au Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
