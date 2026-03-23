# Awesome Bot (Phone App + Ollama via ngrok)

This project gives you a phone app that chats with your local Ollama models through a public tunnel (ngrok).

- Model options are loaded live from your Ollama instance (`/api/tags`), so all installed models appear automatically.
- Works with `qwen3.5:9b`, Gemma models, and any other local model.
- Supports normal chat and diagram mode.
- Diagram mode renders Mermaid diagrams in-app (mindmap, class diagram, sequence diagram, BPMN-like flows with flowchart, ER, state, gantt, user journey).

## Project Layout

- `server/`: Express API proxy to local Ollama
- `mobile/`: Expo React Native app (Android/iOS)

## 1) Run Ollama

Make sure Ollama is running on your laptop:

```powershell
ollama serve
```

Ensure your desired models are available:

```powershell
ollama list
```

## 2) Run the API Server

```powershell
cd "c:\School\BBB\Lernatelier\awesome bot\server"
Copy-Item .env.example .env
npm install
npm run start
```

Default server URL: `http://localhost:8787`

## 3) Expose Server with ngrok

In a new terminal:

```powershell
ngrok http 8787
```

Copy the `https://...ngrok-free.app` URL.

## 4) Run Mobile App

```powershell
cd "c:\School\BBB\Lernatelier\awesome bot\mobile"
npm install
npm run start
```

- Open Expo Go on your phone and scan the QR code.
- In app, set **Backend URL** to your ngrok URL.
- Tap **Refresh Models** to load all local Ollama models.

## 5) Build APK (Cloud, Recommended)

Local Android SDK is not required with EAS cloud builds.

```powershell
cd "c:\School\BBB\Lernatelier\awesome bot\mobile"
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

When the build finishes, Expo gives you an APK download URL.

## GitHub Push

Your target repo: `https://github.com/Aboss3b13/awesome-bot`

```powershell
cd "c:\School\BBB\Lernatelier\awesome bot"
git init
git add .
git commit -m "Initial awesome bot app and ollama proxy"
git branch -M main
git remote add origin https://github.com/Aboss3b13/awesome-bot.git
git push -u origin main
```

If the remote already has commits, run:

```powershell
git pull --rebase origin main
git push -u origin main
```
