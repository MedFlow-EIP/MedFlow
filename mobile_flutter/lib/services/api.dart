import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import '../config.dart';

// Appels réseau avec délai maximum et messages d'erreur compréhensibles
// (copie de utils/network.ts et utils/authHeaders.ts).

const networkErrorMessage = 'Pas de connexion internet. Vérifie ton réseau puis réessaie.';
const timeoutErrorMessage = 'Le serveur met trop de temps à répondre. Réessaie dans un instant.';
const serverErrorMessage = 'Le serveur rencontre un problème. Réessaie dans un instant.';

/// Erreur déjà formulée pour l'utilisateur : son message peut être affiché tel quel.
class UserFacingError implements Exception {
  final String message;
  final int? status;
  UserFacingError(this.message, [this.status]);

  @override
  String toString() => message;
}

/// Message à montrer pour une réponse HTTP en erreur.
String httpErrorMessage(int status, dynamic body, String fallback) {
  if (body is Map && body['error'] is String && (body['error'] as String).isNotEmpty) {
    return body['error'] as String;
  }
  if (status >= 500) return serverErrorMessage;
  return fallback;
}

/// Message d'erreur à afficher, quelle que soit l'erreur attrapée.
String errorMessage(Object? err, String fallback) {
  if (err is UserFacingError) return err.message;
  return fallback;
}

/// Corps JSON d'une réponse (null s'il n'est pas lisible).
dynamic decodeBody(http.Response res) {
  if (res.bodyBytes.isEmpty) return null;
  try {
    return jsonDecode(utf8.decode(res.bodyBytes));
  } catch (_) {
    return null;
  }
}

/// Lit la réponse JSON et lève une UserFacingError si le statut est en erreur.
dynamic readJsonOrThrow(http.Response res, String fallback) {
  final body = decodeBody(res);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw UserFacingError(httpErrorMessage(res.statusCode, body, fallback), res.statusCode);
  }
  if (body == null) throw UserFacingError(fallback, res.statusCode);
  return body;
}

/// Client de l'API MedFlow. Toutes les routes passent par ici.
class Api {
  Api._();

  static User? get currentUser => FirebaseAuth.instance.currentUser;

  static Uri uri(String path, [Map<String, dynamic>? query]) {
    final u = Uri.parse('$apiUrl$path');
    if (query == null || query.isEmpty) return u;
    return u.replace(queryParameters: {
      ...u.queryParameters,
      for (final e in query.entries)
        if (e.value != null) e.key: '${e.value}',
    });
  }

  /// En-têtes d'authentification : token Firebase + anciens en-têtes X-User-*
  /// (lus seulement par le backend en mode dev) + décalage horaire du téléphone.
  static Future<Map<String, String>> authHeaders([User? user]) async {
    final u = user ?? currentUser;
    if (u == null) return {'X-TZ-Offset': '${DateTime.now().timeZoneOffset.inMinutes}'};
    final token = await u.getIdToken();
    return {
      'Authorization': 'Bearer $token',
      'X-User-UID': u.uid,
      'X-User-Name': _headerSafe(u.displayName ?? ''),
      'X-User-Avatar': u.photoURL ?? '',
      'X-User-Email': u.email ?? '',
      // Le serveur, en UTC, compte « aujourd'hui » comme le téléphone.
      'X-TZ-Offset': '${DateTime.now().timeZoneOffset.inMinutes}',
    };
  }

  /// Les en-têtes HTTP n'acceptent que du latin-1 ; RN les envoyait tels quels.
  static String _headerSafe(String v) =>
      String.fromCharCodes(v.runes.map((r) => r > 255 ? 0x3F : r));

  /// Requête brute (statut à examiner par l'appelant). Lève une UserFacingError
  /// en cas de coupure réseau ou de délai dépassé (30 s par défaut).
  static Future<http.Response> send(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    Map<String, String>? headers,
    Duration timeout = const Duration(seconds: 30),
    bool auth = true,
  }) async {
    final h = <String, String>{
      if (auth) ...await authHeaders(),
      if (body != null) 'Content-Type': 'application/json',
      ...?headers,
    };
    final request = http.Request(method, uri(path, query))..headers.addAll(h);
    if (body != null) request.body = body is String ? body : jsonEncode(body);
    try {
      final streamed = await http.Client().send(request).timeout(timeout);
      return await http.Response.fromStream(streamed).timeout(timeout);
    } on TimeoutException {
      throw UserFacingError(timeoutErrorMessage);
    } on SocketException {
      throw UserFacingError(networkErrorMessage);
    } on http.ClientException {
      throw UserFacingError(networkErrorMessage);
    } on HandshakeException {
      throw UserFacingError(networkErrorMessage);
    }
  }

  static Future<http.Response> get(String path, {Map<String, dynamic>? query, Duration? timeout}) =>
      send('GET', path, query: query, timeout: timeout ?? const Duration(seconds: 30));

  static Future<http.Response> post(String path, [Object? body, Duration? timeout]) =>
      send('POST', path, body: body ?? const {}, timeout: timeout ?? const Duration(seconds: 30));

  static Future<http.Response> put(String path, [Object? body]) => send('PUT', path, body: body ?? const {});

  static Future<http.Response> patch(String path, [Object? body]) => send('PATCH', path, body: body ?? const {});

  static Future<http.Response> delete(String path, [Object? body]) => send('DELETE', path, body: body);

  /// GET + lecture JSON ; lève une UserFacingError (message serveur ou ``fallback``).
  static Future<dynamic> getJson(String path,
      {String fallback = 'Chargement impossible. Réessaie.', Map<String, dynamic>? query, Duration? timeout}) async {
    return readJsonOrThrow(await get(path, query: query, timeout: timeout), fallback);
  }

  static Future<dynamic> postJson(String path, Object? body,
      {String fallback = 'Une erreur est survenue. Réessaie.', Duration? timeout}) async {
    return readJsonOrThrow(await post(path, body, timeout), fallback);
  }

  static Future<dynamic> putJson(String path, Object? body, {String fallback = 'Une erreur est survenue. Réessaie.'}) async {
    return readJsonOrThrow(await put(path, body), fallback);
  }

  static Future<dynamic> patchJson(String path, Object? body, {String fallback = 'Une erreur est survenue. Réessaie.'}) async {
    return readJsonOrThrow(await patch(path, body), fallback);
  }

  static Future<dynamic> deleteJson(String path, {Object? body, String fallback = 'Une erreur est survenue. Réessaie.'}) async {
    return readJsonOrThrow(await delete(path, body), fallback);
  }

  /// Envoi multipart (fichiers). ``files`` : nom du champ → fichier(s).
  static Future<http.Response> multipart(
    String path, {
    Map<String, String> fields = const {},
    List<http.MultipartFile> files = const [],
    Duration timeout = const Duration(seconds: 120),
  }) async {
    final request = http.MultipartRequest('POST', uri(path))
      ..headers.addAll(await authHeaders())
      ..fields.addAll(fields)
      ..files.addAll(files);
    try {
      final streamed = await request.send().timeout(timeout);
      return await http.Response.fromStream(streamed).timeout(timeout);
    } on TimeoutException {
      throw UserFacingError(timeoutErrorMessage);
    } on SocketException {
      throw UserFacingError(networkErrorMessage);
    } on http.ClientException {
      throw UserFacingError(networkErrorMessage);
    }
  }
}
