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
import {
  logTutorialStarted,
  logStepViewed,
  logTutorialSkipped,
  logTutorialCompleted,
} from '../../utils/tutorialAnalytics';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

// Doit correspondre exactement a AppNavigator.tsx (styles.bottomNav.height)
export const TAB_BAR_HEIGHT = 70;

// Ordre reel des 5 items dans CustomTabBar (AppNavigator.tsx), chacun flex:1
// sur la largeur totale de l'ecran.
export const TAB_ORDER = ['home-tab', 'aichat-tab', 'add-tab', 'dashboard-tab', 'account-tab'] as const;
export type TabKey = (typeof TAB_ORDER)[number];

type TutorialStep = {
  id: string;
  title: string;
  description: string;
  highlightTab?: TabKey;
  highlightElement?: 'paths-section';
  // Badge affiché en haut du tooltip pour toujours savoir où on se trouve
  // dans l'app, sans dépendre de la tab bar réelle (parfois masquée, comme
  // sur l'écran Upload qui n'est pas un onglet).
  sectionLabel?: string;
  sectionIcon?: keyof typeof Ionicons.glyphMap;
  // Si renseigne, on navigue reellement vers cet ecran en arrivant sur l'etape,
  // et le tooltip flotte par-dessus l'ecran REEL (pas de voile sombre qui le
  // cacherait) plutot que de juste pointer l'icone depuis Accueil.
  navigateTo?: { screen: string; nested?: string };
};

const tutorialSteps: TutorialStep[] = [
  {
    id: '1',
    title: 'Bienvenue sur MedFlow',
    description: "Votre application d'apprentissage medical intelligent. Suivez ce guide pour decouvrir toutes les fonctionnalites.",
  },
  {
    id: '2',
    title: 'Onglet "Accueil"',
    description: "C'est ici que vous trouverez tous vos parcours d'apprentissage.",
    highlightTab: 'home-tab',
    sectionLabel: 'Accueil',
    sectionIcon: 'home',
  },
  {
    id: '3',
    title: "Parcours d'apprentissage",
    description: 'Choisissez un parcours (Anatomie, Cardiologie, etc.) pour acceder aux lecons.',
    highlightElement: 'paths-section',
    sectionLabel: 'Accueil',
    sectionIcon: 'home',
  },
  {
    id: '4',
    title: 'Assistant IA',
    description: "Posez vos questions medicales a l'assistant, et partagez images ou documents directement dans la conversation.",
    navigateTo: { screen: 'AIChat', nested: 'MainTabs' },
    sectionLabel: 'IA Chat',
    sectionIcon: 'chatbubble-ellipses',
  },
  {
    id: '5',
    title: 'Ajouter un cours',
    description: "Importez un PDF de cours : MedFlow genere automatiquement un resume, des flashcards et un quiz grace a l'IA.",
    navigateTo: { screen: 'UploadCourse' },
    sectionLabel: 'Ajouter',
    sectionIcon: 'cloud-upload',
  },
  {
    id: '6',
    title: 'Tableau de bord',
    description: "Retrouvez tous vos cours importes. L'icone en haut a droite vous donne acces a votre progression detaillee (XP, lecons completees...).",
    navigateTo: { screen: 'Dashboard', nested: 'MainTabs' },
    sectionLabel: 'Dashboard',
    sectionIcon: 'grid',
  },
  {
    id: '7',
    title: 'Votre compte',
    description: "Gerez votre profil ici. L'icone en haut a droite ouvre les reglages : theme clair/sombre, mot de passe, et plus encore.",
    navigateTo: { screen: 'Account', nested: 'MainTabs' },
    sectionLabel: 'Compte',
    sectionIcon: 'person',
  },
  {
    id: '8',
    title: 'Pret a commencer !',
    description: 'Vous etes maintenant pret a utiliser MedFlow.',
    navigateTo: { screen: 'Home', nested: 'MainTabs' },
  },
];

interface TutorialScreenProps {
  visible: boolean;
  onComplete: () => void;
  navigation: any;
}

type Rect = { x: number; y: number; width: number; height: number };

export function getTabPosition(tabKey: TabKey): Rect {
  const idx = TAB_ORDER.indexOf(tabKey);
  const tabWidth = width / TAB_ORDER.length;
  return { x: idx * tabWidth, y: height - TAB_BAR_HEIGHT, width: tabWidth, height: TAB_BAR_HEIGHT };
}

