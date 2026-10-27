import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { auth } from '../firebaseConfig';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from './authHeaders';
import { errorMessage, fetchWithTimeout, readJsonOrThrow, UserFacingError } from './network';

// Dictée vocale du chat (F45) : enregistrement court, retranscrit par le
// serveur (Gemini), puis placé dans le champ de saisie pour relecture.

export const MAX_DICTATION_SECONDS = 120;

// Formats lus par Gemini : AAC (ADTS) sur Android, WAV 16 kHz mono sur iOS.
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.aac',
    outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

const MIME_TYPE = Platform.OS === 'ios' ? 'audio/wav' : 'audio/aac';

export type DictationState = 'idle' | 'recording' | 'transcribing';

/**
 * ``onText`` reçoit le texte retranscrit ; ``onError`` un message à afficher.
 */
export function useVoiceDictation(onText: (text: string) => void, onError: (message: string) => void) {
  const [state, setState] = useState<DictationState>('idle');
  const [seconds, setSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const release = async (): Promise<string | null> => {
    clearTimer();
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return null;
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // Déjà arrêté.
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    return recording.getURI();
  };

  // Écran quitté pendant l'enregistrement : on libère le micro.
  useEffect(() => () => {
    release();
  }, []);

  const start = async () => {
    if (state !== 'idle') return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        onError('Autorise le micro dans les réglages du téléphone pour dicter ta question.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = recording;
      setSeconds(0);
      setState('recording');
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(elapsed);
        // Limite du serveur (2 min) : on s'arrête et on retranscrit.
        if (elapsed >= MAX_DICTATION_SECONDS) stop();
      }, 500);
    } catch {
      await release();
      setState('idle');
      onError('Micro indisponible. Réessaie.');
    }
  };

  const cancel = async () => {
    const uri = await release();
    if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    setState('idle');
  };

  const stop = async () => {
    const uri = await release();
    if (!uri) {
      setState('idle');
      return;
    }
    setState('transcribing');
    try {
      const user = auth.currentUser;
      if (!user) throw new UserFacingError('Reconnecte-toi pour dicter.');
      const audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await fetchWithTimeout(`${API_URL}/chat/transcribe`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio, mime_type: MIME_TYPE }),
      }, 60_000);
      const data = await readJsonOrThrow<{ text: string }>(res, 'Dictée impossible. Réessaie.');
      onText(data.text);
    } catch (err) {
      onError(errorMessage(err, 'Dictée impossible. Réessaie.'));
    } finally {
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      setState('idle');
    }
  };

  return { state, seconds, start, stop, cancel };
}
