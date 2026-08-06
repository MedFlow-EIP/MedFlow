import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { FlashCard } from '../../components/FlashCard';
import { Button } from '../ui/button';
import { ProgressBar } from '../ui/progress';
import { Card } from '../ui/card';
import { Path, Lesson, FlashCardData } from '../../types';
import { ExplanationStep } from "../../components/steps/ExplanationStep";
import { SwipeCardsStep } from "../../components/steps/SwipeCardsStep";
import { SpeedChallengeStep } from "../../components/steps/SpeedChallengeStep";
import { QuickQuizCardsStep } from "../../components/steps/QuickQuizzCardsStep";
import { VisualDiscovery } from "../../components/steps/VisualDiscoveryStep";

type ExplanationStepType = {
  type: "explanation";
  data: { title: string; explanation: string; image: string };
};

type SwipeStepType = {
  type: "swipe";
  data: { cards: { id: string; concept: string; image: string }[] };
};

type SpeedStepType = {
  type: "speed";
  data: {
    question: string;
    options: { id: string; text: string }[];
    correctId: string;
    timeLimit: number;
  };
};

type VisualQuizStepType = {
  type: "visualQuiz";
  data: {
    question: string;
    image: string;
    parts: { id: string; x: number; y: number }[];
    correctId: string;
  };
};

type QuickQuizStepType = {
  type: "quickQuiz";
  data: {
    question: string;
    options: { id: string; text: string }[];
    correctId: string;
  };
};

type LessonStep =
  | ExplanationStepType
  | SwipeStepType
  | SpeedStepType
  | VisualQuizStepType
  | QuickQuizStepType;

interface LessonScreenProps {
  route: any;
  navigation: any;
}

export function LessonScreen({ route, navigation }: LessonScreenProps) {
  const { path, lesson } = route.params;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [index, setIndex] = useState(0);
  const xp = lesson?.xp ?? 10

  const steps: LessonStep[] = [
  {
    type: "explanation",
    data: {
      title: "Le crâne",
      explanation:
        "Le crâne protège le cerveau et forme la structure de la tête.",
      image:
        "https://www.materielmedical.fr/41039-thickbox_default/crane-humain-articule-22-pieces-ez-4701.jpg",
    },
  },
  {
    type: "swipe",
    data: {
      cards: [
        {
          id: "1",
          concept: "Le crâne a 22 os",
          image:
            "https://img.passeportsante.net/600x558/2025-01-21/anatomie-crane-humain.jpg",
        },
        {
          id: "2",
          concept: "8 os crâniens",
          image:
            "https://www.fiches-ide.fr/wp-content/uploads/2020/05/92.-Os-du-cr%C3%A2ne-vue-lat%C3%A9rale.png",
        },
        {
          id: "3",
          concept: "14 os faciaux",
          image:
            "https://www.fiches-ide.fr/wp-content/uploads/2020/05/92.-Os-du-cr%C3%A2ne-vue-lat%C3%A9rale.png",
        },
      ],
    },
  },
  {
    type: "visualQuiz",
    data: {
      question: "Où se trouve la clavicule ?",
      image:
        "https://cdn.pixabay.com/photo/2020/08/19/11/54/human-skeleton-5500722_1280.png",
      parts: [
        { id: "clavicle", x: 73, y: 26 },
        { id: "bassin", x: 27, y: 40 },
        { id: "femur", x: 70, y: 58 },
      ],
      correctId: "clavicle",
    },
  },
  {
    type: "speed",
    data: {
      question: "Quel os protège le cerveau ?",
      options: [
        { id: "a", text: "Le crâne" },
        { id: "b", text: "Le tibia" },
        { id: "c", text: "La clavicule" },
      ],
      correctId: "a",
      timeLimit: 5,
    },
  },
  {
    type: "quickQuiz",
    data: {
      question: "Combien de vertèbres cervicales possède l’homme ?",
      options: [
        { id: "opt1", text: "7" },
        { id: "opt2", text: "12" },
        { id: "opt3", text: "5" },
      ],
      correctId: "opt1",
    },
  },
];

  const step = steps[index];

  const progress = ((index + 1) / steps.length) * 100;

  const next = () => {
    if (index < steps.length - 1) {
      setIndex(index + 1);
    } else {
      setShowResults(true);
    }
  };

  const flashcards: FlashCardData[] = [
    {
      question: "Combien d'os compose le crâne humain adulte?",
      answer: "Le crâne humain adulte est composé de 22 os : 8 os crâniens et 14 os faciaux.",
      color: path.color,
    },
    {
      question: "Quelle est la fonction principale de la cage thoracique?",
      answer: "La cage thoracique protège les organes vitaux (cœur, poumons) et joue un rôle essentiel dans la respiration.",
      color: path.color,
    },
    {
      question: "Combien de vertèbres compte la colonne vertébrale?",
      answer: "La colonne vertébrale compte 33 vertèbres : 7 cervicales, 12 thoraciques, 5 lombaires, 5 sacrées (fusionnées) et 4 coccygiennes (fusionnées).",
      color: path.color,
    },
  ];

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleFinish = () => {
    navigation.goBack();
  };

  if (showResults) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultsContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successEmoji}>✅</Text>
          </View>

          <Text style={styles.resultsTitle}>Leçon terminée !</Text>
          <Text style={styles.resultsSubtitle}>
            Vous avez terminé cette leçon !
          </Text>

          {/* <Card style={styles.statsCard}>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>⭐</Text>
                <Text style={styles.statValue}>+{xp} XP</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>🔥</Text>
                <Text style={styles.statValue}>Série: 7j</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>✅</Text>
                <Text style={styles.statValue}>100%</Text>
              </View>
            </View>
          </Card> */}

          <Button
            title="Continuer"
            onPress={handleFinish}
            color={path.color}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ProgressBar progress={progress} color={path.color} height={8} />
      </View>

      {step.type === "explanation" && (
        <ExplanationStep
          title={step.data.title}
          explanation={step.data.explanation}
          image={step.data.image}
          onContinue={next}
        />
      )}

      {step.type === "swipe" && (
        <SwipeCardsStep cards={step.data.cards} onComplete={next} />
      )}

      {step.type === "speed" && (
        <SpeedChallengeStep
          question={step.data.question}
          options={step.data.options}
          correctId={step.data.correctId}
          timeLimit={step.data.timeLimit}
          onComplete={next}
        />
      )}

      {step.type === "visualQuiz" && (
        <VisualDiscovery
          question={step.data.question}
          imageUrl={step.data.image}
          parts={step.data.parts}
          correctId={step.data.correctId}
          onComplete={next}
        />
      )}

      {step.type === "quickQuiz" && (
        <QuickQuizCardsStep
          question={step.data.question}
          options={step.data.options}
          correctId={step.data.correctId}
          onComplete={next}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  progressBarContainer: {
    marginBottom: 4,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  footer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonWrapper: {
    flex: 1,
  },
  resultsContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 48,
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  resultsSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  statsCard: {
    width: '100%',
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
});