export function getElementPosition(elementName: string): Rect {
  switch (elementName) {
    case 'paths-section':
      return { x: 20, y: 170, width: width - 40, height: 400 };
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

export function getHighlightRect(step: TutorialStep): Rect | null {
  if (step.highlightTab) return getTabPosition(step.highlightTab);
  if (step.highlightElement) return getElementPosition(step.highlightElement);
  return null;
}

export function TutorialScreen({ visible, onComplete, navigation }: TutorialScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const startedAtRef = useRef<number | null>(null);

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
  const isShowcase = !!step.navigateTo && !highlightRect;

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      startedAtRef.current = logTutorialStarted();
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

    if (startedAtRef.current !== null) {
      logStepViewed(startedAtRef.current, currentStep, step.id, step.title);
    }

    if (step.navigateTo && navigation?.isReady?.()) {
      if (step.navigateTo.nested) {
        navigation.navigate(step.navigateTo.nested, { screen: step.navigateTo.screen });
      } else {
        navigation.navigate(step.navigateTo.screen);
      }
    }

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
      if (startedAtRef.current !== null) {
        logTutorialCompleted(startedAtRef.current);
      }
      await markTutorialCompleted();
      onComplete();
    }
  };

  const handleSkip = async () => {
    if (startedAtRef.current !== null) {
      logTutorialSkipped(startedAtRef.current, currentStep, step.id, step.title);
    }
    await markTutorialCompleted();
    onComplete();
  };

  if (!visible) return null;

  const isLastStep = currentStep === tutorialSteps.length - 1;

  const getTooltipPosition = () => {
    // Dernière étape : pas de contenu précis à montrer, centrée comme l'intro
    // plutôt que collée en bas.
    if (isLastStep) {
      return { top: height / 2 - 140, left: 20, right: 20, position: 'absolute' as const };
    }
    if (step.highlightTab) {
      // Ancré depuis le BAS plutôt que le haut : la hauteur du tooltip varie
      // selon le texte, un offset fixe depuis le haut le faisait parfois
      // chevaucher la flèche/le spotlight de la tab bar en dessous.
      return { bottom: TAB_BAR_HEIGHT + 100, left: 20, right: 20, position: 'absolute' as const };
    }
    if (isShowcase) {
      // Sur un écran d'onglet, la tab bar (70px) reste visible sous l'écran
      // réel — il faut laisser de la place au-dessus d'elle, sinon le
      // tooltip la chevauche. Sur un écran poussé hors des tabs (Upload),
      // pas de tab bar : une simple marge suffit.
      const clearance = step.navigateTo?.nested ? TAB_BAR_HEIGHT + 20 : 30;
      return { bottom: clearance, left: 20, right: 20, position: 'absolute' as const };
    }
    return { top: height / 2 - 120, left: 20, right: 20, position: 'absolute' as const };
  };

  const tooltipStyle = getTooltipPosition();

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
                      { scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) },
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
              <Ionicons name="arrow-down" size={24} color={colors.primary} />
            </Animated.View>
          </>
        ) : isShowcase ? (
          <View style={styles.showcaseBlocker} />
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
            {step.sectionLabel ? (
              <View style={styles.sectionBadge}>
                <Ionicons name={step.sectionIcon!} size={13} color={colors.primary} />
                <Text style={styles.sectionBadgeText}>{step.sectionLabel}</Text>
              </View>
            ) : (
              <View />
            )}
            <View style={styles.tooltipHeaderRight}>
              <Text style={styles.stepCounter}>
                {currentStep + 1}/{tutorialSteps.length}
              </Text>
              <TouchableOpacity onPress={handleSkip} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          {/* Points de progression désormais DANS le tooltip : ne peuvent
              plus jamais chevaucher le texte, quelle que soit sa longueur. */}
          <View style={styles.progressRow}>
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

          <View style={styles.buttonContainer}>
            {currentStep > 0 && (
              <TouchableOpacity
                onPress={() => goToStep(currentStep - 1)}
                style={styles.backButton}
                accessibilityLabel="Étape précédente"
                accessibilityRole="button"
              >
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
    showcaseBlocker: {
      ...StyleSheet.absoluteFillObject,
      // Assombrit pour focus sur le tutoriel, mais assez léger pour que
      // l'écran réel (le "showcase") reste lisible en dessous.
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
      marginBottom: 14,
    },
    sectionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.tintPrimary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    sectionBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    tooltipHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    stepCounter: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    closeButton: {
      padding: 4,
    },
    title: {
      fontSize: 21,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 10,
      lineHeight: 26,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: 18,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 18,
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
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    progressDotActive: {
      width: 24,
      backgroundColor: colors.primary,
    },
    progressDotCompleted: {
      backgroundColor: colors.primary,
      opacity: 0.5,
    },
  });
}