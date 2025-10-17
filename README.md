# AI Hand‑Drawing

Pinch (index–thumb) to draw. Release to stop. Works in browser (https) and as PWA / Electron.

## Run (Browser)
Open `index.html` over a local server (needed for `getUserMedia`):
- Python: `python -m http.server 8080` then open http://localhost:8080

## Install as PWA
Open in a modern browser and click “Install App”. Works offline after first load.

## Electron
- Install Node.js
- `npm install`
- `npm start`

## Features
- MediaPipe Hands tracking
- Pinch-to-draw with speed→width/opacity
- Multiple layers, undo/redo
- PNG export
- Sensitivity control, two-hand mode, optional landmark overlay
