import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../navigation/nav.dart';
import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../ui.dart';

/// Carte d'accueil : reprendre le cas clinique en cours, ou en commencer un.
/// Chaque cas de /api/cases : id, title, status, finished, answered, total_steps.
class ClinicalCaseCard extends StatefulWidget {
  const ClinicalCaseCard({super.key});

  @override
  State<ClinicalCaseCard> createState() => _ClinicalCaseCardState();
}

class _ClinicalCaseCardState extends State<ClinicalCaseCard> with FocusRefresh<ClinicalCaseCard> {
  Map<String, dynamic>? _ongoing;

  @override
  String? get tabName => 'Home';

  @override
  void onFocus() => _load();

  Future<void> _load() async {
    if (Api.currentUser == null) return;
    try {
      final res = await Api.get('/api/cases');
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      final data = decodeBody(res);
      final list = data is Map && data['cases'] is List
          ? (data['cases'] as List).whereType<Map>().map((m) => m.cast<String, dynamic>())
          : const <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _ongoing = list.where((c) => c['finished'] != true && (c['status'] ?? 'ready') == 'ready').firstOrNull;
      });
    } catch (_) {
      // Carte secondaire : affichée sans « reprendre » hors ligne.
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final ongoing = _ongoing;
    final title = '${ongoing?['title'] ?? ''}';
    final answered = ongoing?['answered'] is num ? (ongoing!['answered'] as num).toInt() : 0;

    return Tappable(
      onTap: () =>
          ongoing != null ? Nav.navigate('ClinicalCase', {'caseId': ongoing['id']}) : Nav.navigate('ClinicalCases'),
      semanticLabel: ongoing != null ? 'Reprendre le cas clinique $title' : 'Cas cliniques : mets-toi en situation',
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: c.border),
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
                child: Icon(Ionicons.medkit, size: 22, color: c.onAction),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(ongoing != null ? 'Reprendre ton cas clinique' : 'Cas cliniques',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    const SizedBox(height: 2),
                    Text(
                      ongoing != null
                          ? '$title · étape ${answered + 1}/${ongoing['total_steps'] ?? ''}'
                          : 'Un patient, tes décisions, et un retour sur chaque choix',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 13, height: 18 / 13, color: c.textSecondary),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Icon(Ionicons.chevronForward, size: 20, color: c.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}
