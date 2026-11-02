import 'package:flutter/material.dart';

/// Navigation globale (équivalent de navigationRef / navigation.navigate).
///
/// Les noms d'écrans sont ceux de l'app React Native : `CourseDetail`,
/// `Revision`, `ClinicalCase`… Les paramètres passent dans une Map, comme
/// `navigation.navigate('CourseDetail', { courseId })`.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

/// Observateur des routes : permet aux écrans de se recharger quand on y revient.
final RouteObserver<ModalRoute<void>> routeObserver = RouteObserver<ModalRoute<void>>();

/// Onglets de la barre du bas.
const tabRoutes = ['Home', 'AIChat', 'Dashboard', 'Account'];

/// Onglet sélectionné, avec ses paramètres (ex. AIChat {prompt}).
class TabState {
  final String route;
  final Map<String, dynamic>? params;
  final int stamp;
  const TabState(this.route, [this.params, this.stamp = 0]);
}

final ValueNotifier<TabState> currentTab = ValueNotifier(const TabState('Home'));

class Nav {
  Nav._();

  static NavigatorState? get _nav => navigatorKey.currentState;

  /// Ouvre un écran par son nom. Un nom d'onglet (Home, AIChat, Dashboard,
  /// Account) revient aux onglets et sélectionne celui-ci.
  /// `MainTabs` avec `{screen, params}` est aussi accepté (forme React Navigation).
  static Future<T?> navigate<T>(String name, [Map<String, dynamic>? params]) async {
    if (name == 'MainTabs') {
      final screen = params?['screen'] as String? ?? 'Home';
      return navigate(screen, (params?['params'] as Map?)?.cast<String, dynamic>());
    }
    if (tabRoutes.contains(name)) {
      _nav?.popUntil((r) => r.isFirst);
      currentTab.value = TabState(name, params, DateTime.now().microsecondsSinceEpoch);
      return null;
    }
    return _nav?.pushNamed<T>(name, arguments: params ?? const <String, dynamic>{});
  }

  /// Remplace l'écran courant (navigation.replace).
  static Future<T?> replace<T>(String name, [Map<String, dynamic>? params]) async {
    return _nav?.pushReplacementNamed<T, Object?>(name, arguments: params ?? const <String, dynamic>{});
  }

  static void goBack<T>([T? result]) {
    if (_nav?.canPop() ?? false) _nav!.pop<T>(result);
  }

  static bool canGoBack() => _nav?.canPop() ?? false;

  static void popToTop() => _nav?.popUntil((r) => r.isFirst);
}

/// Paramètres de l'écran courant (équivalent de `route.params`).
Map<String, dynamic> routeParams(BuildContext context) {
  final args = ModalRoute.of(context)?.settings.arguments;
  if (args is Map) return args.cast<String, dynamic>();
  return const {};
}

/// Recharge un écran quand il redevient visible (équivalent de useFocusEffect) :
/// retour depuis un écran empilé, ou sélection de son onglet.
///
/// ```dart
/// class _MyState extends State<My> with FocusRefresh<My> {
///   @override
///   String? get tabName => 'Home'; // pour un écran d'onglet, sinon null
///   @override
///   void onFocus() => _load();
/// }
/// ```
mixin FocusRefresh<T extends StatefulWidget> on State<T> implements RouteAware {
  /// Nom de l'onglet si l'écran est un onglet (Home, AIChat, Dashboard, Account).
  String? get tabName => null;

  /// Appelé à l'affichage initial puis à chaque retour sur l'écran.
  void onFocus();

  ModalRoute<void>? _route;

  @override
  void initState() {
    super.initState();
    if (tabName != null) currentTab.addListener(_onTab);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (tabName == null || currentTab.value.route == tabName) onFocus();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route != null && route != _route) {
      if (_route != null) routeObserver.unsubscribe(this);
      _route = route;
      routeObserver.subscribe(this, route);
    }
  }

  void _onTab() {
    if (mounted && currentTab.value.route == tabName && (_route?.isCurrent ?? true)) onFocus();
  }

  @override
  void didPush() {}

  @override
  void didPop() {}

  @override
  void didPushNext() {}

  @override
  void didPopNext() {
    if (tabName == null || currentTab.value.route == tabName) onFocus();
  }

  @override
  void dispose() {
    routeObserver.unsubscribe(this);
    if (tabName != null) currentTab.removeListener(_onTab);
    super.dispose();
  }
}
