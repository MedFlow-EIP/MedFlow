import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../theme/colors.dart';
import '../theme/theme_controller.dart';
import '../utils/first_time.dart';
import '../utils/tutorial.dart';
import '../utils/tutorial_analytics.dart';
import '../widgets/insets.dart';
import '../widgets/ui.dart';

class TutorialSlide {
  final String id;
  final IconData icon;
  final Tone tone;
  final String title;
  final String text;

  /// Petites étiquettes autour de l'illustration (formats, exemples…).
  final List<String>? chips;

  /// Où retrouver la fonctionnalité dans l'app.
  final ({IconData icon, String label})? where;

  const TutorialSlide({
    required this.id,
    required this.icon,
    required this.tone,
    required this.title,
    required this.text,
    this.chips,
    this.where,
  });
}

// Accueil en quelques cartes, sans quitter l'écran : on présente ce que
// l'app apporte, puis on propose d'importer tout de suite un premier cours.
const tutorialSlides = <TutorialSlide>[
  TutorialSlide(
    id: 'welcome',
    icon: Ionicons.medkit,
    tone: Tone.primary,
    title: 'Bienvenue sur MedFlow',
    text:
        'Tes cours de médecine deviennent des résumés, des flashcards et des quiz. Tu révises moins longtemps, et tu retiens mieux.',
  ),
  TutorialSlide(
    id: 'import',
    icon: Ionicons.cloud_upload,
    tone: Tone.primary,
    title: 'Importe tes cours',
    text:
        'Un PDF, un Word, un PowerPoint ou une simple photo d’un poly : l’IA en tire l’essentiel en moins d’une minute.',
    chips: ['PDF', 'Word', 'PowerPoint', 'Photo'],
    where: (icon: Ionicons.add, label: 'Bouton + au centre de la barre du bas'),
  ),
  TutorialSlide(
    id: 'revision',
    icon: Ionicons.flash,
    tone: Tone.warning,
    title: 'Révise au bon moment',
    text:
        'La répétition espacée te repropose chaque carte juste avant que tu l’oublies. Un rappel quotidien te prévient quand il y en a à revoir.',
    chips: ['Aujourd’hui', 'Dans 3 j', 'Dans 1 sem.'],
    where: (icon: Ionicons.home, label: 'Accueil, carte « Aujourd’hui »'),
  ),
  TutorialSlide(
    id: 'assistant',
    icon: Ionicons.chatbubble_ellipses,
    tone: Tone.primary,
    title: 'Un assistant pour tes questions',
    text:
        'Demande une explication, envoie une photo ou un PDF, puis transforme ses réponses en flashcards en un geste.',
    where: (icon: Ionicons.chatbubble_ellipses, label: 'Onglet IA Chat'),
  ),
  TutorialSlide(
    id: 'progress',
    icon: Ionicons.trophy,
    tone: Tone.success,
    title: 'Garde le rythme',
    text: 'Leçons guidées, XP, séries, badges et classement entre amis : chaque jour de révision compte.',
    where: (icon: Ionicons.home, label: 'Onglet Accueil'),
  ),
];

// Étiquettes réparties autour de l'illustration.
const _chipPositions = <({double? top, double? left, double? right, double? bottom})>[
  (top: 18, left: 8, right: null, bottom: null),
  (top: 40, left: null, right: 0, bottom: null),
  (top: null, left: 0, right: null, bottom: 30),
  (top: null, left: null, right: 16, bottom: 8),
];

/// Tutoriel de bienvenue (copie de TutorialScreen.tsx), monté par `app.dart`
/// par-dessus toute l'app quand `tutorialVisible` est vrai : il vit hors du
/// Navigator, d'où le `Material` et la navigation par `Nav`.
class TutorialOverlay extends StatefulWidget {
  const TutorialOverlay({super.key});

  @override
  State<TutorialOverlay> createState() => _TutorialOverlayState();
}

class _TutorialOverlayState extends State<TutorialOverlay> {
  final _pageController = PageController();
  int _index = 0;
  late final int _startedAt;

