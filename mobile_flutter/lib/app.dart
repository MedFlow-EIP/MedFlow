import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'navigation/main_shell.dart';
import 'navigation/nav.dart';
import 'navigation/routes.dart';
import 'screens/auth/login_screen.dart';
import 'screens/tutorial_screen.dart';
import 'theme/theme_controller.dart';
import 'utils/background_jobs.dart';
import 'utils/first_time.dart';
import 'utils/push_notifications.dart';
import 'utils/social_notifications.dart';
import 'utils/tutorial.dart';
import 'widgets/job_done_banner.dart';

class MedFlowApp extends StatelessWidget {
  const MedFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.watchTheme;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: theme.isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: MaterialApp(
        title: 'MedFlow',
        debugShowCheckedModeBanner: false,
        theme: theme.themeData,
        navigatorKey: navigatorKey,
        navigatorObservers: [routeObserver],
        onGenerateRoute: onGenerateRoute,
        locale: const Locale('fr', 'FR'),
        supportedLocales: const [Locale('fr', 'FR')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const AuthGate(),
        // Au-dessus de tous les écrans : bandeau « c'est prêt » et tutoriel.
        builder: (context, child) => StreamBuilder<User?>(
          stream: FirebaseAuth.instance.authStateChanges(),
          builder: (context, snap) {
            final loggedIn = snap.data != null;
            return Stack(
              children: [
                child ?? const SizedBox.shrink(),
                if (loggedIn) const JobDoneBanner(),
                if (loggedIn)
                  ValueListenableBuilder(
                    valueListenable: tutorialVisible,
                    builder: (_, visible, __) => visible ? const TutorialOverlay() : const SizedBox.shrink(),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Connexion → onglets ; déconnexion → écran de connexion (copie de AppNavigator).
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late final StreamSubscription<User?> _sub;
  late final AppLifecycleListener _lifecycle;
  User? _user;
  bool _loading = true;
  Timer? _socialTimer;

  @override
  void initState() {
    super.initState();
    _sub = FirebaseAuth.instance.authStateChanges().listen(_onUser);
    // Demandes d'ami et défis : vérifiés au retour dans l'app.
    _lifecycle = AppLifecycleListener(onResume: () {
      final u = _user;
      if (u != null) checkSocialNotifications(u);
    });
  }

  @override
  void dispose() {
    _sub.cancel();
    _lifecycle.dispose();
    _socialTimer?.cancel();
    super.dispose();
  }

  void _onUser(User? user) {
    final changed = user?.uid != _user?.uid;
    setState(() {
      _user = user;
      _loading = false;
    });
    if (!changed) return;
    // Retire les écrans empilés (inscription, réglages…) au changement de compte.
    navigatorKey.currentState?.popUntil((r) => r.isFirst);
    _socialTimer?.cancel();
    if (user == null) {
      resetSocialBadge();
      resetBackgroundJobs();
      hideTutorial();
      return;
    }
    resumeBackgroundJobs(user);
    registerForPushNotifications(user);
    checkSocialNotifications(user);
    // Et toutes les 2 minutes tant que l'app est ouverte.
    _socialTimer = Timer.periodic(const Duration(minutes: 2), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) checkSocialNotifications(user);
    });
    // Tutoriel : vérifié une fois par session, au login.
    isFirstTimeUser().then((first) {
      if (first) showTutorial();
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    if (_loading) {
      return Scaffold(
        backgroundColor: c.action,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: c.onAction, semanticsLabel: "Chargement de l'application"),
              const SizedBox(height: 12),
              Text('Chargement...', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: c.onAction)),
            ],
          ),
        ),
      );
    }
    return _user == null ? const LoginScreen() : const MainShell();
  }
}
