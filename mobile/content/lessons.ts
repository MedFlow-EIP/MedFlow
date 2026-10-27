import type { ImageSourcePropType } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';

// Contenu des leçons des parcours, rangé par parcours puis par identifiant de
// leçon (mêmes identifiants que la table `lessons` du backend). Chaque leçon
// enchaîne les étapes existantes : explication, cartes, quiz visuel, quiz
// rapide et défi chronométré.

type IconName = keyof typeof Ionicons.glyphMap;

export type QuizOption = { id: string; text: string };

export type LessonStep =
  | {
      type: 'explanation';
      data: { title: string; explanation: string; points?: string[]; image?: ImageSourcePropType };
    }
  | {
      type: 'swipe';
      data: { title: string; cards: { id: string; concept: string; detail: string; icon: IconName }[] };
    }
  | {
      type: 'speed';
      data: { question: string; options: QuizOption[]; correctId: string; timeLimit: number; explanation?: string };
    }
  | {
      type: 'visualQuiz';
      data: {
        question: string;
        image: ImageSourcePropType;
        /** Largeur / hauteur de l'image, pour placer les zones au bon endroit. */
        aspectRatio: number;
        /** Coordonnées en % de l'image. */
        parts: { id: string; label: string; x: number; y: number }[];
        correctId: string;
        explanation?: string;
      };
    }
  | {
      type: 'quickQuiz';
      data: { question: string; options: QuizOption[]; correctId: string; explanation?: string };
    };

// Squelette vu de face (Pixabay, licence libre d'usage), recadré.
const SKELETON = require('../assets/anatomy/skeleton-front.png');
const SKELETON_RATIO = 520 / 940;

// Zones vérifiées visuellement sur l'image recadrée.
const ZONE = {
  crane: { id: 'crane', label: 'Crâne', x: 50.4, y: 4.8 },
  humerus: { id: 'humerus', label: 'Humérus', x: 27.3, y: 28.2 },
  thorax: { id: 'thorax', label: 'Cage thoracique', x: 44.2, y: 25.5 },
  colonne: { id: 'colonne', label: 'Colonne lombaire', x: 50.4, y: 37.2 },
  bassin: { id: 'bassin', label: 'Bassin (os coxal)', x: 41.3, y: 42.6 },
  femur: { id: 'femur', label: 'Fémur', x: 38.5, y: 60.6 },
  tibia: { id: 'tibia', label: 'Tibia', x: 31.7, y: 82.4 },
};

const skeletonQuiz = (
  question: string,
  correct: keyof typeof ZONE,
  others: (keyof typeof ZONE)[],
  explanation?: string
): LessonStep => ({
  type: 'visualQuiz',
  data: {
    question,
    image: SKELETON,
    aspectRatio: SKELETON_RATIO,
    parts: [correct, ...others].map((key) => ZONE[key]),
    correctId: ZONE[correct].id,
    explanation,
  },
});

