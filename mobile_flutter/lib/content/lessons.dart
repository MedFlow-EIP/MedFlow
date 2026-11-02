import 'package:flutter/widgets.dart';
import 'package:ionicons/ionicons.dart';

// Contenu des leçons des parcours, rangé par parcours puis par identifiant de
// leçon (mêmes identifiants que la table `lessons` du backend). Chaque leçon
// enchaîne les étapes existantes : explication, cartes, quiz visuel, quiz
// rapide et défi chronométré.
// Copie de mobile/content/lessons.ts.

class QuizOption {
  final String id;
  final String text;
  const QuizOption({required this.id, required this.text});
}

/// Une étape de leçon. `type` reprend la valeur du champ `type` du code RN.
sealed class LessonStep {
  const LessonStep();
  String get type;
}

class ExplanationStepData extends LessonStep {
  final String title;
  final String explanation;
  final List<String>? points;

  /// Chemin d'un asset (`assets/…`) ou URL d'une image.
  final String? image;
  const ExplanationStepData({required this.title, required this.explanation, this.points, this.image});

  @override
  String get type => 'explanation';
}

class SwipeCard {
  final String id;
  final String concept;
  final String? detail;
  final IconData? icon;
  const SwipeCard({required this.id, required this.concept, this.detail, this.icon});
}

class SwipeStepData extends LessonStep {
  final String title;
  final List<SwipeCard> cards;
  const SwipeStepData({required this.title, required this.cards});

  @override
  String get type => 'swipe';
}

class SpeedStepData extends LessonStep {
  final String question;
  final List<QuizOption> options;
  final String correctId;
  final int timeLimit;
  final String? explanation;
  const SpeedStepData({
    required this.question,
    required this.options,
    required this.correctId,
    required this.timeLimit,
    this.explanation,
  });

  @override
  String get type => 'speed';
}

class AnatomyPart {
  final String id;
  final String label;

  /// Position en % de l'image.
  final double x;
  final double y;
  const AnatomyPart({required this.id, required this.label, required this.x, required this.y});
}

class VisualQuizStepData extends LessonStep {
  final String question;

  /// Chemin de l'asset.
  final String image;

  /// Largeur / hauteur de l'image, pour placer les zones au bon endroit.
  final double aspectRatio;

  /// Coordonnées en % de l'image.
  final List<AnatomyPart> parts;
  final String correctId;
  final String? explanation;
  const VisualQuizStepData({
    required this.question,
    required this.image,
    required this.aspectRatio,
    required this.parts,
    required this.correctId,
    this.explanation,
  });

  @override
  String get type => 'visualQuiz';
}

class QuickQuizStepData extends LessonStep {
  final String question;
  final List<QuizOption> options;
  final String correctId;
  final String? explanation;
  const QuickQuizStepData({required this.question, required this.options, required this.correctId, this.explanation});

  @override
  String get type => 'quickQuiz';
}

// Squelette vu de face (Pixabay, licence libre d'usage), recadré.
const _skeleton = 'assets/anatomy/skeleton-front.png';
const _skeletonRatio = 520 / 940;

// Zones vérifiées visuellement sur l'image recadrée.
const _zone = <String, AnatomyPart>{
  'crane': AnatomyPart(id: 'crane', label: 'Crâne', x: 50.4, y: 4.8),
  'humerus': AnatomyPart(id: 'humerus', label: 'Humérus', x: 27.3, y: 28.2),
  'thorax': AnatomyPart(id: 'thorax', label: 'Cage thoracique', x: 44.2, y: 25.5),
  'colonne': AnatomyPart(id: 'colonne', label: 'Colonne lombaire', x: 50.4, y: 37.2),
  'bassin': AnatomyPart(id: 'bassin', label: 'Bassin (os coxal)', x: 41.3, y: 42.6),
  'femur': AnatomyPart(id: 'femur', label: 'Fémur', x: 38.5, y: 60.6),
  'tibia': AnatomyPart(id: 'tibia', label: 'Tibia', x: 31.7, y: 82.4),
};

