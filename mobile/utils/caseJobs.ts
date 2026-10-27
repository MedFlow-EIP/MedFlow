import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from './authHeaders';
import { fetchWithTimeout, httpErrorMessage, UserFacingError } from './network';
import { isPushActive } from './pushNotifications';

// Cas cliniques préparés en arrière-plan : le serveur génère le cas pendant
// que l'utilisateur continue dans l'app ; on suit l'avancement et on prévient
// (notification) quand il est prêt. Même principe que les imports de cours.

export type CaseJob = { caseId: number; label: string; status: 'generating' | 'ready' | 'error'; title?: string };

const POLL_MS = 4000;
const storageKey = (uid: string) => `@case_jobs:${uid}`;

let jobs: CaseJob[] = [];
const listeners = new Set<(jobs: CaseJob[]) => void>();
const polling = new Set<number>();

function publish(next: CaseJob[]) {
  jobs = next;
  listeners.forEach((l) => l(jobs));
}

function upsert(job: CaseJob) {
  publish([...jobs.filter((j) => j.caseId !== job.caseId), job]);
}

/** Cas suivis (en préparation et terminés depuis l'ouverture de l'app). */
export function useCaseJobs(): CaseJob[] {
  const [list, setList] = useState(jobs);
  useEffect(() => {
    listeners.add(setList);
    setList(jobs);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}

async function persist(uid: string) {
  const pending = jobs.filter((j) => j.status === 'generating').map(({ caseId, label }) => ({ caseId, label }));
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify(pending)).catch(() => {});
}

async function notify(job: CaseJob) {
  // Avec les push actives, le serveur envoie déjà la notification.
  if (isPushActive()) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content:
        job.status === 'ready'
          ? { title: '🩺 Cas clinique prêt', body: job.title ?? job.label, data: { screen: 'ClinicalCase', caseId: job.caseId } }
          : { title: 'Cas clinique non créé', body: `${job.label} : réessaie dans un instant.` },
      trigger: null,
    });
  } catch {
    // La notification est un bonus : l'état reste visible dans l'app.
  }
}

function poll(user: User, caseId: number) {
  if (polling.has(caseId)) return;
  polling.add(caseId);

  const tick = async () => {
    try {
      const res = await fetch(`${API_URL}/api/cases/${caseId}`, { headers: await getAuthHeaders(user) });
      if (res.status === 404) {
        publish(jobs.filter((j) => j.caseId !== caseId));
        polling.delete(caseId);
        await persist(user.uid);
        return;
      }
      const data = await res.json();
      if (data.status && data.status !== 'generating') {
        const current = jobs.find((j) => j.caseId === caseId);
        const done: CaseJob = { caseId, label: current?.label ?? data.source_label, status: data.status, title: data.title };
        upsert(done);
        polling.delete(caseId);
        await persist(user.uid);
        await notify(done);
        return;
      }
    } catch {
      // Réseau coupé : on réessaie au prochain tour.
    }
    setTimeout(tick, POLL_MS);
  };
  setTimeout(tick, POLL_MS);
}

/** Lance la préparation d'un cas (cours ou sujet). Renvoie l'identifiant du cas. */
export async function startBackgroundCase(
  user: User,
  request: { course_id?: string; topic?: string; difficulty: string },
  label: string
): Promise<number> {
  const res = await fetchWithTimeout(`${API_URL}/api/cases`, {
    method: 'POST',
    headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, background: true }),
  });
  const body = await res.json().catch(() => null);
  if (res.status !== 202 || typeof body?.id !== 'number') {
    throw new UserFacingError(httpErrorMessage(res.status, body, 'Le cas n’a pas pu être lancé.'), res.status);
  }
  // Pour prévenir quand le cas sera prêt.
  Notifications.requestPermissionsAsync().catch(() => {});
  upsert({ caseId: body.id, label, status: 'generating' });
  await persist(user.uid);
  poll(user, body.id);
  return body.id;
}

/** À l'ouverture de l'app : reprend le suivi des cas encore en préparation. */
export async function resumeCaseJobs(user: User): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(user.uid));
    const pending: { caseId: number; label: string }[] = raw ? JSON.parse(raw) : [];
    for (const p of pending) {
      if (!jobs.some((j) => j.caseId === p.caseId)) upsert({ ...p, status: 'generating' });
      poll(user, p.caseId);
    }
  } catch {
    // ignoré
  }
}

/** Déconnexion : on oublie les cas suivis en mémoire. */
export function resetCaseJobs() {
  publish([]);
}
