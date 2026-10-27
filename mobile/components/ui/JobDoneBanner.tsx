import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useScreenInsets } from '../navigation/constants';
import { useImportJobs } from '../../utils/importJobs';
import { useCaseJobs } from '../../utils/caseJobs';
import { bannerJobs, newlyFinished, type BannerJob } from '../../utils/jobBanner';

const VISIBLE_MS = 9000;

/** Bandeau en haut de l'écran quand un import ou un cas clinique est terminé. */
export function JobDoneBanner({ onOpen }: { onOpen: (target: NonNullable<BannerJob['target']>) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top } = useScreenInsets();
  const imports = useImportJobs();
  const cases = useCaseJobs();
  const wasPending = useRef(new Set<string>());
  const [shown, setShown] = useState<BannerJob | null>(null);

  useEffect(() => {
    const finished = newlyFinished(wasPending.current, bannerJobs(imports, cases));
    if (finished.length > 0) setShown(finished[finished.length - 1]);
  }, [imports, cases]);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  const open = () => {
    if (shown.target) onOpen(shown.target);
    setShown(null);
  };

  return (
    <Animated.View
      key={shown.key}
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={[styles.banner, { top }]}
      accessibilityLiveRegion="polite"
    >
      <TouchableOpacity
        style={styles.main}
        onPress={open}
        disabled={!shown.target}
        accessibilityRole="button"
        accessibilityLabel={shown.target ? `${shown.title}. Ouvrir` : shown.title}
      >
        <Ionicons
          name={shown.ok ? 'checkmark-circle' : 'alert-circle'}
          size={22}
          color={shown.ok ? colors.successText : colors.dangerText}
        />
        <Text style={styles.title} numberOfLines={2}>
          {shown.title}
        </Text>
        {shown.target && <Text style={styles.link}>Voir</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setShown(null)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 100,
      elevation: 10,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    link: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
  });
}
