#!/usr/bin/env bash
# Lance l'émulateur Android de Windows et l'app Flutter dessus, depuis WSL.
#
#   mobile_flutter/scripts/android.sh                # émulateur + app, au comportement iOS
#   mobile_flutter/scripts/android.sh --android-look # comportement Android natif
#   mobile_flutter/scripts/android.sh --local-api    # backend local (python app.py) au lieu de la prod
#   mobile_flutter/scripts/android.sh --avd NOM      # autre émulateur (liste : emulator -list-avds)
#   mobile_flutter/scripts/android.sh --build-only   # compile l'APK de debug, sans émulateur
#
# Le build se fait côté Windows (SDK Android et Flutter Windows) : Gradle gère
# mal les chemins \\wsl. Le projet est donc recopié dans
# %LOCALAPPDATA%\MedFlow\mobile_flutter à chaque lancement (seuls les
# fichiers modifiés), puis `flutter run` démarre l'app.
#
# Configuration Firebase : env.json (voir env.example.json) et/ou le
# google-services.json de l'app Android, déposé dans mobile_flutter/android/app/.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROD_API="https://5-196-191-64.sslip.io"

ios_look=true
api_url=""
avd=""
build_only=false
while [ $# -gt 0 ]; do
  case "$1" in
    --android-look) ios_look=false ;;
    --local-api) api_url="http://10.0.2.2:8080" ;;
    --avd) avd="$2"; shift ;;
    --build-only) build_only=true ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 1 ;;
  esac
  shift
done

# cmd.exe lancé depuis un dossier WSL affiche un avertissement UNC : on part de C:.
win() { (cd /mnt/c && cmd.exe /c "$@" 2>/dev/null | tr -d '\r'); }

win_localappdata="${WIN_LOCALAPPDATA:-$(win "echo %LOCALAPPDATA%")}"
sdk_win="${ANDROID_SDK_WIN:-$win_localappdata\\Android\\Sdk}"
sdk="$(wslpath "$sdk_win")"
adb="$sdk/platform-tools/adb.exe"
emulator="$sdk/emulator/emulator.exe"
flutter_win="${FLUTTER_WIN:-$(win "where flutter.bat" | head -n 1)}"
work_win="$win_localappdata\\MedFlow\\mobile_flutter"
work="$(wslpath "$work_win")"

[ -x "$adb" ] || { echo "SDK Android introuvable : $sdk_win (variable ANDROID_SDK_WIN)" >&2; exit 1; }
[ -n "$flutter_win" ] || { echo "Flutter Windows introuvable (variable FLUTTER_WIN)" >&2; exit 1; }

device() { "$adb" devices | tr -d '\r' | awk '/^emulator-[0-9]+\tdevice$/ { print $1; exit }'; }

