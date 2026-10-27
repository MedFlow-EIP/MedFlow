# Installation

Toute l’installation (backend, mobile, variables d’environnement, tests) est décrite dans le [README](../README.md#lancer-le-projet-en-local).

## Émulateur Android avec Expo dans WSL

Le SDK Android est installé côté Windows ; Expo tourne dans WSL.

1. `C:\Users\<toi>\.wslconfig` :
   ```
   [wsl2]
   networkingMode=mirrored
   ```
   puis `wsl --shutdown`.
2. Relais vers le SDK Windows dans WSL :
   ```bash
   SDK_WIN=/mnt/c/Users/<toi>/AppData/Local/Android/Sdk
   mkdir -p ~/Android/sdk/platform-tools ~/Android/sdk/emulator
   printf '#!/bin/sh\nexec "%s/platform-tools/adb.exe" "$@"\n' "$SDK_WIN" > ~/Android/sdk/platform-tools/adb
   printf '#!/bin/sh\nexec "%s/emulator/emulator.exe" "$@"\n' "$SDK_WIN" > ~/Android/sdk/emulator/emulator
   chmod +x ~/Android/sdk/platform-tools/adb ~/Android/sdk/emulator/emulator
   echo 'export ANDROID_HOME=$HOME/Android/sdk' >> ~/.zshrc
   ```
3. Émulateur ouvert : `cd mobile && npm run emu`, puis `a`.

Node doit être installé **dans WSL** (`nvm install 20`) : le `npm` de Windows échoue sur les chemins `\\wsl.localhost`.
