import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../navigation/nav.dart';
import '../services/api.dart';

// Documents d'origine des cours (PDF, Word, PowerPoint, photo) : téléchargés
// puis ouverts dans la visionneuse du téléphone (copie de utils/courseDocuments.ts).
//
// Un document est une Map JSON de /api/sources : course_id, nom, source_name,
// source_size, source_mime, created_at.

String formatBytes(num? bytes) {
  if (bytes == null || bytes == 0) return '';
  if (bytes < 1024 * 1024) return '${math.max(1, (bytes / 1024).round())} Ko';
  return '${(bytes / 1024 / 1024).toStringAsFixed(1).replaceAll('.', ',')} Mo';
}

final _extension = RegExp(r'\.[A-Za-z0-9]{1,5}$');

/// Nom de fichier sûr pour le cache (le nom d'origine peut contenir n'importe quoi).
String cacheFileName(String courseId, String sourceName) {
  final ext = (_extension.firstMatch(sourceName)?.group(0) ?? '').toLowerCase();
  var base = sourceName.replaceFirst(_extension, '').replaceAll(RegExp(r'[^A-Za-z0-9_-]+'), '_');
  if (base.length > 60) base = base.substring(0, 60);
  if (base.isEmpty) base = 'document';
  var id = courseId.replaceAll(RegExp(r'[^A-Za-z0-9_-]+'), '');
  if (id.length > 20) id = id.substring(0, 20);
  return '$base-$id$ext';
}

/// Zone d'où part la feuille de partage : obligatoire sur iPad (sinon le partage
/// échoue). Par défaut, le centre de l'écran.
Rect? shareOrigin([BuildContext? context]) {
  final box = (context ?? navigatorKey.currentContext)?.findRenderObject();
  if (box is! RenderBox || !box.hasSize) return null;
  if (context != null) return box.localToGlobal(Offset.zero) & box.size;
  return Rect.fromCenter(center: box.size.center(Offset.zero), width: 1, height: 1);
}

/// Télécharge le document d'origine dans le cache puis l'ouvre.
/// Lève une [UserFacingError] si le téléchargement échoue.
Future<void> openCourseDocument({
  required String courseId,
  required String sourceName,
  String? sourceMime,
  Rect? origin,
}) async {
  final folder = Directory('${(await getTemporaryDirectory()).path}/documents');
  try {
    await folder.create(recursive: true);
  } catch (_) {}
  final file = File('${folder.path}/${cacheFileName(courseId, sourceName)}');

  final headers = await Api.authHeaders();
  final client = Api.clientFactory();
  try {
    final http.StreamedResponse res;
    try {
      final request = http.Request('GET', Api.uri('/api/course/${Uri.encodeComponent(courseId)}/source'))
        ..headers.addAll(headers);
      res = await client.send(request);
    } catch (_) {
      throw UserFacingError(networkErrorMessage);
    }
    if (res.statusCode != 200) {
      await res.stream.drain<void>().catchError((_) {});
      try {
        if (await file.exists()) await file.delete();
      } catch (_) {}
      throw UserFacingError('Document d’origine indisponible.');
    }
    try {
      await res.stream.pipe(file.openWrite());
    } catch (_) {
      try {
        if (await file.exists()) await file.delete();
      } catch (_) {}
      throw UserFacingError(networkErrorMessage);
    }
  } finally {
    client.close();
  }

  // iOS (et Android, faute d'ouverture directe ici) : feuille de partage, d'où
  // l'on choisit la visionneuse (Fichiers, Livres, Word…).
  await SharePlus.instance.share(ShareParams(
    files: [XFile(file.path, mimeType: sourceMime)],
    title: sourceName,
    sharePositionOrigin: origin ?? shareOrigin(),
  ));
}
