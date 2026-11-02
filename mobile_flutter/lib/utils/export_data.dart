import 'dart:convert';
import 'dart:io';
import 'dart:ui' show Rect;

import 'package:file_picker/file_picker.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../services/api.dart';

// Copie de utils/exportData.ts.

enum ExportResult { saved, shared, cancelled }

/// Export RGPD : récupère toutes les données du compte et les enregistre dans
/// un fichier JSON. Android : l'utilisateur choisit où l'enregistrer. iOS :
/// feuille de partage (``origin`` : point d'ancrage de la feuille sur iPad).
Future<ExportResult> exportUserData(User user, {Rect? origin}) async {
  final data = await Api.getJson(
    '/api/account/export',
    fallback: 'Export impossible. Réessaie.',
    timeout: const Duration(seconds: 60),
  );
  final json = const JsonEncoder.withIndent('  ').convert(data);
  final baseName = 'medflow-donnees-${DateTime.now().toUtc().toIso8601String().substring(0, 10)}';

  if (Platform.isAndroid) {
    final path = await FilePicker.saveFile(fileName: '$baseName.json', bytes: utf8.encode(json));
    return path == null ? ExportResult.cancelled : ExportResult.saved;
  }

  final dir = await getTemporaryDirectory();
  final path = '${dir.path}/$baseName.json';
  await File(path).writeAsString(json, encoding: utf8);
  final result = await SharePlus.instance.share(ShareParams(
    files: [XFile(path, mimeType: 'application/json')],
    title: 'Mes données MedFlow',
    sharePositionOrigin: origin,
  ));
  return result.status == ShareResultStatus.dismissed ? ExportResult.cancelled : ExportResult.shared;
}
