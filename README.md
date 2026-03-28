# audioTexte PWA

Minimal PWA to play MP3s via buttons on iPhone.

Installation rapide:
- Copier le dossier sur un serveur HTTPS (ou utiliser `ngrok` / `localtunnel`).
- Mettre vos fichiers MP3 dans `assets/sounds/` (ex: `sound1.mp3`, `sound2.mp3`).
- Ouvrir `https://<votre-hote>/index.html` sur iPhone Safari.
- Appuyer sur un bouton pour jouer le son (iOS exige une action utilisateur).
- Connecter l'iPhone à l'enceinte Bluetooth; iOS routera l'audio automatiquement.

Notes:
- iOS Safari PWA a des limitations (lecture en arrière-plan, contrôles limités).
- Pour publier comme application native, un Mac et Xcode ou un service de build macOS sont nécessaires.
