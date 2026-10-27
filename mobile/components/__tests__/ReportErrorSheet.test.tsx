import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ReportErrorSheet } from '../ReportErrorSheet';

jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../theme/colors').lightColors, isDark: false }),
}));
jest.mock('../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'u1' } } }));
jest.mock('../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));

const json = (body: any, ok = true, status = 200) => ({ ok, status, json: async () => body }) as any;
const target = { kind: 'quiz' as const, courseId: 'cardio', excerpt: 'B2 : ouverture des sigmoïdes' };

describe('ReportErrorSheet', () => {
  it('envoie le signalement avec le commentaire puis remercie', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ success: true }, true, 201));
    render(<ReportErrorSheet target={target} onClose={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('Ce qui est faux, facultatif'), 'C’est la fermeture');
    fireEvent.press(screen.getByText('Envoyer le signalement'));

    await waitFor(() => expect(screen.getByText('Merci, c’est noté')).toBeTruthy());
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/api\/reports$/);
    expect(JSON.parse(init.body)).toEqual({
      kind: 'quiz',
      excerpt: 'B2 : ouverture des sigmoïdes',
      comment: 'C’est la fermeture',
      course_id: 'cardio',
    });
  });

  it('affiche l’erreur du serveur sans fermer', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ error: 'Trop de signalements d’un coup.' }, false, 429));
    render(<ReportErrorSheet target={target} onClose={jest.fn()} />);
    fireEvent.press(screen.getByText('Envoyer le signalement'));
    await waitFor(() => expect(screen.getByText('Trop de signalements d’un coup.')).toBeTruthy());
  });
});
