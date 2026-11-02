import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Hauteur utile de la barre d'onglets, hors zone système du bas.
const double tabBarHeight = 72;

/// Marge minimale sous la barre d'onglets sur les appareils sans zone système en bas.
const double _minBottom = 12;

/// Marges calculées depuis les safe areas (copie de useScreenInsets) :
/// - top : début du contenu sous la barre de statut
/// - bottom : zone système du bas
/// - tabBar : hauteur totale de la barre d'onglets, à réserver en bas des écrans à onglets
class ScreenInsets {
  final double top;
  final double bottom;
  final double tabBar;
  const ScreenInsets(this.top, this.bottom, this.tabBar);

  factory ScreenInsets.of(BuildContext context) {
    final padding = MediaQuery.paddingOf(context);
    final bottomPad = math.max(padding.bottom, _minBottom);
    return ScreenInsets(padding.top + 12, bottomPad, tabBarHeight + bottomPad);
  }
}
