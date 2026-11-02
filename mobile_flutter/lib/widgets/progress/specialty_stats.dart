import 'package:flutter/material.dart';

import '../../navigation/nav.dart';
import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../ui.dart';

// Statistique d'une spécialité : {tag, courses, questions, mastered, mastery,
// due_today, answers, accuracy (null sans réponse)}

/// Progression par spécialité (F69) : part des cartes maîtrisées, cartes dues
/// aujourd'hui et taux de bonnes réponses. Rien n'est affiché sans cours.
/// (copie de components/SpecialtyStats.tsx)
class SpecialtyStats extends StatefulWidget {
  const SpecialtyStats({super.key});

  @override
  State<SpecialtyStats> createState() => _SpecialtyStatsState();
}

class _SpecialtyStatsState extends State<SpecialtyStats> with FocusRefresh<SpecialtyStats> {
  List<Map<String, dynamic>> _stats = [];

  @override
  void onFocus() => _load();

  Future<void> _load() async {
    if (Api.currentUser == null) return;
    try {
      final res = await Api.get('/api/stats/specialties');
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      final data = decodeBody(res);
      final list = data is Map ? data['specialties'] : null;
      if (mounted && list is List) {
        setState(() => _stats = [for (final s in list) (s as Map).cast<String, dynamic>()]);
      }
    } catch (_) {
      // Section secondaire : silencieuse hors ligne.
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    if (_stats.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text('Par spécialité',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
          ),
          for (final s in _stats) ...[
            const SizedBox(height: 10),
            Semantics(
              label: '${s['tag']} : ${s['mastery']} % maîtrisé, ${s['due_today']} cartes à revoir aujourd\'hui'
                  '${s['accuracy'] != null ? ', ${s['accuracy']} % de bonnes réponses' : ''}',
              excludeSemantics: true,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: c.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text('${s['tag']}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                        ),
                        const SizedBox(width: 8),
                        Text('${s['mastery']} %',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.successText)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ProgressBar(progress: (s['mastery'] as num? ?? 0).toDouble(), height: 8, color: c.success),
                    const SizedBox(height: 8),
                    Text(
                      '${s['mastered']}/${s['questions']} maîtrisées · ${s['due_today']} à revoir'
                      '${s['accuracy'] != null ? ' · ${s['accuracy']} % de réussite' : ''}',
                      style: TextStyle(fontSize: 13, color: c.textSecondary),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
