import type { ImportJob } from './importJobs';
import type { CaseJob } from './caseJobs';

// Bandeau « c'est prêt » dans l'app : quand un import ou un cas clinique se
// termine pendant qu'on navigue, la notification système peut ne pas
// s'afficher (app au premier plan, permission refusée). On le dit dans l'app.

export type BannerJob = {
  key: string;
  pending: boolean;
  ok: boolean;
  title: string;
  target?: { screen: string; params?: object };
};

export function bannerJobs(imports: ImportJob[], cases: CaseJob[]): BannerJob[] {
  return [
    ...imports.map((j) => ({
      key: `import:${j.jobId}`,
      pending: j.status === 'processing',
      ok: j.status === 'done',
      title:
        j.status === 'done'
          ? `« ${j.courseNom ?? j.fileName} » est prêt`
          : `Import de « ${j.fileName} » échoué`,
      target: j.status === 'done' && j.courseId ? { screen: 'CourseDetail', params: { courseId: j.courseId } } : undefined,
    })),
    ...cases.map((j) => ({
      key: `case:${j.caseId}`,
      pending: j.status === 'generating',
      ok: j.status === 'ready',
      title: j.status === 'ready' ? `Cas clinique prêt : ${j.title ?? j.label}` : `Cas clinique non créé (${j.label})`,
      target: j.status === 'ready' ? { screen: 'ClinicalCase', params: { caseId: j.caseId } } : undefined,
    })),
  ];
}

/** Travaux vus en cours et désormais terminés. Met à jour `wasPending`. */
export function newlyFinished(wasPending: Set<string>, jobs: BannerJob[]): BannerJob[] {
  const finished = jobs.filter((j) => !j.pending && wasPending.has(j.key));
  wasPending.clear();
  jobs.filter((j) => j.pending).forEach((j) => wasPending.add(j.key));
  return finished;
}
