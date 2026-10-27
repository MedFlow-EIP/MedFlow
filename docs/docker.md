# Docker

## Services (`docker-compose.yml`)

| Service | Rôle | Ports |
|---------|------|-------|
| `backend` | API Flask, toujours en `FLASK_ENV=production` | `127.0.0.1:8080` (VM uniquement) |
| `caddy` | HTTPS devant le backend, certificat Let’s Encrypt automatique | `80`, `443` |

- Domaine : `MEDFLOW_DOMAIN` (par défaut `5-196-191-64.sslip.io`, nom gratuit qui pointe vers l’IP de la VM).
- Volumes : `backend/uploads` et `backend/data` (données), `caddy_data` et `caddy_config` (certificats).
- Le backend lit ses secrets dans `backend/.env` (jamais commité).

## Commandes utiles (sur la VM, dans `~/MedFlow`)

```bash
bash deploy.sh main                        # déploiement complet
docker compose ps                          # état des conteneurs
docker compose logs backend --tail=50
docker compose logs caddy --tail=50        # certificat : "certificate obtained successfully"
curl https://5-196-191-64.sslip.io/health  # depuis n'importe où
curl http://localhost:8080/health          # depuis la VM
```

## Prérequis réseau

Ports 80 et 443 ouverts vers la VM (pare-feu de la VM et de l’hébergeur) : Let’s Encrypt valide le domaine sur le port 80.
