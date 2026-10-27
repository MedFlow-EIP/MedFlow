import { getLessonSteps, isGradedStep } from '../lessons';

// Les 10 leçons du parcours Anatomie (mêmes identifiants que la table `lessons` du backend).
const ANATOMY_LESSONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

describe('contenu des leçons — cohérence', () => {
  it.each(ANATOMY_LESSONS)('la leçon anatomy/%s a un contenu propre et au moins un quiz', (id) => {
    const steps = getLessonSteps('anatomy', id);
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps.some(isGradedStep)).toBe(true);
  });

  it('chaque leçon a un contenu différent', () => {
    const firstQuestions = ANATOMY_LESSONS.map((id) => JSON.stringify(getLessonSteps('anatomy', id)));
    expect(new Set(firstQuestions).size).toBe(ANATOMY_LESSONS.length);
  });

  it.each(ANATOMY_LESSONS)('anatomy/%s : chaque bonne réponse existe parmi les choix', (id) => {
    for (const step of getLessonSteps('anatomy', id)) {
      if (step.type === 'quickQuiz' || step.type === 'speed') {
        const ids = step.data.options.map((o) => o.id);
        expect(ids).toContain(step.data.correctId);
        expect(new Set(ids).size).toBe(ids.length);
      }
      if (step.type === 'speed') {
        expect(step.data.timeLimit).toBeGreaterThanOrEqual(5);
      }
      if (step.type === 'visualQuiz') {
        const ids = step.data.parts.map((p) => p.id);
        expect(ids).toContain(step.data.correctId);
        for (const p of step.data.parts) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(100);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('une leçon sans contenu affiche un message au lieu du contenu d’une autre leçon', () => {
    const steps = getLessonSteps('cardiology', '1', 'Le cœur');
    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe('explanation');
    expect(steps[0].type === 'explanation' && steps[0].data.title).toBe('Le cœur');
  });
});
