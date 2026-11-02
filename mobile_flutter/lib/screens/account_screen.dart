import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ionicons/ionicons.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/analytics.dart';
import '../utils/app_alert.dart';
import '../utils/push_notifications.dart';
import '../utils/reminders.dart';
import '../widgets/insets.dart';
import '../widgets/ui.dart';

// Copie de components/screens/AccountScreen.tsx.

// Formulaire de retour des testeurs (beta test) ; sans formulaire, l'avis part par email.

const _contactEmail = 'medflow.app.contact@gmail.com';

/// Icônes des badges envoyées par le serveur (noms Ionicons, BADGE_CATALOG du backend).
const _badgeIcons = <String, IconData>{
  'school': Ionicons.school,
  'flame': Ionicons.flame,
  'star': Ionicons.star,
  'trophy': Ionicons.trophy,
  'checkmark-done': Ionicons.checkmark_done,
  'checkmark-done-circle': Ionicons.checkmark_done_circle,
};

/// « #cd7f32 » → couleur (null si le format n'est pas reconnu).
Color? _parseHex(String? hex) {
  final m = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(hex ?? '');
  if (m == null) return null;
  return Color(0xFF000000 | int.parse(m.group(1)!, radix: 16));
}

/// Couleur #rrggbb + canal alpha en hexadécimal (« 26 », « 20 »), comme `color + "26"` en RN.
Color _withHexAlpha(Color color, int alpha) => color.withAlpha(alpha);

/// Assombrit une couleur #rrggbb (factor < 1).
Color _darken(Color color, double factor) {
  int ch(int v) => (v * factor).round().clamp(0, 255);
  return Color.fromARGB(255, ch(color.red), ch(color.green), ch(color.blue));
}

String _formatRelativeTime(String iso) {
  final then = DateTime.tryParse(iso);
  if (then == null) return '';
  final diffMs = DateTime.now().millisecondsSinceEpoch - then.millisecondsSinceEpoch;
  final diffMin = (diffMs / 60000).floor();

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return 'Il y a $diffMin min';
  final diffH = (diffMin / 60).floor();
  if (diffH < 24) return 'Il y a ${diffH}h';
  final diffDays = (diffH / 24).floor();
  if (diffDays == 1) return 'Hier';
  if (diffDays < 7) return 'Il y a $diffDays jours';
  return DateFormat('d MMM', 'fr_FR').format(then.toLocal());
}

/// Point d'ancrage de la feuille de partage sur iPad (le widget touché).
Rect? _originOf(BuildContext context) {
  final box = context.findRenderObject();
  if (box is! RenderBox || !box.hasSize) return null;
  return box.localToGlobal(Offset.zero) & box.size;
}

class _League {
  final String id;
  final String name;
  final String color;
  final String? nextLeagueName;
  final int xpToNextLeague;
  const _League(this.id, this.name, this.color, this.nextLeagueName, this.xpToNextLeague);

  factory _League.fromJson(Map<String, dynamic> j) => _League(
        '${j['id'] ?? ''}',
        '${j['name'] ?? ''}',
        '${j['color'] ?? ''}',
        j['nextLeagueName'] as String?,
        (j['xpToNextLeague'] as num?)?.toInt() ?? 0,
      );
}

