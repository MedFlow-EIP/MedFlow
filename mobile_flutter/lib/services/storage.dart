import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Stockage clé/valeur du téléphone (équivalent d'AsyncStorage).
/// Toutes les méthodes sont best-effort : un échec ne casse jamais l'écran.
class Storage {
  Storage._();

  // getInstance garde déjà l'instance en cache.
  static Future<SharedPreferences> get _p => SharedPreferences.getInstance();

  static Future<String?> getString(String key) async {
    try {
      return (await _p).getString(key);
    } catch (_) {
      return null;
    }
  }

  static Future<void> setString(String key, String value) async {
    try {
      await (await _p).setString(key, value);
    } catch (_) {}
  }

  static Future<void> remove(String key) async {
    try {
      await (await _p).remove(key);
    } catch (_) {}
  }

  static Future<dynamic> getJson(String key) async {
    final raw = await getString(key);
    if (raw == null) return null;
    try {
      return jsonDecode(raw);
    } catch (_) {
      return null;
    }
  }

  static Future<void> setJson(String key, Object? value) => setString(key, jsonEncode(value));
}
