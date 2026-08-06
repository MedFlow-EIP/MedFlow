// Base de données de questions pour l'examen blanc médical
// Format: Blocs de 5 questions avec réponses multiples possibles

export const EXAM_QUESTIONS = [
  // BLOC 1 - Cardiologie
  {
    id: 1,
    bloc: 1,
    theme: "Cardiologie",
    question: "Concernant l'insuffisance cardiaque, quelles propositions sont exactes ?",
    options: {
      A: "La dyspnée d'effort est un signe précoce",
      B: "Les œdèmes des membres inférieurs sont toujours bilatéraux",
      C: "La fraction d'éjection du ventricule gauche est toujours < 40%",
      D: "Les diurétiques font partie du traitement de première ligne",
      E: "L'ECG est systématiquement normal"
    },
    correct: ["A", "B", "D"],
    explication: "La dyspnée d'effort est précoce, les œdèmes sont bilatéraux dans l'IC globale, et les diurétiques sont essentiels. La FEVG peut être préservée (IC à FEVG préservée) et l'ECG montre souvent des anomalies."
  },
  {
    id: 2,
    bloc: 1,
    theme: "Cardiologie",
    question: "Parmi les facteurs de risque cardiovasculaire suivants, lesquels sont modifiables ?",
    options: {
      A: "L'âge",
      B: "Le tabagisme",
      C: "L'hérédité",
      D: "L'hypertension artérielle",
      E: "La dyslipidémie"
    },
    correct: ["B", "D", "E"],
    explication: "Les facteurs modifiables incluent le tabagisme, l'HTA et la dyslipidémie. L'âge et l'hérédité sont non modifiables."
  },
  {
    id: 3,
    bloc: 1,
    theme: "Cardiologie",
    question: "Concernant l'infarctus du myocarde, quelles propositions sont vraies ?",
    options: {
      A: "La troponine est le marqueur le plus spécifique",
      B: "La douleur thoracique irradie typiquement vers le membre inférieur gauche",
      C: "L'aspirine doit être administrée en urgence",
      D: "Le sus-décalage du segment ST est toujours présent",
      E: "La coronarographie est l'examen de référence"
    },
    correct: ["A", "C", "E"],
    explication: "La troponine est très spécifique, l'aspirine est donnée en urgence, et la coronarographie est l'examen de référence. La douleur irradie au membre supérieur gauche et le sus-décalage n'est pas toujours présent (IDM sans sus-ST)."
  },
  {
    id: 4,
    bloc: 1,
    theme: "Cardiologie",
    question: "Les signes cliniques de l'embolie pulmonaire incluent :",
    options: {
      A: "Dyspnée brutale",
      B: "Douleur thoracique",
      C: "Hémoptysie",
      D: "Fièvre élevée constante",
      E: "Tachycardie"
    },
    correct: ["A", "B", "C", "E"],
    explication: "L'EP se manifeste par dyspnée, douleur thoracique, hémoptysie et tachycardie. La fièvre n'est pas un signe constant."
  },
  {
    id: 5,
    bloc: 1,
    theme: "Cardiologie",
    question: "Parmi les examens suivants, lesquels sont utiles pour le diagnostic d'HTA ?",
    options: {
      A: "Mesure ambulatoire de la pression artérielle (MAPA)",
      B: "Automesure tensionnelle",
      C: "Échographie cardiaque systématique",
      D: "Mesure au cabinet médical répétée",
      E: "IRM cérébrale systématique"
    },
    correct: ["A", "B", "D"],
    explication: "Le diagnostic d'HTA repose sur MAPA, automesure et mesures répétées au cabinet. L'échographie et l'IRM ne sont pas systématiques pour le diagnostic."
  },

  // BLOC 2 - Pneumologie
  {
    id: 6,
    bloc: 2,
    theme: "Pneumologie",
    question: "Concernant l'asthme, quelles affirmations sont correctes ?",
    options: {
      A: "C'est une maladie inflammatoire chronique des voies aériennes",
      B: "Les bêta-2 mimétiques de courte durée sont le traitement de fond",
      C: "Le DEP (débit expiratoire de pointe) est diminué lors des crises",
      D: "Les corticoïdes inhalés sont le traitement de fond de référence",
      E: "L'obstruction bronchique est irréversible"
    },
    correct: ["A", "C", "D"],
    explication: "L'asthme est inflammatoire chronique avec DEP diminué en crise. Les corticoïdes inhalés sont le traitement de fond. Les bêta-2 mimétiques sont pour les crises et l'obstruction est réversible."
  },
  {
    id: 7,
    bloc: 2,
    theme: "Pneumologie",
    question: "Les signes de gravité d'une crise d'asthme incluent :",
    options: {
      A: "Impossibilité de parler",
      B: "Fréquence respiratoire > 30/min",
      C: "DEP < 50% de la valeur théorique",
      D: "Silence auscultatoire",
      E: "Toux productive"
    },
    correct: ["A", "B", "C", "D"],
    explication: "Les signes de gravité sont : impossibilité de parler, FR>30, DEP<50%, et silence auscultatoire. La toux n'est pas un critère de gravité."
  },
  {
    id: 8,
    bloc: 2,
    theme: "Pneumologie",
    question: "Concernant la BPCO (Bronchopneumopathie Chronique Obstructive) :",
    options: {
      A: "Le tabagisme en est la principale cause",
      B: "Le rapport VEMS/CV est augmenté",
      C: "L'oxygénothérapie de longue durée améliore le pronostic",
      D: "La réversibilité à l'épreuve aux bronchodilatateurs est complète",
      E: "La vaccination antigrippale est recommandée"
    },
    correct: ["A", "C", "E"],
    explication: "La BPCO est liée au tabac, l'O2 longue durée améliore le pronostic, et la vaccination est recommandée. Le rapport VEMS/CV est diminué et la réversibilité est incomplète."
  },
  {
    id: 9,
    bloc: 2,
    theme: "Pneumologie",
    question: "Les indications de l'antibiothérapie dans l'exacerbation de BPCO sont :",
    options: {
      A: "Augmentation de la dyspnée",
      B: "Augmentation du volume de l'expectoration",
      C: "Purulence de l'expectoration",
      D: "Fièvre isolée",
      E: "Présence des 3 critères d'Anthonisen"
    },
    correct: ["C", "E"],
    explication: "L'antibiothérapie est indiquée si purulence de l'expectoration ou présence des 3 critères d'Anthonisen (dyspnée + volume + purulence)."
  },
  {
    id: 10,
    bloc: 2,
    theme: "Pneumologie",
    question: "Le diagnostic de pneumonie communautaire repose sur :",
    options: {
      A: "La présence d'un foyer de crépitants",
      B: "La radiographie thoracique",
      C: "La présence de fièvre",
      D: "L'hémoculture systématique",
      E: "Les signes cliniques et radiologiques"
    },
    correct: ["B", "E"],
    explication: "Le diagnostic repose sur la clinique ET la radiographie thoracique. Les hémocultures ne sont pas systématiques."
  },

  // BLOC 3 - Neurologie
  {
    id: 11,
    bloc: 3,
    theme: "Neurologie",
    question: "Concernant l'accident vasculaire cérébral (AVC) ischémique :",
    options: {
      A: "La thrombolyse est possible jusqu'à 4h30",
      B: "L'IRM cérébrale est l'examen de référence",
      C: "L'aspirine doit être débutée en urgence",
      D: "La tension artérielle doit être normalisée immédiatement",
      E: "La thrombectomie mécanique peut être proposée"
    },
    correct: ["A", "B", "E"],
    explication: "La thrombolyse est possible jusqu'à 4h30, l'IRM est l'examen de référence, et la thrombectomie peut être proposée. L'aspirine n'est pas urgente si thrombolyse envisagée, et l'HTA ne doit pas être normalisée brutalement."
  },
  {
    id: 12,
    bloc: 3,
    theme: "Neurologie",
    question: "Les signes de gravité d'une méningite bactérienne sont :",
    options: {
      A: "Purpura fulminans",
      B: "Troubles de la conscience",
      C: "Céphalées isolées",
      D: "Convulsions",
      E: "Signes de localisation"
    },
    correct: ["A", "B", "D", "E"],
    explication: "Les signes de gravité incluent purpura, troubles conscience, convulsions et signes de localisation. Les céphalées isolées ne sont pas un signe de gravité."
  },
  {
    id: 13,
    bloc: 3,
    theme: "Neurologie",
    question: "Dans la maladie de Parkinson :",
    options: {
      A: "Le tremblement de repos est caractéristique",
      B: "L'akinésie est un signe cardinal",
      C: "Le traitement par L-dopa est curatif",
      D: "L'hypertonie est de type spastique",
      E: "L'instabilité posturale apparaît tardivement"
    },
    correct: ["A", "B", "E"],
    explication: "Parkinson : tremblement de repos, akinésie et instabilité posturale tardive sont caractéristiques. La L-dopa est symptomatique (non curatif) et l'hypertonie est plastique (pas spastique)."
  },
  {
    id: 14,
    bloc: 3,
    theme: "Neurologie",
    question: "Les critères diagnostiques de la sclérose en plaques incluent :",
    options: {
      A: "Dissémination spatiale des lésions",
      B: "Dissémination temporelle des poussées",
      C: "Présence de bandes oligoclonales dans le LCR",
      D: "Atteinte pyramidale isolée suffisante",
      E: "Lésions de la substance blanche à l'IRM"
    },
    correct: ["A", "B", "C", "E"],
    explication: "Le diagnostic repose sur dissémination spatio-temporelle, bandes oligoclonales et lésions IRM. Une atteinte isolée n'est pas suffisante."
  },
  {
    id: 15,
    bloc: 3,
    theme: "Neurologie",
    question: "Concernant les céphalées :",
    options: {
      A: "La migraine est toujours unilatérale",
      B: "L'algie vasculaire de la face touche surtout les femmes",
      C: "Les céphalées de tension sont bilatérales",
      D: "Une céphalée brutale en coup de tonnerre doit faire évoquer une HSA",
      E: "Le sumatriptan est efficace dans la migraine"
    },
    correct: ["C", "D", "E"],
    explication: "Les céphalées de tension sont bilatérales, la céphalée brutale évoque une HSA, et le sumatriptan est efficace. La migraine peut être bilatérale et l'AVF touche surtout les hommes."
  },

  // BLOC 4 - Gastro-entérologie
  {
    id: 16,
    bloc: 4,
    theme: "Gastro-entérologie",
    question: "Les facteurs de risque de l'ulcère gastroduodénal sont :",
    options: {
      A: "Helicobacter pylori",
      B: "AINS",
      C: "Tabagisme",
      D: "Stress émotionnel seul",
      E: "Aspirine à faible dose"
    },
    correct: ["A", "B", "C", "E"],
    explication: "H. pylori, AINS, tabac et aspirine sont des facteurs de risque. Le stress seul n'est pas un facteur direct."
  },
  {
    id: 17,
    bloc: 4,
    theme: "Gastro-entérologie",
    question: "Concernant la cirrhose hépatique :",
    options: {
      A: "L'alcool est la première cause en France",
      B: "L'ascite est un signe de décompensation",
      C: "Le carcinome hépatocellulaire est une complication",
      D: "La biopsie hépatique est systématiquement nécessaire",
      E: "Les varices œsophagiennes peuvent se rompre"
    },
    correct: ["A", "B", "C", "E"],
    explication: "L'alcool est la 1ère cause, l'ascite signe la décompensation, le CHC est une complication, et les varices peuvent se rompre. La biopsie n'est pas systématique."
  },
  {
    id: 18,
    bloc: 4,
    theme: "Gastro-entérologie",
    question: "Les indications de coloscopie incluent :",
    options: {
      A: "Rectorragies",
      B: "Dépistage du cancer colorectal après 50 ans",
      C: "Constipation simple",
      D: "Anémie ferriprive inexpliquée",
      E: "Surveillance des polypes adénomateux"
    },
    correct: ["A", "B", "D", "E"],
    explication: "La coloscopie est indiquée pour rectorragies, dépistage, anémie ferriprive et surveillance polypes. Pas pour constipation simple."
  },
  {
    id: 19,
    bloc: 4,
    theme: "Gastro-entérologie",
    question: "Dans la maladie de Crohn :",
    options: {
      A: "L'atteinte peut toucher tout le tube digestif",
      B: "Les lésions sont continues",
      C: "Les fistules sont fréquentes",
      D: "Le tabac est un facteur protecteur",
      E: "Les anti-TNF alpha peuvent être utilisés"
    },
    correct: ["A", "C", "E"],
    explication: "Crohn : atteinte pan-digestive possible, fistules fréquentes, anti-TNF utilisables. Les lésions sont discontinues et le tabac est délétère."
  },
  {
    id: 20,
    bloc: 4,
    theme: "Gastro-entérologie",
    question: "Les signes de pancréatite aiguë grave sont :",
    options: {
      A: "Score de Ranson ≥ 3",
      B: "Nécrose pancréatique étendue au scanner",
      C: "Amylasémie > 3N",
      D: "Défaillance d'organe",
      E: "Hypocalcémie"
    },
    correct: ["A", "B", "D"],
    explication: "Gravité si Ranson ≥3, nécrose étendue, défaillance organe. L'amylasémie et l'hypocalcémie ne sont pas des critères de gravité."
  }
];

