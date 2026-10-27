import { activityLevel, toWeeks } from '../ActivityCalendar';

jest.mock('../../theme/ThemeContext', () => ({ useTheme: () => ({}) }));
jest.mock('../../firebaseConfig', () => ({ auth: {} }));
jest.mock('../../utils/authHeaders', () => ({ getAuthHeaders: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));

describe('ActivityCalendar', () => {
  it.each([
    [0, 0],
    [1, 1],
    [5, 2],
    [15, 3],
    [40, 4],
  ])('%i activités → niveau %i', (count, level) => {
    expect(activityLevel(count)).toBe(level);
  });

  it('aligne chaque ligne sur un jour de la semaine (lundi en haut)', () => {
    // 2026-10-28 est un mercredi : 2 cases vides (lundi, mardi) avant.
    const days = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-10-${String(28 + i).padStart(2, '0')}`.replace('-10-32', '-11-01'),
      count: i,
    }));
    const weeks = toWeeks(days);
    expect(weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(weeks[0][2]?.date).toBe('2026-10-28');
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[1][0]?.count).toBe(5);
  });
});
