import type { User } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from './authHeaders';
import { courseCacheName, readOffline, saveOffline } from './offlineCache';

// Révision hors ligne (F74) : la dernière liste de cartes dues est gardée sur
// le téléphone, les réponses sont corrigées avec la copie locale du cours,
// puis envoyées au serveur au retour du réseau (file d'attente).

export type RevisionItem = {
  course_id: string;
  course_nom: string;
  item_index: number;
  question: string;
  options: Record<string, string>;
};

type QueuedRequest = {
  path: '/api/revision/answer' | '/api/session-done';
  body: Record<string, unknown>;
  queuedAt: number;
};

const QUEUE_NAME = 'revision-queue';
// Au-delà, on garde les plus récentes : une file infinie remplirait le stockage.
const MAX_QUEUE = 500;

export const dueCacheName = (courseId?: string) => `revision-due:${courseId || 'all'}`;

export async function saveDueItems(uid: string, courseId: string | undefined, items: RevisionItem[]) {
  await saveOffline(uid, dueCacheName(courseId), items);
}

/**
 * Cartes à réviser sans réseau : la dernière liste de cartes dues connue,
 * sinon toutes les questions des cours gardés sur le téléphone.
 */
export async function readOfflineItems(uid: string, courseId?: string): Promise<RevisionItem[]> {
  const cached = await readOffline<RevisionItem[]>(uid, dueCacheName(courseId));
  if (cached && cached.length > 0) return cached;
  if (!courseId) return [];
  const course = await readOffline<any>(uid, courseCacheName(courseId));
  if (!course || !Array.isArray(course.quiz)) return [];
  return course.quiz.map((q: any, index: number) => ({
    course_id: courseId,
    course_nom: course.nom || '',
    item_index: index,
    question: q.question,
    options: q.options || {},
  }));
}

/** Correction locale à partir de la copie du cours (null si le cours n'est pas sur le téléphone). */
export async function gradeOffline(
  uid: string,
  courseId: string,
  itemIndex: number,
  selectedOption: string
): Promise<{ correct: boolean; correct_answer: string; explanation?: string | null } | null> {
  const course = await readOffline<any>(uid, courseCacheName(courseId));
  const question = course?.quiz?.[itemIndex];
  if (!question?.correct) return null;
  return {
    correct: question.correct === selectedOption,
    correct_answer: question.correct,
    explanation: question.explanation ?? null,
  };
}

async function readQueue(uid: string): Promise<QueuedRequest[]> {
  return (await readOffline<QueuedRequest[]>(uid, QUEUE_NAME)) ?? [];
}

async function enqueue(uid: string, request: Omit<QueuedRequest, 'queuedAt'>) {
  const queue = await readQueue(uid);
  queue.push({ ...request, queuedAt: Date.now() });
  await saveOffline(uid, QUEUE_NAME, queue.slice(-MAX_QUEUE));
}

export const queueAnswer = (uid: string, body: { course_id: string; item_index: number; selected_option: string }) =>
  enqueue(uid, { path: '/api/revision/answer', body });

export const queueSessionDone = (uid: string, body: Record<string, unknown>) =>
  enqueue(uid, { path: '/api/session-done', body });

export async function pendingCount(uid: string): Promise<number> {
  return (await readQueue(uid)).length;
}

let flushing: Promise<number> | null = null;

/**
 * Envoie les réponses en attente, dans l'ordre. S'arrête à la première coupure
 * réseau (on réessaiera plus tard) ; une requête refusée par le serveur (cours
 * supprimé entre-temps…) est abandonnée. Renvoie le nombre de requêtes envoyées.
 */
export function flushRevisionQueue(user: User): Promise<number> {
  if (!flushing) {
    flushing = doFlush(user).finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function doFlush(user: User): Promise<number> {
  const queue = await readQueue(user.uid);
  if (queue.length === 0) return 0;

  let done = 0;
  try {
    const headers = { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' };
    for (const request of queue) {
      const res = await fetch(`${API_URL}${request.path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request.body),
      });
      if (res.status >= 500) break; // serveur en difficulté : on réessaiera
      done += 1;
    }
  } catch {
    // Toujours hors ligne : on garde le reste pour la prochaine fois.
  }

  // Relit la file : des réponses ont pu s'ajouter pendant l'envoi.
  const latest = await readQueue(user.uid);
  await saveOffline(user.uid, QUEUE_NAME, latest.slice(done));
  return done;
}
