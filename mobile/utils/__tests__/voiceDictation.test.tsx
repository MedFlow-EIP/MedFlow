import React from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Audio } from 'expo-av';
import { useVoiceDictation } from '../voiceDictation';

const mockRecording = {
  stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
  getURI: jest.fn().mockReturnValue('file:///rec.aac'),
};

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Recording: { createAsync: jest.fn() },
    AndroidOutputFormat: { AAC_ADTS: 6 },
    AndroidAudioEncoder: { AAC: 3 },
    IOSOutputFormat: { LINEARPCM: 'lpcm' },
    IOSAudioQuality: { MEDIUM: 64 },
  },
}));
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('QUFD'),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64' },
}));
jest.mock('../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'u1' } } }));
jest.mock('../authHeaders', () => ({ getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }) }));

const A = Audio as any;

function Harness({ onText, onError }: { onText: (t: string) => void; onError: (m: string) => void }) {
  const d = useVoiceDictation(onText, onError);
  return (
    <>
      <Text>{d.state}</Text>
      <TouchableOpacity onPress={d.start}><Text>start</Text></TouchableOpacity>
      <TouchableOpacity onPress={d.stop}><Text>stop</Text></TouchableOpacity>
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  A.requestPermissionsAsync.mockResolvedValue({ granted: true });
  A.Recording.createAsync.mockResolvedValue({ recording: mockRecording });
});

it('enregistre puis renvoie le texte retranscrit', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ text: 'Bonjour docteur' }) }) as any;
  const onText = jest.fn();
  render(<Harness onText={onText} onError={jest.fn()} />);

  fireEvent.press(screen.getByText('start'));
  await waitFor(() => expect(screen.getByText('recording')).toBeTruthy());
  fireEvent.press(screen.getByText('stop'));

  await waitFor(() => expect(onText).toHaveBeenCalledWith('Bonjour docteur'));
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  // Les tests tournent en « iOS » : WAV ; sur Android ce serait de l'AAC.
  expect(body).toEqual({ audio: 'QUFD', mime_type: Platform.OS === 'ios' ? 'audio/wav' : 'audio/aac' });
  expect(screen.getByText('idle')).toBeTruthy();
});

it('explique quoi faire si le micro est refusé', async () => {
  A.requestPermissionsAsync.mockResolvedValue({ granted: false });
  const onError = jest.fn();
  render(<Harness onText={jest.fn()} onError={onError} />);
  await act(async () => {
    fireEvent.press(screen.getByText('start'));
  });
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('Autorise le micro'));
  expect(A.Recording.createAsync).not.toHaveBeenCalled();
});

it('affiche le message du serveur si rien n’est compris', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: 'Je n’ai rien compris.' }) }) as any;
  const onError = jest.fn();
  render(<Harness onText={jest.fn()} onError={onError} />);
  fireEvent.press(screen.getByText('start'));
  await waitFor(() => expect(screen.getByText('recording')).toBeTruthy());
  fireEvent.press(screen.getByText('stop'));
  await waitFor(() => expect(onError).toHaveBeenCalledWith('Je n’ai rien compris.'));
});