const ANATOMY: Record<string, LessonStep[]> = {
  // 1 — Introduction
  '1': [
    {
      type: 'explanation',
      data: {
        title: 'Le squelette humain',
        explanation:
          'Le squelette forme la charpente du corps. Il travaille avec les muscles pour le mouvement et protège les organes les plus fragiles.',
        points: [
          'Environ 206 os chez l’adulte (près de 300 à la naissance : certains fusionnent en grandissant)',
          'Squelette axial : crâne, colonne vertébrale, cage thoracique',
          'Squelette appendiculaire : membres et ceintures (scapulaire et pelvienne)',
        ],
      },
    },
    {
      type: 'swipe',
      data: {
        title: 'Les 5 fonctions du squelette',
        cards: [
          { id: 'f1', icon: 'body-outline', concept: 'Soutien', detail: 'Il donne sa forme au corps et porte le poids des tissus mous.' },
          { id: 'f2', icon: 'shield-checkmark-outline', concept: 'Protection', detail: 'Le crâne protège l’encéphale, la cage thoracique le cœur et les poumons.' },
          { id: 'f3', icon: 'walk-outline', concept: 'Mouvement', detail: 'Les os servent de leviers aux muscles qui s’y insèrent.' },
          { id: 'f4', icon: 'water-outline', concept: 'Hématopoïèse', detail: 'La moelle osseuse rouge produit les globules rouges, les globules blancs et les plaquettes.' },
          { id: 'f5', icon: 'flask-outline', concept: 'Réserve minérale', detail: 'L’os stocke le calcium et le phosphore, libérés selon les besoins de l’organisme.' },
        ],
      },
    },
    skeletonQuiz('Où se trouve le bassin ?', 'bassin', ['crane', 'femur', 'humerus'],
      'Le bassin est formé des deux os coxaux, du sacrum et du coccyx.'),
    {
      type: 'quickQuiz',
      data: {
        question: 'Combien d’os compte environ le squelette adulte ?',
        options: [{ id: 'a', text: '106' }, { id: 'b', text: '206' }, { id: 'c', text: '306' }],
        correctId: 'b',
        explanation: 'Environ 206 os chez l’adulte. Le nouveau-né en a davantage, dont certains fusionnent ensuite.',
      },
    },
    {
      type: 'speed',
      data: {
        question: 'Quel tissu produit les cellules sanguines ?',
        options: [{ id: 'a', text: 'Le cartilage' }, { id: 'b', text: 'La moelle osseuse rouge' }, { id: 'c', text: 'Le périoste' }],
        correctId: 'b',
        timeLimit: 8,
        explanation: 'L’hématopoïèse se fait dans la moelle osseuse rouge (os plats, extrémités des os longs).',
      },
    },
  ],

  // 2 — Os du crâne
  '2': [
    {
      type: 'explanation',
      data: {
        title: 'Le crâne : 22 os',
        explanation: 'Le crâne se divise en deux parties : la boîte crânienne, qui protège l’encéphale, et le massif facial.',
        points: [
          'Neurocrâne : 8 os qui entourent l’encéphale',
          'Viscérocrâne (massif facial) : 14 os',
          'Les os sont unis par des sutures, articulations immobiles',
        ],
      },
    },
    {
      type: 'swipe',
      data: {
        title: 'Les 8 os du neurocrâne',
        cards: [
          { id: 'c1', icon: 'ellipse-outline', concept: 'Frontal (1)', detail: 'Forme le front et le toit des orbites.' },
          { id: 'c2', icon: 'ellipse-outline', concept: 'Pariétaux (2)', detail: 'Forment la voûte et les côtés du crâne.' },
          { id: 'c3', icon: 'ear-outline', concept: 'Temporaux (2)', detail: 'Sur les côtés ; ils abritent l’oreille moyenne et l’oreille interne.' },
          { id: 'c4', icon: 'ellipse-outline', concept: 'Occipital (1)', detail: 'À l’arrière ; percé du foramen magnum, par lequel passe la moelle épinière.' },
          { id: 'c5', icon: 'ellipse-outline', concept: 'Sphénoïde (1)', detail: 'En forme de papillon ; sa selle turcique loge l’hypophyse.' },
          { id: 'c6', icon: 'ellipse-outline', concept: 'Ethmoïde (1)', detail: 'Entre les orbites ; sa lame criblée laisse passer les nerfs olfactifs.' },
        ],
      },
    },
    skeletonQuiz('Où se trouve le crâne ?', 'crane', ['bassin', 'femur', 'tibia']),
    {
      type: 'quickQuiz',
      data: {
        question: 'Quel est le seul os mobile du crâne ?',
        options: [{ id: 'a', text: 'Le maxillaire' }, { id: 'b', text: 'La mandibule' }, { id: 'c', text: 'Le zygomatique' }],
        correctId: 'b',
        explanation: 'La mandibule s’articule avec les temporaux par l’articulation temporo-mandibulaire.',
      },
    },
    {
      type: 'quickQuiz',
      data: {
        question: 'Quelle suture sépare le frontal des deux pariétaux ?',
        options: [{ id: 'a', text: 'La suture sagittale' }, { id: 'b', text: 'La suture lambdoïde' }, { id: 'c', text: 'La suture coronale' }],
        correctId: 'c',
        explanation: 'Coronale : frontal / pariétaux. Sagittale : entre les pariétaux. Lambdoïde : pariétaux / occipital.',
      },
    },
    {
      type: 'speed',
      data: {
        question: 'Par quel orifice la moelle épinière rejoint-elle l’encéphale ?',
        options: [{ id: 'a', text: 'Le canal optique' }, { id: 'b', text: 'Le foramen ovale' }, { id: 'c', text: 'Le foramen magnum' }],
        correctId: 'c',
        timeLimit: 8,
        explanation: 'Le foramen magnum est le grand trou de l’os occipital.',
      },
    },
  ],

  // 3 — Révision 1
  '3': [
    {
      type: 'explanation',
      data: {
        title: 'Révision : squelette et crâne',
        explanation: 'On reprend l’essentiel des deux premières leçons avant d’aller plus loin.',
        points: [
          '≈ 206 os ; squelette axial et appendiculaire',
          'Fonctions : soutien, protection, mouvement, hématopoïèse, réserve minérale',
          'Crâne : 8 os du neurocrâne + 14 os de la face',
        ],
      },
    },
    {
      type: 'speed',
      data: {
        question: 'Combien d’os forment le neurocrâne ?',
        options: [{ id: 'a', text: '8' }, { id: 'b', text: '14' }, { id: 'c', text: '22' }],
        correctId: 'a',
        timeLimit: 6,
        explanation: '8 os pour le neurocrâne, 14 pour la face : 22 au total.',
      },
    },
    {
      type: 'quickQuiz',
      data: {
        question: 'Quel os porte la selle turcique, qui loge l’hypophyse ?',
        options: [{ id: 'a', text: 'L’ethmoïde' }, { id: 'b', text: 'Le sphénoïde' }, { id: 'c', text: 'L’occipital' }],
        correctId: 'b',
      },
    },
    skeletonQuiz('Où se trouve le fémur ?', 'femur', ['humerus', 'colonne', 'tibia']),
    {
      type: 'speed',
      data: {
        question: 'La réserve de calcium de l’organisme se trouve surtout…',
        options: [{ id: 'a', text: 'Dans les os' }, { id: 'b', text: 'Dans les muscles' }, { id: 'c', text: 'Dans le foie' }],
        correctId: 'a',
        timeLimit: 7,
      },
    },
  ],

  // 4 — Colonne vertébrale
  '4': [
    {
      type: 'explanation',
      data: {
        title: 'La colonne vertébrale',
        explanation:
          'La colonne soutient le tronc, protège la moelle épinière et permet les mouvements du dos. Elle compte 33 vertèbres réparties en 5 régions.',
        points: [
          '7 cervicales, 12 thoraciques, 5 lombaires',
          'Sacrum : 5 vertèbres soudées',
          'Coccyx : 4 vertèbres soudées',
        ],
      },
    },
    {
      type: 'swipe',
      data: {
        title: 'Les 5 régions',
        cards: [
          { id: 'v1', icon: 'git-commit-outline', concept: 'Cervicales C1 à C7', detail: 'C1 (atlas) porte la tête ; C2 (axis) possède la dent autour de laquelle pivote l’atlas.' },
          { id: 'v2', icon: 'git-commit-outline', concept: 'Thoraciques T1 à T12', detail: 'Elles s’articulent avec les 12 paires de côtes.' },
          { id: 'v3', icon: 'git-commit-outline', concept: 'Lombaires L1 à L5', detail: 'Les corps vertébraux les plus volumineux : elles portent le plus de poids.' },
          { id: 'v4', icon: 'git-commit-outline', concept: 'Sacrum', detail: '5 vertèbres soudées, articulées avec les deux os coxaux.' },
          { id: 'v5', icon: 'git-commit-outline', concept: 'Coccyx', detail: '4 vertèbres soudées, vestige de la queue.' },
        ],
      },
    },
    {
      type: 'swipe',
      data: {
        title: 'Les 4 courbures',
        cards: [
          { id: 'k1', icon: 'pulse-outline', concept: 'Lordose cervicale', detail: 'Courbure concave en arrière, au niveau du cou.' },
          { id: 'k2', icon: 'pulse-outline', concept: 'Cyphose thoracique', detail: 'Courbure convexe en arrière, au niveau du dos.' },
          { id: 'k3', icon: 'pulse-outline', concept: 'Lordose lombaire', detail: 'Courbure concave en arrière, au creux des reins.' },
          { id: 'k4', icon: 'pulse-outline', concept: 'Cyphose sacrée', detail: 'Courbure convexe en arrière du sacrum et du coccyx.' },
        ],
      },
    },
    skeletonQuiz('Touche la colonne lombaire', 'colonne', ['crane', 'femur', 'humerus']),
    {
      type: 'quickQuiz',
      data: {
        question: 'Combien de vertèbres cervicales possède l’être humain ?',
        options: [{ id: 'a', text: '5' }, { id: 'b', text: '7' }, { id: 'c', text: '12' }],
        correctId: 'b',
        explanation: '7 cervicales, comme chez presque tous les mammifères, girafe comprise.',
      },
    },
    {
      type: 'speed',
      data: {
        question: 'Comment s’appelle la 2e vertèbre cervicale (C2) ?',
        options: [{ id: 'a', text: 'L’atlas' }, { id: 'b', text: 'L’axis' }, { id: 'c', text: 'Le sacrum' }],
        correctId: 'b',
        timeLimit: 6,
      },
    },
  ],

  // 5 — Cage thoracique
  '5': [
    {
      type: 'explanation',
      data: {
        title: 'La cage thoracique',
        explanation:
          'Formée du sternum, des 12 paires de côtes et des 12 vertèbres thoraciques, elle protège le cœur et les poumons et participe à la respiration.',
        points: [
          'Sternum : manubrium, corps, processus xiphoïde',
          'Angle sternal (de Louis) : repère de la 2e côte',
          '12 paires de côtes : 7 vraies, 3 fausses, 2 flottantes',
        ],
      },
    },
    {
      type: 'swipe',
      data: {
        title: 'Les côtes',
        cards: [
          { id: 'r1', icon: 'reorder-four-outline', concept: 'Vraies côtes (1 à 7)', detail: 'Reliées directement au sternum par leur propre cartilage costal.' },
          { id: 'r2', icon: 'reorder-four-outline', concept: 'Fausses côtes (8 à 10)', detail: 'Rejoignent le sternum indirectement, via le cartilage de la 7e côte.' },
          { id: 'r3', icon: 'reorder-four-outline', concept: 'Côtes flottantes (11 et 12)', detail: 'Sans attache au sternum : leur extrémité avant est libre.' },
        ],
      },
    },
    skeletonQuiz('Touche la cage thoracique', 'thorax', ['colonne', 'bassin', 'crane']),
    {
      type: 'quickQuiz',
      data: {
        question: 'Combien de paires de côtes flottantes ?',
        options: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }, { id: 'c', text: '5' }],
        correctId: 'a',
        explanation: 'Les côtes 11 et 12.',
      },
    },
    {
      type: 'speed',
      data: {
        question: 'Quelle est la partie la plus basse du sternum ?',
        options: [{ id: 'a', text: 'Le manubrium' }, { id: 'b', text: 'Le corps' }, { id: 'c', text: 'Le processus xiphoïde' }],
        correctId: 'c',
        timeLimit: 7,
      },
    },
  ],

  // 6 — Test 1
  '6': [
    {
      type: 'speed',
      data: {
        question: 'Combien de vertèbres lombaires ?',
        options: [{ id: 'a', text: '5' }, { id: 'b', text: '7' }, { id: 'c', text: '12' }],
        correctId: 'a',
        timeLimit: 6,
      },
    },
    {
      type: 'quickQuiz',
      data: {
        question: 'Quel os est percé du foramen magnum ?',
        options: [{ id: 'a', text: 'Le sphénoïde' }, { id: 'b', text: 'L’occipital' }, { id: 'c', text: 'Le temporal' }],
        correctId: 'b',
      },
    },
    {
      type: 'speed',
      data: {
        question: 'Les côtes 8 à 10 sont appelées…',
        options: [{ id: 'a', text: 'Vraies côtes' }, { id: 'b', text: 'Fausses côtes' }, { id: 'c', text: 'Côtes flottantes' }],
        correctId: 'b',
        timeLimit: 7,
      },
    },
    {
      type: 'quickQuiz',
      data: {
        question: 'Quelle courbure présente normalement la région thoracique ?',
        options: [{ id: 'a', text: 'Une lordose' }, { id: 'b', text: 'Une cyphose' }, { id: 'c', text: 'Une scoliose' }],
        correctId: 'b',
        explanation: 'La scoliose est une déviation latérale anormale, pas une courbure physiologique.',
      },
    },
    skeletonQuiz('Où se trouve la colonne lombaire ?', 'colonne', ['thorax', 'femur', 'humerus']),
    {
      type: 'speed',
      data: {
        question: 'Quel os de la face est mobile ?',
        options: [{ id: 'a', text: 'La mandibule' }, { id: 'b', text: 'Le vomer' }, { id: 'c', text: 'Le maxillaire' }],
        correctId: 'a',
        timeLimit: 6,
      },
    },
  ],

  // 7 — Membres supérieurs
  '7': [
    {
      type: 'explanation',
      data: {
        title: 'Le membre supérieur',
        explanation: 'Il s’attache au tronc par la ceinture scapulaire et se termine par la main, très mobile.',
        points: [
          'Ceinture scapulaire : clavicule + scapula',
          'Bras : humérus ; avant-bras : radius et ulna',
          'Main : 8 carpiens, 5 métacarpiens, 14 phalanges (27 os)',
        ],
      },
    },
    {
      type: 'swipe',
      data: {
        title: 'Du tronc à la main',
        cards: [
          { id: 'u1', icon: 'remove-outline', concept: 'Clavicule', detail: 'Relie le sternum à la scapula ; souvent fracturée lors d’une chute sur l’épaule.' },
          { id: 'u2', icon: 'triangle-outline', concept: 'Scapula', detail: 'Os plat triangulaire ; sa cavité glénoïdale reçoit la tête de l’humérus.' },
          { id: 'u3', icon: 'barbell-outline', concept: 'Humérus', detail: 'Seul os du bras, de l’épaule au coude.' },
          { id: 'u4', icon: 'swap-horizontal-outline', concept: 'Radius et ulna', detail: 'Le radius est du côté du pouce (latéral), l’ulna du côté de l’auriculaire (médial).' },
          { id: 'u5', icon: 'hand-left-outline', concept: 'La main', detail: '8 os du carpe (dont le scaphoïde, souvent fracturé), 5 métacarpiens, 14 phalanges.' },
        ],
      },
    },
    skeletonQuiz('Où se trouve l’humérus ?', 'humerus', ['femur', 'tibia', 'crane']),
    {
      type: 'quickQuiz',
      data: {
        question: 'Quel os de l’avant-bras est du côté du pouce ?',
        options: [{ id: 'a', text: 'L’ulna' }, { id: 'b', text: 'Le radius' }, { id: 'c', text: 'L’humérus' }],
        correctId: 'b',
      },
    },
    {
      type: 'speed',
      data: {
        question: 'Combien d’os forment le carpe ?',
        options: [{ id: 'a', text: '5' }, { id: 'b', text: '8' }, { id: 'c', text: '14' }],
        correctId: 'b',
        timeLimit: 6,
      },
    },
  ],

  // 8 — Membres inférieurs
  '8': [
    {
      type: 'explanation',
      data: {
        title: 'Le membre inférieur',
        explanation: 'Il porte le poids du corps et assure la marche. Il s’attache au tronc par la ceinture pelvienne.',
        points: [
          'Ceinture pelvienne : les deux os coxaux',
          'Cuisse : fémur ; genou : patella ; jambe : tibia et fibula',
          'Pied : 7 tarsiens, 5 métatarsiens, 14 phalanges (26 os)',
        ],
      },
    },
    {
      type: 'swipe',
      data: {
        title: 'De la hanche au pied',
        cards: [
          { id: 'l1', icon: 'ellipse-outline', concept: 'Os coxal', detail: 'Fusion de l’ilium, de l’ischium et du pubis ; l’acétabulum reçoit la tête du fémur.' },
          { id: 'l2', icon: 'barbell-outline', concept: 'Fémur', detail: 'L’os le plus long et le plus solide du corps.' },
          { id: 'l3', icon: 'disc-outline', concept: 'Patella', detail: 'La rotule : le plus gros os sésamoïde, dans le tendon du quadriceps.' },
          { id: 'l4', icon: 'swap-vertical-outline', concept: 'Tibia et fibula', detail: 'Le tibia, médial, porte le poids ; la fibula, latérale, est plus fine.' },
          { id: 'l5', icon: 'footsteps-outline', concept: 'Le pied', detail: '7 tarsiens (dont le talus et le calcanéus, l’os du talon), 5 métatarsiens, 14 phalanges.' },
        ],
      },
    },
    skeletonQuiz('Touche le tibia', 'tibia', ['femur', 'humerus', 'bassin']),
    {
      type: 'quickQuiz',
      data: {
        question: 'Quel est l’os le plus long du corps ?',
        options: [{ id: 'a', text: 'Le tibia' }, { id: 'b', text: 'L’humérus' }, { id: 'c', text: 'Le fémur' }],
        correctId: 'c',
      },
    },
    {
      type: 'speed',
      data: {
        question: 'Quel os du tarse forme le talon ?',
        options: [{ id: 'a', text: 'Le talus' }, { id: 'b', text: 'Le calcanéus' }, { id: 'c', text: 'Le naviculaire' }],
        correctId: 'b',
        timeLimit: 7,
      },
    },
  ],

  // 9 — Révision 2
  '9': [
    {
      type: 'explanation',
      data: {
        title: 'Révision : les membres',
        explanation: 'Membres supérieurs et inférieurs sont construits sur le même plan : une ceinture, un os, deux os, puis l’extrémité.',
        points: [
          'Bras : humérus / cuisse : fémur',
          'Avant-bras : radius et ulna / jambe : tibia et fibula',
          'Main : 27 os / pied : 26 os',
        ],
      },
    },
    {
      type: 'speed',
      data: {
        question: 'Combien d’os compte la main ?',
        options: [{ id: 'a', text: '14' }, { id: 'b', text: '27' }, { id: 'c', text: '33' }],
        correctId: 'b',
        timeLimit: 7,
      },
    },
    {
      type: 'quickQuiz',
      data: {
        question: 'Quelle cavité de l’os coxal reçoit la tête du fémur ?',
        options: [{ id: 'a', text: 'La cavité glénoïdale' }, { id: 'b', text: 'L’acétabulum' }, { id: 'c', text: 'La fosse olécrânienne' }],
        correctId: 'b',
        explanation: 'La cavité glénoïdale, elle, appartient à la scapula et reçoit l’humérus.',
      },
    },
    skeletonQuiz('Où se trouve le fémur ?', 'femur', ['humerus', 'tibia', 'bassin']),
    {
      type: 'speed',
      data: {
        question: 'Par rapport au tibia, la fibula est située…',
        options: [{ id: 'a', text: 'Latéralement' }, { id: 'b', text: 'Médialement' }, { id: 'c', text: 'En avant' }],
        correctId: 'a',
        timeLimit: 6,
      },
    },
  ],

  // 10 — Test final
  '10': [
    {
      type: 'speed',
      data: {
        question: 'Combien de vertèbres compte la colonne au total ?',
        options: [{ id: 'a', text: '24' }, { id: 'b', text: '33' }, { id: 'c', text: '42' }],
        correctId: 'b',
        timeLimit: 6,
      },
    },
    {
      type: 'quickQuiz',
      data: {
        question: 'Quel os loge l’oreille moyenne et l’oreille interne ?',
        options: [{ id: 'a', text: 'Le temporal' }, { id: 'b', text: 'Le pariétal' }, { id: 'c', text: 'Le sphénoïde' }],
        correctId: 'a',
      },
    },
    skeletonQuiz('Où se trouve le bassin ?', 'bassin', ['thorax', 'femur', 'tibia']),
    {
      type: 'speed',
      data: {
        question: 'L’ulna est située du côté…',
        options: [{ id: 'a', text: 'Du pouce' }, { id: 'b', text: 'De l’auriculaire' }, { id: 'c', text: 'Du coude seulement' }],
        correctId: 'b',
        timeLimit: 6,
      },
    },
    {
      type: 'quickQuiz',
      data: {
        question: 'Quel repère palpable correspond à la 2e côte ?',
        options: [{ id: 'a', text: 'Le processus xiphoïde' }, { id: 'b', text: 'L’angle sternal' }, { id: 'c', text: 'La 7e cervicale' }],
        correctId: 'b',
        explanation: 'L’angle sternal (de Louis), à la jonction manubrium / corps du sternum.',
      },
    },
    {
      type: 'speed',
      data: {
        question: 'Où se fait l’hématopoïèse chez l’adulte ?',
        options: [{ id: 'a', text: 'Dans la moelle osseuse rouge' }, { id: 'b', text: 'Dans le cartilage articulaire' }, { id: 'c', text: 'Dans la moelle épinière' }],
        correctId: 'a',
        timeLimit: 7,
      },
    },
  ],
};

const CONTENT: Record<string, Record<string, LessonStep[]>> = {
  anatomy: ANATOMY,
};

/** Étapes d'une leçon ; une leçon sans contenu affiche un message plutôt qu'un contenu d'une autre leçon. */
export function getLessonSteps(pathId: string, lessonId: string, lessonTitle?: string): LessonStep[] {
  const steps = CONTENT[pathId]?.[lessonId];
  if (steps && steps.length > 0) return steps;
  return [
    {
      type: 'explanation',
      data: {
        title: lessonTitle || 'Leçon en préparation',
        explanation: 'Le contenu de cette leçon arrive bientôt. Tu peux la valider pour continuer ton parcours.',
      },
    },
  ];
}

/** Nombre d'étapes notées (quiz) d'une leçon, pour le score final. */
export const isGradedStep = (step: LessonStep) =>
  step.type === 'speed' || step.type === 'quickQuiz' || step.type === 'visualQuiz';
