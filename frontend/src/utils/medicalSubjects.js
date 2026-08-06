// Configuration des matières médicales pour MedFlow
// Version améliorée avec détection automatique par mots-clés

export const MEDICAL_SUBJECTS = {
  anatomie: {
    id: "anatomie",
    nom: "Anatomie",
    description: "Système squelettique, musculaire et organes",
    icon: "🦴",
    color: "from-blue-400 to-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
    colorHex: "#2563eb",
    colorLightHex: "#eff6ff",
    colorBorderHex: "#bfdbfe",
    keywords: ["anatomie", "os", "muscle", "ligament", "tendon", "articulation", "squelette", "morphologie", "tissu", "organe", "cavité", "membre", "colonne", "vertèbre", "thorax", "bassin"],
  },
  cardiologie: {
    id: "cardiologie",
    nom: "Cardiologie",
    description: "Système cardiovasculaire et pathologies",
    icon: "❤️",
    color: "from-red-400 to-red-600",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    textColor: "text-red-600 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800",
    colorHex: "#dc2626",
    colorLightHex: "#fef2f2",
    colorBorderHex: "#fca5a5",
    keywords: ["cardio", "cœur", "coeur", "cardiaque", "artère", "artere", "ventricule", "aorte", "infarctus", "ecg", "arythmie", "coronaire", "hypertension", "insuffisance cardiaque", "valve", "palpitation", "tachycardie", "fibrillation"],
  },
  neurologie: {
    id: "neurologie",
    nom: "Neurologie",
    description: "Système nerveux et fonctions cérébrales",
    icon: "🧠",
    color: "from-purple-400 to-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-800",
    colorHex: "#7c3aed",
    colorLightHex: "#faf5ff",
    colorBorderHex: "#c4b5fd",
    keywords: ["neuro", "cerveau", "nerveux", "neurone", "synapse", "avc", "épilepsie", "epilepsie", "parkinson", "alzheimer", "sclérose", "sclerose", "moelle", "réflexe", "reflexe", "conscience", "coma", "méningite", "meningite", "démence", "demence"],
  },
  pharmacologie: {
    id: "pharmacologie",
    nom: "Pharmacologie",
    description: "Médicaments et leurs actions",
    icon: "💊",
    color: "from-yellow-400 to-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    textColor: "text-yellow-600 dark:text-yellow-400",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    colorHex: "#d97706",
    colorLightHex: "#fffbeb",
    colorBorderHex: "#fde68a",
    keywords: ["pharma", "médicament", "medicament", "drogue", "posologie", "pharmacocinétique", "pharmacocinetique", "récepteur", "recepteur", "agoniste", "antagoniste", "biodisponibilité", "biodisponibilite", "adme", "dose", "effets indésirables", "interactions"],
  },
  pneumologie: {
    id: "pneumologie",
    nom: "Pneumologie",
    description: "Système respiratoire",
    icon: "🫁",
    color: "from-cyan-400 to-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
    textColor: "text-cyan-600 dark:text-cyan-400",
    borderColor: "border-cyan-200 dark:border-cyan-800",
    colorHex: "#0891b2",
    colorLightHex: "#ecfeff",
    colorBorderHex: "#a5f3fc",
    keywords: ["pneumo", "poumon", "respiratoire", "respiration", "bronche", "asthme", "bpco", "plèvre", "plevre", "pneumonie", "tuberculose", "oxygène", "ventilation", "spirométrie", "emphysème", "emphyseme", "apnée", "apnee"],
  },
  gastroenterologie: {
    id: "gastroenterologie",
    nom: "Gastro-entérologie",
    description: "Système digestif",
    icon: "🔬",
    color: "from-orange-400 to-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-200 dark:border-orange-800",
    colorHex: "#ea580c",
    colorLightHex: "#fff7ed",
    colorBorderHex: "#fdba74",
    keywords: ["gastro", "digestif", "intestin", "foie", "pancréas", "pancreas", "estomac", "colon", "rectum", "hépatite", "hepatite", "cirrhose", "ulcère", "ulcere", "crohn", "rgo", "endoscopie", "bile", "vésicule", "vesicule"],
  },
  endocrinologie: {
    id: "endocrinologie",
    nom: "Endocrinologie",
    description: "Système hormonal et métabolisme",
    icon: "⚗️",
    color: "from-pink-400 to-pink-600",
    bgColor: "bg-pink-50 dark:bg-pink-900/20",
    textColor: "text-pink-600 dark:text-pink-400",
    borderColor: "border-pink-200 dark:border-pink-800",
    colorHex: "#db2777",
    colorLightHex: "#fdf2f8",
    colorBorderHex: "#f9a8d4",
    keywords: ["endocrino", "hormone", "thyroïde", "thyroide", "diabète", "diabete", "insuline", "cortisol", "surrénale", "surrenale", "hypophyse", "métabolisme", "metabolisme", "glycémie", "glycemie", "obésité", "obesite"],
  },
  nephrologie: {
    id: "nephrologie",
    nom: "Néphrologie",
    description: "Système rénal et urinaire",
    icon: "💧",
    color: "from-teal-400 to-teal-600",
    bgColor: "bg-teal-50 dark:bg-teal-900/20",
    textColor: "text-teal-600 dark:text-teal-400",
    borderColor: "border-teal-200 dark:border-teal-800",
    colorHex: "#0d9488",
    colorLightHex: "#f0fdfa",
    colorBorderHex: "#99f6e4",
    keywords: ["néphro", "nephro", "rein", "urée", "uree", "créatinine", "creatinine", "dialyse", "glomérule", "glomerule", "néphrite", "nephrite", "rénale", "renale", "diurèse", "protéinurie", "proteinurie"],
  },
  hematologie: {
    id: "hematologie",
    nom: "Hématologie",
    description: "Sang et système immunitaire",
    icon: "🩸",
    color: "from-rose-400 to-rose-600",
    bgColor: "bg-rose-50 dark:bg-rose-900/20",
    textColor: "text-rose-600 dark:text-rose-400",
    borderColor: "border-rose-200 dark:border-rose-800",
    colorHex: "#e11d48",
    colorLightHex: "#fff1f2",
    colorBorderHex: "#fda4af",
    keywords: ["hémato", "hemato", "sang", "globule", "leucocyte", "érythrocyte", "erythrocyte", "plaquette", "anémie", "anemie", "leucémie", "leucemie", "lymphome", "coagulation", "thrombose", "hémoglobine", "hemoglobine"],
  },
  infectiologie: {
    id: "infectiologie",
    nom: "Infectiologie",
    description: "Maladies infectieuses et microbiologie",
    icon: "🦠",
    color: "from-green-400 to-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    textColor: "text-green-600 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-800",
    colorHex: "#16a34a",
    colorLightHex: "#f0fdf4",
    colorBorderHex: "#86efac",
    keywords: ["infectio", "infection", "bactérie", "bacterie", "virus", "antibiotique", "sepsis", "vih", "sida", "paludisme", "tuberculose", "fièvre", "fievre", "microbiologie", "pathogène", "pathogene", "vaccin", "immunité", "immunite"],
  },
  pediatrie: {
    id: "pediatrie",
    nom: "Pédiatrie",
    description: "Médecine de l'enfant",
    icon: "👶",
    color: "from-indigo-400 to-indigo-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
    textColor: "text-indigo-600 dark:text-indigo-400",
    borderColor: "border-indigo-200 dark:border-indigo-800",
    colorHex: "#4338ca",
    colorLightHex: "#eef2ff",
    colorBorderHex: "#a5b4fc",
    keywords: ["pédiatrie", "pediatrie", "enfant", "nourrisson", "nouveau-né", "nouveau-ne", "neonatal", "croissance", "vaccinations", "puberté", "puberte"],
  },
  gynecologie: {
    id: "gynecologie",
    nom: "Gynécologie",
    description: "Santé de la femme",
    icon: "🤰",
    color: "from-fuchsia-400 to-fuchsia-600",
    bgColor: "bg-fuchsia-50 dark:bg-fuchsia-900/20",
    textColor: "text-fuchsia-600 dark:text-fuchsia-400",
    borderColor: "border-fuchsia-200 dark:border-fuchsia-800",
    colorHex: "#a21caf",
    colorLightHex: "#fdf4ff",
    colorBorderHex: "#f0abfc",
    keywords: ["gynéco", "gyneco", "obstétrique", "obstetrique", "grossesse", "utérus", "uterus", "ovaire", "menstruation", "ménopause", "menopause", "accouchement", "foetus", "fœtus"],
  },
  psychiatrie: {
    id: "psychiatrie",
    nom: "Psychiatrie",
    description: "Santé mentale",
    icon: "🧘",
    color: "from-violet-400 to-violet-600",
    bgColor: "bg-violet-50 dark:bg-violet-900/20",
    textColor: "text-violet-600 dark:text-violet-400",
    borderColor: "border-violet-200 dark:border-violet-800",
    colorHex: "#6d28d9",
    colorLightHex: "#f5f3ff",
    colorBorderHex: "#c4b5fd",
    keywords: ["psychiatrie", "psychose", "dépression", "depression", "anxiété", "anxiete", "schizophrénie", "schizophrenie", "trouble bipolaire", "tdah", "autisme", "psychotrope", "antidépresseur", "antidepresseur"],
  },
  dermatologie: {
    id: "dermatologie",
    nom: "Dermatologie",
    description: "Peau et phanères",
    icon: "🧴",
    color: "from-amber-400 to-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-200 dark:border-amber-800",
    colorHex: "#b45309",
    colorLightHex: "#fffbeb",
    colorBorderHex: "#fcd34d",
    keywords: ["dermato", "peau", "cutané", "cutane", "éruption", "eruption", "eczéma", "eczema", "psoriasis", "mélanome", "melanome", "acné", "acne", "urticaire", "cicatrice"],
  },
  ophtalmologie: {
    id: "ophtalmologie",
    nom: "Ophtalmologie",
    description: "Vision et système oculaire",
    icon: "👁️",
    color: "from-sky-400 to-sky-600",
    bgColor: "bg-sky-50 dark:bg-sky-900/20",
    textColor: "text-sky-600 dark:text-sky-400",
    borderColor: "border-sky-200 dark:border-sky-800",
    colorHex: "#0284c7",
    colorLightHex: "#f0f9ff",
    colorBorderHex: "#bae6fd",
    keywords: ["ophtalmo", "œil", "oeil", "vision", "rétine", "retine", "cornée", "cornee", "glaucome", "cataracte", "myopie", "astigmatisme", "fond d'œil"],
  },
  orl: {
    id: "orl",
    nom: "ORL",
    description: "Oreille, nez et gorge",
    icon: "👂",
    color: "from-lime-400 to-lime-600",
    bgColor: "bg-lime-50 dark:bg-lime-900/20",
    textColor: "text-lime-600 dark:text-lime-400",
    borderColor: "border-lime-200 dark:border-lime-800",
    colorHex: "#65a30d",
    colorLightHex: "#f7fee7",
    colorBorderHex: "#bef264",
    keywords: ["orl", "oreille", "nez", "gorge", "sinus", "amygdale", "larynx", "pharynx", "surdité", "surdite", "otite", "rhinite", "sinusite", "vertiges"],
  },
  rhumatologie: {
    id: "rhumatologie",
    nom: "Rhumatologie",
    description: "Articulations et maladies osseuses",
    icon: "🦴",
    color: "from-slate-400 to-slate-600",
    bgColor: "bg-slate-50 dark:bg-slate-900/20",
    textColor: "text-slate-600 dark:text-slate-400",
    borderColor: "border-slate-200 dark:border-slate-800",
    colorHex: "#475569",
    colorLightHex: "#f8fafc",
    colorBorderHex: "#cbd5e1",
    keywords: ["rhumato", "arthrite", "arthrose", "polyarthrite", "lupus", "ostéoporose", "osteoporose", "goutte", "spondylarthrite", "inflammation articulaire", "fibromyalgie"],
  },
  urgences: {
    id: "urgences",
    nom: "Médecine d'urgence",
    description: "Soins d'urgence et réanimation",
    icon: "🚑",
    color: "from-red-500 to-orange-600",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    textColor: "text-red-600 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800",
    colorHex: "#dc2626",
    colorLightHex: "#fef2f2",
    colorBorderHex: "#fca5a5",
    keywords: ["urgence", "réanimation", "reanimation", "trauma", "choc", "arrêt cardiaque", "arret cardiaque", "détresse", "detresse", "triage", "smur", "secours"],
  },
  radiologie: {
    id: "radiologie",
    nom: "Radiologie",
    description: "Imagerie médicale",
    icon: "📡",
    color: "from-gray-400 to-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-900/20",
    textColor: "text-gray-600 dark:text-gray-400",
    borderColor: "border-gray-200 dark:border-gray-800",
    colorHex: "#4b5563",
    colorLightHex: "#f9fafb",
    colorBorderHex: "#d1d5db",
    keywords: ["radio", "imagerie", "scanner", "irm", "échographie", "echographie", "rayons", "scintigraphie", "pet scan", "tomographie", "doppler"],
  },
  chirurgie: {
    id: "chirurgie",
    nom: "Chirurgie",
    description: "Interventions chirurgicales",
    icon: "⚕️",
    color: "from-emerald-400 to-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    textColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    colorHex: "#059669",
    colorLightHex: "#ecfdf5",
    colorBorderHex: "#6ee7b7",
    keywords: ["chirurgie", "opération", "operation", "bloc opératoire", "anesthésie", "anesthesie", "incision", "suture", "laparoscopie", "appendicite", "hernie"],
  },
  autre: {
    id: "autre",
    nom: "Autre",
    description: "Autres spécialités médicales",
    icon: "📚",
    color: "from-zinc-400 to-zinc-600",
    bgColor: "bg-zinc-50 dark:bg-zinc-900/20",
    textColor: "text-zinc-600 dark:text-zinc-400",
    borderColor: "border-zinc-200 dark:border-zinc-800",
    colorHex: "#52525b",
    colorLightHex: "#fafafa",
    colorBorderHex: "#d4d4d8",
    keywords: [],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retourne une matière par son id */
export const getSubject = (subjectId) => {
  return MEDICAL_SUBJECTS[subjectId] || MEDICAL_SUBJECTS.autre;
};

/** Retourne toutes les matières en array */
export const getAllSubjects = () => {
  return Object.values(MEDICAL_SUBJECTS);
};

/**
 * Détecte automatiquement la matière d'un cours à partir de son nom.
 * Retourne l'id de la matière détectée, ou "autre".
 */
export const detectSubject = (courseName = "") => {
  const lower = courseName.toLowerCase();
  for (const subject of Object.values(MEDICAL_SUBJECTS)) {
    if (subject.id === "autre") continue;
    if (subject.keywords.some((kw) => lower.includes(kw))) {
      return subject.id;
    }
  }
  return "autre";
};

/**
 * Groupe un tableau de cours par matière.
 * Retourne un objet { subjectId: [cours, ...] }
 */
export const groupCoursesBySubject = (courses = []) => {
  const grouped = {};
  courses.forEach((course) => {
    const subjectId = course.subject || "autre";
    if (!grouped[subjectId]) grouped[subjectId] = [];
    grouped[subjectId].push(course);
  });
  // Trier dans l'ordre de MEDICAL_SUBJECTS
  const ordered = {};
  Object.keys(MEDICAL_SUBJECTS).forEach((id) => {
    if (grouped[id]) ordered[id] = grouped[id];
  });
  return ordered;
};