LessonStep _skeletonQuiz(String question, String correct, List<String> others, [String? explanation]) =>
    VisualQuizStepData(
      question: question,
      image: _skeleton,
      aspectRatio: _skeletonRatio,
      parts: [correct, ...others].map((key) => _zone[key]!).toList(),
      correctId: _zone[correct]!.id,
      explanation: explanation,
    );

final Map<String, List<LessonStep>> _anatomy = {
  // 1 — Introduction
  '1': [
    const ExplanationStepData(
      title: 'Le squelette humain',
      explanation:
          'Le squelette forme la charpente du corps. Il travaille avec les muscles pour le mouvement et protège les organes les plus fragiles.',
      points: [
        'Environ 206 os chez l’adulte (près de 300 à la naissance : certains fusionnent en grandissant)',
        'Squelette axial : crâne, colonne vertébrale, cage thoracique',
        'Squelette appendiculaire : membres et ceintures (scapulaire et pelvienne)',
      ],
    ),
    const SwipeStepData(
      title: 'Les 5 fonctions du squelette',
      cards: [
        SwipeCard(id: 'f1', icon: Ionicons.bodyOutline, concept: 'Soutien', detail: 'Il donne sa forme au corps et porte le poids des tissus mous.'),
        SwipeCard(id: 'f2', icon: Ionicons.shieldCheckmarkOutline, concept: 'Protection', detail: 'Le crâne protège l’encéphale, la cage thoracique le cœur et les poumons.'),
        SwipeCard(id: 'f3', icon: Ionicons.walkOutline, concept: 'Mouvement', detail: 'Les os servent de leviers aux muscles qui s’y insèrent.'),
        SwipeCard(id: 'f4', icon: Ionicons.waterOutline, concept: 'Hématopoïèse', detail: 'La moelle osseuse rouge produit les globules rouges, les globules blancs et les plaquettes.'),
        SwipeCard(id: 'f5', icon: Ionicons.flaskOutline, concept: 'Réserve minérale', detail: 'L’os stocke le calcium et le phosphore, libérés selon les besoins de l’organisme.'),
      ],
    ),
    _skeletonQuiz('Où se trouve le bassin ?', 'bassin', ['crane', 'femur', 'humerus'],
        'Le bassin est formé des deux os coxaux, du sacrum et du coccyx.'),
    const QuickQuizStepData(
      question: 'Combien d’os compte environ le squelette adulte ?',
      options: [QuizOption(id: 'a', text: '106'), QuizOption(id: 'b', text: '206'), QuizOption(id: 'c', text: '306')],
      correctId: 'b',
      explanation: 'Environ 206 os chez l’adulte. Le nouveau-né en a davantage, dont certains fusionnent ensuite.',
    ),
    const SpeedStepData(
      question: 'Quel tissu produit les cellules sanguines ?',
      options: [QuizOption(id: 'a', text: 'Le cartilage'), QuizOption(id: 'b', text: 'La moelle osseuse rouge'), QuizOption(id: 'c', text: 'Le périoste')],
      correctId: 'b',
      timeLimit: 8,
      explanation: 'L’hématopoïèse se fait dans la moelle osseuse rouge (os plats, extrémités des os longs).',
    ),
  ],

  // 2 — Os du crâne
  '2': [
    const ExplanationStepData(
      title: 'Le crâne : 22 os',
      explanation: 'Le crâne se divise en deux parties : la boîte crânienne, qui protège l’encéphale, et le massif facial.',
      points: [
        'Neurocrâne : 8 os qui entourent l’encéphale',
        'Viscérocrâne (massif facial) : 14 os',
        'Les os sont unis par des sutures, articulations immobiles',
      ],
    ),
    const SwipeStepData(
      title: 'Les 8 os du neurocrâne',
      cards: [
        SwipeCard(id: 'c1', icon: Ionicons.ellipseOutline, concept: 'Frontal (1)', detail: 'Forme le front et le toit des orbites.'),
        SwipeCard(id: 'c2', icon: Ionicons.ellipseOutline, concept: 'Pariétaux (2)', detail: 'Forment la voûte et les côtés du crâne.'),
        SwipeCard(id: 'c3', icon: Ionicons.earOutline, concept: 'Temporaux (2)', detail: 'Sur les côtés ; ils abritent l’oreille moyenne et l’oreille interne.'),
        SwipeCard(id: 'c4', icon: Ionicons.ellipseOutline, concept: 'Occipital (1)', detail: 'À l’arrière ; percé du foramen magnum, par lequel passe la moelle épinière.'),
        SwipeCard(id: 'c5', icon: Ionicons.ellipseOutline, concept: 'Sphénoïde (1)', detail: 'En forme de papillon ; sa selle turcique loge l’hypophyse.'),
        SwipeCard(id: 'c6', icon: Ionicons.ellipseOutline, concept: 'Ethmoïde (1)', detail: 'Entre les orbites ; sa lame criblée laisse passer les nerfs olfactifs.'),
      ],
    ),
    _skeletonQuiz('Où se trouve le crâne ?', 'crane', ['bassin', 'femur', 'tibia']),
    const QuickQuizStepData(
      question: 'Quel est le seul os mobile du crâne ?',
      options: [QuizOption(id: 'a', text: 'Le maxillaire'), QuizOption(id: 'b', text: 'La mandibule'), QuizOption(id: 'c', text: 'Le zygomatique')],
      correctId: 'b',
      explanation: 'La mandibule s’articule avec les temporaux par l’articulation temporo-mandibulaire.',
    ),
    const QuickQuizStepData(
      question: 'Quelle suture sépare le frontal des deux pariétaux ?',
      options: [QuizOption(id: 'a', text: 'La suture sagittale'), QuizOption(id: 'b', text: 'La suture lambdoïde'), QuizOption(id: 'c', text: 'La suture coronale')],
      correctId: 'c',
      explanation: 'Coronale : frontal / pariétaux. Sagittale : entre les pariétaux. Lambdoïde : pariétaux / occipital.',
    ),
    const SpeedStepData(
      question: 'Par quel orifice la moelle épinière rejoint-elle l’encéphale ?',
      options: [QuizOption(id: 'a', text: 'Le canal optique'), QuizOption(id: 'b', text: 'Le foramen ovale'), QuizOption(id: 'c', text: 'Le foramen magnum')],
      correctId: 'c',
      timeLimit: 8,
      explanation: 'Le foramen magnum est le grand trou de l’os occipital.',
    ),
  ],

  // 3 — Révision 1
  '3': [
    const ExplanationStepData(
      title: 'Révision : squelette et crâne',
      explanation: 'On reprend l’essentiel des deux premières leçons avant d’aller plus loin.',
      points: [
        '≈ 206 os ; squelette axial et appendiculaire',
        'Fonctions : soutien, protection, mouvement, hématopoïèse, réserve minérale',
        'Crâne : 8 os du neurocrâne + 14 os de la face',
      ],
    ),
    const SpeedStepData(
      question: 'Combien d’os forment le neurocrâne ?',
      options: [QuizOption(id: 'a', text: '8'), QuizOption(id: 'b', text: '14'), QuizOption(id: 'c', text: '22')],
      correctId: 'a',
      timeLimit: 6,
      explanation: '8 os pour le neurocrâne, 14 pour la face : 22 au total.',
    ),
    const QuickQuizStepData(
      question: 'Quel os porte la selle turcique, qui loge l’hypophyse ?',
      options: [QuizOption(id: 'a', text: 'L’ethmoïde'), QuizOption(id: 'b', text: 'Le sphénoïde'), QuizOption(id: 'c', text: 'L’occipital')],
      correctId: 'b',
    ),
    _skeletonQuiz('Où se trouve le fémur ?', 'femur', ['humerus', 'colonne', 'tibia']),
    const SpeedStepData(
      question: 'La réserve de calcium de l’organisme se trouve surtout…',
      options: [QuizOption(id: 'a', text: 'Dans les os'), QuizOption(id: 'b', text: 'Dans les muscles'), QuizOption(id: 'c', text: 'Dans le foie')],
      correctId: 'a',
      timeLimit: 7,
    ),
  ],

  // 4 — Colonne vertébrale
  '4': [
    const ExplanationStepData(
      title: 'La colonne vertébrale',
      explanation:
          'La colonne soutient le tronc, protège la moelle épinière et permet les mouvements du dos. Elle compte 33 vertèbres réparties en 5 régions.',
      points: [
        '7 cervicales, 12 thoraciques, 5 lombaires',
        'Sacrum : 5 vertèbres soudées',
        'Coccyx : 4 vertèbres soudées',
      ],
    ),
    const SwipeStepData(
      title: 'Les 5 régions',
      cards: [
        SwipeCard(id: 'v1', icon: Ionicons.gitCommitOutline, concept: 'Cervicales C1 à C7', detail: 'C1 (atlas) porte la tête ; C2 (axis) possède la dent autour de laquelle pivote l’atlas.'),
        SwipeCard(id: 'v2', icon: Ionicons.gitCommitOutline, concept: 'Thoraciques T1 à T12', detail: 'Elles s’articulent avec les 12 paires de côtes.'),
        SwipeCard(id: 'v3', icon: Ionicons.gitCommitOutline, concept: 'Lombaires L1 à L5', detail: 'Les corps vertébraux les plus volumineux : elles portent le plus de poids.'),
        SwipeCard(id: 'v4', icon: Ionicons.gitCommitOutline, concept: 'Sacrum', detail: '5 vertèbres soudées, articulées avec les deux os coxaux.'),
        SwipeCard(id: 'v5', icon: Ionicons.gitCommitOutline, concept: 'Coccyx', detail: '4 vertèbres soudées, vestige de la queue.'),
      ],
    ),
    const SwipeStepData(
      title: 'Les 4 courbures',
      cards: [
        SwipeCard(id: 'k1', icon: Ionicons.pulseOutline, concept: 'Lordose cervicale', detail: 'Courbure concave en arrière, au niveau du cou.'),
        SwipeCard(id: 'k2', icon: Ionicons.pulseOutline, concept: 'Cyphose thoracique', detail: 'Courbure convexe en arrière, au niveau du dos.'),
        SwipeCard(id: 'k3', icon: Ionicons.pulseOutline, concept: 'Lordose lombaire', detail: 'Courbure concave en arrière, au creux des reins.'),
        SwipeCard(id: 'k4', icon: Ionicons.pulseOutline, concept: 'Cyphose sacrée', detail: 'Courbure convexe en arrière du sacrum et du coccyx.'),
      ],
    ),
    _skeletonQuiz('Touche la colonne lombaire', 'colonne', ['crane', 'femur', 'humerus']),
    const QuickQuizStepData(
      question: 'Combien de vertèbres cervicales possède l’être humain ?',
      options: [QuizOption(id: 'a', text: '5'), QuizOption(id: 'b', text: '7'), QuizOption(id: 'c', text: '12')],
      correctId: 'b',
      explanation: '7 cervicales, comme chez presque tous les mammifères, girafe comprise.',
    ),
    const SpeedStepData(
      question: 'Comment s’appelle la 2e vertèbre cervicale (C2) ?',
      options: [QuizOption(id: 'a', text: 'L’atlas'), QuizOption(id: 'b', text: 'L’axis'), QuizOption(id: 'c', text: 'Le sacrum')],
      correctId: 'b',
      timeLimit: 6,
    ),
  ],

  // 5 — Cage thoracique
  '5': [
    const ExplanationStepData(
      title: 'La cage thoracique',
      explanation:
          'Formée du sternum, des 12 paires de côtes et des 12 vertèbres thoraciques, elle protège le cœur et les poumons et participe à la respiration.',
      points: [
        'Sternum : manubrium, corps, processus xiphoïde',
        'Angle sternal (de Louis) : repère de la 2e côte',
        '12 paires de côtes : 7 vraies, 3 fausses, 2 flottantes',
      ],
    ),
    const SwipeStepData(
      title: 'Les côtes',
      cards: [
        SwipeCard(id: 'r1', icon: Ionicons.reorderFourOutline, concept: 'Vraies côtes (1 à 7)', detail: 'Reliées directement au sternum par leur propre cartilage costal.'),
        SwipeCard(id: 'r2', icon: Ionicons.reorderFourOutline, concept: 'Fausses côtes (8 à 10)', detail: 'Rejoignent le sternum indirectement, via le cartilage de la 7e côte.'),
        SwipeCard(id: 'r3', icon: Ionicons.reorderFourOutline, concept: 'Côtes flottantes (11 et 12)', detail: 'Sans attache au sternum : leur extrémité avant est libre.'),
      ],
    ),
    _skeletonQuiz('Touche la cage thoracique', 'thorax', ['colonne', 'bassin', 'crane']),
    const QuickQuizStepData(
      question: 'Combien de paires de côtes flottantes ?',
      options: [QuizOption(id: 'a', text: '2'), QuizOption(id: 'b', text: '3'), QuizOption(id: 'c', text: '5')],
      correctId: 'a',
      explanation: 'Les côtes 11 et 12.',
    ),
    const SpeedStepData(
      question: 'Quelle est la partie la plus basse du sternum ?',
      options: [QuizOption(id: 'a', text: 'Le manubrium'), QuizOption(id: 'b', text: 'Le corps'), QuizOption(id: 'c', text: 'Le processus xiphoïde')],
      correctId: 'c',
      timeLimit: 7,
    ),
  ],

  // 6 — Test 1
  '6': [
    const SpeedStepData(
      question: 'Combien de vertèbres lombaires ?',
      options: [QuizOption(id: 'a', text: '5'), QuizOption(id: 'b', text: '7'), QuizOption(id: 'c', text: '12')],
      correctId: 'a',
      timeLimit: 6,
    ),
    const QuickQuizStepData(
      question: 'Quel os est percé du foramen magnum ?',
      options: [QuizOption(id: 'a', text: 'Le sphénoïde'), QuizOption(id: 'b', text: 'L’occipital'), QuizOption(id: 'c', text: 'Le temporal')],
      correctId: 'b',
    ),
    const SpeedStepData(
      question: 'Les côtes 8 à 10 sont appelées…',
      options: [QuizOption(id: 'a', text: 'Vraies côtes'), QuizOption(id: 'b', text: 'Fausses côtes'), QuizOption(id: 'c', text: 'Côtes flottantes')],
      correctId: 'b',
      timeLimit: 7,
    ),
    const QuickQuizStepData(
      question: 'Quelle courbure présente normalement la région thoracique ?',
      options: [QuizOption(id: 'a', text: 'Une lordose'), QuizOption(id: 'b', text: 'Une cyphose'), QuizOption(id: 'c', text: 'Une scoliose')],
      correctId: 'b',
      explanation: 'La scoliose est une déviation latérale anormale, pas une courbure physiologique.',
    ),
    _skeletonQuiz('Où se trouve la colonne lombaire ?', 'colonne', ['thorax', 'femur', 'humerus']),
    const SpeedStepData(
      question: 'Quel os de la face est mobile ?',
      options: [QuizOption(id: 'a', text: 'La mandibule'), QuizOption(id: 'b', text: 'Le vomer'), QuizOption(id: 'c', text: 'Le maxillaire')],
      correctId: 'a',
      timeLimit: 6,
    ),
  ],

  // 7 — Membres supérieurs
  '7': [
    const ExplanationStepData(
      title: 'Le membre supérieur',
      explanation: 'Il s’attache au tronc par la ceinture scapulaire et se termine par la main, très mobile.',
      points: [
        'Ceinture scapulaire : clavicule + scapula',
        'Bras : humérus ; avant-bras : radius et ulna',
        'Main : 8 carpiens, 5 métacarpiens, 14 phalanges (27 os)',
      ],
    ),
    const SwipeStepData(
      title: 'Du tronc à la main',
      cards: [
        SwipeCard(id: 'u1', icon: Ionicons.removeOutline, concept: 'Clavicule', detail: 'Relie le sternum à la scapula ; souvent fracturée lors d’une chute sur l’épaule.'),
        SwipeCard(id: 'u2', icon: Ionicons.triangleOutline, concept: 'Scapula', detail: 'Os plat triangulaire ; sa cavité glénoïdale reçoit la tête de l’humérus.'),
        SwipeCard(id: 'u3', icon: Ionicons.barbellOutline, concept: 'Humérus', detail: 'Seul os du bras, de l’épaule au coude.'),
        SwipeCard(id: 'u4', icon: Ionicons.swapHorizontalOutline, concept: 'Radius et ulna', detail: 'Le radius est du côté du pouce (latéral), l’ulna du côté de l’auriculaire (médial).'),
        SwipeCard(id: 'u5', icon: Ionicons.handLeftOutline, concept: 'La main', detail: '8 os du carpe (dont le scaphoïde, souvent fracturé), 5 métacarpiens, 14 phalanges.'),
      ],
    ),
    _skeletonQuiz('Où se trouve l’humérus ?', 'humerus', ['femur', 'tibia', 'crane']),
    const QuickQuizStepData(
      question: 'Quel os de l’avant-bras est du côté du pouce ?',
      options: [QuizOption(id: 'a', text: 'L’ulna'), QuizOption(id: 'b', text: 'Le radius'), QuizOption(id: 'c', text: 'L’humérus')],
      correctId: 'b',
    ),
    const SpeedStepData(
      question: 'Combien d’os forment le carpe ?',
      options: [QuizOption(id: 'a', text: '5'), QuizOption(id: 'b', text: '8'), QuizOption(id: 'c', text: '14')],
      correctId: 'b',
      timeLimit: 6,
    ),
  ],

  // 8 — Membres inférieurs
  '8': [
    const ExplanationStepData(
      title: 'Le membre inférieur',
      explanation: 'Il porte le poids du corps et assure la marche. Il s’attache au tronc par la ceinture pelvienne.',
      points: [
        'Ceinture pelvienne : les deux os coxaux',
        'Cuisse : fémur ; genou : patella ; jambe : tibia et fibula',
        'Pied : 7 tarsiens, 5 métatarsiens, 14 phalanges (26 os)',
      ],
    ),
    const SwipeStepData(
      title: 'De la hanche au pied',
      cards: [
        SwipeCard(id: 'l1', icon: Ionicons.ellipseOutline, concept: 'Os coxal', detail: 'Fusion de l’ilium, de l’ischium et du pubis ; l’acétabulum reçoit la tête du fémur.'),
        SwipeCard(id: 'l2', icon: Ionicons.barbellOutline, concept: 'Fémur', detail: 'L’os le plus long et le plus solide du corps.'),
        SwipeCard(id: 'l3', icon: Ionicons.discOutline, concept: 'Patella', detail: 'La rotule : le plus gros os sésamoïde, dans le tendon du quadriceps.'),
        SwipeCard(id: 'l4', icon: Ionicons.swapVerticalOutline, concept: 'Tibia et fibula', detail: 'Le tibia, médial, porte le poids ; la fibula, latérale, est plus fine.'),
        SwipeCard(id: 'l5', icon: Ionicons.footstepsOutline, concept: 'Le pied', detail: '7 tarsiens (dont le talus et le calcanéus, l’os du talon), 5 métatarsiens, 14 phalanges.'),
      ],
    ),
    _skeletonQuiz('Touche le tibia', 'tibia', ['femur', 'humerus', 'bassin']),
    const QuickQuizStepData(
      question: 'Quel est l’os le plus long du corps ?',
      options: [QuizOption(id: 'a', text: 'Le tibia'), QuizOption(id: 'b', text: 'L’humérus'), QuizOption(id: 'c', text: 'Le fémur')],
      correctId: 'c',
    ),
    const SpeedStepData(
      question: 'Quel os du tarse forme le talon ?',
      options: [QuizOption(id: 'a', text: 'Le talus'), QuizOption(id: 'b', text: 'Le calcanéus'), QuizOption(id: 'c', text: 'Le naviculaire')],
      correctId: 'b',
      timeLimit: 7,
    ),
  ],

  // 9 — Révision 2
  '9': [
    const ExplanationStepData(
      title: 'Révision : les membres',
      explanation: 'Membres supérieurs et inférieurs sont construits sur le même plan : une ceinture, un os, deux os, puis l’extrémité.',
      points: [
        'Bras : humérus / cuisse : fémur',
        'Avant-bras : radius et ulna / jambe : tibia et fibula',
        'Main : 27 os / pied : 26 os',
      ],
    ),
    const SpeedStepData(
      question: 'Combien d’os compte la main ?',
      options: [QuizOption(id: 'a', text: '14'), QuizOption(id: 'b', text: '27'), QuizOption(id: 'c', text: '33')],
      correctId: 'b',
      timeLimit: 7,
    ),
    const QuickQuizStepData(
      question: 'Quelle cavité de l’os coxal reçoit la tête du fémur ?',
      options: [QuizOption(id: 'a', text: 'La cavité glénoïdale'), QuizOption(id: 'b', text: 'L’acétabulum'), QuizOption(id: 'c', text: 'La fosse olécrânienne')],
      correctId: 'b',
      explanation: 'La cavité glénoïdale, elle, appartient à la scapula et reçoit l’humérus.',
    ),
    _skeletonQuiz('Où se trouve le fémur ?', 'femur', ['humerus', 'tibia', 'bassin']),
    const SpeedStepData(
      question: 'Par rapport au tibia, la fibula est située…',
      options: [QuizOption(id: 'a', text: 'Latéralement'), QuizOption(id: 'b', text: 'Médialement'), QuizOption(id: 'c', text: 'En avant')],
      correctId: 'a',
      timeLimit: 6,
    ),
  ],

  // 10 — Test final
  '10': [
    const SpeedStepData(
      question: 'Combien de vertèbres compte la colonne au total ?',
      options: [QuizOption(id: 'a', text: '24'), QuizOption(id: 'b', text: '33'), QuizOption(id: 'c', text: '42')],
      correctId: 'b',
      timeLimit: 6,
    ),
    const QuickQuizStepData(
      question: 'Quel os loge l’oreille moyenne et l’oreille interne ?',
      options: [QuizOption(id: 'a', text: 'Le temporal'), QuizOption(id: 'b', text: 'Le pariétal'), QuizOption(id: 'c', text: 'Le sphénoïde')],
      correctId: 'a',
    ),
    _skeletonQuiz('Où se trouve le bassin ?', 'bassin', ['thorax', 'femur', 'tibia']),
    const SpeedStepData(
      question: 'L’ulna est située du côté…',
      options: [QuizOption(id: 'a', text: 'Du pouce'), QuizOption(id: 'b', text: 'De l’auriculaire'), QuizOption(id: 'c', text: 'Du coude seulement')],
      correctId: 'b',
      timeLimit: 6,
    ),
    const QuickQuizStepData(
      question: 'Quel repère palpable correspond à la 2e côte ?',
      options: [QuizOption(id: 'a', text: 'Le processus xiphoïde'), QuizOption(id: 'b', text: 'L’angle sternal'), QuizOption(id: 'c', text: 'La 7e cervicale')],
      correctId: 'b',
      explanation: 'L’angle sternal (de Louis), à la jonction manubrium / corps du sternum.',
    ),
    const SpeedStepData(
      question: 'Où se fait l’hématopoïèse chez l’adulte ?',
      options: [QuizOption(id: 'a', text: 'Dans la moelle osseuse rouge'), QuizOption(id: 'b', text: 'Dans le cartilage articulaire'), QuizOption(id: 'c', text: 'Dans la moelle épinière')],
      correctId: 'a',
      timeLimit: 7,
    ),
  ],
};

final Map<String, Map<String, List<LessonStep>>> _content = {
  'anatomy': _anatomy,
};

/// Étapes d'une leçon ; une leçon sans contenu affiche un message plutôt qu'un contenu d'une autre leçon.
List<LessonStep> getLessonSteps(String pathId, String lessonId, [String? lessonTitle]) {
  final steps = _content[pathId]?[lessonId];
  if (steps != null && steps.isNotEmpty) return steps;
  return [
    ExplanationStepData(
      title: (lessonTitle == null || lessonTitle.isEmpty) ? 'Leçon en préparation' : lessonTitle,
      explanation: 'Le contenu de cette leçon arrive bientôt. Tu peux la valider pour continuer ton parcours.',
    ),
  ];
}

/// Nombre d'étapes notées (quiz) d'une leçon, pour le score final.
bool isGradedStep(LessonStep step) =>
    step is SpeedStepData || step is QuickQuizStepData || step is VisualQuizStepData;
