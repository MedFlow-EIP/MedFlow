import 'package:flutter_test/flutter_test.dart';
import 'package:medflow/utils/chat_answers.dart';
import 'package:medflow/utils/diagrams.dart';
import 'package:medflow/widgets/chat/chat_diagram.dart';

const _svg = '<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

List<String> _types(List<MessagePart> parts) => parts.map((p) => p.type.name).toList();

void main() {
  group('schémas du chat', () {
    test('découpe texte et schémas dans l’ordre', () {
      final parts = splitDiagrams('Voici le cycle :\n```svg\n$_svg\n```\nPuis la diastole.');
      expect(_types(parts), ['text', 'svg', 'text']);
      expect(parts[1].content, _svg);
    });

    test('ne plante pas sur un message vide ou absent', () {
      expect(splitDiagrams(null), isEmpty);
      expect(stripDiagrams(null), '');
    });

    test('trouve plusieurs schémas dans la même réponse', () {
      expect(_types(splitDiagrams('```svg\n<svg></svg>\n``` puis ```svg\n<svg></svg>\n```')), ['svg', 'text', 'svg']);
    });

    test('ignore un bloc qui n’est pas un SVG', () {
      expect(splitDiagrams('```svg\n<div>pas un svg</div>\n```'), isEmpty);
    });

    test('retire scripts, HTML embarqué, événements et liens externes', () {
      const dirty = '<svg viewBox="0 0 10 10"><script>alert(1)</script><foreignObject><div>x</div></foreignObject>'
          '<rect onclick="steal()" width="5"/><image href="https://evil.example/x.png"/>'
          '<a href="https://evil.example"><text>lien</text></a><use href="#flèche"/></svg>';
      final clean = sanitizeSvg(dirty)!;
      expect(clean, isNot(matches(RegExp(r'script|foreignObject|onclick|evil\.example|<image|<a\b|<use'))));
      expect(clean, contains('<rect width="5"/>'));
      expect(clean, contains('<text>lien</text>'));
    });

    test('remplace les orientations de flèche que l’app ne sait pas dessiner', () {
      const svg =
          '<svg><marker id="a" orient="auto-start-reverse"/><marker id="b" orient="auto"/><marker id="c" orient=\'45\'/></svg>';
      expect(
        sanitizeSvg(svg),
        '<svg><marker id="a" orient="auto"/><marker id="b" orient="auto"/><marker id="c" orient=\'45\'/></svg>',
      );
    });

    test('ne laisse pas une balise imbriquée se reformer après nettoyage', () {
      expect(
        sanitizeSvg('<svg><scr<script>x</script>ipt>alert(1)</script><rect width="5"/></svg>'),
        '<svg>alert(1)<rect width="5"/></svg>',
      );
    });

    test('refuse un SVG démesuré', () {
      expect(sanitizeSvg('<svg>${'x' * 50000}</svg>'), isNull);
    });

    test('retire les schémas pour la lecture vocale et les flashcards', () {
      expect(stripDiagrams('Avant\n```svg\n$_svg\n```\nAprès'), 'Avant\n\nAprès');
    });

    test('lit le rapport largeur/hauteur du viewBox', () {
      expect(svgAspectRatio(_svg), 2);
      expect(svgAspectRatio('<svg></svg>'), closeTo(4 / 3, 1e-9));
    });
  });

  group('largeur des colonnes de tableau', () {
    test('partage la bulle entre peu de colonnes', () {
      expect(tableColumnWidth(2, 300), 150);
    });

    test('garde 130 px minimum quand il y a beaucoup de colonnes (le tableau défile)', () {
      expect(tableColumnWidth(5, 300), 130);
    });

    test('ne plante pas sans tableau parent', () {
      expect(tableColumnWidth(0, 300), 300);
    });
  });

  group('bouton « Créer des flashcards »', () {
    final course = 'La systole est la phase de contraction du cœur. ' * 12;

    test('apparaît sous une vraie réponse de cours', () {
      expect(worthFlashcards(course), isTrue);
    });

    test('pas sous une réponse courte', () {
      expect(worthFlashcards('Bonjour ! Comment puis-je t’aider aujourd’hui en médecine ?'), isFalse);
    });

    test('pas quand l’assistant demande une précision', () {
      expect(worthFlashcards('$course\n\nDe quel cours parles-tu exactement ?'), isFalse);
    });

    test('pas sous un refus hors sujet', () {
      expect(worthFlashcards('Je suis spécialisé uniquement en médecine. $course'), isFalse);
    });

    test('ignore les schémas dans la longueur', () {
      final svg = '```svg\n<svg>${'x' * 800}</svg>\n```';
      expect(worthFlashcards('Voici le schéma :\n$svg'), isFalse);
    });
  });
}