// Fonction pour calculer le score d'un bloc
export const calculateBlocScore = (userAnswers, correctAnswers) => {
  // Compter les erreurs
  let errors = 0;
  
  // Vérifier chaque option
  const allOptions = ['A', 'B', 'C', 'D', 'E'];
  allOptions.forEach(option => {
    const userSelected = userAnswers.includes(option);
    const shouldBeSelected = correctAnswers.includes(option);
    
    if (userSelected !== shouldBeSelected) {
      errors++;
    }
  });
  
  // Système de notation :
  // 0 erreur = 5 points
  // 1 erreur = 2.5 points
  // 2+ erreurs = 0 points
  if (errors === 0) return 5;
  if (errors === 1) return 2.5;
  return 0;
};

// Fonction pour obtenir les questions d'un bloc
export const getBlocQuestions = (blocNumber) => {
  return EXAM_QUESTIONS.filter(q => q.bloc === blocNumber);
};

// Fonction pour obtenir tous les blocs
export const getAllBlocs = () => {
  const blocs = {};
  EXAM_QUESTIONS.forEach(q => {
    if (!blocs[q.bloc]) {
      blocs[q.bloc] = [];
    }
    blocs[q.bloc].push(q);
  });
  return blocs;
};

// Nombre total de blocs
export const TOTAL_BLOCS = Math.max(...EXAM_QUESTIONS.map(q => q.bloc));
