# MedFlow Carte des frictions

À remplir au fur et à mesure des 5 sessions d'observation et des retours du beta test. Une friction confirmée par **au moins 2 des 3 sources** (observation / données / beta test) devient prioritaire.

## Sources disponibles

- **Observation** : notes prises pendant les 5 sessions de mesure de départ (`protocole-mesure-usabilite.md`)
- **Données** : requêtes sur `activity_log`/`analytics_events` (voir requêtes prêtes à l'emploi plus bas)
- **Beta test** : verbatims collectés par Grégoire/Axel (objectif 1)

## Carte des frictions

| # | Friction observée | Tâche concernée | Vue en observation ? | Vue dans les données ? | Mentionnée en beta test ? | Nb sources | Effet chiffré (temps perdu / taux d'échec / abandon) |
|---|---|---|---|---|---|---|---|
| 1 | | | ☐ | ☐ | ☐ | | |
| 2 | | | ☐ | ☐ | ☐ | | |
| 3 | | | ☐ | ☐ | ☐ | | |
| 4 | | | ☐ | ☐ | ☐ | | |
| 5 | | | ☐ | ☐ | ☐ | | |

*(dupliquer la ligne autant que nécessaire)*

## Tri quick win vs refonte

| # (voir tableau ci-dessus) | Effort estimé | Quick win ou Refonte ? | Objectif chiffré si refonte |
|---|---|---|---|
| | quelques heures / plusieurs jours | | |

## Ce qu'on laisse de côté (et pourquoi)

| Friction | Pourquoi on ne la traite pas ce trimestre |
|---|---|
| | |

---

## Requêtes SQL prêtes à l'emploi (sur la base backend)

**Taux d'abandon par leçon** (commencées vs terminées) :
```sql
SELECT
  s.lesson_id,
  COUNT(DISTINCT s.uid) AS commencees,
  COUNT(DISTINCT c.uid) AS terminees,
  ROUND(100.0 * (COUNT(DISTINCT s.uid) - COUNT(DISTINCT c.uid)) / COUNT(DISTINCT s.uid), 1) AS taux_abandon_pct
FROM analytics_events s
LEFT JOIN analytics_events c
  ON c.uid = s.uid AND c.lesson_id = s.lesson_id AND c.event_type = 'lesson_completed'
WHERE s.event_type = 'lesson_started'
GROUP BY s.lesson_id
ORDER BY taux_abandon_pct DESC;
```

**Écrans vus sans action derrière** (arrivée sur l'écran, jamais revenu avec un événement associé dans l'heure qui suit) :
```sql
SELECT screen, COUNT(*) AS nb_vues
FROM analytics_events
WHERE event_type = 'screen_view'
GROUP BY screen
ORDER BY nb_vues DESC;
```
*(à croiser manuellement avec le nombre de cours effectivement importés / messages IA envoyés sur la même période, pour estimer combien de vues n'ont débouché sur rien)*

**Activité récente d'un utilisateur donné** (utile pour comprendre le parcours d'une personne précise après un entretien) :
```sql
SELECT type, title, detail, created_at FROM activity_log WHERE uid = '<uid>' ORDER BY created_at DESC;
SELECT event_type, path_id, lesson_id, screen, created_at FROM analytics_events WHERE uid = '<uid>' ORDER BY created_at DESC;
```