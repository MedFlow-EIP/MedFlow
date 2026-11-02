// Flutter 3.47 : CupertinoPageTransitionsBuilder n'est plus exporté par material.dart.
import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';
import 'colors.dart';

enum ThemePreference { system, light, dark }

const _storageKey = '@medflow/theme-preference';
const _contrastKey = '@medflow/high-contrast';

/// Thème clair / sombre / système et contraste élevé (copie de ThemeContext.tsx).
class ThemeController extends ChangeNotifier with WidgetsBindingObserver {
  ThemePreference _preference = ThemePreference.system;
  bool _highContrast = false;
  Brightness _systemBrightness = WidgetsBinding.instance.platformDispatcher.platformBrightness;

  ThemePreference get preference => _preference;
  bool get highContrast => _highContrast;

  bool get isDark =>
      _preference == ThemePreference.dark ||
      (_preference == ThemePreference.system && _systemBrightness == Brightness.dark);

  AppColors get colors {
    final base = isDark ? darkColors : lightColors;
    return _highContrast ? withHighContrast(base, isDark) : base;
  }

  /// À appeler avant runApp : évite un flash clair→sombre au démarrage.
  Future<void> load() async {
    WidgetsBinding.instance.addObserver(this);
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_storageKey);
      _preference = ThemePreference.values.firstWhere(
        (p) => p.name == stored,
        orElse: () => ThemePreference.system,
      );
      _highContrast = prefs.getString(_contrastKey) == 'true';
    } catch (_) {}
  }

  @override
  void didChangePlatformBrightness() {
    _systemBrightness = WidgetsBinding.instance.platformDispatcher.platformBrightness;
    notifyListeners();
  }

  void setPreference(ThemePreference pref) {
    _preference = pref;
    notifyListeners();
    // Non bloquant : si la persistance échoue, le choix reste actif pour la session.
    SharedPreferences.getInstance().then((p) => p.setString(_storageKey, pref.name)).catchError((_) => false);
  }

  void setHighContrast(bool on) {
    _highContrast = on;
    notifyListeners();
    SharedPreferences.getInstance().then((p) => p.setString(_contrastKey, '$on')).catchError((_) => false);
  }

  ThemeData get themeData {
    final c = colors;
    final base = isDark ? ThemeData.dark(useMaterial3: true) : ThemeData.light(useMaterial3: true);
    return base.copyWith(
      platform: iosLook ? TargetPlatform.iOS : null,
      scaffoldBackgroundColor: c.background,
      colorScheme: base.colorScheme.copyWith(
        primary: c.primary,
        onPrimary: c.onAction,
        secondary: c.secondary,
        surface: c.surface,
        onSurface: c.textPrimary,
        error: c.danger,
      ),
      dividerColor: c.border,
      textSelectionTheme: TextSelectionThemeData(cursorColor: c.primaryDark),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: c.primary),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      }),
    );
  }
}

extension ThemeContextX on BuildContext {
  /// Couleurs du thème courant (équivalent de `useTheme().colors`).
  AppColors get colors => watch<ThemeController>().colors;

  /// Couleurs sans abonnement (callbacks, initState).
  AppColors get readColors => read<ThemeController>().colors;

  bool get isDark => watch<ThemeController>().isDark;

  /// Contrôleur du thème (préférence, contraste élevé), avec abonnement.
  ThemeController get watchTheme => watch<ThemeController>();
}
