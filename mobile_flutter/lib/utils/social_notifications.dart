import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../services/api.dart';
import '../services/notifications.dart';
import '../services/storage.dart';
import 'push_notifications.dart';

// Demandes d'ami et défis reçus : pastille sur l'onglet Compte et notification
// pour chaque nouveauté. Vérifié à l'ouverture de l'app et régulièrement
// pendant qu'elle est ouverte (copie de utils/socialNotifications.ts).

/// Nombre de demandes d'ami + défis à jouer (pastille de l'onglet Compte).
final ValueNotifier<int> socialBadge = ValueNotifier(0);

String _seenKey(String uid) => '@social_seen:$uid';

/// Nouveautés pas encore notifiées, avec leur message.
List<({String id, String title, String body})> newItems(Map<String, dynamic> summary, Set<String> seen) {
  final items = [
    for (final r in (summary['friend_requests'] as List? ?? []).whereType<Map>())
      (id: 'fr:${r['uid']}', title: '👋 Nouvelle demande d’ami', body: '${r['displayName']} veut t’ajouter en ami.'),
    for (final c in (summary['challenges'] as List? ?? []).whereType<Map>())
      (id: 'ch:${c['id']}', title: '⚡ Nouveau défi', body: '${c['friend_name']} te défie sur « ${c['course_nom']} ».'),
  ];
  return items.where((i) => !seen.contains(i.id)).toList();
}

/// Met à jour la pastille et notifie chaque nouvelle demande d'ami ou défi. Silencieux hors ligne.
Future<void> checkSocialNotifications(User user) async {
  try {
    final res = await Api.get('/api/notifications/summary');
    if (res.statusCode != 200) return;
    final summary = (decodeBody(res) as Map).cast<String, dynamic>();
    socialBadge.value =
        (summary['friend_requests'] as List? ?? []).length + (summary['challenges'] as List? ?? []).length;

    final stored = await Storage.getJson(_seenKey(user.uid));
    final firstCheck = stored == null;
    final seen = <String>{if (stored is List) ...stored.map((e) => '$e')};
    final fresh = newItems(summary, seen);
    if (fresh.isEmpty) return;

    // Première vérification sur ce téléphone : on ne notifie pas tout l'historique.
    // Avec les push actives, le serveur a déjà prévenu : pas de doublon.
    if (!firstCheck && !isPushActive() && await Notifs.isGranted()) {
      for (final item in fresh.take(3)) {
        await Notifs.show(item.title, item.body);
      }
    }
    // On ne garde que les nouveautés encore en attente, pour que la liste reste courte.
    await Storage.setJson(_seenKey(user.uid), newItems(summary, {}).map((i) => i.id).toList());
  } catch (_) {
    // Hors ligne : on réessaiera à la prochaine vérification.
  }
}

void resetSocialBadge() => socialBadge.value = 0;
