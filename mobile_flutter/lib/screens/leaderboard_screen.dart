import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/colors.dart';
import '../theme/theme_controller.dart';
import '../widgets/insets.dart';
import '../widgets/social/avatar_bubble.dart';
import '../widgets/ui.dart';

// Entrée du classement : {uid, displayName, avatarUrl, xp, streak}

enum _Mode { global, friends }

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> with FocusRefresh<LeaderboardScreen> {
  _Mode _mode = _Mode.global;
  List<Map<String, dynamic>> _entries = [];
  String? _yourUid;
  int? _yourRank;
  bool _loading = true;
  bool _error = false;

  @override
  void onFocus() {
    setState(() => _loading = true);
    _load(_mode);
  }

  void _setMode(_Mode mode) {
    if (mode == _mode) return;
    setState(() {
      _mode = mode;
      _loading = true;
    });
    _load(mode);
  }

  Future<void> _load(_Mode currentMode) async {
    if (Api.currentUser == null) {
      setState(() => _loading = false);
      return;
    }

    setState(() => _error = false);
    try {
      if (currentMode == _Mode.global) {
        final res = await Api.get('/api/leaderboard?limit=50');
        if (res.statusCode < 200 || res.statusCode >= 300) throw Exception('HTTP ${res.statusCode}');
        final data = decodeBody(res) as Map;
        if (!mounted) return;
        setState(() {
          _entries = _list(data['entries']);
          _yourUid = data['yourUid'] as String?;
          _yourRank = (data['yourRank'] as num?)?.toInt();
        });
      } else {
        final res = await Api.get('/api/friends/leaderboard');
        if (res.statusCode < 200 || res.statusCode >= 300) throw Exception('HTTP ${res.statusCode}');
        final data = decodeBody(res) as Map;
        final list = _list(data['entries']);
        if (!mounted) return;
        setState(() {
          _entries = list;
          _yourUid = data['yourUid'] as String?;
          final position = list.indexWhere((e) => e['uid'] == data['yourUid']);
          _yourRank = position >= 0 ? position + 1 : null;
        });
      }
    } catch (err) {
      debugPrint('Erreur chargement classement: $err');
      if (mounted) setState(() => _error = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static List<Map<String, dynamic>> _list(dynamic v) =>
      v is List ? [for (final e in v) (e as Map).cast<String, dynamic>()] : [];

  Color _rankColor(AppColors c, int position) {
    if (position == 1) return const Color(0xFFFFD700);
    if (position == 2) return const Color(0xFFC0C0C0);
    if (position == 3) return const Color(0xFFCD7F32);
    return c.textSecondary;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final youAreInTopList = _entries.any((e) => e['uid'] == _yourUid);
    final friendsEmpty = _mode == _Mode.friends && _entries.length <= 1;

    final Widget body;
    if (_loading) {
      body = _centered([
        CircularProgressIndicator(color: c.primary, semanticsLabel: 'Chargement du classement'),
      ]);
    } else if (_error) {
      body = _centered([
        Icon(Ionicons.alertCircleOutline, size: 48, color: c.warning),
        _stateTitle(c, 'Impossible de charger le classement'),
        _actionButton(c, 'Réessayer', () => _load(_mode)),
      ]);
    } else if (_entries.isEmpty && _mode == _Mode.global) {
      body = _centered([
        Icon(Ionicons.trophyOutline, size: 48, color: c.muted),
        _stateTitle(c, 'Personne au classement pour l\'instant'),
        _stateText(c, 'Termine une leçon pour apparaître ici.'),
      ]);
    } else if (friendsEmpty) {
      body = _centered([
        Icon(Ionicons.peopleOutline, size: 48, color: c.muted),
        _stateTitle(c, 'Pas encore d\'amis ajoutés'),
        _stateText(c, 'Ajoute des amis pour te comparer à eux plutôt qu\'à des inconnus.'),
        _actionButton(c, 'Ajouter des amis', () => Nav.navigate('Friends')),
      ]);
    } else {
      final showYourRank = !youAreInTopList && _yourRank != null;
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: ListView.builder(
              padding: EdgeInsets.fromLTRB(16, 16, 16, showYourRank ? 16 : insets.bottom + 16),
              itemCount: _entries.length,
              itemBuilder: (context, index) => _row(c, _entries[index], index),
            ),
          ),
          if (showYourRank)
            Container(
              padding: EdgeInsets.only(top: 12, bottom: insets.bottom + 12),
              decoration: BoxDecoration(
                color: c.surfaceAlt,
                border: Border(top: BorderSide(color: c.border)),
              ),
              alignment: Alignment.center,
              child: Text('Ta position : #$_yourRank',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary)),
            ),
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(
                          header: true,
                          child: Text('Classement',
                              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _mode == _Mode.global ? 'Les meilleurs par XP' : 'Toi et tes amis',
                          style: TextStyle(fontSize: 14, color: c.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  CircleIconButton(
                    icon: Ionicons.peopleOutline,
                    label: 'Gérer mes amis',
                    onPressed: () => Nav.navigate('Friends'),
                  ),
                ],
              ),
            ),
            Container(
              margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  Expanded(child: _toggleOption(c, _Mode.global, Ionicons.earth, 'Global', 'Classement global')),
                  const SizedBox(width: 4),
                  Expanded(child: _toggleOption(c, _Mode.friends, Ionicons.people, 'Amis', 'Classement amis')),
                ],
              ),
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }

  Widget _toggleOption(AppColors c, _Mode mode, IconData icon, String text, String label) {
    final active = _mode == mode;
    return Tappable(
      onTap: () => _setMode(mode),
      selected: active,
      semanticLabel: label,
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: active ? c.surface : null,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: active ? c.primaryText : c.textSecondary),
              const SizedBox(width: 6),
              Text(text,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                    color: active ? c.textPrimary : c.textSecondary,
                  )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(AppColors c, Map<String, dynamic> item, int index) {
    final position = index + 1;
    final isYou = item['uid'] == _yourUid;
    final name = '${item['displayName']}';

    return Semantics(
      label: '${position}e : $name${isYou ? ' (toi)' : ''}, ${item['xp']} XP, série de ${item['streak']} jours',
      excludeSemantics: true,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(14),
          border: isYou ? Border.all(color: c.primary, width: 2) : null,
        ),
        child: Row(
          children: [
            SizedBox(
              width: 32,
              child: Center(
                child: position <= 3
                    ? Icon(Ionicons.trophy, size: 20, color: _rankColor(c, position))
                    : Text('#$position',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.textSecondary)),
              ),
            ),
            const SizedBox(width: 10),
            AvatarBubble(uri: item['avatarUrl'] as String?, displayName: name, size: 36),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '$name${isYou ? ' (toi)' : ''}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: isYou ? c.primaryText : c.textPrimary,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Icon(Ionicons.flame, size: 14, color: c.warning),
            const SizedBox(width: 3),
            Text('${item['streak']}', style: TextStyle(fontSize: 13, color: c.textSecondary)),
            const SizedBox(width: 4 + 10),
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 64),
              child: Text('${item['xp']} XP',
                  textAlign: TextAlign.right,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.primaryText)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _centered(List<Widget> children) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) const SizedBox(height: 12),
              children[i],
            ],
          ],
        ),
      ),
    );
  }

  Widget _stateTitle(AppColors c, String text) => Text(text,
      textAlign: TextAlign.center, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.textPrimary));

  Widget _stateText(AppColors c, String text) =>
      Text(text, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.textSecondary));

  Widget _actionButton(AppColors c, String label, VoidCallback onTap) {
    return Tappable(
      onTap: onTap,
      semanticLabel: label,
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(10)),
          child: Center(
            widthFactor: 1,
            heightFactor: 1,
            child: Text(label, style: TextStyle(color: c.onAction, fontSize: 14, fontWeight: FontWeight.w600)),
          ),
        ),
      ),
    );
  }
}
