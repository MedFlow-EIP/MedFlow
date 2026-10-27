import * as Notifications from 'expo-notifications';
import { countdownLabel, reminderDate, syncExamReminders } from '../examReminders';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const N = Notifications as jest.Mocked<typeof Notifications>;

const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => {
  jest.clearAllMocks();
  N.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
});

describe('reminderDate', () => {
  it('place le rappel à 9h, N jours avant, en heure locale', () => {
    const d = reminderDate('2026-11-10', 7);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 3, 9]);
  });
});

describe('syncExamReminders', () => {
  it('planifie J-7 et la veille pour un examen lointain', async () => {
    await syncExamReminders([{ id: 4, title: 'Partiel', exam_date: inDays(20) }]);
    const ids = N.scheduleNotificationAsync.mock.calls.map((c) => c[0].identifier);
    expect(ids.sort()).toEqual(['exam-4-1', 'exam-4-7']);
  });

  it('ne planifie pas un rappel déjà passé', async () => {
    await syncExamReminders([{ id: 4, title: 'Partiel', exam_date: inDays(3) }]);
    const ids = N.scheduleNotificationAsync.mock.calls.map((c) => c[0].identifier);
    expect(ids).toEqual(['exam-4-1']);
  });

  it('annule les rappels des examens supprimés et ne replanifie pas les existants', async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'exam-9-7' },
      { identifier: 'exam-4-7' },
      { identifier: 'autre-rappel' },
    ] as any);
    await syncExamReminders([{ id: 4, title: 'Partiel', exam_date: inDays(20) }]);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith('exam-9-7');
    expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('autre-rappel');
    const ids = N.scheduleNotificationAsync.mock.calls.map((c) => c[0].identifier);
    expect(ids).toEqual(['exam-4-1']);
  });

  it('ne fait rien sans permission', async () => {
    N.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
    await syncExamReminders([{ id: 4, title: 'Partiel', exam_date: inDays(20) }]);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('countdownLabel', () => {
  it.each([
    [-2, 'Passé'],
    [0, "Aujourd'hui"],
    [1, 'Demain'],
    [12, 'J-12'],
  ])('%i jours → %s', (days, label) => {
    expect(countdownLabel(days)).toBe(label);
  });
});
