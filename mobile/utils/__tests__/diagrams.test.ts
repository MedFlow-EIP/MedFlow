import { sanitizeSvg, splitDiagrams, stripDiagrams } from '../diagrams';
import { svgAspectRatio } from '../../components/chat/ChatDiagram';

jest.mock('../../theme/ThemeContext', () => ({ useTheme: () => ({}) }));
jest.mock('react-native-svg', () => ({ SvgXml: () => null }));

const SVG = '<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

describe('schémas du chat', () => {
  it('découpe texte et schémas dans l’ordre', () => {
    const parts = splitDiagrams(`Voici le cycle :\n\`\`\`svg\n${SVG}\n\`\`\`\nPuis la diastole.`);
    expect(parts.map((p) => p.type)).toEqual(['text', 'svg', 'text']);
    expect(parts[1].content).toBe(SVG);
  });

  it('ne plante pas sur un message vide ou absent', () => {
    expect(splitDiagrams(undefined as any)).toEqual([]);
    expect(stripDiagrams(null as any)).toBe('');
  });

  it('trouve plusieurs schémas dans la même réponse', () => {
    const parts = splitDiagrams('```svg\n<svg></svg>\n``` puis ```svg\n<svg></svg>\n```');
    expect(parts.map((p) => p.type)).toEqual(['svg', 'text', 'svg']);
  });

  it('ignore un bloc qui n’est pas un SVG', () => {
    expect(splitDiagrams('```svg\n<div>pas un svg</div>\n```').map((p) => p.type)).toEqual([]);
  });

  it('retire scripts, HTML embarqué, événements et liens externes', () => {
    const dirty =
      '<svg viewBox="0 0 10 10"><script>alert(1)</script><foreignObject><div>x</div></foreignObject>' +
      '<rect onclick="steal()" width="5"/><image href="https://evil.example/x.png"/>' +
      '<a href="https://evil.example"><text>lien</text></a><use href="#flèche"/></svg>';
    const clean = sanitizeSvg(dirty)!;
    expect(clean).not.toMatch(/script|foreignObject|onclick|evil\.example|<image|<a\b|<use/);
    expect(clean).toContain('<rect width="5"/>');
    expect(clean).toContain('<text>lien</text>');
  });

  it('remplace les orientations de flèche que l’app ne sait pas dessiner', () => {
    const svg =
      '<svg><marker id="a" orient="auto-start-reverse"/><marker id="b" orient="auto"/><marker id="c" orient=\'45\'/></svg>';
    expect(sanitizeSvg(svg)).toBe(
      '<svg><marker id="a" orient="auto"/><marker id="b" orient="auto"/><marker id="c" orient=\'45\'/></svg>'
    );
  });

  it('ne laisse pas une balise imbriquée se reformer après nettoyage', () => {
    const clean = sanitizeSvg('<svg><scr<script>x</script>ipt>alert(1)</script><rect width="5"/></svg>');
    expect(clean).toBe('<svg>alert(1)<rect width="5"/></svg>');
  });

  it('refuse un SVG démesuré', () => {
    expect(sanitizeSvg(`<svg>${'x'.repeat(50_000)}</svg>`)).toBeNull();
  });

  it('retire les schémas pour la lecture vocale et les flashcards', () => {
    expect(stripDiagrams(`Avant\n\`\`\`svg\n${SVG}\n\`\`\`\nAprès`)).toBe('Avant\n\nAprès');
  });

  it('lit le rapport largeur/hauteur du viewBox', () => {
    expect(svgAspectRatio(SVG)).toBe(2);
    expect(svgAspectRatio('<svg></svg>')).toBeCloseTo(4 / 3);
  });
});
