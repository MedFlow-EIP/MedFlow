import { buildRevisionSheetHtml, escapeHtml, sanitizeSummary } from '../revisionSheet';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const course = {
  nom: 'Cardio <1>',
  summary: '<h2>Le cœur</h2><p onclick="x()">Quatre cavités</p><script>alert(1)</script>',
  flashcards: [{ question: 'Combien de cavités ?', answer: '4 & pas <3>' }],
  quiz: [{ question: 'Valve mitrale ?', options: { A: 'Gauche', B: 'Droite' }, correct: 'A', explanation: 'Côté gauche.' }],
  tags: ['Cardiologie'],
};

describe('fiche de révision', () => {
  it('échappe le texte saisi par l’utilisateur', () => {
    expect(escapeHtml('<b>"a" & b</b>')).toBe('&lt;b&gt;&quot;a&quot; &amp; b&lt;/b&gt;');
  });

  it('retire scripts et gestionnaires d’événements du résumé', () => {
    const clean = sanitizeSummary(course.summary);
    expect(clean).not.toMatch(/script|onclick/);
    expect(clean).toContain('<h2>Le cœur</h2>');
  });

  it('ne laisse pas une balise imbriquée se reformer après nettoyage', () => {
    const clean = sanitizeSummary('<p>ok</p><scr<script>x</script>ipt>alert(1)</script>');
    expect(clean).toBe('<p>ok</p>alert(1)');
  });

  it('garde la mise en forme sans attributs, ni images, ni entités doublées', () => {
    expect(sanitizeSummary('<h2 style="color:red">Cœur &amp; vaisseaux</h2><p onclick="x()">A & B</p><img src=x onerror=alert(1)>'))
      .toBe('<h2>Cœur &amp; vaisseaux</h2><p>A &amp; B</p>');
  });

  it('contient le titre, les flashcards et le corrigé', () => {
    const html = buildRevisionSheetHtml(course, new Date(2026, 9, 27));
    expect(html).toContain('<h1>Cardio &lt;1&gt;</h1>');
    expect(html).toContain('27/10/2026');
    expect(html).toContain('Flashcards (1)');
    expect(html).toContain('4 &amp; pas &lt;3&gt;');
    expect(html).toContain('<li class="correct">Gauche ✓</li>');
    expect(html).toContain('Côté gauche.');
    expect(html).toContain('<span class="tag">Cardiologie</span>');
    expect(html).not.toContain('<script>');
  });

  it('omet les sections vides', () => {
    const html = buildRevisionSheetHtml({ nom: 'Vide' });
    expect(html).not.toContain('Flashcards');
    expect(html).not.toContain('Quiz corrigé');
  });
});
