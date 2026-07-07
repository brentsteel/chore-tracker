# Chore Tracker

A mobile-friendly household chore tracker built with React + Vite.

## What changed from the Claude artifact version

The Claude artifact used `window.storage`, which only works inside Claude's
own environment. This version uses the browser's `localStorage` instead, so
it works as a normal standalone web app. Data is saved per-browser/per-device
— same behaviour as the original had inside Claude, just now it works outside
of it too.

The star-reward chime uses the Web Audio API and needs a user tap to play
(browsers block audio without a gesture) — since it's triggered by tapping
the "done" checkmark, that's already covered.

## Deploy to Render

1. **Put this project on GitHub**
   - Create a new repo (e.g. `chore-tracker`)
   - Push these files to it:
     ```
     git init
     git add .
     git commit -m "Chore tracker"
     git branch -M main
     git remote add origin https://github.com/<your-username>/chore-tracker.git
     git push -u origin main
     ```

2. **Create a Static Site on Render**
   - Go to https://dashboard.render.com → **New** → **Static Site**
   - Connect your GitHub repo
   - Settings:
     - **Build Command:** `npm install && npm run build`
     - **Publish Directory:** `dist`
   - Click **Create Static Site**

3. Render will give you a URL like `https://chore-tracker-xxxx.onrender.com` —
   open it on your phone, add it to your home screen, and it behaves like an app.

## Run locally first (optional)

```
npm install
npm run dev
```

Then open the local URL it prints (usually http://localhost:5173).
