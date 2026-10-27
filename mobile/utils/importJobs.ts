import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from './authHeaders';
import { fetchWithTimeout, httpErrorMessage, UserFacingError } from './network';
import { isPushActive } from './pushNotifications';

// Imports de cours en arrière-plan : le serveur génère le cours pendant que
// l'utilisateur navigue ailleurs ; l'app suit l'avancement et prévient
// (notification) quand le cours est prêt. Les imports en cours sont gardés
// sur le téléphone : le suivi reprend si l'app est relancée.

export type ImportJob = {
  jobId: string;
  fileName: string;
  status: 'processing' | 'done' | 'error';
  courseId?: string;
  courseNom?: string;
  error?: string;
};

export type DuplicateInfo = { courseId: string; courseName: string };

const POLL_MS = 4000;
const storageKey = (uid: string) => `@import_jobs:${uid}`;

let jobs: ImportJob[] = [];
const listeners = new Set<(jobs: ImportJob[]) => void>();
const polling = new Set<string>();

function publish(next: ImportJob[]) {
  jobs = next;
  listeners.forEach((l) => l(jobs));
}

function upsert(job: ImportJob) {
  publish([...jobs.filter((j) => j.jobId !== job.jobId), job]);
}

/** Imports suivis (en cours et terminés depuis l'ouverture de l'app). */
export function useImportJobs(): ImportJob[] {
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
  const pending = jobs.filter((j) => j.status === 'processing').map(({ jobId, fileName }) => ({ jobId, fileName }));
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify(pending)).catch(() => {});
}

async function notify(job: ImportJob) {
  // App ouverte : le bandeau dans l'app suffit (JobDoneBanner).
  // Avec les push actives, le serveur envoie déjà la notification.
  if (AppState.currentState === 'active' || isPushActive()) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content:
        job.status === 'done'
          ? {
              title: '✅ Cours prêt',
              body: `« ${job.courseNom ?? job.fileName} » est prêt à réviser.`,
              data: { courseId: job.courseId },
            }
          : {
              title: 'Import échoué',
              body: `${job.fileName} : ${job.error ?? 'la génération a échoué.'}`,
            },
      trigger: null,
    });
  } catch {
    // La notification est un bonus : l'état reste visible dans l'app.
  }
}

function poll(user: User, jobId: string) {
  if (polling.has(jobId)) return;
  polling.add(jobId);

  const tick = async () => {
    try {
      const res = await fetch(`${API_URL}/api/process/jobs/${jobId}`, { headers: await getAuthHeaders(user) });
      if (res.status === 404) {
        // Import inconnu (compte supprimé, base réinitialisée…) : on arrête de le suivre.
        publish(jobs.filter((j) => j.jobId !== jobId));
        polling.delete(jobId);
        await persist(user.uid);
        return;
      }
      const data = await res.json();
      if (data.status && data.status !== 'processing') {
        const current = jobs.find((j) => j.jobId === jobId);
        const done: ImportJob = {
          jobId,
          fileName: data.file_name ?? current?.fileName ?? 'Cours',
          status: data.status,
          courseId: data.course_id ?? undefined,
          courseNom: data.course_nom ?? undefined,
          error: data.error ?? undefined,
        };
        upsert(done);
        polling.delete(jobId);
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

/**
 * Lance la génération en arrière-plan. Renvoie le job créé, ou les infos du
 * cours déjà importé (même document). Lève une UserFacingError sinon.
 */
export async function startBackgroundImport(
  user: User,
  formData: FormData,
  fileName: string
): Promise<{ job: ImportJob } | { duplicate: DuplicateInfo }> {
  formData.append('background', '1');
  const res = await fetchWithTimeout(
    `${API_URL}/api/process`,
    { method: 'POST', headers: await getAuthHeaders(user), body: formData },
    // Envoi du fichier (et lecture du texte) seulement : la génération suit en arrière-plan.
    120_000
  );
  const body = await res.json().catch(() => null);
  if (res.status === 409 && body?.code === 'duplicate') {
    return { duplicate: { courseId: body.course_id, courseName: body.nom } };
  }
  if (res.status !== 202 || !body?.job_id) {
    throw new UserFacingError(httpErrorMessage(res.status, body, 'Import impossible. Réessaie.'), res.status);
  }

  // Pour prévenir quand le cours sera prêt (demandé une fois, au premier import).
  Notifications.requestPermissionsAsync().catch(() => {});

  const job: ImportJob = { jobId: body.job_id, fileName, status: 'processing' };
  upsert(job);
  await persist(user.uid);
  poll(user, job.jobId);
  return { job };
}

/** À l'ouverture de l'app : reprend le suivi des imports encore en cours. */
export async function resumeImportJobs(user: User): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(user.uid));
    const pending: { jobId: string; fileName: string }[] = raw ? JSON.parse(raw) : [];
    for (const p of pending) {
      if (!jobs.some((j) => j.jobId === p.jobId)) upsert({ ...p, status: 'processing' });
      poll(user, p.jobId);
    }
  } catch {
    // ignoré
  }
}

/** Retire un import terminé de la liste (déjà consulté). */
export function dismissImportJob(jobId: string) {
  publish(jobs.filter((j) => j.jobId !== jobId));
}

/** Déconnexion : on oublie les imports suivis en mémoire. */
export function resetImportJobs() {
  publish([]);
}
