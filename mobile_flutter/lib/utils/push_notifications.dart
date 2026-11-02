import 'dart:async';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../services/api.dart';
import '../services/notifications.dart';

// Notifications push (demandes d'ami, défis, cours prêt) via Firebase Cloud
// Messaging : le serveur envoie aux jetons FCM, l'app Expo garde ses jetons
// Expo (backend/services/push.py). Sur iOS, il faut la clé APNs dans la
// console Firebase : sans elle, l'enregistrement échoue en silence et l'app
// garde ses notifications locales (vérification à l'ouverture).

String? _currentToken;
StreamSubscription<String>? _refreshSub;

/// Vrai quand le serveur peut joindre ce téléphone : les notifications locales doublonneraient.
bool isPushActive() => _currentToken != null;

/// À appeler une fois au démarrage : affichage app ouverte et ouverture de
/// l'écran concerné quand on touche une notification push.
Future<void> initPushHandlers(void Function(Map<String, dynamic> data) onTap) async {
  try {
    final messaging = FirebaseMessaging.instance;
    // App ouverte : la notification s'affiche quand même, comme avec Expo.
    await messaging.setForegroundNotificationPresentationOptions(alert: true, sound: true, badge: false);
    if (Platform.isAndroid) {
      // Android n'affiche pas les push reçues app ouverte : on les montre en local.
      FirebaseMessaging.onMessage.listen((m) {
        final n = m.notification;
        if (n != null) Notifs.show(n.title ?? '', n.body ?? '', data: m.data);
      });
    }
    FirebaseMessaging.onMessageOpenedApp.listen((m) => onTap(m.data));
    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      Future.delayed(const Duration(milliseconds: 800), () => onTap(initial.data));
    }
  } catch (_) {
    // Push indisponibles : les notifications locales restent.
  }
}

Future<bool> _sendToken(String token) async {
  final res = await Api.post('/api/push-token', {'token': token});
  return res.statusCode == 200;
}

/// Récupère le jeton de l'appareil et l'envoie au serveur (si les
/// notifications sont autorisées).
Future<String?> registerForPushNotifications(User user) async {
  try {
    if (!await Notifs.isGranted()) return null;
    final messaging = FirebaseMessaging.instance;
    if (Platform.isIOS) {
      // Le jeton FCM dépend du jeton APNs, qui peut arriver juste après le lancement.
      var apns = await messaging.getAPNSToken();
      for (var i = 0; apns == null && i < 5; i++) {
        await Future.delayed(const Duration(seconds: 1));
        apns = await messaging.getAPNSToken();
      }
      if (apns == null) return null;
    }
    final token = await messaging.getToken();
    if (token == null || !await _sendToken(token)) return null;
    _currentToken = token;
    _refreshSub ??= messaging.onTokenRefresh.listen((fresh) async {
      if (FirebaseAuth.instance.currentUser == null) return;
      try {
        if (await _sendToken(fresh)) _currentToken = fresh;
      } catch (_) {}
    });
    return token;
  } catch (_) {
    // Clé APNs absente, simulateur, pas de réseau… : on reste sur les notifications locales.
    return null;
  }
}

/// À la déconnexion : ce téléphone ne doit plus recevoir les notifications de ce compte.
Future<void> unregisterPushNotifications(User user) async {
  final token = _currentToken;
  _currentToken = null;
  await _refreshSub?.cancel();
  _refreshSub = null;
  if (token == null) return;
  try {
    await Api.delete('/api/push-token', {'token': token});
  } catch (_) {
    // Le serveur oubliera le jeton quand FCM le signalera comme invalide.
  }
}

int? _intOf(Object? v) => v is num ? v.toInt() : (v is String ? int.tryParse(v) : null);

/// Écran à ouvrir quand on touche une notification. Les données FCM sont
/// toujours des chaînes : les identifiants numériques sont reconvertis.
({String screen, Map<String, dynamic>? params})? notificationTarget(Map<String, dynamic>? data) {
  if (data == null) return null;
  final courseId = data['courseId'];
  if (courseId is String && courseId.isNotEmpty) return (screen: 'CourseDetail', params: {'courseId': courseId});
  final challengeId = _intOf(data['challengeId']);
  if (data['screen'] == 'Challenge' && challengeId != null) {
    return (screen: 'Challenge', params: {'challengeId': challengeId});
  }
  final caseId = _intOf(data['caseId']);
  if (data['screen'] == 'ClinicalCase' && caseId != null) {
    return (screen: 'ClinicalCase', params: {'caseId': caseId});
  }
  if (data['screen'] == 'Friends') return (screen: 'Friends', params: null);
  return null;
}
