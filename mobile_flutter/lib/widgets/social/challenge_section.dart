import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../navigation/nav.dart';
import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../../utils/app_alert.dart';
import '../ui.dart';

// Défi (copie de components/challenge/ChallengeSection.tsx) :
// {id, role: challenger|opponent, friend_uid, friend_name, course_nom, total,
//  status: pending|done|declined|expired, my_score, their_score,
//  outcome: win|loss|tie|null, can_play}

/// Texte d'état d'un défi, du point de vue de l'utilisateur.
String challengeStatusText(Map c) {
  if (c['status'] == 'done') {
    final score = '${c['my_score']} à ${c['their_score']}';
    return c['outcome'] == 'win'
        ? 'Gagné $score'
        : c['outcome'] == 'loss'
            ? 'Perdu $score'
            : 'Égalité $score';
  }
  if (c['status'] == 'declined') return c['role'] == 'challenger' ? 'Refusé' : 'Tu as refusé';
  if (c['status'] == 'expired') return 'Expiré';
  if (c['can_play'] == true) return c['role'] == 'opponent' ? 'À toi de jouer' : 'Tu n’as pas encore joué';
  return 'En attente de ${c['friend_name']}';
}

/// Défis reçus et envoyés (F57), dans l'écran Amis.
class ChallengeSection extends StatefulWidget {
  final int refreshKey;
  const ChallengeSection({super.key, required this.refreshKey});

  @override
  State<ChallengeSection> createState() => _ChallengeSectionState();
}

class _ChallengeSectionState extends State<ChallengeSection> with FocusRefresh<ChallengeSection> {
  List<Map<String, dynamic>> _challenges = [];

  @override
  void onFocus() => _load();

  @override
  void didUpdateWidget(covariant ChallengeSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshKey != widget.refreshKey) _load();
  }

  Future<void> _load() async {
    if (Api.currentUser == null) return;
    try {
      final data = await Api.getJson('/api/challenges', fallback: '');
      if (!mounted) return;
      setState(() {
        _challenges = [
          for (final c in (data['challenges'] as List? ?? const [])) (c as Map).cast<String, dynamic>(),
        ];
      });
    } catch (_) {
      // Section secondaire : on garde la dernière liste connue.
    }
  }

  void _decline(Map<String, dynamic> c) {
    appAlert('Refuser le défi ?', '${c['friend_name']} sera prévenu que tu as refusé.', [
      const AlertButton('Annuler', style: AlertStyle.cancel),
      AlertButton(
        'Refuser',
        style: AlertStyle.destructive,
        onPress: () async {
          if (Api.currentUser == null) return;
          try {
            final res = await Api.send('POST', '/api/challenges/${c['id']}/decline');
            readJsonOrThrow(res, 'Impossible de refuser le défi.');
            _load();
          } catch (err) {
            appAlert('Erreur', errorMessage(err, 'Impossible de refuser le défi.'));
          }
        },
      ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    // Les défis terminés depuis longtemps encombrent : on garde les 10 plus récents.
    final shown = _challenges.take(10).toList();
    if (shown.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text('Défis', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary)),
          ),
          for (final ch in shown) ...[
            const SizedBox(height: 10),
            _row(context, ch),
          ],
        ],
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> ch) {
    final c = context.colors;
    final toPlay = ch['can_play'] == true;
    final won = ch['outcome'] == 'win';
    final name = ch['friend_name'];
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: won ? c.tintWarning : (toPlay ? c.action : c.tintPrimary),
              shape: BoxShape.circle,
            ),
            child: Icon(
              ch['status'] == 'done' ? (won ? Ionicons.trophy : Ionicons.flag) : Ionicons.flash,
              size: 18,
              color: toPlay
                  ? c.onAction
                  : won
                      ? c.warning
                      : c.primaryDark,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ch['role'] == 'challenger' ? 'Toi vs $name' : '$name te défie',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  '${ch['course_nom']} · ${challengeStatusText(ch)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, color: c.textSecondary),
                ),
              ],
            ),
          ),
          if (toPlay) ...[
            if (ch['role'] == 'opponent') ...[
              const SizedBox(width: 12),
              Tappable(
                onTap: () => _decline(ch),
                semanticLabel: 'Refuser le défi de $name',
                child: SizedBox(
                  width: 40,
                  height: 40,
                  child: Icon(Ionicons.close, size: 20, color: c.textSecondary),
                ),
              ),
            ],
            const SizedBox(width: 12),
            Tappable(
              onTap: () => Nav.navigate('Challenge', {'challengeId': ch['id']}),
              semanticLabel: 'Jouer le défi contre $name',
              child: ExcludeSemantics(
                child: Container(
                  constraints: const BoxConstraints(minHeight: 40),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(12)),
                  child: Center(
                    widthFactor: 1,
                    heightFactor: 1,
                    child:
                        Text('Jouer', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.onAction)),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
