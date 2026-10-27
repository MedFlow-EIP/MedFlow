FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

# Serveur de production (le serveur intégré de Flask n'est fait que pour le
# développement). Un seul processus, plusieurs threads : les imports en
# arrière-plan et les caches en mémoire restent dans le même processus.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "--timeout", "200", "--access-logfile", "-", "app:create_app()"]
