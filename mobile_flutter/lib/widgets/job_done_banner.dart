import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../theme/theme_controller.dart';
import '../utils/background_jobs.dart';
import 'insets.dart';
import 'ui.dart';

const _visibleFor = Duration(seconds: 9);

/// Bandeau en haut de l'écran quand un import ou un cas clinique est terminé.
class JobDoneBanner extends StatefulWidget {
  const JobDoneBanner({super.key});

  @override
  State<JobDoneBanner> createState() => _JobDoneBannerState();
}

class _JobDoneBannerState extends State<JobDoneBanner> {
  final Set<String> _wasPending = {};
  BannerJob? _shown;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    importJobs.addListener(_update);
    caseJobs.addListener(_update);
    _update();
  }

  @override
  void dispose() {
    importJobs.removeListener(_update);
    caseJobs.removeListener(_update);
    _timer?.cancel();
    super.dispose();
  }

  void _update() {
    final finished = newlyFinished(_wasPending, bannerJobs(importJobs.value, caseJobs.value));
    if (finished.isEmpty) return;
    setState(() => _shown = finished.last);
    _timer?.cancel();
    _timer = Timer(_visibleFor, () {
      if (mounted) setState(() => _shown = null);
    });
  }

  void _open() {
    final target = _shown?.target;
    setState(() => _shown = null);
    if (target != null) Nav.navigate(target.screen, target.params);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final shown = _shown;
    return Positioned(
      left: 16,
      right: 16,
      top: ScreenInsets.of(context).top,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        transitionBuilder: (child, anim) => FadeTransition(
          opacity: anim,
          child: SlideTransition(
            position: Tween(begin: const Offset(0, -0.4), end: Offset.zero).animate(anim),
            child: child,
          ),
        ),
        child: shown == null
            ? const SizedBox.shrink()
            : Material(
                key: ValueKey(shown.key),
                color: c.surface,
                elevation: 10,
                shadowColor: Colors.black38,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: c.border),
                ),
                child: Semantics(
                  liveRegion: true,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                    child: Row(
                      children: [
                        Expanded(
                          child: Tappable(
                            onTap: shown.target != null ? _open : null,
                            semanticLabel: shown.target != null ? '${shown.title}. Ouvrir' : shown.title,
                            child: Row(
                              children: [
                                Icon(shown.ok ? Ionicons.checkmark_circle : Ionicons.alert_circle,
                                    size: 22, color: shown.ok ? c.successText : c.dangerText),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(shown.title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                          fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary)),
                                ),
                                if (shown.target != null) ...[
                                  const SizedBox(width: 10),
                                  Text('Voir',
                                      style: TextStyle(
                                          fontSize: 14, fontWeight: FontWeight.w700, color: c.primaryText)),
                                ],
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Tappable(
                          onTap: () => setState(() => _shown = null),
                          semanticLabel: 'Fermer',
                          child: Padding(
                            padding: const EdgeInsets.all(4),
                            child: Icon(Ionicons.close, size: 20, color: c.textSecondary),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}
