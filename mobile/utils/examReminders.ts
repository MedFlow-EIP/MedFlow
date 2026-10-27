import * as Notifications from 'expo-notifications';
import { requestNotificationPermission } from './revisionNotifications';

export type ExamSummary = { id: number; title: string; exam_date: string };

// Rappels locaux avant chaque examen : J-7 et la veille, à 9h.
const REMINDER_DAYS = [7, 1];
const REMINDER_HOUR = 9;
const PREFIX = 'exam-';

/** « Aujourd'hui », « Demain », « J-12 », « Passé » */
export function countdownLabel(daysLeft: number): string {
  if (daysLeft < 0) return 'Passé';
  if (daysLeft === 0) return "Aujourd'hui";
  if (daysLeft === 1) return 'Demain';
  return `J-${daysLeft}`;
}

const identifier = (examId: number, daysBefore: number) => `${PREFIX}${examId}-${daysBefore}`;

/** « 2026-11-03 » → date locale à l'heure du rappel, ``daysBefore`` jours avant. */
export function reminderDate(examDate: string, daysBefore: number): Date {
  const [y, m, d] = examDate.split('-').map(Number);
  return new Date(y, m - 1, d - daysBefore, REMINDER_HOUR, 0, 0, 0);
}

function reminderBody(title: string, daysBefore: number): string {
  return daysBefore === 1
    ? `${title} demain. Une dernière révision des cartes prioritaires ?`
    : `${title} dans ${daysBefore} jours. Tes cartes de ce cours passent en priorité.`;
}

/**
 * Aligne les notifications planifiées sur la liste d'examens : annule celles
 * d'examens supprimés, planifie celles qui manquent. Sans permission, ne fait rien.
 */
export async function syncExamReminders(exams: ExamSummary[], askPermission = false): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      if (!askPermission || !(await requestNotificationPermission())) return;
    }

    const now = Date.now();
    const wanted = new Map<string, { title: string; body: string; at: Date }>();
    for (const exam of exams) {
      for (const days of REMINDER_DAYS) {
        const at = reminderDate(exam.exam_date, days);
        if (at.getTime() > now + 60_000) {
          wanted.set(identifier(exam.id, days), {
            title: days === 1 ? '📅 Examen demain' : '📅 Examen dans une semaine',
            body: reminderBody(exam.title, days),
            at,
          });
        }
      }
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = new Set<string>();
    for (const n of scheduled) {
      if (!n.identifier.startsWith(PREFIX)) continue;
      if (wanted.has(n.identifier)) existing.add(n.identifier);
      else await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }

    for (const [id, r] of wanted) {
      if (existing.has(id)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: { title: r.title, body: r.body },
        trigger: { seconds: Math.round((r.at.getTime() - Date.now()) / 1000) },
      });
    }
  } catch (err) {
    // Best-effort : un rappel manqué ne doit jamais bloquer l'écran.
    console.warn('Rappels d’examen non planifiés', err);
  }
}
