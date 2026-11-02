import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/theme_controller.dart';
import '../insets.dart';

// Copie de components/chat/ChatDiagram.tsx.

final RegExp _viewBox =
    RegExp(r'''viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)''', caseSensitive: false);

/// parseFloat de JavaScript : lit le nombre en tête de chaîne (0 sinon).
double _parseFloat(String? value) {
  final m = RegExp(r'^\d*\.?\d*').firstMatch(value ?? '');
  final text = m?.group(0) ?? '';
  return double.tryParse(text.endsWith('.') ? '${text}0' : text) ?? 0;
}

/// Rapport largeur/hauteur tiré du viewBox (4:3 par défaut).
double svgAspectRatio(String xml) {
  final m = _viewBox.firstMatch(xml);
  final w = m != null ? _parseFloat(m.group(1)) : 0.0;
  final h = m != null ? _parseFloat(m.group(2)) : 0.0;
  return w > 0 && h > 0 ? w / h : 4 / 3;
}

/// Schéma dessiné par l'assistant, sur fond blanc (les couleurs du SVG sont
/// pensées pour un fond clair). Toucher l'agrandit en plein écran.
class ChatDiagram extends StatelessWidget {
  final String xml;
  final double width;
  const ChatDiagram({super.key, required this.xml, required this.width});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final ratio = svgAspectRatio(xml);
    return Semantics(
      button: true,
      image: true,
      label: "Schéma de l'assistant, toucher pour agrandir",
      excludeSemantics: true,
      child: GestureDetector(
        onTap: () => _openFullScreen(context, ratio),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 8),
          padding: const EdgeInsets.all(8),
          clipBehavior: Clip.hardEdge,
          decoration: BoxDecoration(
            color: const Color(0xFFFFFFFF),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: c.border),
          ),
          child: Stack(
            children: [
              _DiagramSvg(xml: xml, width: width, height: width / ratio),
              Positioned(
                // Le badge est à 8 px du bord du cadre (padding compris).
                right: 0,
                top: 0,
                child: Container(
                  width: 26,
                  height: 26,
                  decoration: const BoxDecoration(color: Color(0xFFF3F4F6), shape: BoxShape.circle),
                  child: const Icon(Ionicons.expandOutline, size: 14, color: Color(0xFF374151)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openFullScreen(BuildContext context, double ratio) {
    showGeneralDialog<void>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: false,
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (ctx, _, __) => _FullScreenDiagram(xml: xml, ratio: ratio),
      transitionBuilder: (ctx, anim, _, child) => FadeTransition(opacity: anim, child: child),
    );
  }
}

/// SVG avec repli « Schéma illisible » s'il ne peut pas être dessiné.
class _DiagramSvg extends StatelessWidget {
  final String xml;
  final double width;
  final double height;
  const _DiagramSvg({required this.xml, required this.width, required this.height});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SvgPicture.string(
      xml,
      width: width,
      height: height,
      excludeFromSemantics: true,
      errorBuilder: (context, error, stackTrace) => Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Ionicons.imageOutline, size: 18, color: c.textSecondary),
            const SizedBox(width: 6),
            Text('Schéma illisible', style: TextStyle(fontSize: 13, color: c.textSecondary)),
          ],
        ),
      ),
    );
  }
}

class _FullScreenDiagram extends StatelessWidget {
  final String xml;
  final double ratio;
  const _FullScreenDiagram({required this.xml, required this.ratio});

  @override
  Widget build(BuildContext context) {
    final insets = ScreenInsets.of(context);
    final window = MediaQuery.sizeOf(context);
    void close() => Navigator.of(context).pop();
    return Material(
      color: const Color(0xFFFFFFFF),
      child: Padding(
        padding: EdgeInsets.only(top: insets.top, bottom: insets.bottom),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Semantics(
                    button: true,
                    label: 'Fermer le schéma',
                    excludeSemantics: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: close,
                      child: const SizedBox(
                        width: 48,
                        height: 48,
                        child: Icon(Ionicons.close, size: 24, color: Color(0xFF111827)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Défilement dans les deux sens et zoom (×4) : schéma affiché en grand.
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) => InteractiveViewer(
                  constrained: false,
                  minScale: 1,
                  maxScale: 4,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minWidth: constraints.maxWidth, minHeight: constraints.maxHeight),
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: GestureDetector(
                          onTap: close,
                          child: _DiagramSvg(xml: xml, width: window.width * 1.4, height: (window.width * 1.4) / ratio),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
