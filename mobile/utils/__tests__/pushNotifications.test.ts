import { notificationTarget } from '../pushNotifications';

jest.mock('expo-notifications', () => ({}));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'p' } } } }));
jest.mock('../authHeaders', () => ({ getAuthHeaders: jest.fn() }));

describe('notificationTarget', () => {
  it.each([
    [{ screen: 'CourseDetail', courseId: 'c1' }, { screen: 'CourseDetail', params: { courseId: 'c1' } }],
    [{ courseId: 'c2' }, { screen: 'CourseDetail', params: { courseId: 'c2' } }],
    [{ screen: 'Challenge', challengeId: 4 }, { screen: 'Challenge', params: { challengeId: 4 } }],
    [{ screen: 'Friends' }, { screen: 'Friends' }],
    [{ screen: 'Inconnu' }, null],
    [undefined, null],
  ])('%j', (data, target) => {
    expect(notificationTarget(data)).toEqual(target);
  });
});

it('ouvre un cas clinique prêt', () => {
  expect(notificationTarget({ screen: 'ClinicalCase', caseId: 3 })).toEqual({ screen: 'ClinicalCase', params: { caseId: 3 } });
});
