import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Animated,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { markTutorialCompleted } from '../../utils/firstTime';

const { width, height } = Dimensions.get('window');

type TutorialStep = {
  id: string;
  title: string;
  description: string;
  target: 'home-tab' | 'progress-tab' | 'home-content' | 'stats' | 'progress-card';
  position: 'top' | 'bottom' | 'center';
  arrowDirection: 'up' | 'down' | 'left' | 'right';
  highlightTab?: boolean;
  highlightElement?: string;
};

const tutorialSteps: TutorialStep[] = [
  {
    id: '1',
    title: 'Bienvenue sur MedFlow',
    description: 'Votre application d\'apprentissage médical intelligent. Suivez ce guide pour découvrir toutes les fonctionnalités.',
    target: 'home-content',
    position: 'center',
    arrowDirection: 'down',
  },
  {
    id: '2',
    title: 'Onglet "Accueil"',
    description: 'C\'est ici que vous trouverez tous vos parcours d\'apprentissage.',
    target: 'home-tab',
    position: 'bottom',
    arrowDirection: 'up',
    highlightTab: true,
  },
  {
    id: '3',
    title: 'Parcours d\'Apprentissage',
    description: 'Choisissez un parcours (Anatomie, Cardiologie, etc.) pour accéder aux leçons.',
    target: 'home-content',
    position: 'center',
    arrowDirection: 'down',
    highlightElement: 'paths-section',
  },
  {
    id: '4',
    title: 'Onglet "Progrès"',
    description: 'Cliquez ici pour voir vos statistiques et suivre votre avancement.',
    target: 'progress-tab',
    position: 'bottom',
    arrowDirection: 'up',
    highlightTab: true,
  },
  {
    id: '5',
    title: 'Vos Statistiques',
    description: 'Ici vous pouvez voir vos points XP, jours de série et progression.',
    target: 'stats',
    position: 'top',
    arrowDirection: 'down',
    highlightElement: 'stats-section',
  },
  {
    id: '6',
    title: 'Prêt à commencer !',
    description: 'Vous êtes maintenant prêt à utiliser MedFlow.',
    target: 'home-content',
    position: 'center',
    arrowDirection: 'down',
  },
];

interface TutorialScreenProps {
  visible: boolean;
  onComplete: () => void;
  currentTab?: string;
}

export function TutorialScreen({ visible, onComplete, currentTab = 'Home' }: TutorialScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getTabPosition = (tabName: string) => {
    const tabHeight = 60;
    const tabWidth = width / 2;
    
    if (tabName === 'home-tab') {
      return {
        x: 0,
        y: height - tabHeight,
        width: tabWidth,
        height: tabHeight,
      };
    } else if (tabName === 'progress-tab') {
      return {
        x: tabWidth,
        y: height - tabHeight,
        width: tabWidth,
        height: tabHeight,
      };
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  };

  const getElementPosition = (elementName: string) => {
    switch (elementName) {
      case 'stats-section':
        return { x: 20, y: 160, width: width - 40, height: 100 };
      case 'paths-section':
        return { x: 20, y: 160, width: width - 40, height: 400 };
      default:
        return { x: 0, y: 0, width: 0, height: 0 };
    }
  };

  const getTooltipPosition = () => {
    const step = tutorialSteps[currentStep];
    const isTabStep = step.target === 'home-tab' || step.target === 'progress-tab';
    
    if (isTabStep) {
      return {
        top: height - 280,
        left: 20,
        right: 20,
        position: 'absolute' as const,
      };
    } else if (step.target === 'stats' || step.target === 'progress-card') {
      return {
        top: 180,
        left: 20,
        right: 20,
        position: 'absolute' as const,
      };
    } else {
      return {
        top: height / 2 - 120,
        left: 20,
        right: 20,
        position: 'absolute' as const,
      };
    }
  };

  const getArrowPosition = () => {
    const step = tutorialSteps[currentStep];
    
    if (step.highlightTab) {
      const tabPos = getTabPosition(step.target);
      return {
        top: tabPos.y - 40,
        left: tabPos.x + tabPos.width / 2 - 12,
      };
    } else if (step.highlightElement) {
      const elemPos = getElementPosition(step.highlightElement);
      return {
        top: elemPos.y - 40,
        left: elemPos.x + elemPos.width / 2 - 12,
      };
    }
    
    return { top: 0, left: 0 };
  };

  const getArrowStyle = (direction: string) => {
    switch (direction) {
      case 'up': return { transform: [{ rotate: '0deg' }] };
      case 'down': return { transform: [{ rotate: '180deg' }] };
      case 'left': return { transform: [{ rotate: '-90deg' }] };
      case 'right': return { transform: [{ rotate: '90deg' }] };
      default: return { transform: [{ rotate: '0deg' }] };
    }
  };

  const handleNext = async () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await markTutorialCompleted();
      onComplete();
    }
  };

  const handleSkip = async () => {
    await markTutorialCompleted();
    onComplete();
  };

  if (!visible) return null;

  const step = tutorialSteps[currentStep];
  const tooltipStyle = getTooltipPosition();
  const arrowStyle = getArrowStyle(step.arrowDirection);
  const arrowPos = getArrowPosition();
  const highlightPos = step.highlightTab 
    ? getTabPosition(step.target)
    : step.highlightElement 
      ? getElementPosition(step.highlightElement)
      : null;

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={handleSkip}
    >
      <View style={styles.container}>
        <View style={styles.overlay} />
        
        {highlightPos && (
          <View style={[
            styles.highlightHole,
            {
              top: highlightPos.y,
              left: highlightPos.x,
              width: highlightPos.width,
              height: highlightPos.height,
              borderRadius: step.highlightTab ? 0 : 8,
            }
          ]}>
            <View style={styles.highlightBorder} />
          </View>
        )}
        
        {step.highlightTab || step.highlightElement ? (
          <View style={[styles.arrowContainer, arrowPos]}>
            <Ionicons 
              name="arrow-down" 
              size={24} 
              color="#3b82f6" 
              style={[styles.arrow, arrowStyle]}
            />
          </View>
        ) : null}

        <Animated.View
          style={[
            styles.tooltip,
            tooltipStyle,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.tooltipHeader}>
            <Text style={styles.stepCounter}>
              {currentStep + 1} / {tutorialSteps.length}
            </Text>
            <TouchableOpacity onPress={handleSkip} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.buttonContainer}>
            {currentStep > 0 && (
              <TouchableOpacity
                onPress={() => setCurrentStep(currentStep - 1)}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={16} color="#3b82f6" />
                <Text style={styles.backButtonText}>Retour</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleNext}
              style={styles.nextButton}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>
                {currentStep === tutorialSteps.length - 1 ? 'Terminer' : 'Suivant'}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={16}
                color="#ffffff"
                style={styles.nextIcon}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.progressContainer}>
          {tutorialSteps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
                index < currentStep && styles.progressDotCompleted,
              ]}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  highlightHole: {
    position: 'absolute',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  highlightBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: '#3b82f6',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  arrowContainer: {
    position: 'absolute',
    zIndex: 1000,
  },
  arrow: {
    fontSize: 24,
  },
  tooltip: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepCounter: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 24,
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 100,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
    marginLeft: 6,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  nextIcon: {
    marginLeft: 8,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 6,
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#ffffff',
  },
  progressDotCompleted: {
    backgroundColor: '#3b82f6',
  },
});