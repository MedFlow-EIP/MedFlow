import 'package:flutter_test/flutter_test.dart';
import 'package:medflow/utils/background_jobs.dart';

ImportJob _import(String id, ImportStatus status, {String? courseId, String? courseNom}) =>
    ImportJob(jobId: id, fileName: 'cardio.pdf', status: status, courseId: courseId, courseNom: courseNom);

void main() {
  group('bandeau « c’est prêt »', () {
    test('annonce un cours terminé pendant qu’on navigue', () {
      final seen = <String>{};
      expect(newlyFinished(seen, bannerJobs([_import('j1', ImportStatus.processing)], [])), isEmpty);

      final done = newlyFinished(
        seen,
        bannerJobs([_import('j1', ImportStatus.done, courseId: 'c1', courseNom: 'Cardio')], []),
      );
      expect(done, hasLength(1));
      expect(done[0].ok, isTrue);
      expect(done[0].title, '« Cardio » est prêt');
      expect(done[0].target?.screen, 'CourseDetail');
      expect(done[0].target?.params, {'courseId': 'c1'});
      // Annoncé une seule fois.
      expect(newlyFinished(seen, bannerJobs([_import('j1', ImportStatus.done, courseId: 'c1')], [])), isEmpty);
    });

    test('annonce un cas clinique prêt ou raté', () {
      final seen = <String>{};
      newlyFinished(seen, bannerJobs([], const [
        CaseJob(caseId: 1, label: 'Cardio', status: CaseStatus.generating),
        CaseJob(caseId: 2, label: 'Neuro', status: CaseStatus.generating),
      ]));
      final done = newlyFinished(seen, bannerJobs([], const [
        CaseJob(caseId: 1, label: 'Cardio', status: CaseStatus.ready, title: 'Douleur thoracique'),
        CaseJob(caseId: 2, label: 'Neuro', status: CaseStatus.error),
      ]));
      expect(done.map((d) => [d.ok, d.title]).toList(), [
        [true, 'Cas clinique prêt : Douleur thoracique'],
        [false, 'Cas clinique non créé (Neuro)'],
      ]);
      expect(done[0].target?.screen, 'ClinicalCase');
      expect(done[0].target?.params, {'caseId': 1});
      expect(done[1].target, isNull);
    });

    test('ne réannonce pas un travail déjà terminé à l’ouverture', () {
      final seen = <String>{};
      expect(
        newlyFinished(seen, bannerJobs([], const [CaseJob(caseId: 3, label: 'X', status: CaseStatus.ready)])),
        isEmpty,
      );
    });
  });
}
