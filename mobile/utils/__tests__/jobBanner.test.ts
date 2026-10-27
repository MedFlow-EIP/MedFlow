import { bannerJobs, newlyFinished } from '../jobBanner';

describe('bandeau « c’est prêt »', () => {
  it('annonce un cours terminé pendant qu’on navigue', () => {
    const seen = new Set<string>();
    expect(newlyFinished(seen, bannerJobs([{ jobId: 'j1', fileName: 'cardio.pdf', status: 'processing' }], []))).toEqual([]);

    const done = newlyFinished(
      seen,
      bannerJobs([{ jobId: 'j1', fileName: 'cardio.pdf', status: 'done', courseId: 'c1', courseNom: 'Cardio' }], [])
    );
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({
      ok: true,
      title: '« Cardio » est prêt',
      target: { screen: 'CourseDetail', params: { courseId: 'c1' } },
    });
    // Annoncé une seule fois.
    expect(
      newlyFinished(seen, bannerJobs([{ jobId: 'j1', fileName: 'cardio.pdf', status: 'done', courseId: 'c1' }], []))
    ).toEqual([]);
  });

  it('annonce un cas clinique prêt ou raté', () => {
    const seen = new Set<string>();
    newlyFinished(seen, bannerJobs([], [
      { caseId: 1, label: 'Cardio', status: 'generating' },
      { caseId: 2, label: 'Neuro', status: 'generating' },
    ]));
    const done = newlyFinished(seen, bannerJobs([], [
      { caseId: 1, label: 'Cardio', status: 'ready', title: 'Douleur thoracique' },
      { caseId: 2, label: 'Neuro', status: 'error' },
    ]));
    expect(done.map((d) => [d.ok, d.title])).toEqual([
      [true, 'Cas clinique prêt : Douleur thoracique'],
      [false, 'Cas clinique non créé (Neuro)'],
    ]);
    expect(done[0].target).toEqual({ screen: 'ClinicalCase', params: { caseId: 1 } });
    expect(done[1].target).toBeUndefined();
  });

  it('ne réannonce pas un travail déjà terminé à l’ouverture', () => {
    const seen = new Set<string>();
    expect(newlyFinished(seen, bannerJobs([], [{ caseId: 3, label: 'X', status: 'ready' }]))).toEqual([]);
  });
});
