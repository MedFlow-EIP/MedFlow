import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../services/api.dart';
import '../theme/theme_controller.dart';
import 'sheet.dart';

/// Contenu signalé. ``kind`` : summary | flashcard | quiz | chat | case.
class ReportTarget {
  final String kind;

  /// Le contenu jugé faux, tel qu'affiché.
  final String excerpt;
  final String? courseId;
  const ReportTarget({required this.kind, required this.excerpt, this.courseId});
}

/// « Signaler une erreur » sur un contenu généré par l'IA. Les signalements
/// mesurent la confiance dans le contenu (hypothèse du beta test).
Future<void> showReportErrorSheet(BuildContext context, ReportTarget target, {VoidCallback? onSent}) {
  return showAppSheet<void>(
    context,
    showClose: false,
    builder: (_) => _ReportErrorBody(target: target, onSent: onSent),
  );
}

class _ReportErrorBody extends StatefulWidget {
  final ReportTarget target;
  final VoidCallback? onSent;
  const _ReportErrorBody({required this.target, this.onSent});

  @override
  State<_ReportErrorBody> createState() => _ReportErrorBodyState();
}

class _ReportErrorBodyState extends State<_ReportErrorBody> {
  final _comment = TextEditingController();
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final excerpt = widget.target.excerpt;
      await Api.postJson(
        '/api/reports',
        {
          'kind': widget.target.kind,
          'excerpt': excerpt.length > 2000 ? excerpt.substring(0, 2000) : excerpt,
          'comment': _comment.text.trim(),
          if (widget.target.courseId != null) 'course_id': widget.target.courseId,
        },
        fallback: 'Le signalement n’a pas pu être envoyé.',
      );
      setState(() => _sent = true);
      widget.onSent?.call();
    } catch (err) {
      setState(() => _error = errorMessage(err, 'Le signalement n’a pas pu être envoyé.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final primary = SizedBox(
      height: 52,
      child: TextButton(
        style: TextButton.styleFrom(
          backgroundColor: c.action,
          shape: const StadiumBorder(),
        ),
        onPressed: _sent ? () => Navigator.of(context).pop() : (_busy ? null : _send),
        child: _busy
            ? SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: c.onAction))
            : Text(_sent ? 'Fermer' : 'Envoyer le signalement',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction)),
      ),
    );

    if (_sent) {
      return Semantics(
        liveRegion: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(Ionicons.checkmark_circle, size: 40, color: c.successText),
            const SizedBox(height: 10),
            Text('Merci, c’est noté',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
            const SizedBox(height: 10),
            Text('Ton signalement nous aide à rendre le contenu plus fiable.',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary)),
            const SizedBox(height: 16),
            primary,
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text('Signaler une erreur',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: c.background, borderRadius: BorderRadius.circular(12)),
          child: Text(widget.target.excerpt,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary)),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _comment,
          minLines: 3,
          maxLines: 6,
          maxLength: 1000,
          style: TextStyle(fontSize: 15, color: c.textPrimary),
          decoration: InputDecoration(
            hintText: 'Qu’est-ce qui est faux ? (facultatif)',
            hintStyle: TextStyle(color: c.textSecondary),
            counterText: '',
            contentPadding: const EdgeInsets.all(12),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.border)),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.primaryDark)),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Semantics(
            liveRegion: true,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: c.tintDanger, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  Icon(Ionicons.alert_circle, size: 18, color: c.dangerText),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(_error!,
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.dangerText)),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        primary,
        SizedBox(
          height: 48,
          child: TextButton(
            onPressed: _busy ? null : () => Navigator.of(context).pop(),
            child: Text('Annuler',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textSecondary)),
          ),
        ),
      ],
    );
  }
}
