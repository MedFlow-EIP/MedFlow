import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
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
import { useScreenInsets } from '../navigation/constants';

type Tone = 'primary' | 'success' | 'warning';

export type TutorialSlide = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: Tone;
  title: string;
  text: string;
  /** Petites étiquettes autour de l'illustration (formats, exemples…). */
  chips?: string[];
  /** Où retrouver la fonctionnalité dans l'app. */
  where?: { icon: keyof typeof Ionicons.glyphMap; label: string };
};

// Accueil en quelques cartes, sans quitter l'écran : on présente ce que
// l'app apporte, puis on propose d'importer tout de suite un premier cours.
export const TUTORIAL_SLIDES: TutorialSlide[] = [
  {
    id: 'welcome',
    icon: 'medkit',
    tone: 'primary',
    title: 'Bienvenue sur MedFlow',
    text: 'Tes cours de médecine deviennent des résumés, des flashcards et des quiz. Tu révises moins longtemps, et tu retiens mieux.',
  },
  {
    id: 'import',
    icon: 'cloud-upload',
    tone: 'primary',
    title: 'Importe tes cours',
    text: 'Un PDF, un Word, un PowerPoint ou une simple photo d’un poly : l’IA en tire l’essentiel en moins d’une minute.',
    chips: ['PDF', 'Word', 'PowerPoint', 'Photo'],
    where: { icon: 'add', label: 'Bouton + au centre de la barre du bas' },
  },
  {
    id: 'revision',
    icon: 'flash',
    tone: 'warning',
    title: 'Révise au bon moment',
    text: 'La répétition espacée te repropose chaque carte juste avant que tu l’oublies. Un rappel quotidien te prévient quand il y en a à revoir.',
    chips: ['Aujourd’hui', 'Dans 3 j', 'Dans 1 sem.'],
    where: { icon: 'home', label: 'Accueil, carte « Aujourd’hui »' },
  },
  {
    id: 'assistant',
    icon: 'chatbubble-ellipses',
    tone: 'primary',
    title: 'Un assistant pour tes questions',
    text: 'Demande une explication, envoie une photo ou un PDF, puis transforme ses réponses en flashcards en un geste.',
    where: { icon: 'chatbubble-ellipses', label: 'Onglet IA Chat' },
  },
  {
    id: 'progress',
    icon: 'trophy',
    tone: 'success',
    title: 'Garde le rythme',
    text: 'Leçons guidées, XP, séries, badges et classement entre amis : chaque jour de révision compte.',
    where: { icon: 'home', label: 'Onglet Accueil' },
  },
];

interface TutorialScreenProps {
  visible: boolean;
  onComplete: () => void;
  navigation: any;
}