class _StatCard {
  final IconData icon;
  final Color iconColor;
  final Color tint;
  final String value;
  final String label;
  final VoidCallback? onPress;
  final String? a11y;
  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.tint,
    required this.value,
    required this.label,
    this.onPress,
    this.a11y,
  });
}

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> with FocusRefresh<AccountScreen> {
  int _streak = 0;
  int _xp = 0;
  int _rank = 1;
  _League _league = const _League('bronze', 'Bronze', '#cd7f32', null, 0);

  List<Map<String, dynamic>> _badges = [];
  List<Map<String, dynamic>> _activity = [];
  int _friendsCount = 0;
  int _pendingFriendRequests = 0;

  @override
  String? get tabName => 'Account';

  @override
  void onFocus() {
    final user = FirebaseAuth.instance.currentUser;
    // Le profil a pu changer (Réglages) : relit le nom et la photo.
    setState(() {});
    if (user == null) return;
    _loadAccount();
    _loadBadgesAndActivity();
  }

  Future<void> _loadBadgesAndActivity() async {
    if (FirebaseAuth.instance.currentUser == null) return;
    try {
      final responses = await Future.wait([
        Api.get('/api/badges'),
        Api.get('/api/activity', query: {'limit': 10}),
        Api.get('/api/friends'),
        Api.get('/api/friends/requests'),
      ]);
      final data = [
        for (final res in responses)
          (decodeBody(res) as Map? ?? (throw FormatException('Réponse illisible (${res.statusCode})')))
              .cast<String, dynamic>(),
      ];
      final [badgesData, activityData, friendsData, requestsData] = data;
      if (!mounted) return;
      setState(() {
        _badges = badgesData['badges'] is List
            ? (badgesData['badges'] as List).whereType<Map>().map((b) => b.cast<String, dynamic>()).toList()
            : [];
        _activity = activityData['activity'] is List
            ? (activityData['activity'] as List).whereType<Map>().map((a) => a.cast<String, dynamic>()).toList()
            : [];
        _friendsCount = friendsData['friends'] is List ? (friendsData['friends'] as List).length : 0;
        _pendingFriendRequests = requestsData['received'] is List ? (requestsData['received'] as List).length : 0;
      });
    } catch (err) {
      debugPrint('Erreur chargement badges/activité: $err');
    }
  }

  Future<void> _loadAccount() async {
    try {
      final res = await Api.get('/api/account');
      final data = decodeBody(res) as Map;
      final stats = (data['stats'] as Map).cast<String, dynamic>();
      if (mounted) {
        setState(() {
          _xp = (stats['xp'] as num).toInt();
          _streak = (stats['streak'] as num).toInt();
          _rank = (stats['rank'] as num).toInt();
          _league = _League.fromJson((stats['league'] as Map).cast<String, dynamic>());
        });
      }
      scheduleReminderIfNeeded(stats['lastActivity'] as String?);
    } catch (err) {
      debugPrint('Erreur chargement compte $err');
    }
  }

  void _handleLogout() {
    appAlert('Déconnexion', 'Tu veux vraiment te déconnecter ?', [
      const AlertButton('Annuler', style: AlertStyle.cancel),
      AlertButton(
        'Se déconnecter',
        style: AlertStyle.destructive,
        onPress: () async {
          try {
            // Ce téléphone ne doit plus recevoir les notifications de ce compte.
            final current = FirebaseAuth.instance.currentUser;
            if (current != null) await unregisterPushNotifications(current);
            await FirebaseAuth.instance.signOut();
          } catch (_) {
            appAlert('Erreur', 'Impossible de se déconnecter');
          }
        },
      ),
    ]);
  }

  Future<void> _openLink(String url) async {
    try {
      final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!ok) throw Exception('launchUrl');
    } catch (_) {
      appAlert('Erreur', "Impossible d'ouvrir le lien");
    }
  }

  Future<void> _sendEmail([String subject = "Contact depuis l'application MedFlow"]) async {
    final url = 'mailto:$_contactEmail?subject=${Uri.encodeComponent(subject)}';
    try {
      final ok = await launchUrl(Uri.parse(url));
      if (!ok) throw Exception('launchUrl');
    } catch (_) {
      appAlert('Erreur', 'Aucune application mail configurée sur cet appareil');
    }
  }

  Future<void> _shareApp(BuildContext origin) async {
    try {
      await SharePlus.instance.share(ShareParams(
        text:
            'Je révise mes cours de médecine avec MedFlow : résumés, flashcards et quiz générés par IA. https://www.instagram.com/med_flowapp/',
        sharePositionOrigin: _originOf(origin),
      ));
    } catch (_) {
      // Partage annulé : rien à faire.
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isDark = context.isDark;
    final insets = ScreenInsets.of(context);
    final user = FirebaseAuth.instance.currentUser;

    if (user == null) {
      return ColoredBox(
        color: c.background,
        child: Padding(
          padding: EdgeInsets.fromLTRB(20, insets.top, 20, 0),
          child: Align(
            alignment: Alignment.topLeft,
            child: Text('Aucun utilisateur connecté', style: TextStyle(color: c.textPrimary)),
          ),
        ),
      );
    }

    // Date abrégée pour que la puce tienne sur une ligne.
    final created = user.metadata.creationTime;
    final joinedDate = created == null ? '' : DateFormat('d MMM y', 'fr_FR').format(created.toLocal());

    // Texte de la puce de ligue : couleur de la ligue assombrie, lisible sur sa teinte claire (ex. bronze #cd7f32 → #9a5f26).
    final leagueColor = _parseHex(_league.color) ?? c.textPrimary;
    final leagueText = isDark ? leagueColor : _darken(leagueColor, 0.75);

    final initials = (user.displayName == null || user.displayName!.isEmpty ? 'U' : user.displayName!)
        .split(' ')
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((part) => part.substring(0, 1).toUpperCase())
        .join();

    final statCards = [
      _StatCard(
        icon: Ionicons.flame,
        iconColor: c.warning,
        tint: c.tintWarning,
        value: '$_streak',
        label: 'Jours de série',
      ),
      _StatCard(
        icon: Ionicons.star,
        iconColor: c.primaryDark,
        tint: c.tintPrimary,
        value: '$_xp',
        label: 'XP totaux',
      ),
      _StatCard(
        icon: Ionicons.trophy,
        iconColor: c.success,
        tint: c.tintSuccess,
        value: '#$_rank',
        label: 'Classement',
        onPress: () => Nav.navigate('Leaderboard'),
        a11y: 'Classement, rang numéro $_rank',
      ),
      _StatCard(
        icon: Ionicons.people,
        iconColor: c.textPrimary,
        tint: c.surfaceAlt,
        value: '$_friendsCount',
        label: 'Amis',
        onPress: () => Nav.navigate('Friends'),
        a11y:
            'Amis, $_friendsCount${_pendingFriendRequests > 0 ? ', $_pendingFriendRequests demande${_pendingFriendRequests > 1 ? 's' : ''} en attente' : ''}',
      ),
    ];

    final socials = [
      (
        label: 'Instagram',
        icon: Ionicons.logo_instagram,
        color: const Color(0xFFE1306C),
        url: 'https://www.instagram.com/med_flowapp/',
      ),
      (
        label: 'LinkedIn',
        icon: Ionicons.logo_linkedin,
        color: const Color(0xFF0A66C2),
        url: 'https://www.linkedin.com/company/medflow-app/',
      ),
      (
        label: 'Product Hunt',
        icon: Ionicons.rocket_outline,
        color: const Color(0xFFDA552F),
        url: 'https://www.producthunt.com/products/medflow-3?launch=medflow-2',
      ),
    ];

    final cardDecoration = BoxDecoration(
      color: c.surface,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: c.border),
    );

    Widget sectionTitle(String text) => Semantics(
          header: true,
          child: Text(text, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
        );

    Widget chevron() => Icon(Ionicons.chevron_forward, size: 18, color: c.textSecondary);

    Widget contactCard({
      required IconData icon,
      required String title,
      required String subtitle,
      required String a11y,
      required VoidCallback onTap,
      bool link = false,
    }) {
      return Semantics(
        link: link,
        child: Tappable(
          onTap: onTap,
          button: !link,
          semanticLabel: a11y,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: cardDecoration,
            child: ExcludeSemantics(
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(12)),
                    child: Icon(icon, size: 22, color: c.primaryDark),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                        const SizedBox(height: 2),
                        Text(subtitle, style: TextStyle(fontSize: 13, color: c.textSecondary)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  chevron(),
                ],
              ),
            ),
          ),
        ),
      );
    }

    // Les espacements reprennent le `gap: 22` du ScrollView RN, corrigé par les
    // marges négatives (profil : -10, titres de section : -8).
    final content = <Widget>[
      // Header
      Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Builder(
            builder: (btn) => CircleIconButton(
              icon: Ionicons.share_outline,
              label: 'Partager MedFlow',
              onPressed: () => _shareApp(btn),
            ),
          ),
          const SizedBox(width: 10),
          CircleIconButton(
            icon: Ionicons.settings_outline,
            label: 'Réglages',
            onPressed: () => Nav.navigate('Settings'),
          ),
        ],
      ),
      const SizedBox(height: 12),

      // Profil
      Column(
        children: [
          Tappable(
            onTap: () => Nav.navigate('Settings'),
            semanticLabel: 'Changer la photo de profil',
            child: ExcludeSemantics(
              child: SizedBox(
                width: 112,
                height: 112,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    if (user.photoURL != null && user.photoURL!.isNotEmpty)
                      ClipOval(
                        child: Image.network(
                          user.photoURL!,
                          width: 112,
                          height: 112,
                          fit: BoxFit.cover,
                          excludeFromSemantics: true,
                          errorBuilder: (_, __, ___) => _initialsAvatar(initials),
                        ),
                      )
                    else
                      _initialsAvatar(initials),
                    Positioned(
                      right: -2,
                      bottom: -2,
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: c.action,
                          shape: BoxShape.circle,
                          border: Border.all(color: c.surface, width: 3),
                        ),
                        child: Icon(Ionicons.camera, size: 16, color: c.onAction),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(user.displayName == null || user.displayName!.isEmpty ? 'Utilisateur' : user.displayName!,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: c.textPrimary)),
          const SizedBox(height: 6),
          Text(user.email ?? '', style: TextStyle(fontSize: 15, color: c.textSecondary)),
          const SizedBox(height: 10),

          // Puces qui passent à la ligne au lieu de déborder
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip(
                background: _withHexAlpha(leagueColor, 0x26),
                icon: Ionicons.ribbon,
                color: leagueText,
                text: 'Ligue ${_league.name}',
                weight: FontWeight.w600,
              ),
              _chip(
                background: c.tintPrimary,
                icon: Ionicons.calendar,
                iconColor: c.primaryDark,
                color: c.primaryText,
                text: 'Membre depuis le $joinedDate',
                weight: FontWeight.w500,
              ),
            ],
          ),

          if (_league.nextLeagueName != null && _league.nextLeagueName!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Plus que ${_league.xpToNextLeague} XP pour la ligue ${_league.nextLeagueName}',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.textSecondary),
            ),
          ],
        ],
      ),
      const SizedBox(height: 22),

      // Stats en grille 2 × 2
      _statsRow(statCards.sublist(0, 2)),
      const SizedBox(height: 12),
      _statsRow(statCards.sublist(2)),
      const SizedBox(height: 22),

      // Badges
      sectionTitle('Badges'),
      const SizedBox(height: 14),
      for (var i = 0; i < _badges.length; i += 2) ...[
        if (i > 0) const SizedBox(height: 12),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: _badgeCard(_badges[i])),
              if (i + 1 < _badges.length) ...[
                const SizedBox(width: 12),
                Expanded(child: _badgeCard(_badges[i + 1])),
              ],
            ],
          ),
        ),
      ],
      const SizedBox(height: 22),

      // Activité récente
      sectionTitle('Activité récente'),
      const SizedBox(height: 14),
      if (_activity.isEmpty)
        Text('Termine une leçon pour voir ton activité ici.', style: TextStyle(fontSize: 14, color: c.textSecondary))
      else
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          decoration: cardDecoration,
          child: Column(
            children: [
              for (var i = 0; i < _activity.length; i++) _activityRow(_activity[i], i),
            ],
          ),
        ),
      const SizedBox(height: 22),

      // Actions rapides
      IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Builder(
                builder: (btn) => _quickAction(
                  icon: Ionicons.share_social_outline,
                  tint: c.tintSuccess,
                  iconColor: c.success,
                  label: 'Partager',
                  onTap: () => _shareApp(btn),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _quickAction(
                icon: Ionicons.help_buoy_outline,
                tint: c.tintWarning,
                iconColor: c.warning,
                label: 'Aide',
                onTap: () => _sendEmail(),
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 22),

      // À propos
      sectionTitle('À propos de MedFlow'),
      const SizedBox(height: 14),
      Text(
        'MedFlow accompagne les étudiants en médecine dans leurs révisions grâce à des cours interactifs, '
        'des flashcards et des outils d’apprentissage assistés par IA.',
        style: TextStyle(fontSize: 15, height: 23 / 15, color: c.textSecondary),
      ),
      const SizedBox(height: 22),

      contactCard(
        icon: Ionicons.chatbubble_ellipses_outline,
        title: 'Donner mon avis',
        subtitle: 'Quelques minutes pour nous aider à améliorer MedFlow',
        a11y: 'Donner mon avis sur MedFlow',
        link: true,
        onTap: () {
          logEvent('feedback_opened');
          if (feedbackUrl.isNotEmpty) {
            _openLink(feedbackUrl);
          } else {
            _sendEmail('Mon avis sur MedFlow');
          }
        },
      ),
      const SizedBox(height: 22),
      contactCard(
        icon: Ionicons.mail_outline,
        title: 'Nous contacter',
        subtitle: _contactEmail,
        a11y: 'Nous contacter, $_contactEmail',
        onTap: () => _sendEmail(),
      ),
      const SizedBox(height: 22),
      contactCard(
        icon: Ionicons.shield_checkmark_outline,
        title: 'Confidentialité et avertissement',
        subtitle: 'Tes données, l’IA et ses limites',
        a11y: 'Confidentialité et avertissement médical',
        onTap: () => Nav.navigate('Legal'),
      ),
      const SizedBox(height: 22),

      sectionTitle('Suivez-nous'),
      const SizedBox(height: 14),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        decoration: cardDecoration,
        child: Column(
          children: [
            for (var i = 0; i < socials.length; i++)
              Semantics(
                link: true,
                child: Tappable(
                  onTap: () => _openLink(socials[i].url),
                  button: false,
                  semanticLabel: socials[i].label,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: i > 0 ? BoxDecoration(border: Border(top: BorderSide(color: c.border))) : null,
                    child: ExcludeSemantics(
                      child: Row(
                        children: [
                          Icon(socials[i].icon, size: 24, color: socials[i].color),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(socials[i].label,
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: c.textPrimary)),
                          ),
                          const SizedBox(width: 12),
                          chevron(),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
      const SizedBox(height: 22),

      // Déconnexion : bouton rouge clair, bien au-dessus de la barre d'onglets
      Tappable(
        onTap: _handleLogout,
        semanticLabel: 'Se déconnecter',
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
          decoration: BoxDecoration(color: c.tintDanger, borderRadius: BorderRadius.circular(14)),
          child: ExcludeSemantics(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Ionicons.log_out_outline, size: 20, color: c.dangerText),
                const SizedBox(width: 10),
                Text('Se déconnecter',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.dangerText)),
              ],
            ),
          ),
        ),
      ),
    ];

    return ColoredBox(
      color: c.background,
      child: ScrollConfiguration(
        behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.tabBar + 40),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: content),
        ),
      ),
    );
  }

  Widget _initialsAvatar(String initials) {
    final colors = context.colors;
    return Container(
      width: 112,
      height: 112,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: colors.warning, shape: BoxShape.circle),
      child: Text(initials, style: TextStyle(fontSize: 38, fontWeight: FontWeight.w700, color: colors.onAction)),
    );
  }

  Widget _chip({
    required Color background,
    required IconData icon,
    Color? iconColor,
    required Color color,
    required String text,
    required FontWeight weight,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: iconColor ?? color),
          const SizedBox(width: 6),
          Flexible(child: Text(text, style: TextStyle(fontSize: 13, fontWeight: weight, color: color))),
        ],
      ),
    );
  }

  Widget _statsRow(List<_StatCard> cards) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < cards.length; i++) ...[
            if (i > 0) const SizedBox(width: 12),
            Expanded(child: _statCard(cards[i])),
          ],
        ],
      ),
    );
  }

  Widget _statCard(_StatCard card) {
    final c = context.colors;
    final body = Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: c.border),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: card.tint, borderRadius: BorderRadius.circular(12)),
                child: Icon(card.icon, size: 22, color: card.iconColor),
              ),
              const SizedBox(height: 10),
              Text(card.value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
              const SizedBox(height: 2),
              Text(card.label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: c.textSecondary)),
            ],
          ),
          if (card.label == 'Amis' && _pendingFriendRequests > 0)
            // top/right : 12 depuis le bord de la carte, soit -4 dans le padding de 16.
            Positioned(
              top: -4,
              right: -4,
              child: Container(
                constraints: const BoxConstraints(minWidth: 22),
                height: 22,
                padding: const EdgeInsets.symmetric(horizontal: 6),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: c.danger, borderRadius: BorderRadius.circular(11)),
                child: Text('$_pendingFriendRequests',
                    style: TextStyle(color: c.onAction, fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ),
        ],
      ),
    );
    if (card.onPress != null) {
      return Tappable(
        onTap: card.onPress,
        semanticLabel: card.a11y,
        child: ExcludeSemantics(child: body),
      );
    }
    return Semantics(
      container: true,
      label: '${card.label} : ${card.value}',
      child: ExcludeSemantics(child: body),
    );
  }

  Widget _badgeCard(Map<String, dynamic> badge) {
    final c = context.colors;
    final unlocked = badge['unlocked'] == true;
    final color = _parseHex(badge['color'] as String?) ?? c.primaryDark;
    final progress = ((badge['progress'] as num?)?.toDouble() ?? 0).clamp(0.0, 1.0);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: unlocked ? c.surface : c.surfaceAlt,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: c.border),
      ),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: unlocked ? _withHexAlpha(color, 0x20) : c.surface,
              shape: BoxShape.circle,
            ),
            child: Icon(
              unlocked ? (_badgeIcons[badge['icon']] ?? Ionicons.help) : Ionicons.lock_closed,
              size: unlocked ? 26 : 22,
              color: unlocked ? color : c.muted,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${badge['title'] ?? ''}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: unlocked ? c.textPrimary : c.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${badge['description'] ?? ''}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, height: 18 / 13, color: c.textSecondary),
          ),
          if (!unlocked) ...[
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: SizedBox(
                height: 6,
                child: Stack(
                  children: [
                    Positioned.fill(child: ColoredBox(color: c.border)),
                    FractionallySizedBox(
                      widthFactor: progress,
                      heightFactor: 1,
                      child: DecoratedBox(
                        decoration: BoxDecoration(color: c.warning, borderRadius: BorderRadius.circular(3)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${badge['currentValue'] ?? 0}/${badge['threshold'] ?? 0}',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.textSecondary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _activityRow(Map<String, dynamic> item, int index) {
    final c = context.colors;
    final type = '${item['type'] ?? ''}';
    final isBadge = type == 'badge_unlocked';
    final isQuest = type == 'quest_completed' || type.startsWith('streak_freeze');
    final icon = isBadge
        ? Ionicons.trophy
        : type.startsWith('streak_freeze')
            ? Ionicons.shield_checkmark
            : type == 'mock_exam'
                ? Ionicons.timer
                : type == 'challenge'
                    ? Ionicons.flash
                    : type == 'clinical_case'
                        ? Ionicons.medkit
                        : isQuest
                            ? Ionicons.flag
                            : Ionicons.school;
    final detail = '${item['detail'] ?? ''}';
    final xpGained = (item['xpGained'] as num?)?.toInt() ?? 0;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: index > 0 ? BoxDecoration(border: Border(top: BorderSide(color: c.border))) : null,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isBadge
                  ? c.tintWarning
                  : isQuest
                      ? c.tintSuccess
                      : c.tintPrimary,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 22,
              color: isBadge
                  ? c.warning
                  : isQuest
                      ? c.success
                      : c.primaryDark,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${item['title'] ?? ''}',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                const SizedBox(height: 2),
                Text(
                  '${detail.isNotEmpty ? '$detail · ' : ''}${_formatRelativeTime('${item['createdAt'] ?? ''}')}',
                  style: TextStyle(fontSize: 13, color: c.textSecondary),
                ),
              ],
            ),
          ),
          if (xpGained > 0) ...[
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: c.tintWarning, borderRadius: BorderRadius.circular(999)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Ionicons.star, size: 14, color: c.warning),
                  const SizedBox(width: 4),
                  Text('+$xpGained XP',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.warningText)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _quickAction({
    required IconData icon,
    required Color tint,
    required Color iconColor,
    required String label,
    required VoidCallback onTap,
  }) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: c.border),
        ),
        child: Column(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
              child: Icon(icon, size: 22, color: iconColor),
            ),
            const SizedBox(height: 8),
            Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary)),
          ],
        ),
      ),
    );
  }
}
