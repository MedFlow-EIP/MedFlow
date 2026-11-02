import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/app_alert.dart';
import '../utils/course_documents.dart';
import '../widgets/insets.dart';
import '../widgets/ui.dart';

// Copie de components/screens/DocumentsScreen.tsx.

IconData _iconFor(String mime) => mime.startsWith('image/')
    ? Ionicons.image
    : mime.contains('presentation')
        ? Ionicons.easel
        : mime.contains('word')
            ? Ionicons.document
            : Ionicons.document_text;

String _formatDate(Object? iso) {
  if (iso is! String || iso.isEmpty) return '';
  final d = DateTime.tryParse('${iso.replaceFirst(' ', 'T')}Z');
  return d == null ? '' : DateFormat('d MMM y', 'fr_FR').format(d.toLocal());
}

/// Liste des documents importés, à rouvrir dans la visionneuse du téléphone.
class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> with FocusRefresh<DocumentsScreen> {
  List<Map<String, dynamic>>? _docs;
  ({num used, num max}) _usage = (used: 0, max: 1);
  String? _error;
  String? _opening;

  @override
  void onFocus() => _load();

  Future<void> _load() async {
    if (Api.currentUser == null) return;
    setState(() => _error = null);
    try {
      final data = await Api.getJson('/api/sources', fallback: 'Impossible de charger tes documents.');
      if (!mounted) return;
      setState(() {
        _docs = [
          for (final d in (data['documents'] as List? ?? const []))
            if (d is Map) d.cast<String, dynamic>(),
        ];
        _usage = (used: (data['used_bytes'] as num?) ?? 0, max: (data['max_bytes'] as num?) ?? 1);
      });
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Impossible de charger tes documents.'));
    }
  }

  Future<void> _open(Map<String, dynamic> doc, BuildContext rowContext) async {
    if (Api.currentUser == null || _opening != null) return;
    final origin = shareOrigin(rowContext);
    setState(() => _opening = '${doc['course_id']}');
    try {
      await openCourseDocument(
        courseId: '${doc['course_id']}',
        sourceName: '${doc['source_name']}',
        sourceMime: doc['source_mime'] as String?,
        origin: origin,
      );
    } catch (err) {
      appAlert('Ouverture impossible', errorMessage(err, 'Réessaie dans un instant.'));
    } finally {
      if (mounted) setState(() => _opening = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);

    if (_error != null && _docs == null) {
      return Scaffold(
        backgroundColor: c.background,
        body: StateView(
          icon: Ionicons.cloud_offline_outline,
          tone: Tone.neutral,
          title: 'Impossible de charger tes documents',
          subtitle: _error,
          primary: StateAction('Réessayer', _load),
          onClose: () => Nav.goBack(),
        ),
      );
    }

    final docs = _docs;
    return Scaffold(
      backgroundColor: c.background,
      body: Padding(
        padding: EdgeInsets.only(top: insets.top),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Row(
                children: [
                  CircleIconButton.back(() => Nav.goBack()),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text('Mes documents',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    ),
                  ),
                ],
              ),
            ),
            if (docs == null)
              Padding(
                padding: const EdgeInsets.only(top: 40),
                child: Center(
                  child: CircularProgressIndicator(color: c.primaryDark, semanticsLabel: 'Chargement'),
                ),
              )
            else
              Expanded(
                child: ListView.separated(
                  padding: EdgeInsets.fromLTRB(20, 0, 20, insets.bottom + 24),
                  // En-tête, puis les documents (ou l'état vide).
                  itemCount: 1 + (docs.isEmpty ? 1 : docs.length),
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    if (index == 0) return _usageHeader(context);
                    if (docs.isEmpty) return _empty(context);
                    return _row(context, docs[index - 1]);
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _usageHeader(BuildContext context) {
    final c = context.colors;
    final used = formatBytes(_usage.used);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${used.isEmpty ? '0 Ko' : used} utilisés sur ${formatBytes(_usage.max)}',
              style: TextStyle(fontSize: 13, color: c.textSecondary)),
          const SizedBox(height: 6),
          ProgressBar(progress: _usage.max > 0 ? (_usage.used / _usage.max) * 100 : 0, height: 6, color: c.primaryDark),
        ],
      ),
    );
  }

  Widget _empty(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          Icon(Ionicons.folder_open_outline, size: 36, color: c.textSecondary),
          const SizedBox(height: 8),
          Text('Les documents que tu importes apparaîtront ici.',
              textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.textSecondary)),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> item) {
    final c = context.colors;
    final id = '${item['course_id']}';
    final meta = [formatBytes(item['source_size'] as num?), _formatDate(item['created_at'])]
        .where((s) => s.isNotEmpty)
        .join(' · ');
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: Builder(
              builder: (rowContext) => Tappable(
                onTap: () => _open(item, rowContext),
                semanticLabel: 'Ouvrir ${item['source_name']}',
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: ExcludeSemantics(
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(12)),
                          child: _opening == id
                              ? SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2.5, color: c.primaryDark),
                                )
                              : Icon(_iconFor('${item['source_mime'] ?? ''}'), size: 22, color: c.primaryDark),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${item['source_name'] ?? ''}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                              const SizedBox(height: 2),
                              Text(meta,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 13, color: c.textSecondary)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          Tappable(
            onTap: () => Nav.navigate('CourseDetail', {'courseId': id}),
            semanticLabel: 'Voir le cours ${item['nom']}',
            child: SizedBox(
              width: 48,
              height: 48,
              child: Icon(Ionicons.school_outline, size: 20, color: c.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
