import { useState, useRef, useEffect } from "react";
import { Upload, FileText, XCircle, Loader2 } from "lucide-react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function UploadCours() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizValidation, setQuizValidation] = useState(false);
  const [activeTab, setActiveTab] = useState("resume");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setData(null);
    setError(null);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setData(null);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    if (!user) {
      setError("Vous devez être connecté pour générer un cours.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("uid", user.uid);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/process`, {
        method: "POST",
        headers: {
          "X-User-UID": user.uid,
          "X-User-Name": user.displayName || "",
          "X-User-Avatar": user.photoURL || "",
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Erreur réseau ou serveur");
      }

      const result = await res.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setData({
        resume: result.summary,
        flashcards: result.flashcards,
        quiz: result.quiz,
        courseId: result.id,
        courseName: result.nom
      });

      setActiveTab("resume");
      setQuizAnswers({});
      setQuizValidation(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-6 flex justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-full max-w-3xl p-8">
        {/* Header */}
        <h2 className="text-3xl font-bold text-center text-blue-600 dark:text-blue-400 mb-2">
          Importer un document médical
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
          Téléversez vos cours en PDF pour générer automatiquement un résumé,
          des flashcards et des quiz interactifs.
        </p>

        {/* Zone upload */}
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-10 cursor-pointer hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
          <Upload className="w-10 h-10 text-blue-600 mb-2" />
          <span className="text-gray-700 dark:text-gray-300">
            {file ? "Changer le fichier" : "Glissez-déposez ou cliquez pour importer"}
          </span>
          <input type="file" accept="application/pdf" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
        </label>

        {/* Aperçu fichier */}
        {file && (
          <div className="mt-6 flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="text-blue-600" />
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button onClick={handleRemoveFile}>
              <XCircle className="text-red-500 hover:text-red-600 w-6 h-6" />
            </button>
          </div>
        )}

        {/* Bouton Générer */}
        {file && !data && (
          <div className="mt-8 text-center">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 mx-auto"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Générer le contenu"}
            </button>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="mt-6 text-center text-red-500 font-medium">
            {error}
          </div>
        )}

        {/* Tabs + Content */}
        {data && (
          <div className="mt-8">
            {/* Success message */}
            <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white text-sm">✓</span>
                </div>
                <span className="font-medium">Cours créé avec succès!</span>
              </div>
              <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                "{data.courseName}" a été ajouté à vos cours et est maintenant disponible sur votre tableau de bord.
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => window.location.href = "/dashboard"}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                >
                  Voir sur le tableau de bord
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    setData(null);
                    setError(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition text-sm"
                >
                  Ajouter un autre cours
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex justify-center gap-4 mb-6">
              {["resume", "flashcards", "quiz"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    activeTab === tab
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {tab === "resume" ? "Résumé" : tab === "flashcards" ? "Flashcards" : "Quiz"}
                </button>
              ))}
            </div>

            {/* Résumé */}
            {activeTab === "resume" && (
              <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg shadow text-gray-800 dark:text-gray-200 prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: data.resume }} />
              </div>
            )}

            {/* Flashcards */}
            {activeTab === "flashcards" && (
              <div className="grid grid-cols-1 gap-4">
                {data.flashcards.map((card, i) => (
                  <Flashcard key={i} question={card.question} answer={card.answer} />
                ))}
              </div>
            )}

            {/* Quiz */}
            {activeTab === "quiz" && (
              <Quiz
                quiz={data.quiz}
                quizAnswers={quizAnswers}
                setQuizAnswers={setQuizAnswers}
                quizValidation={quizValidation}
                setQuizValidation={setQuizValidation}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Flashcard({ question, answer }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="w-full h-40 cursor-pointer perspective"
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className={`relative w-full h-full transition-transform duration-700 preserve-3d ${
          flipped ? "rotate-y-180" : ""
        }`}
      >
        <div className="absolute w-full h-full flex items-center justify-center p-4 rounded-xl shadow bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium backface-hidden">
          {question}
        </div>
        <div className="absolute w-full h-full flex items-center justify-center p-4 rounded-xl shadow bg-blue-600 text-white font-medium backface-hidden rotate-y-180">
          {answer}
        </div>
      </div>
    </div>
  );
}

function Quiz({ quiz, quizAnswers, setQuizAnswers, quizValidation, setQuizValidation }) {
  return (
    <div className="space-y-6">
      {quiz.map((q, i) => (
        <div key={i} className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow">
          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-3">{q.question}</p>
          <div className="space-y-2">
            {Object.entries(q.options).map(([key, opt]) => {
              let style = "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
              if (quizValidation) {
                if (key === q.correct) style = "bg-green-500 text-white";
                else if (quizAnswers[i] === key) style = "bg-red-500 text-white";
              } else if (quizAnswers[i] === key) {
                style = "bg-blue-500 text-white";
              }

              return (
                <button
                  key={key}
                  onClick={() => !quizValidation && setQuizAnswers({ ...quizAnswers, [i]: key })}
                  className={`w-full px-4 py-2 rounded-lg text-left transition ${style}`}
                  disabled={quizValidation}
                >
                  {key}. {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!quizValidation && (
        <div className="text-center mt-6">
          <button
            onClick={() => setQuizValidation(true)}
            disabled={Object.keys(quizAnswers).length < quiz.length}
            className={`px-6 py-3 rounded-lg text-white ${
              Object.keys(quizAnswers).length < quiz.length
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            Valider toutes les réponses
          </button>
        </div>
      )}
    </div>
  );
}
