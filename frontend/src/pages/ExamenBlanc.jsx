import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Award,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Home
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { 
  EXAM_QUESTIONS, 
  calculateBlocScore, 
  getBlocQuestions,
  TOTAL_BLOCS 
} from "../utils/examQuestions";

export default function ExamenBlanc() {
  const navigate = useNavigate();
  const [currentBloc, setCurrentBloc] = useState(1);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [blocResults, setBlocResults] = useState({});
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [examStarted, setExamStarted] = useState(false);

  // Timer
  useEffect(() => {
    if (!examStarted || showResults) return;
    
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [examStarted, showResults]);

  // Format du temps
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Démarrer l'examen
  const startExam = () => {
    setExamStarted(true);
    setTimeElapsed(0);
  };

  // Gérer la sélection d'une réponse
  const handleAnswerToggle = (questionId, option) => {
    setUserAnswers(prev => {
      const currentAnswers = prev[questionId] || [];
      const newAnswers = currentAnswers.includes(option)
        ? currentAnswers.filter(a => a !== option)
        : [...currentAnswers, option];
      
      return {
        ...prev,
        [questionId]: newAnswers
      };
    });
  };

  // Vérifier si toutes les questions du bloc sont répondues
  const isBlocComplete = (blocNumber) => {
    const blocQuestions = getBlocQuestions(blocNumber);
    return blocQuestions.every(q => userAnswers[q.id] && userAnswers[q.id].length > 0);
  };

  // Naviguer vers le bloc suivant
  const goToNextBloc = () => {
    if (currentBloc < TOTAL_BLOCS) {
      setCurrentBloc(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  // Naviguer vers le bloc précédent
  const goToPreviousBloc = () => {
    if (currentBloc > 1) {
      setCurrentBloc(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  // Calculer les résultats
  const calculateResults = () => {
    const results = {};
    
    for (let blocNum = 1; blocNum <= TOTAL_BLOCS; blocNum++) {
      const blocQuestions = getBlocQuestions(blocNum);
      const blocAnswers = blocQuestions.map(q => userAnswers[q.id] || []);
      const correctAnswers = blocQuestions.map(q => q.correct);
      
      // Calculer le score du bloc (sur 5 points)
      const score = calculateBlocScore(
        blocAnswers.flat(),
        correctAnswers.flat()
      );
      
      results[blocNum] = {
        score,
        userAnswers: blocAnswers,
        correctAnswers
      };
    }
    
    setBlocResults(results);
    setShowResults(true);
  };

  // Calculer le score total
  const getTotalScore = () => {
    return Object.values(blocResults).reduce((sum, result) => sum + result.score, 0);
  };

  const getMaxScore = () => {
    return TOTAL_BLOCS * 5;
  };

  const getPercentage = () => {
    return Math.round((getTotalScore() / getMaxScore()) * 100);
  };

  const currentBlocQuestions = getBlocQuestions(currentBloc);

  // Page d'accueil de l'examen
  if (!examStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Examen Blanc Médical
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              QCM à réponses multiples
            </p>
          </div>

          <div className="space-y-6 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
              <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Format de l'examen
              </h3>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span><strong>{TOTAL_BLOCS} blocs</strong> de 5 questions (QCM)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Chaque question peut avoir <strong>plusieurs réponses correctes</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Total : <strong>{TOTAL_BLOCS * 5} questions</strong></span>
                </li>
              </ul>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
              <h3 className="font-bold text-purple-900 dark:text-purple-300 mb-3 flex items-center gap-2">
                <Award className="w-5 h-5" />
                Système de notation (par bloc de 5 questions)
              </h3>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span><strong>0 erreur</strong> = 5 points</span>
                </li>
                <li className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <span><strong>1 erreur</strong> = 2.5 points</span>
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span><strong>2+ erreurs</strong> = 0 point</span>
                </li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 italic">
                Une erreur = une réponse cochée à tort OU non cochée à tort
              </p>
            </div>

            <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 text-center">
              <p className="text-gray-700 dark:text-gray-300">
                Score maximum : <span className="font-bold text-2xl text-indigo-600 dark:text-indigo-400">{getMaxScore()} points</span>
              </p>
            </div>
          </div>

          <button
            onClick={startExam}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition shadow-lg text-lg"
          >
            Commencer l'examen
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            className="w-full mt-3 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Retour au tableau de bord
          </button>
        </motion.div>
      </div>
    );
  }

  // Page des résultats
  if (showResults) {
    const totalScore = getTotalScore();
    const maxScore = getMaxScore();
    const percentage = getPercentage();

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-10 px-6">
        <div className="max-w-4xl mx-auto">
          
          {/* Header des résultats */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 mb-6"
          >
            <div className="text-center mb-6">
              <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 ${
                percentage >= 75 
                  ? "bg-gradient-to-br from-green-400 to-emerald-500"
                  : percentage >= 50
                  ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                  : "bg-gradient-to-br from-red-400 to-pink-500"
              }`}>
                <Award className="w-12 h-12 text-white" />
              </div>
              
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Résultats de l'examen
              </h1>
              
              <div className="flex items-center justify-center gap-4 text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>{formatTime(timeElapsed)}</span>
                </div>
              </div>
            </div>

            {/* Score global */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white text-center mb-6">
              <div className="text-6xl font-bold mb-2">
                {totalScore}/{maxScore}
              </div>
              <div className="text-2xl font-semibold mb-1">
                {percentage}%
              </div>
              <div className="text-sm opacity-90">
                {percentage >= 75 
                  ? "🎉 Excellent !"
                  : percentage >= 50
                  ? "👍 Bien, continuez !"
                  : "💪 Il faut réviser"}
              </div>
            </div>

            {/* Détail par bloc */}
            <div className="space-y-3">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-3">
                Détail par bloc :
              </h3>
              {Object.entries(blocResults).map(([blocNum, result]) => {
                const blocQuestions = getBlocQuestions(parseInt(blocNum));
                const theme = blocQuestions[0]?.theme || "Bloc " + blocNum;
                
                return (
                  <div
                    key={blocNum}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${
                        result.score === 5
                          ? "bg-green-500"
                          : result.score === 2.5
                          ? "bg-orange-500"
                          : "bg-red-500"
                      }`}>
                        {blocNum}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {theme}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          5 questions
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {result.score}/5
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Corrections détaillées */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 mb-6"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              📚 Corrections détaillées
            </h2>

            {EXAM_QUESTIONS.map((question, idx) => {
              const userAnswer = userAnswers[question.id] || [];
              const isCorrect = JSON.stringify([...userAnswer].sort()) === JSON.stringify([...question.correct].sort());

              return (
                <div key={question.id} className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700 last:border-0">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCorrect 
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-red-100 dark:bg-red-900/30"
                    }`}>
                      {isCorrect 
                        ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        : <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      }
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Bloc {question.bloc} - Question {(idx % 5) + 1}
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white mb-3">
                        {question.question}
                      </p>

                      <div className="space-y-2 mb-3">
                        {Object.entries(question.options).map(([key, value]) => {
                          const isUserSelected = userAnswer.includes(key);
                          const shouldBeSelected = question.correct.includes(key);
                          const isWrong = isUserSelected !== shouldBeSelected;

                          return (
                            <div
                              key={key}
                              className={`p-3 rounded-lg ${
                                shouldBeSelected
                                  ? "bg-green-100 dark:bg-green-900/30 border-2 border-green-500"
                                  : isUserSelected && isWrong
                                  ? "bg-red-100 dark:bg-red-900/30 border-2 border-red-500"
                                  : "bg-gray-50 dark:bg-gray-700"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="font-bold">{key}.</span>
                                <span className="flex-1">{value}</span>
                                {shouldBeSelected && (
                                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                )}
                                {isUserSelected && isWrong && (
                                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <strong className="text-blue-600 dark:text-blue-400">💡 Explication :</strong>{" "}
                          {question.explication}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Boutons d'action */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setExamStarted(false);
                setCurrentBloc(1);
                setUserAnswers({});
                setShowResults(false);
                setBlocResults({});
                setTimeElapsed(0);
                window.scrollTo(0, 0);
              }}
              className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition shadow-lg"
            >
              🔄 Refaire l'examen
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex-1 py-4 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow border-2 border-gray-200 dark:border-gray-600"
            >
              <Home className="w-5 h-5 inline mr-2" />
              Tableau de bord
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Page de l'examen en cours
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-10 px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header avec progression */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Bloc {currentBloc}/{TOTAL_BLOCS}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {currentBlocQuestions[0]?.theme}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/30 px-4 py-2 rounded-full">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {formatTime(timeElapsed)}
              </span>
            </div>
          </div>

          {/* Barre de progression */}
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300"
              style={{ width: `${(currentBloc / TOTAL_BLOCS) * 100}%` }}
            />
          </div>
        </div>

        {/* Questions du bloc */}
        <div className="space-y-6 mb-6">
          {currentBlocQuestions.map((question, idx) => (
            <motion.div
              key={question.id}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {question.question}
                  </p>

                  <div className="space-y-2">
                    {Object.entries(question.options).map(([key, value]) => {
                      const isSelected = (userAnswers[question.id] || []).includes(key);

                      return (
                        <button
                          key={key}
                          onClick={() => handleAnswerToggle(question.id, key)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30"
                              : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-600"
                                : "border-gray-300 dark:border-gray-600"
                            }`}>
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-white" fill="white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <span className="font-bold text-gray-900 dark:text-white mr-2">
                                {key}.
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {value}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-4">
          <button
            onClick={goToPreviousBloc}
            disabled={currentBloc === 1}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Bloc précédent
          </button>

          {currentBloc < TOTAL_BLOCS ? (
            <button
              onClick={goToNextBloc}
              disabled={!isBlocComplete(currentBloc)}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Bloc suivant
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={calculateResults}
              disabled={!isBlocComplete(currentBloc)}
              className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Award className="w-5 h-5" />
              Voir mes résultats
            </button>
          )}
        </div>

        {/* Indicateur de réponses manquantes */}
        {!isBlocComplete(currentBloc) && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl">
            <p className="text-yellow-800 dark:text-yellow-300 text-center">
              ⚠️ Répondez à toutes les questions du bloc pour continuer
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