# ---------------------------------------------------------------- Émulateur
if ! $build_only && [ -z "$(device)" ]; then
  [ -n "$avd" ] || avd="$("$emulator" -list-avds | tr -d '\r' | head -n 1)"
  [ -n "$avd" ] || { echo "Aucun émulateur : crée-en un dans Android Studio (Device Manager)." >&2; exit 1; }
  # Image système de l'AVD : sans elle, l'émulateur s'arrête aussitôt.
  avd_dir="$(wslpath "$(win "echo %USERPROFILE%")")/.android/avd/$avd.avd"
  sysdir="$(grep -m 1 '^image.sysdir.1' "$avd_dir/config.ini" 2>/dev/null | cut -d= -f2 | tr -d ' \r' | tr '\\' '/')"
  if [ -n "$sysdir" ] && [ -z "$(ls -A "$sdk/$sysdir" 2>/dev/null)" ]; then
    echo "Image système absente pour $avd : $sysdir" >&2
    echo "Android Studio > Device Manager : télécharger l'image de cet émulateur (ou en créer un nouveau), puis relancer." >&2
    exit 1
  fi
  echo "▶ Démarrage de l'émulateur $avd…"
  # Processus Windows détaché : l'émulateur reste ouvert après le script.
  (cd /mnt/c && powershell.exe -NoProfile -Command \
    "Start-Process -FilePath '$sdk_win\emulator\emulator.exe' -ArgumentList '-avd','$avd'" >/dev/null)
  for _ in $(seq 1 120); do
    [ -n "$(device)" ] && [ "$("$adb" -s "$(device)" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    sleep 2
  done
fi
if ! $build_only; then
  dev="$(device)"
  [ -n "$dev" ] || { echo "L'émulateur n'a pas démarré (lance-le depuis Android Studio pour voir l'erreur)." >&2; exit 1; }
  echo "✓ Émulateur prêt : $dev"
fi

# ---------------------------------------------------------------- Projet côté Windows
echo "▶ Copie du projet vers $work_win…"
mkdir -p "$work"
set +e
(cd /mnt/c && robocopy.exe "$(wslpath -w "$APP_DIR")" "$work_win" /MIR /XD build .dart_tool Pods .idea .gradle \
  /XF local.properties .flutter-plugins .flutter-plugins-dependencies env.json google-services.json \
  /NFL /NDL /NJH /NJS /NP >/dev/null)
code=$?
set -e
# robocopy : 0 à 7 = réussite.
[ "$code" -lt 8 ] || { echo "Copie impossible (robocopy $code)." >&2; exit 1; }

# ---------------------------------------------------------------- Configuration
python3 - "$APP_DIR" "$work/env.android.json" "$ios_look" "$api_url" "$PROD_API" <<'PY'
import json, os, sys

app_dir, out, ios_look, api_url, prod_api = sys.argv[1:]
env = {}
path = os.path.join(app_dir, "env.json")
if os.path.exists(path):
    env = json.load(open(path))

# google-services.json de l'app Android : identifiant et clé propres à Android.
for candidate in ("android/app/google-services.json", "google-services.json"):
    gs_path = os.path.join(app_dir, candidate)
    if not os.path.exists(gs_path):
        continue
    gs = json.load(open(gs_path))
    project = gs.get("project_info", {})
    client = next(
        (c for c in gs.get("client", [])
         if c.get("client_info", {}).get("android_client_info", {}).get("package_name") == "com.wavitooo.medflowlearning"),
        (gs.get("client") or [{}])[0],
    )
    env["FIREBASE_ANDROID_APP_ID"] = client.get("client_info", {}).get("mobilesdk_app_id", "")
    env["FIREBASE_ANDROID_API_KEY"] = (client.get("api_key") or [{}])[0].get("current_key", "")
    env.setdefault("FIREBASE_PROJECT_ID", project.get("project_id", ""))
    env.setdefault("FIREBASE_MESSAGING_SENDER_ID", project.get("project_number", ""))
    env.setdefault("FIREBASE_STORAGE_BUCKET", project.get("storage_bucket", ""))
    if project.get("project_id"):
        env.setdefault("FIREBASE_AUTH_DOMAIN", project["project_id"] + ".firebaseapp.com")
    print(f"✓ Firebase Android lu dans {candidate}")
    break

if api_url:
    env["API_URL"] = api_url
env.setdefault("API_URL", prod_api)
env["IOS_LOOK"] = ios_look

app_id = env.get("FIREBASE_ANDROID_APP_ID") or env.get("FIREBASE_APP_ID")
api_key = env.get("FIREBASE_ANDROID_API_KEY") or env.get("FIREBASE_API_KEY")
if not (app_id and api_key and env.get("FIREBASE_PROJECT_ID")):
    print("⚠ Configuration Firebase absente : l'app s'ouvrira sur « Configuration Firebase manquante ».")
    print("  Dépose le google-services.json de l'app Android dans mobile_flutter/android/app/ (ou remplis env.json).")
print(f"✓ API : {env['API_URL']}")
json.dump(env, open(out, "w"), indent=2)
PY

# ---------------------------------------------------------------- Lancement
# PowerShell plutôt que cmd.exe : cmd ne comprend pas les guillemets échappés par WSL.
flutter_ps() {
  cd /mnt/c
  exec powershell.exe -NoProfile -Command "Set-Location '$work_win'; & '$flutter_win' $*; exit \$LASTEXITCODE"
}
if $build_only; then
  echo "▶ flutter build apk --debug (premier build : plusieurs minutes)…"
  flutter_ps build apk --debug --dart-define-from-file=env.android.json
fi
echo "▶ flutter run sur $dev (premier build : plusieurs minutes)…"
flutter_ps run -d "$dev" --dart-define-from-file=env.android.json
