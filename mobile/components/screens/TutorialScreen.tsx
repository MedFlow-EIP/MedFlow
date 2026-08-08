import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { markTutorialCompleted } from '../../utils/firstTime';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

// Doit correspondre exactement à AppNavigator.tsx (styles.bottomNav.height)
const TAB_BAR_HEIGHT = 70;

// Ordre réel des 5 items dans CustomTabBar (AppNavigator.tsx), chacun flex:1
// sur la largeur totale de l'écran.
const TAB_ORDER = ['home-tab', 'aichat-tab', 'add-tab', 'dashboard-tab', 'account-tab'] as const;
type TabKey = (typeof TAB_ORDER)[number];

type TutorialStep = {
  id: string;
  title: string;
  description: string;
  highlightTab?: TabKey;
  highlightElement?: 'paths-section';
  position: 'top' | 'bottom' | 'center';
  arrowDirection: 'up' | 'down' | 'left' | 'right';
};

const tutorialSteps: TutorialStep[] = [
  {
    id: '1',
    title: 'Bienvenue sur MedFlow',
    description: "Votre application d'apprentissage médical intelligent. Suivez ce guide pour découvrir toutes les fonctionnalités.",
    position: 'center',
    arrowDirection: 'down',
  },
  {
    id: '2',
    title: 'Onglet "Accueil"',
    description: "C'est ici que vous trouverez tous vos parcours d'apprentissage.",
    highlightTab: 'home-tab',
    position: 'bottom',
    arrowDirection: 'up',
  },
  {
    id: '3',
    title: "Parcours d'apprentissage",
    description: 'Choisissez un parcours (Anatomie, Cardiologie, etc.) pour accéder aux leçons.',
    highlightElement: 'paths-section',
    position: 'center',
    arrowDirection: 'down',
  },
  {
    id: '4',
    title: 'Assistant IA',
    description: "Posez vos questions médicales à l'assistant, et partagez images ou documents directement dans la conversation.",
    highlightTab: 'aichat-tab',
    position: 'bottom',
    arrowDirection: 'up',
  },
  {
    id: '5',
    title: 'Ajouter un cours',
    description: "Importez un PDF de cours : MedFlow génère automatiquement un résumé, des flashcards et un quiz grâce à l'IA.",
    highlightTab: 'add-tab',
    position: 'bottom',
    arrowDirection: 'up',
  },
  {
    id: '6',
    title: 'Tableau de bord',
    description: "Retrouvez tous vos cours importés. L'icône en haut à droite vous donne accès à votre progression détaillée (XP, leçons complétées...).",
    highlightTab: 'dashboard-tab',
    position: 'bottom',
    arrowDirection: 'up',
  },
  {
    id: '7',
    title: 'Votre compte',
    description: "Gérez votre profil ici. L'icône en haut à droite ouvre les réglages : thème clair/sombre, mot de passe, et plus encore.",
    highlightTab: 'account-tab',
    position: 'bottom',
    arrowDirection: 'up',
  },
  {
    id: '8',
    title: 'Prêt à commencer !',
    description: 'Vous êtes maintenant prêt à utiliser MedFlow.',
    position: 'center',
    arrowDirection: 'down',
  },
];

interface TutorialScreenProps {
  visible: boolean;
  onComplete: () => void;
  currentTab?: string;
}

type Rect = { x: number; y: number; width: number; height: number };

function getTabPosition(tabKey: TabKey): Rect {
  const idx = TAB_ORDER.indexOf(tabKey);
  const tabWidth = width / TAB_ORDER.length;
  return { x: idx * tabWidth, y: height - TAB_BAR_HEIGHT, width: tabWidth, height: TAB_BAR_HEIGHT };
}

