import 'package:flutter/widgets.dart';

// Petits outils de mise en page du lot « cours » : `gap` de React Native et
// bordure en pointillés (`borderStyle: 'dashed'`), absente de Flutter.

/// Intercale un espace de [gap] px entre les enfants (comme `gap` en RN).
List<Widget> gapped(List<Widget> children, double gap, {Axis axis = Axis.vertical}) {
  final out = <Widget>[];
  for (final child in children) {
    if (out.isNotEmpty) out.add(axis == Axis.vertical ? SizedBox(height: gap) : SizedBox(width: gap));
    out.add(child);
  }
  return out;
}

/// Boîte à bordure en pointillés et coins arrondis.
class DashedBorderBox extends StatelessWidget {
  final Widget child;
  final Color color;
  final Color? background;
  final double width;
  final double radius;
  final EdgeInsetsGeometry? padding;
  final BoxConstraints? constraints;
  const DashedBorderBox({
    super.key,
    required this.child,
    required this.color,
    this.background,
    this.width = 1.5,
    this.radius = 14,
    this.padding,
    this.constraints,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DashedPainter(color: color, background: background, width: width, radius: radius),
      child: Container(
        constraints: constraints,
        // La bordure occupe de la place, comme en RN.
        padding: EdgeInsets.all(width).add(padding ?? EdgeInsets.zero),
        child: child,
      ),
    );
  }
}

class _DashedPainter extends CustomPainter {
  final Color color;
  final Color? background;
  final double width;
  final double radius;
  _DashedPainter({required this.color, this.background, required this.width, required this.radius});

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    if (background != null) canvas.drawRRect(rrect, Paint()..color = background!);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = width;
    final path = Path()..addRRect(rrect.deflate(width / 2));
    // Tirets de 3 × l'épaisseur, comme iOS.
    final dash = width * 3;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + dash), paint);
        distance += dash * 2;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedPainter old) =>
      old.color != color || old.background != background || old.width != width || old.radius != radius;
}