  TutorialSlide get _slide => tutorialSlides[_index];
  bool get _isLast => _index == tutorialSlides.length - 1;

  @override
  void initState() {
    super.initState();
    // Monté à chaque affichage : on repart de la première carte.
    _startedAt = logTutorialStarted();
    logStepViewed(_startedAt, _index, _slide.id, _slide.title);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _setIndex(int next) {
    if (!mounted || next == _index) return;
    setState(() => _index = next);
    logStepViewed(_startedAt, _index, _slide.id, _slide.title);
  }

  void _goTo(int next) {
    _pageController.animateToPage(next, duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    _setIndex(next);
  }

  // onMomentumScrollEnd : l'étape suit la page où le glissement s'arrête.
  bool _onScrollEnd(ScrollEndNotification notification) {
    if (notification.depth != 0) return false;
    final page = _pageController.hasClients ? _pageController.page : null;
    if (page != null) _setIndex(page.round());
    return false;
  }

  Future<void> _finish([VoidCallback? then]) async {
    logTutorialCompleted(_startedAt);
    await markTutorialCompleted();
    hideTutorial();
    then?.call();
  }

  Future<void> _skip() async {
    logTutorialSkipped(_startedAt, _index, _slide.id, _slide.title);
    await markTutorialCompleted();
    hideTutorial();
  }

  void _openUpload() => Nav.navigate('UploadCourse');

  void _openHome() => Nav.navigate('MainTabs', {'screen': 'Home'});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    // Modal animationType="fade". BlockSemantics : comme le Modal RN, l'app
    // en dessous n'est plus lue par VoiceOver tant que le tutoriel est ouvert.
    return SizedBox.expand(
      child: BlockSemantics(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 300),
          builder: (context, opacity, child) => Opacity(opacity: opacity, child: child),
          child: Material(
            color: c.background,
            child: Padding(
              padding: EdgeInsets.only(top: insets.top + 8, bottom: insets.bottom + 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _topBar(context),
                  Expanded(
                    child: NotificationListener<ScrollEndNotification>(
                      onNotification: _onScrollEnd,
                      child: PageView.builder(
                        controller: _pageController,
                        // bounces={false} : pas de rebond aux extrémités.
                        physics: const ClampingScrollPhysics(),
                        itemCount: tutorialSlides.length,
                        itemBuilder: (context, i) => _SlideView(slide: tutorialSlides[i]),
                      ),
                    ),
                  ),
                  _dots(context),
                  _actions(context),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _topBar(BuildContext context) {
    final c = context.colors;
    return Container(
      constraints: const BoxConstraints(minHeight: 44),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Semantics(
            label: 'Étape ${_index + 1} sur ${tutorialSlides.length}',
            excludeSemantics: true,
            child: Text('${_index + 1}/${tutorialSlides.length}',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textSecondary)),
          ),
          if (!_isLast)
            Tappable(
              onTap: _skip,
              semanticLabel: 'Passer le tutoriel',
              child: ExcludeSemantics(
                child: Container(
                  constraints: const BoxConstraints(minHeight: 44),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  alignment: Alignment.center,
                  child:
                      Text('Passer', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // Points de progression : s'allongent en suivant le glissement du doigt.
  Widget _dots(BuildContext context) {
    final c = context.colors;
    return ExcludeSemantics(
      child: Padding(
        // paddingVertical 20, dont 8 servent de zone tactile élargie aux points (hitSlop).
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: AnimatedBuilder(
          animation: _pageController,
          builder: (context, _) {
            final page = (_pageController.hasClients && _pageController.position.haveDimensions)
                ? (_pageController.page ?? _index.toDouble())
                : _index.toDouble();
            return Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < tutorialSlides.length; i++)
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => _goTo(i),
                    // hitSlop={8} ; les 2 × 4 px horizontaux font l'écart de 8 entre les points.
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                      child: Builder(builder: (context) {
                        final d = (page - i).abs().clamp(0.0, 1.0);
                        return Opacity(
                          opacity: 1 - 0.65 * d,
                          child: Container(
                            width: 24 - 16 * d,
                            height: 8,
                            decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(4)),
                          ),
                        );
                      }),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _actions(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: _isLast
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _PrimaryAction(
                  onTap: () => _finish(_openUpload),
                  children: [
                    Icon(Ionicons.cloud_upload_outline, size: 20, color: c.onAction),
                    const SizedBox(width: 10),
                    Flexible(child: Text('Importer mon premier cours', style: _primaryTextStyle(c))),
                  ],
                ),
                const SizedBox(height: 8),
                Tappable(
                  onTap: () => _finish(_openHome),
                  child: SizedBox(
                    height: 48,
                    child: Center(
                      child: Text('Découvrir l’app d’abord',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
                    ),
                  ),
                ),
              ],
            )
          : Row(
              children: [
                if (_index > 0) ...[
                  Tappable(
                    onTap: () => _goTo(_index - 1),
                    semanticLabel: 'Étape précédente',
                    child: ExcludeSemantics(
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: c.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: c.border, width: 1.5),
                        ),
                        child: Icon(Ionicons.arrow_back, size: 22, color: c.textPrimary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: _PrimaryAction(
                    onTap: () => _goTo(_index + 1),
                    children: [
                      Flexible(child: Text(_index == 0 ? 'C’est parti' : 'Suivant', style: _primaryTextStyle(c))),
                      const SizedBox(width: 10),
                      Icon(Ionicons.arrow_forward, size: 20, color: c.onAction),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

TextStyle _primaryTextStyle(AppColors c) => TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: c.onAction);

/// Bouton plein du tutoriel (56 px, rayon 16).
class _PrimaryAction extends StatelessWidget {
  final VoidCallback onTap;
  final List<Widget> children;
  const _PrimaryAction({required this.onTap, required this.children});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      child: Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(16)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: children),
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  final TutorialSlide slide;
  const _SlideView({required this.slide});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final tone = toneColors(context, slide.tone);
    final where = slide.where;
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ExcludeSemantics(
                  child: SizedBox(
                    width: 240,
                    height: 220,
                    child: Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 200,
                          height: 200,
                          decoration: BoxDecoration(color: tone.bg, shape: BoxShape.circle),
                        ),
                        Container(
                          width: 120,
                          height: 120,
                          decoration: BoxDecoration(
                            color: c.surface,
                            shape: BoxShape.circle,
                            border: Border.all(color: tone.bg, width: 6),
                            boxShadow: [
                              BoxShadow(
                                  color: Colors.black.withOpacity(0.12), blurRadius: 14, offset: const Offset(0, 6)),
                            ],
                          ),
                          child: Icon(slide.icon, size: 56, color: tone.fg),
                        ),
                        for (var i = 0; i < (slide.chips?.length ?? 0); i++)
                          Positioned(
                            top: _chipPositions[i % _chipPositions.length].top,
                            left: _chipPositions[i % _chipPositions.length].left,
                            right: _chipPositions[i % _chipPositions.length].right,
                            bottom: _chipPositions[i % _chipPositions.length].bottom,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: c.surface,
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: c.border),
                                boxShadow: [
                                  BoxShadow(
                                      color: Colors.black.withOpacity(0.08), blurRadius: 4, offset: const Offset(0, 2)),
                                ],
                              ),
                              child: Text(slide.chips![i],
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textPrimary)),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                // marginBottom 18 de l'illustration + gap 14.
                const SizedBox(height: 32),
                Semantics(
                  header: true,
                  child: Text(slide.title,
                      textAlign: TextAlign.center,
                      style:
                          TextStyle(fontSize: 26, height: 32 / 26, fontWeight: FontWeight.w700, color: c.textPrimary)),
                ),
                const SizedBox(height: 14),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 360),
                  child: Text(slide.text,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 16, height: 24 / 16, color: c.textSecondary)),
                ),
                if (where != null) ...[
                  // gap 14 + marginTop 6.
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.only(left: 6, right: 14, top: 6, bottom: 6),
                    decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(999)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(color: c.surface, shape: BoxShape.circle),
                          child: Icon(where.icon, size: 16, color: c.primaryDark),
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(where.label,
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textPrimary)),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