export function TutorialScreen({ visible, onComplete, navigation }: TutorialScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();
  const { width } = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<TutorialSlide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const startedAtRef = useRef<number | null>(null);

  const slide = TUTORIAL_SLIDES[index];
  const isLast = index === TUTORIAL_SLIDES.length - 1;

  useEffect(() => {
    if (visible) {
      setIndex(0);
      scrollX.setValue(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      startedAtRef.current = logTutorialStarted();
    }
  }, [visible]);

  useEffect(() => {
    if (visible && startedAtRef.current !== null) {
      logStepViewed(startedAtRef.current, index, slide.id, slide.title);
    }
  }, [index, visible]);

  const goTo = (next: number) => {
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const finish = async (then?: () => void) => {
    if (startedAtRef.current !== null) logTutorialCompleted(startedAtRef.current);
    await markTutorialCompleted();
    onComplete();
    then?.();
  };

  const skip = async () => {
    if (startedAtRef.current !== null) {
      logTutorialSkipped(startedAtRef.current, index, slide.id, slide.title);
    }
    await markTutorialCompleted();
    onComplete();
  };

  const openUpload = () => {
    if (navigation?.isReady?.()) navigation.navigate('UploadCourse');
  };

  const openHome = () => {
    if (navigation?.isReady?.()) navigation.navigate('MainTabs', { screen: 'Home' });
  };

  const toneColors: Record<Tone, { bg: string; fg: string }> = {
    primary: { bg: colors.tintPrimary, fg: colors.primaryDark },
    success: { bg: colors.tintSuccess, fg: colors.success },
    warning: { bg: colors.tintWarning, fg: colors.warning },
  };

  const renderSlide = ({ item }: { item: TutorialSlide }) => {
    const tone = toneColors[item.tone];
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.illustration} importantForAccessibility="no-hide-descendants">
          <View style={[styles.halo, { backgroundColor: tone.bg }]} />
          <View style={[styles.iconCircle, { backgroundColor: colors.surface, borderColor: tone.bg }]}>
            <Ionicons name={item.icon} size={56} color={tone.fg} />
          </View>
          {item.chips?.map((chip, i) => (
            <View key={chip} style={[styles.chip, CHIP_POSITIONS[i % CHIP_POSITIONS.length]]}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.title} accessibilityRole="header">{item.title}</Text>
        <Text style={styles.text}>{item.text}</Text>

        {item.where && (
          <View style={styles.where}>
            <View style={styles.whereIcon}>
              <Ionicons name={item.where.icon} size={16} color={colors.primaryDark} />
            </View>
            <Text style={styles.whereText}>{item.where.label}</Text>
          </View>
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={skip}>
      <View style={[styles.container, { paddingTop: top + 8, paddingBottom: bottom + 16 }]}>
        <View style={styles.topBar}>
          <Text style={styles.counter} accessibilityLabel={`Étape ${index + 1} sur ${TUTORIAL_SLIDES.length}`}>
            {index + 1}/{TUTORIAL_SLIDES.length}
          </Text>
          {!isLast && (
            <TouchableOpacity onPress={skip} style={styles.skipButton} accessibilityRole="button" accessibilityLabel="Passer le tutoriel">
              <Text style={styles.skipText}>Passer</Text>
            </TouchableOpacity>
          )}
        </View>

        <Animated.FlatList
          ref={listRef as any}
          data={TUTORIAL_SLIDES}
          keyExtractor={(item) => item.id}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onScrollEnd}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          style={styles.list}
        />

        {/* Points de progression : s'allongent en suivant le glissement du doigt. */}
        <View style={styles.dots} importantForAccessibility="no-hide-descendants">
          {TUTORIAL_SLIDES.map((s, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            return (
              <TouchableOpacity key={s.id} onPress={() => goTo(i)} hitSlop={8}>
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      width: scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' }),
                      opacity: scrollX.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' }),
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.actions}>
          {isLast ? (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={() => finish(openUpload)} accessibilityRole="button">
                <Ionicons name="cloud-upload-outline" size={20} color={colors.onAction} />
                <Text style={styles.primaryText}>Importer mon premier cours</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => finish(openHome)} accessibilityRole="button">
                <Text style={styles.secondaryText}>Découvrir l’app d’abord</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.navRow}>
              {index > 0 ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => goTo(index - 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Étape précédente"
                >
                  <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.primaryButton, styles.flex]} onPress={() => goTo(index + 1)} accessibilityRole="button">
                <Text style={styles.primaryText}>{index === 0 ? 'C’est parti' : 'Suivant'}</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.onAction} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Étiquettes réparties autour de l'illustration.
const CHIP_POSITIONS = [
  { top: 18, left: 8 },
  { top: 40, right: 0 },
  { bottom: 30, left: 0 },
  { bottom: 8, right: 16 },
] as const;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingHorizontal: 20,
    },
    counter: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    skipButton: {
      minHeight: 44,
      paddingHorizontal: 12,
      justifyContent: 'center',
    },
    skipText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
    },
    list: {
      flex: 1,
    },
    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 14,
    },
    illustration: {
      width: 240,
      height: 220,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    halo: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
    },
    iconCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 6,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 6,
    },
    chip: {
      position: 'absolute',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    title: {
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.textPrimary,
    },
    text: {
      fontSize: 16,
      lineHeight: 24,
      textAlign: 'center',
      color: colors.textSecondary,
      maxWidth: 360,
    },
    where: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
      paddingLeft: 6,
      paddingRight: 14,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    whereIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    whereText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 20,
    },
    dot: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.action,
    },
    actions: {
      paddingHorizontal: 20,
      gap: 8,
    },
    navRow: {
      flexDirection: 'row',
      gap: 12,
    },
    flex: {
      flex: 1,
    },
    backButton: {
      width: 56,
      height: 56,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      height: 56,
      paddingHorizontal: 20,
      borderRadius: 16,
      backgroundColor: colors.action,
    },
    primaryText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.onAction,
    },
    secondaryButton: {
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryText,
    },
  });
}
