import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../screens/account_screen.dart';
import '../screens/ai_chat_screen.dart';
import '../screens/dashboard_screen.dart';
import '../screens/home_screen.dart';
import '../theme/theme_controller.dart';
import '../utils/background_jobs.dart';
import '../utils/social_notifications.dart';
import '../widgets/insets.dart';
import '../widgets/sheet.dart';
import '../widgets/ui.dart';
import 'nav.dart';

class _Tab {
  final String route;
  final String label;
  final String a11y;
  final IconData icon;
  final IconData iconActive;
  const _Tab(this.route, this.label, this.a11y, this.icon, this.iconActive);
}

const _tabs = [
  _Tab('Home', 'Accueil', 'Accueil', Ionicons.home_outline, Ionicons.home),
  _Tab('AIChat', 'IA Chat', 'Assistant IA', Ionicons.chatbubble_ellipses_outline, Ionicons.chatbubble_ellipses),
  _Tab('Dashboard', 'Cours', 'Mes cours', Ionicons.book_outline, Ionicons.book),
  _Tab('Account', 'Compte', 'Compte', Ionicons.person_outline, Ionicons.person),
];

/// Onglets principaux avec la barre du bas maison et le bouton « Ajouter ».
/// Les écrans d'onglet passent sous la barre : ils réservent
/// `ScreenInsets.of(context).tabBar` en bas de leur contenu.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  // Les onglets se construisent à la première visite (comme React Navigation).
  final Set<String> _visited = {'Home'};

  @override
  void initState() {
    super.initState();
    currentTab.value = const TabState('Home');
    currentTab.addListener(_onTab);
  }

  @override
  void dispose() {
    currentTab.removeListener(_onTab);
    super.dispose();
  }

  void _onTab() => setState(() => _visited.add(currentTab.value.route));

  Widget _screen(String route) => switch (route) {
        'Home' => const HomeScreen(),
        'AIChat' => const AIChatScreen(),
        'Dashboard' => const DashboardScreen(),
        _ => const AccountScreen(),
      };

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final selected = currentTab.value.route;
    return PopScope(
      // Retour Android sur un autre onglet : revient à l'accueil.
      canPop: selected == 'Home',
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Nav.navigate('Home');
      },
      child: Scaffold(
        backgroundColor: c.background,
        resizeToAvoidBottomInset: false,
        body: Stack(
          children: [
            IndexedStack(
              index: _tabs.indexWhere((t) => t.route == selected),
              children: [
                for (final t in _tabs)
                  TickerMode(
                    enabled: t.route == selected,
                    child: _visited.contains(t.route) ? _screen(t.route) : const SizedBox.shrink(),
                  ),
              ],
            ),
            const _BackgroundPill(),
            const Positioned(left: 0, right: 0, bottom: 0, child: _TabBar()),
          ],
        ),
      ),
    );
  }
}

