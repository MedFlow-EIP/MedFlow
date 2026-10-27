import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Hauteur utile de la barre d'onglets, hors zone système du bas (barre de gestes / home indicator). */
export const TAB_BAR_HEIGHT = 72;

/** Marge minimale sous la barre d'onglets sur les appareils sans zone système en bas. */
const MIN_BOTTOM = 12;

/**
 * Marges calculées à partir des safe areas réelles de l'appareil (encoche,
 * barre de statut, barre de gestes Android) au lieu de paddings fixes.
 * - top : début du contenu sous la barre de statut
 * - bottom : zone système du bas
 * - tabBarHeight : hauteur totale de la barre d'onglets, à réserver en bas des écrans à onglets
 */
export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, MIN_BOTTOM);
  return {
    top: insets.top + 12,
    bottom: bottomPad,
    tabBarHeight: TAB_BAR_HEIGHT + bottomPad,
  };
}
