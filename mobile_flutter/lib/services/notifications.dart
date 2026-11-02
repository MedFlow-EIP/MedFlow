import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

/// Notifications locales (équivalent d'expo-notifications côté téléphone).
///
/// Les identifiants sont des chaînes, comme avec Expo (`exam-12-7`) ; ils
/// sont convertis en entier stable pour le plugin et gardés dans le payload.
class Notifs {
  Notifs._();

  static final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  /// Appelé quand on touche une notification (données envoyées avec elle).
  static void Function(Map<String, dynamic> data)? onTap;

  static const _details = NotificationDetails(
    android: AndroidNotificationDetails('default', 'MedFlow', importance: Importance.defaultImportance),
    iOS: DarwinNotificationDetails(presentAlert: true, presentSound: true, presentBadge: false),
  );

  static Future<void> init() async {
    if (_ready) return;
    try {
      tzdata.initializeTimeZones();
      try {
        tz.setLocalLocation(tz.getLocation(await FlutterTimezone.getLocalTimezone()));
      } catch (_) {}
      await _plugin.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(
            requestAlertPermission: false,
            requestBadgePermission: false,
            requestSoundPermission: false,
          ),
        ),
        onDidReceiveNotificationResponse: (r) => _handleTap(r.payload),
      );
      _ready = true;
      // Application lancée en touchant une notification.
      final launch = await _plugin.getNotificationAppLaunchDetails();
      if (launch?.didNotificationLaunchApp ?? false) {
        final payload = launch!.notificationResponse?.payload;
        Future.delayed(const Duration(milliseconds: 800), () => _handleTap(payload));
      }
    } catch (e) {
      debugPrint('Notifications indisponibles : $e');
    }
  }

  static void _handleTap(String? payload) {
    final data = _decode(payload)['data'];
    if (data is Map) onTap?.call(data.cast<String, dynamic>());
  }

  static Map<String, dynamic> _decode(String? payload) {
    if (payload == null) return const {};
    try {
      final v = jsonDecode(payload);
      return v is Map ? v.cast<String, dynamic>() : const {};
    } catch (_) {
      return const {};
    }
  }

  /// Hash FNV-1a 31 bits : même identifiant entier d'un lancement à l'autre.
  static int _intId(String identifier) {
    var h = 0x811c9dc5;
    for (final unit in utf8.encode(identifier)) {
      h ^= unit;
      h = (h * 0x01000193) & 0xffffffff;
    }
    return h & 0x7fffffff;
  }

  static Future<bool> isGranted() async {
    await init();
    try {
      if (Platform.isIOS) {
        final ios = _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
        final opts = await ios?.checkPermissions();
        return opts?.isEnabled ?? false;
      }
      final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      return await android?.areNotificationsEnabled() ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Demande la permission si besoin. Renvoie true si elle est accordée.
  static Future<bool> requestPermission() async {
    await init();
    if (await isGranted()) return true;
    try {
      if (Platform.isIOS) {
        final ios = _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
        return await ios?.requestPermissions(alert: true, sound: true, badge: false) ?? false;
      }
      final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      return await android?.requestNotificationsPermission() ?? false;
    } catch (_) {
      return false;
    }
  }

  static int _nextImmediate = 0;

  /// Notification immédiate.
  static Future<void> show(String title, String body, {Map<String, dynamic>? data}) async {
    await init();
    try {
      final id = _intId('now-${DateTime.now().microsecondsSinceEpoch}-${_nextImmediate++}');
      await _plugin.show(id, title, body, _details, payload: jsonEncode({'data': data}));
    } catch (_) {}
  }

  /// Planifie une notification. Renvoie son identifiant.
  static Future<String> schedule({
    String? identifier,
    required String title,
    required String body,
    required DateTime at,
    Map<String, dynamic>? data,
  }) async {
    await init();
    final id = identifier ?? 'n-${DateTime.now().microsecondsSinceEpoch}';
    await _plugin.zonedSchedule(
      _intId(id),
      title,
      body,
      tz.TZDateTime.from(at, tz.local),
      _details,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      payload: jsonEncode({'id': id, 'data': data}),
    );
    return id;
  }

  static Future<void> cancel(String identifier) async {
    await init();
    try {
      await _plugin.cancel(_intId(identifier));
    } catch (_) {}
  }

  /// Identifiants des notifications planifiées.
  static Future<List<String>> scheduledIdentifiers() async {
    await init();
    try {
      final pending = await _plugin.pendingNotificationRequests();
      return [
        for (final p in pending)
          if (_decode(p.payload)['id'] is String) _decode(p.payload)['id'] as String,
      ];
    } catch (_) {
      return const [];
    }
  }
}