/// Imports et cas cliniques en cours de génération (on peut naviguer pendant ce temps).
class _BackgroundPill extends StatelessWidget {
  const _BackgroundPill();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    return ValueListenableBuilder(
      valueListenable: importJobs,
      builder: (context, imports, _) => ValueListenableBuilder(
        valueListenable: caseJobs,
        builder: (context, cases, _) {
          final importing = imports.where((j) => j.status == ImportStatus.processing).toList();
          final preparing = cases.where((j) => j.status == CaseStatus.generating).toList();
          final total = importing.length + preparing.length;
          final label = total > 1
              ? '$total générations en cours…'
              : importing.length == 1
                  ? 'Génération de « ${importing.first.fileName} »…'
                  : preparing.length == 1
                      ? 'Préparation d’un cas clinique…'
                      : '';
          if (label.isEmpty) return const SizedBox.shrink();
          return Positioned(
            left: 0,
            right: 0,
            bottom: insets.tabBar + 10,
            child: IgnorePointer(
              child: Center(
                child: FractionallySizedBox(
                  widthFactor: 0.86,
                  child: Align(
                    child: Semantics(
                      liveRegion: true,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: c.action,
                          borderRadius: BorderRadius.circular(999),
                          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 3))],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: c.onAction),
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.onAction)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    return ValueListenableBuilder(
      valueListenable: currentTab,
      builder: (context, tab, _) => Container(
        height: insets.tabBar,
        padding: EdgeInsets.fromLTRB(8, 8, 8, insets.bottom),
        decoration: BoxDecoration(color: c.surface, border: Border(top: BorderSide(color: c.border))),
        child: MediaQuery.withClampedTextScaling(
          // Barre de hauteur fixe : le texte grandit, mais pas au point de déborder.
          maxScaleFactor: 1.3,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _TabItem(tab: _tabs[0], focused: tab.route == _tabs[0].route),
              _TabItem(tab: _tabs[1], focused: tab.route == _tabs[1].route),
              const _AddButton(),
              _TabItem(tab: _tabs[2], focused: tab.route == _tabs[2].route),
              _TabItem(tab: _tabs[3], focused: tab.route == _tabs[3].route),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  final _Tab tab;
  final bool focused;
  const _TabItem({required this.tab, required this.focused});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ValueListenableBuilder(
      valueListenable: socialBadge,
      builder: (context, social, _) {
        final count = tab.route == 'Account' ? social : 0;
        return Tappable(
          onTap: () => Nav.navigate(tab.route),
          selected: focused,
          semanticLabel: count > 0 ? '${tab.a11y}, $count nouveauté${count > 1 ? 's' : ''}' : tab.a11y,
          child: SizedBox(
            width: 72,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      width: 56,
                      height: 32,
                      decoration: BoxDecoration(
                        color: focused ? c.action : Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(focused ? tab.iconActive : tab.icon,
                          size: 22, color: focused ? c.onAction : c.textSecondary),
                    ),
                    if (count > 0)
                      Positioned(
                        top: -4,
                        right: 8,
                        child: Container(
                          constraints: const BoxConstraints(minWidth: 18),
                          height: 18,
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          decoration: BoxDecoration(
                            color: c.danger,
                            borderRadius: BorderRadius.circular(9),
                            border: Border.all(color: c.surface, width: 2),
                          ),
                          alignment: Alignment.center,
                          child: Text(count > 9 ? '9+' : '$count',
                              textScaler: TextScaler.noScaling,
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(tab.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      color: focused ? c.action : c.textSecondary,
                      fontWeight: focused ? FontWeight.w600 : FontWeight.w500,
                    )),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: () => _openAddSheet(context),
      semanticLabel: 'Ajouter du contenu',
      child: SizedBox(
        width: 72,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: c.action,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: c.primaryDark.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4))],
              ),
              child: Icon(Ionicons.add, size: 28, color: c.onAction),
            ),
            Text('Ajouter',
                maxLines: 1, style: TextStyle(fontSize: 11, color: c.textSecondary, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  void _openAddSheet(BuildContext context) {
    showAppSheet<void>(
      context,
      title: 'Ajouter du contenu',
      builder: (ctx) {
        void go(String screen) {
          Navigator.of(ctx).pop();
          Nav.navigate(screen);
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _AddOption(
              icon: Ionicons.cloud_upload_outline,
              title: 'Importer un cours',
              description: 'PDF, Word, PowerPoint ou photo d’un poly',
              onTap: () => go('UploadCourse'),
            ),
            const SizedBox(height: 18),
            _AddOption(
              icon: Ionicons.medkit_outline,
              title: 'Cas clinique',
              description: 'Prends les décisions face à un patient',
              semanticLabel: 'Faire un cas clinique',
              onTap: () => go('ClinicalCases'),
            ),
            const SizedBox(height: 18),
            _AddOption(
              icon: Ionicons.timer_outline,
              title: 'Examen blanc',
              description: 'Chronométré, noté sur 20',
              semanticLabel: 'Lancer un examen blanc',
              onTap: () => go('MockExam'),
            ),
            const SizedBox(height: 18),
            _AddOption(
              icon: Ionicons.calendar_outline,
              title: 'Ajouter un examen',
              description: 'Ses cours passent en priorité dans tes révisions',
              semanticLabel: 'Ajouter un examen au calendrier',
              onTap: () => go('Exams'),
            ),
          ],
        );
      },
    );
  }
}

class _AddOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final String? semanticLabel;
  final VoidCallback onTap;
  const _AddOption({
    required this.icon,
    required this.title,
    required this.description,
    this.semanticLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      semanticLabel: semanticLabel ?? title,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: c.border),
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(14)),
              child: Icon(icon, size: 26, color: c.primaryDark),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.textPrimary)),
                  const SizedBox(height: 3),
                  Text(description, style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary)),
                ],
              ),
            ),
            Icon(Ionicons.chevron_forward, size: 20, color: c.textSecondary),
          ],
        ),
      ),
    );
  }
}
