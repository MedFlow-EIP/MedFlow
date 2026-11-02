import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../widgets/home/ai_usage_card.dart';
import '../widgets/home/clinical_case_card.dart';
import '../widgets/home/email_verification_banner.dart';
import '../widgets/home/path_card.dart';
import '../widgets/home/quests_card.dart';
import '../widgets/home/streak_sheet.dart';
import '../widgets/home/today_card.dart';
import '../widgets/insets.dart';
import '../widgets/ui.dart';

/// Onglet Accueil (copie de HomeScreen.tsx).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with FocusRefresh<HomeScreen> {
  static const _gap = 20.0;

  List<Map<String, dynamic>> _paths = [];
  int? _streak;
  ({int count, int max}) _freezes = (count: 0, max: 2);
  String? _nextLessonTitle;

  // Parcours dont la prochaine leçon a été demandée (dépendance heroPath?.id de l'effet RN).
  Object? _heroId;
  int _heroRequest = 0;

  @override
  String? get tabName => 'Home';

  @override
  void initState() {
    super.initState();
    currentTab.addListener(_onTabParams);
    _onTabParams();
  }

  @override
  void dispose() {
    currentTab.removeListener(_onTabParams);
    super.dispose();
  }

  // route.params.updatedPaths : parcours mis à jour passés en paramètre de l'onglet.
  void _onTabParams() {
    final tab = currentTab.value;
    final updated = tab.params?['updatedPaths'];
    if (tab.route == 'Home' && updated is List) _setPaths(updated);
  }

  @override
  void onFocus() {
    _loadPaths().then((_) => _loadStreak());
  }

  User? get _user => FirebaseAuth.instance.currentUser;

  void _setPaths(List<dynamic> list) {
    if (!mounted) return;
    setState(() => _paths = list.whereType<Map>().map((p) => p.cast<String, dynamic>()).toList());
    _syncHero();
  }

  Future<void> _loadPaths() async {
    if (_user == null) return;
    try {
      final data = decodeBody(await Api.get('/api/paths'));
      if (data == null) throw const FormatException('Réponse illisible');
      _setPaths(data is Map && data['paths'] is List ? data['paths'] as List : const []);
    } catch (err) {
      debugPrint('$err');
    }
  }

  Future<void> _loadStreak() async {
    if (_user == null) return;
    try {
      final data = decodeBody(await Api.get('/api/account'));
      if (data == null) throw const FormatException('Réponse illisible');
      final stats = data is Map && data['stats'] is Map ? data['stats'] as Map : const {};
      if (!mounted) return;
      setState(() {
        _streak = stats['streak'] is num ? (stats['streak'] as num).toInt() : null;
        _freezes = (
          count: stats['streakFreezes'] is num ? (stats['streakFreezes'] as num).toInt() : 0,
          max: stats['maxStreakFreezes'] is num ? (stats['maxStreakFreezes'] as num).toInt() : 2,
        );
      });
    } catch (err) {
      debugPrint('$err');
    }
  }

  // Parcours en cours = premier parcours débloqué non terminé : il devient la carte héros.
  Map<String, dynamic>? get _heroPath =>
      _paths.where((p) => p['isLocked'] != true && p['progress'] is num && (p['progress'] as num) < 100).firstOrNull;

  /// Prochaine leçon disponible du parcours héros, rechargée quand il change.
  void _syncHero() {
    final hero = _heroPath;
    final id = hero?['id'];
    if (id == _heroId) return;
    _heroId = id;
    final request = ++_heroRequest;
    if (_user == null || hero == null) {
      setState(() => _nextLessonTitle = null);
      return;
    }
    () async {
      try {
        final data = decodeBody(await Api.get('/api/lessons/$id'));
        final lessons = data is Map && data['lessons'] is List ? data['lessons'] as List : null;
        final next = lessons?.whereType<Map>().where((l) => l['status'] == 'available').firstOrNull;
        if (mounted && request == _heroRequest) setState(() => _nextLessonTitle = next?['title']?.toString());
      } catch (err) {
        debugPrint('$err');
      }
    }();
  }

  void _handlePathPress(Map<String, dynamic> path) {
    if (path['isLocked'] != true) {
      Nav.navigate('Path', {'path': path});
    }
  }

  // Condition de déblocage explicite : le parcours précédent doit être terminé.
  String? _unlockHintFor(int index) {
    final previous = index > 0 ? _paths[index - 1] : null;
    return previous != null ? 'Termine ${previous['title']} pour débloquer' : null;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final displayName = _user?.displayName ?? '';
    final firstName = displayName.split(' ').first.isNotEmpty ? displayName.split(' ').first : 'Médecin';
    final heroId = _heroPath?['id'];

    return ColoredBox(
      color: c.background,
      child: ScrollConfiguration(
        behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.tabBar + 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _header(context, firstName),
              const EmailVerificationBanner(margin: EdgeInsets.only(top: _gap)),
              const TodayCard(margin: EdgeInsets.only(top: _gap)),
              const QuestsCard(margin: EdgeInsets.only(top: _gap)),
              const SizedBox(height: _gap),
              const ClinicalCaseCard(),
              const SizedBox(height: _gap),
              Semantics(
                header: true,
                child: Text("Parcours d'apprentissage",
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
              ),
              const SizedBox(height: _gap),
              if (_paths.isEmpty)
                _emptyState(context)
              else
                for (final (index, path) in _paths.indexed) ...[
                  if (index > 0) const SizedBox(height: _gap),
                  PathCard(
                    key: ValueKey('path-${path['id']}'),
                    path: path,
                    index: index,
                    isHero: heroId != null && path['id'] == heroId,
                    nextLessonTitle: heroId != null && path['id'] == heroId ? _nextLessonTitle : null,
                    unlockHint: path['isLocked'] == true ? _unlockHintFor(index) : null,
                    onPress: () => _handlePathPress(path),
                  ),
                ],
              const AIUsageCard(margin: EdgeInsets.only(top: _gap)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context, String firstName) {
    final c = context.colors;
    final streak = _streak;
    final count = _freezes.count;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text('Bonjour, $firstName',
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: c.textPrimary)),
              ),
              const SizedBox(height: 4),
              Text('Prêt pour ta session du jour ?', style: TextStyle(fontSize: 15, color: c.textSecondary)),
            ],
          ),
        ),
        if (streak != null) ...[
          const SizedBox(width: 12),
          Tappable(
            onTap: () => showStreakSheet(context, streak: streak, freezes: count, maxFreezes: _freezes.max),
            semanticLabel: 'Série de $streak jour${streak > 1 ? 's' : ''}, $count protection${count > 1 ? 's' : ''}',
            child: ExcludeSemantics(
              child: Container(
                constraints: const BoxConstraints(minHeight: 40),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: c.tintWarning, borderRadius: BorderRadius.circular(999)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Ionicons.flame, size: 16, color: c.warningText),
                    const SizedBox(width: 6),
                    Text('$streak j',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.warningText)),
                    if (count > 0) ...[
                      const SizedBox(width: 6),
                      Icon(Ionicons.shieldCheckmark, size: 14, color: c.primaryText),
                      const SizedBox(width: 6),
                      Text('$count', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.primaryText)),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _emptyState(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.border),
      ),
      child: Column(
        children: [
          Icon(Ionicons.schoolOutline, size: 48, color: c.muted),
          const SizedBox(height: 12),
          Text('Aucun parcours', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 12),
          Text(
            'Importe un cours pour commencer : l’IA en tire un résumé, des flashcards et un quiz.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: c.textSecondary),
          ),
        ],
      ),
    );
  }
}