function getElementPosition(elementName: string): Rect {
  switch (elementName) {
    case 'paths-section':
      return { x: 20, y: 170, width: width - 40, height: 400 };
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

function getHighlightRect(step: TutorialStep): Rect | null {
  if (step.highlightTab) return getTabPosition(step.highlightTab);
  if (step.highlightElement) return getElementPosition(step.highlightElement);
  return null;
}

export function TutorialScreen({ visible, onComplete, currentTab = 'Home' }: TutorialScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tooltipOpacity = useRef(new Animated.Value(1)).current;
  const tooltipSlide = useRef(new Animated.Value(0)).current;

  const spotX = useRef(new Animated.Value(0)).current;
  const spotY = useRef(new Animated.Value(0)).current;
  const spotW = useRef(new Animated.Value(0)).current;
  const spotH = useRef(new Animated.Value(0)).current;
  const spotOpacity = useRef(new Animated.Value(0)).current;

  const pulseAnim = useRef(new Animated.Value(0)).current;

  const step = tutorialSteps[currentStep];
  const highlightRect = getHighlightRect(step);

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const rect = highlightRect;

    if (rect) {
      Animated.parallel([
        Animated.spring(spotX, { toValue: rect.x, useNativeDriver: false, bounciness: 6 }),
        Animated.spring(spotY, { toValue: rect.y, useNativeDriver: false, bounciness: 6 }),
        Animated.spring(spotW, { toValue: rect.width, useNativeDriver: false, bounciness: 6 }),
        Animated.spring(spotH, { toValue: rect.height, useNativeDriver: false, bounciness: 6 }),
        Animated.timing(spotOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.timing(spotOpacity, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }

    tooltipOpacity.setValue(0);
    tooltipSlide.setValue(direction === 'forward' ? 24 : -24);
    Animated.parallel([
      Animated.timing(tooltipOpacity, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.spring(tooltipSlide, { toValue: 0, useNativeDriver: false, bounciness: 8 }),
    ]).start();
  }, [currentStep, visible]);

  useEffect(() => {
    if (!visible || !highlightRect) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, currentStep]);

  const goToStep = (nextIndex: number) => {
    setDirection(nextIndex > currentStep ? 'forward' : 'backward');
    setCurrentStep(nextIndex);
  };

  const handleNext = async () => {
    if (currentStep < tutorialSteps.length - 1) {
      goToStep(currentStep + 1);
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

  const getTooltipPosition = () => {
    if (step.highlightTab) {
      return { top: height - TAB_BAR_HEIGHT - 220, left: 20, right: 20, position: 'absolute' as const };
    }
    return { top: height / 2 - 120, left: 20, right: 20, position: 'absolute' as const };
  };

  const getArrowStyle = (dir: string) => {
    switch (dir) {
      case 'up': return { transform: [{ rotate: '0deg' }] };
      case 'down': return { transform: [{ rotate: '180deg' }] };
      case 'left': return { transform: [{ rotate: '-90deg' }] };
      case 'right': return { transform: [{ rotate: '90deg' }] };
      default: return { transform: [{ rotate: '0deg' }] };
    }
  };

  const tooltipStyle = getTooltipPosition();
  const arrowStyle = getArrowStyle(step.arrowDirection);

  const bandTop = { top: 0, left: 0, right: 0, height: spotY };
  const bandBottom = {
    top: Animated.add(spotY, spotH),
    left: 0,
    right: 0,
    bottom: 0,
  };
  const bandLeft = { top: spotY, height: spotH, left: 0, width: spotX };
  const bandRight = {
    top: spotY,
    height: spotH,
    left: Animated.add(spotX, spotW),
    right: 0,
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {highlightRect ? (
          <>
            <Animated.View style={[styles.band, bandTop]} />
            <Animated.View style={[styles.band, bandBottom]} />
            <Animated.View style={[styles.band, bandLeft]} />
            <Animated.View style={[styles.band, bandRight]} />

            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: spotX,
                top: spotY,
                width: spotW,
                height: spotH,
              }}
            >
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    width: '100%',
                    height: '100%',
                    borderRadius: step.highlightTab ? 0 : 12,
                    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                    transform: [
                      {
                        scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }),
                      },
                    ],
                  },
                ]}
              />
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.spotlightBorder,
                {
                  left: spotX,
                  top: spotY,
                  width: spotW,
                  height: spotH,
                  borderRadius: step.highlightTab ? 0 : 12,
                },
              ]}
            />

            <Animated.View
              pointerEvents="none"
              style={[
                styles.arrowContainer,
                {
                  top: Animated.subtract(spotY, 40),
                  left: Animated.subtract(Animated.add(spotX, Animated.divide(spotW, 2)), 12),
                },
              ]}
            >
              <Ionicons name="arrow-down" size={24} color={colors.primary} style={arrowStyle} />
            </Animated.View>
          </>
        ) : (
          <View style={styles.fullOverlay} />
        )}

        <Animated.View
          style={[
            styles.tooltip,
            tooltipStyle,
            {
              opacity: tooltipOpacity,
              transform: [{ translateY: tooltipSlide }],
            },
          ]}
        >
          <View style={styles.tooltipHeader}>
            <Text style={styles.stepCounter}>
              {currentStep + 1} / {tutorialSteps.length}
            </Text>
            <TouchableOpacity onPress={handleSkip} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.buttonContainer}>
            {currentStep > 0 && (
              <TouchableOpacity onPress={() => goToStep(currentStep - 1)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={16} color={colors.primary} />
                <Text style={styles.backButtonText}>Retour</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleNext} style={styles.nextButton} activeOpacity={0.8}>
              <Text style={styles.nextButtonText}>
                {currentStep === tutorialSteps.length - 1 ? 'Terminer' : 'Suivant'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textInverse} style={styles.nextIcon} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.progressContainer}>
          {tutorialSteps.map((_, index) => (
            <TouchableOpacity key={index} onPress={() => goToStep(index)} hitSlop={8}>
              <View
                style={[
                  styles.progressDot,
                  index === currentStep && styles.progressDotActive,
                  index < currentStep && styles.progressDotCompleted,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    fullOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    band: {
      position: 'absolute',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    spotlightBorder: {
      position: 'absolute',
      borderWidth: 3,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    pulseRing: {
      position: 'absolute',
      borderWidth: 3,
      borderColor: colors.primary,
    },
    arrowContainer: {
      position: 'absolute',
      zIndex: 1000,
    },
    tooltip: {
      backgroundColor: colors.surface,
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
      color: colors.textSecondary,
      fontWeight: '500',
    },
    closeButton: {
      padding: 4,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 12,
      lineHeight: 24,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
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
      borderColor: colors.border,
      minWidth: 100,
    },
    backButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      marginLeft: 6,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      minWidth: 120,
      justifyContent: 'center',
    },
    nextButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textInverse,
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
      gap: 6,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    progressDotActive: {
      width: 24,
      backgroundColor: '#ffffff',
    },
    progressDotCompleted: {
      backgroundColor: colors.primary,
    },
  });
}