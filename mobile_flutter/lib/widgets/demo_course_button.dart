import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/analytics.dart';
import '../utils/app_alert.dart';
import 'ui.dart';

/// « Essayer avec un cours d'exemple » : ajoute un cours déjà généré et
/// l'ouvre, pour découvrir l'app sans attendre l'import d'un premier PDF.
class DemoCourseButton extends StatefulWidget {
  const DemoCourseButton({super.key});

  @override
  State<DemoCourseButton> createState() => _DemoCourseButtonState();
}

class _DemoCourseButtonState extends State<DemoCourseButton> {
  bool _busy = false;

  Future<void> _addDemo() async {
    if (_busy || Api.currentUser == null) return;
    setState(() => _busy = true);
    try {
      final data = await Api.postJson('/api/courses/demo', null,
          fallback: 'Le cours d’exemple n’a pas pu être ajouté.');
      logEvent('demo_course_added');
      Nav.navigate('CourseDetail', {'courseId': data['course_id']});
    } catch (err) {
      appAlert('Cours d’exemple', errorMessage(err, 'Le cours d’exemple n’a pas pu être ajouté.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Tappable(
          onTap: _busy ? null : _addDemo,
          semanticLabel: 'Essayer avec un cours d’exemple',
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: c.primaryText),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_busy)
                  SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: c.primaryText))
                else
                  Icon(Ionicons.sparkles_outline, size: 18, color: c.primaryText),
                const SizedBox(width: 8),
                Flexible(
                  child: Text('Essayer avec un cours d’exemple',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
