import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SettingsScreen } from '../SettingsScreen';
import * as revisionNotifications from '../../../utils/revisionNotifications';
import * as streakNotifications from '../../../utils/streakNotifications';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({
    colors: require('../../../theme/colors').lightColors,
    isDark: false,
    preference: 'system',
    setPreference: jest.fn(),
  }),
}));

jest.mock('../../../firebaseConfig', () => ({
  auth: { currentUser: { uid: 'test-uid', email: 'test@example.com', displayName: 'Test User', photoURL: null } },
}));

jest.mock('firebase/auth', () => ({
  updateProfile: jest.fn().mockResolvedValue(undefined),
  updatePassword: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('../../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer fake-token' }),
}));

jest.mock('../../../utils/firstTime', () => ({
  resetTutorial: jest.fn(),
}));

jest.mock('../../../context/TutorialContext', () => ({
  useTutorial: () => ({ visible: false, show: jest.fn(), hide: jest.fn() }),
}));

jest.mock('../../../navigationRef', () => ({
  navigationRef: {},
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../../../utils/streakNotifications', () => ({
  isStreakReminderEnabled: jest.fn().mockResolvedValue(false),
  enableStreakReminders: jest.fn(),
  disableStreakReminders: jest.fn(),
  sendTestNotification: jest.fn(),
}));

jest.mock('../../../utils/revisionNotifications', () => ({
  isRevisionReminderEnabled: jest.fn().mockResolvedValue(false),
  enableRevisionReminders: jest.fn(),
  disableRevisionReminders: jest.fn(),
  sendTestRevisionNotification: jest.fn(),
  getRevisionReminderHour: jest.fn().mockResolvedValue(9),
  setRevisionReminderHour: jest.fn().mockResolvedValue(undefined),
  scheduleRevisionReminder: jest.fn().mockResolvedValue(undefined),
}));

function mockJsonResponse(body: any, ok = true) {
  return { ok, json: async () => body } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  (revisionNotifications.isRevisionReminderEnabled as jest.Mock).mockResolvedValue(false);
  (revisionNotifications.getRevisionReminderHour as jest.Mock).mockResolvedValue(9);
  (streakNotifications.isStreakReminderEnabled as jest.Mock).mockResolvedValue(false);
  global.fetch = jest.fn().mockResolvedValue(mockJsonResponse({ forecast: [{ date: '2026-08-14', count: 3 }] }));
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SettingsScreen — bouton de test des notifications de révision', () => {
  it('affiche le sous-titre avec l\'heure actuelle du rappel', async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Un rappel à 9h avec le nombre de cartes à réviser')).toBeTruthy();
    });
  });

  it('appelle sendTestRevisionNotification au clic sur le bouton de test', async () => {
    (revisionNotifications.sendTestRevisionNotification as jest.Mock).mockResolvedValue(true);

    render(<SettingsScreen />);
    await waitFor(() => expect(screen.getByText('Tester une notification de révision (5s)')).toBeTruthy());

    fireEvent.press(screen.getByText('Tester une notification de révision (5s)'));

    await waitFor(() => {
      expect(revisionNotifications.sendTestRevisionNotification).toHaveBeenCalledTimes(1);
    });
  });

  it('affiche une alerte de succès si la notification de test part bien', async () => {
    (revisionNotifications.sendTestRevisionNotification as jest.Mock).mockResolvedValue(true);

    render(<SettingsScreen />);
    await waitFor(() => expect(screen.getByText('Tester une notification de révision (5s)')).toBeTruthy());
    fireEvent.press(screen.getByText('Tester une notification de révision (5s)'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "C'est parti",
        expect.stringContaining('révision')
      );
    });
  });

  it('affiche une alerte de permission refusee si le test echoue', async () => {
    (revisionNotifications.sendTestRevisionNotification as jest.Mock).mockResolvedValue(false);

    render(<SettingsScreen />);
    await waitFor(() => expect(screen.getByText('Tester une notification de révision (5s)')).toBeTruthy());
    fireEvent.press(screen.getByText('Tester une notification de révision (5s)'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Permission refusée',
        expect.any(String)
      );
    });
  });
});

describe('SettingsScreen — selecteur d\'heure du rappel', () => {
  it('ne montre pas les creneaux d\'heure quand les rappels sont desactives', async () => {
    (revisionNotifications.isRevisionReminderEnabled as jest.Mock).mockResolvedValue(false);

    render(<SettingsScreen />);
    await waitFor(() => expect(screen.getByText('Rappels de révision')).toBeTruthy());

    expect(screen.queryByText('7h')).toBeNull();
  });

  it('montre les 5 creneaux quand les rappels sont actives', async () => {
    (revisionNotifications.isRevisionReminderEnabled as jest.Mock).mockResolvedValue(true);

    render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('7h')).toBeTruthy();
    });
    expect(screen.getByText('9h')).toBeTruthy();
    expect(screen.getByText('12h')).toBeTruthy();
    expect(screen.getByText('18h')).toBeTruthy();
    expect(screen.getByText('21h')).toBeTruthy();
  });

  it('appelle setRevisionReminderHour avec la bonne heure au clic sur un creneau', async () => {
    (revisionNotifications.isRevisionReminderEnabled as jest.Mock).mockResolvedValue(true);

    render(<SettingsScreen />);
    await waitFor(() => expect(screen.getByText('18h')).toBeTruthy());

    fireEvent.press(screen.getByText('18h'));

    await waitFor(() => {
      expect(revisionNotifications.setRevisionReminderHour).toHaveBeenCalledWith(18);
    });
  });

  it('met a jour le sous-titre apres avoir choisi une nouvelle heure', async () => {
    (revisionNotifications.isRevisionReminderEnabled as jest.Mock).mockResolvedValue(true);

    render(<SettingsScreen />);
    await waitFor(() => expect(screen.getByText('21h')).toBeTruthy());

    fireEvent.press(screen.getByText('21h'));

    await waitFor(() => {
      expect(screen.getByText('Un rappel à 21h avec le nombre de cartes à réviser')).toBeTruthy();
    });
  });

  it('replanifie le rappel avec le nombre de cartes dues apres un changement d\'heure', async () => {
    (revisionNotifications.isRevisionReminderEnabled as jest.Mock).mockResolvedValue(true);

    render(<SettingsScreen />);
    await waitFor(() => expect(screen.getByText('12h')).toBeTruthy());

    fireEvent.press(screen.getByText('12h'));

    await waitFor(() => {
      expect(revisionNotifications.scheduleRevisionReminder).toHaveBeenCalledWith(3);
    });
  });
});