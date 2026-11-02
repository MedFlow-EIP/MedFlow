import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/colors.dart';
import '../theme/theme_controller.dart';
import '../utils/app_alert.dart';
import '../utils/social_notifications.dart';
import '../widgets/insets.dart';
import '../widgets/social/avatar_bubble.dart';
import '../widgets/social/challenge_create_sheet.dart';
import '../widgets/social/challenge_section.dart';
import '../widgets/ui.dart';

// Recherche : {uid, displayName, avatarUrl, friendshipStatus: none|friends|request_sent|request_received}
// Ami : {uid, displayName, avatarUrl, xp, streak}
// Demande en attente : {uid, displayName, avatarUrl}

/// Corps JSON lu sans regarder le statut, comme `res.json()` (lève si illisible).
dynamic _json(http.Response res) => jsonDecode(utf8.decode(res.bodyBytes));

List<Map<String, dynamic>> _list(dynamic data, String key) {
  final v = data is Map ? data[key] : null;
  return v is List ? [for (final e in v) (e as Map).cast<String, dynamic>()] : [];
}

class FriendsScreen extends StatefulWidget {
  const FriendsScreen({super.key});

  @override
  State<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends State<FriendsScreen> with FocusRefresh<FriendsScreen> {
  final _queryController = TextEditingController();
  String _query = '';
  List<Map<String, dynamic>> _searchResults = [];
  bool _searching = false;

  List<Map<String, dynamic>> _friends = [];
  List<Map<String, dynamic>> _received = [];
  List<Map<String, dynamic>> _sent = [];
  bool _loading = true;
  // Nombre de questions choisi dans la feuille de défi (gardé d'une ouverture à l'autre).
  int _challengeCount = 5;
  int _challengesKey = 0;

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  @override
  void onFocus() {
    setState(() => _loading = true);
    _loadAll();
  }

  Future<void> _loadAll() async {
    final user = Api.currentUser;
    if (user == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    try {
      final results = await Future.wait([
        Api.get('/api/friends'),
        Api.get('/api/friends/requests'),
      ]);
      final friendsData = _json(results[0]);
      final requestsData = _json(results[1]);
      if (!mounted) return;
      setState(() {
        _friends = _list(friendsData, 'friends');
        _received = _list(requestsData, 'received');
        _sent = _list(requestsData, 'sent');
      });
      // Demande acceptée ou refusée : la pastille de l'onglet Compte suit.
      unawaited(checkSocialNotifications(user));
    } catch (err) {
      debugPrint('Erreur chargement amis: $err');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _runSearch(String text) async {
    setState(() => _query = text);
    final user = Api.currentUser;
    if (user == null || text.trim().length < 2) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final res = await Api.get('/api/users/search', query: {'q': text.trim()});
      final data = _json(res);
      if (!mounted) return;
      setState(() => _searchResults = _list(data, 'results'));
    } catch (err) {
      debugPrint('Erreur recherche: $err');
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _sendRequest(String targetUid) async {
    if (Api.currentUser == null) return;
    try {
      await Api.post('/api/friends/request', {'uid': targetUid});
      await _runSearch(_query);
      await _loadAll();
    } catch (err) {
      debugPrint('Erreur envoi demande: $err');
    }
  }

  Future<void> _respondRequest(String requesterUid, bool accept) async {
    if (Api.currentUser == null) return;
    try {
      await Api.post('/api/friends/respond', {'uid': requesterUid, 'accept': accept});
      await _loadAll();
    } catch (err) {
      debugPrint('Erreur réponse demande: $err');
    }
  }

  Future<void> _removeFriend(String targetUid) async {
    if (Api.currentUser == null) return;
    try {
      await Api.delete('/api/friends/$targetUid');
      await _loadAll();
      await _runSearch(_query);
    } catch (err) {
      debugPrint('Erreur suppression ami: $err');
    }
  }

  void _confirmRemoveFriend(String targetUid, String name) {
    appAlert('Retirer cet ami ?', '$name ne sera plus dans ta liste d\'amis ni dans ton classement entre amis.', [
      const AlertButton('Annuler', style: AlertStyle.cancel),
      AlertButton('Retirer', style: AlertStyle.destructive, onPress: () => _removeFriend(targetUid)),
    ]);
  }

  void _openChallenge(Map<String, dynamic> friend) {
    showChallengeCreateSheet(
      context,
      friend: friend,
      count: _challengeCount,
      onCountChanged: (n) => _challengeCount = n,
      onCreated: (challengeId) {
        if (mounted) setState(() => _challengesKey++);
        // Le créateur joue tout de suite ; son ami jouera de son côté.
        Nav.navigate('Challenge', {'challengeId': challengeId});
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);

    final Widget body;
    if (_query.trim().length >= 2) {
      body = ListView(
        padding: EdgeInsets.fromLTRB(16, 8, 16, insets.bottom + 16),
        children: [
          if (_searchResults.isEmpty && !_searching) _emptyText(c, 'Aucun résultat'),
          for (final item in _searchResults) _row(c, item, trailing: [_searchButton(c, item)]),
        ],
      );
    } else if (_loading) {
      body = Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: CircularProgressIndicator(color: c.primary, semanticsLabel: 'Chargement des amis'),
        ),
      );
    } else {
      body = ListView(
        padding: EdgeInsets.fromLTRB(16, 8, 16, insets.bottom + 16),
        children: [
          if (_received.isNotEmpty)
            _section(c, 'Demandes reçues', [
              for (final r in _received)
                _row(c, r, trailing: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _acceptButton(c, r),
                      const SizedBox(width: 8),
                      Tappable(
                        onTap: () => _respondRequest('${r['uid']}', false),
                        semanticLabel: 'Refuser la demande de ${r['displayName']}',
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(color: c.tintDanger, shape: BoxShape.circle),
                          child: Icon(Ionicons.close, size: 16, color: c.danger),
                        ),
                      ),
                    ],
                  ),
                ]),
            ]),
          if (_sent.isNotEmpty)
            _section(c, 'Demandes envoyées', [
              for (final s in _sent) _row(c, s, trailing: [_statusPill(c, 'En attente')]),
            ]),
          ChallengeSection(refreshKey: _challengesKey),
          _section(c, 'Tes amis ${_friends.isNotEmpty ? '(${_friends.length})' : ''}', [
            if (_friends.isEmpty)
              _emptyText(c, 'Recherche un nom ci-dessus pour ajouter ton premier ami.')
            else
              for (final f in _friends)
                _row(
                  c,
                  f,
                  subtitle: '${f['xp']} XP · ${f['streak']}j de série',
                  trailing: [
                    Tappable(
                      onTap: () => _openChallenge(f),
                      semanticLabel: 'Défier ${f['displayName']}',
                      child: ExcludeSemantics(
                        child: Container(
                          constraints: const BoxConstraints(minHeight: 40),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(12)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Ionicons.flash_outline, size: 16, color: c.primaryText),
                              const SizedBox(width: 4),
                              Text('Défier',
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.primaryText)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Tappable(
                      onTap: () => _confirmRemoveFriend('${f['uid']}', '${f['displayName']}'),
                      semanticLabel: 'Retirer ${f['displayName']} de tes amis',
                      child: SizedBox(
                        width: 40,
                        height: 40,
                        child: Icon(Ionicons.person_remove_outline, size: 20, color: c.danger),
                      ),
                    ),
                  ],
                ),
          ]),
        ],
      );
    }

    return Scaffold(
      backgroundColor: c.background,
      body: Padding(
        padding: EdgeInsets.only(top: insets.top),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Row(
                children: [
                  CircleIconButton.back(Nav.goBack),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text('Amis',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: c.surface,
                border: Border.all(color: c.border),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Ionicons.search, size: 18, color: c.muted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Semantics(
                      label: 'Rechercher un ami par nom',
                      child: TextField(
                        controller: _queryController,
                        onChanged: _runSearch,
                        style: TextStyle(fontSize: 15, color: c.textPrimary),
                        decoration: InputDecoration(
                          isDense: true,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 12),
                          hintText: 'Nom ou email exact…',
                          hintStyle: TextStyle(fontSize: 15, color: c.textSecondary),
                        ),
                      ),
                    ),
                  ),
                  if (_searching) ...[
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: c.primary, semanticsLabel: 'Recherche en cours'),
                    ),
                  ],
                ],
              ),
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }

  Widget _section(AppColors c, String title, List<Widget> children) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(title.toUpperCase(),
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.textSecondary)),
          ),
          const SizedBox(height: 8),
          ...children,
        ],
      ),
    );
  }

  Widget _emptyText(AppColors c, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Text(text, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.textSecondary)),
    );
  }

  /// Ligne : avatar + nom (+ sous-titre), puis les actions à droite.
  Widget _row(AppColors c, Map<String, dynamic> person, {String? subtitle, required List<Widget> trailing}) {
    final name = Text('${person['displayName']}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary));
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                AvatarBubble(
                  uri: person['avatarUrl'] as String?,
                  displayName: '${person['displayName']}',
                  size: 34,
                ),
                const SizedBox(width: 10),
                if (subtitle == null)
                  Flexible(child: name)
                else
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        name,
                        const SizedBox(height: 2),
                        Text(subtitle, style: TextStyle(fontSize: 12, color: c.textSecondary)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          for (final t in trailing) ...[const SizedBox(width: 12), t],
        ],
      ),
    );
  }

  Widget _statusPill(AppColors c, String text, {IconData? icon, Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(12)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 14, color: color), const SizedBox(width: 4)],
          Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color ?? c.textSecondary)),
        ],
      ),
    );
  }

  Widget _acceptButton(AppColors c, Map<String, dynamic> person) {
    return Tappable(
      onTap: () => _respondRequest('${person['uid']}', true),
      semanticLabel: 'Accepter la demande de ${person['displayName']}',
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 36),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(10)),
          child: Center(
            widthFactor: 1,
            heightFactor: 1,
            child: Text('Accepter', style: TextStyle(color: c.onAction, fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        ),
      ),
    );
  }

  Widget _searchButton(AppColors c, Map<String, dynamic> result) {
    switch (result['friendshipStatus']) {
      case 'friends':
        return _statusPill(c, 'Ami', icon: Ionicons.checkmark, color: c.successText);
      case 'request_sent':
        return _statusPill(c, 'Demande envoyée');
      case 'request_received':
        return _acceptButton(c, result);
      default:
        return Tappable(
          onTap: () => _sendRequest('${result['uid']}'),
          semanticLabel: 'Ajouter ${result['displayName']} en ami',
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: c.tintPrimary, shape: BoxShape.circle),
            child: Icon(Ionicons.person_add, size: 16, color: c.primary),
          ),
        );
    }
  }
}
