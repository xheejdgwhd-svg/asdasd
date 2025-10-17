// AI Hand‑Drawing App with MediaPipe Hands
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const composite = document.getElementById('composite');
const octx = overlay.getContext('2d');
const cctx = composite.getContext('2d');

const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnClear = document.getElementById('btnClear');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnNewLayer = document.getElementById('btnNewLayer');
const btnToggleLayer = document.getElementById('btnToggleLayer');
const btnDownload = document.getElementById('btnDownload');

const sizeEl = document.getElementById('size');
const opacityEl = document.getElementById('opacity');
const colorEl = document.getElementById('color');
const speedWidthEl = document.getElementById('speedWidth');
const speedOpacityEl = document.getElementById('speedOpacity');
const sensitivityEl = document.getElementById('sensitivity');
const twoHandsEl = document.getElementById('twoHands');
const showLandmarksEl = document.getElementById('showLandmarks');

const layerIndexEl = document.getElementById('layerIndex');
const layerTotalEl = document.getElementById('layerTotal');

let camera, hands;
let running = false;

const layers = [];
let activeLayer = 0;

function createLayer(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  return {
    canvas, ctx, visible: true,
    undo: [], redo: []
  };
}

function ensureLayers() {
  if (layers.length === 0) {
    layers.push(createLayer(composite.width, composite.height));
    activeLayer = 0;
    updateLayerUI();
  }
}

function updateLayerUI() {
  layerIndexEl.textContent = activeLayer + 1;
  layerTotalEl.textContent = layers.length;
  btnUndo.disabled = layers[activeLayer].undo.length === 0;
  btnRedo.disabled = layers[activeLayer].redo.length === 0;
}

function compositeRender() {
  cctx.clearRect(0,0,composite.width, composite.height);
  for (const L of layers) {
    if (L.visible) cctx.drawImage(L.canvas, 0, 0);
  }
  btnDownload.href = composite.toDataURL('image/png');
}

function pushUndoSnapshot() {
  const L = layers[activeLayer];
  try {
    L.undo.push(L.ctx.getImageData(0,0,L.canvas.width,L.canvas.height));
    if (L.undo.length > 50) L.undo.shift();
    L.redo.length = 0;
  } catch(e) {
    console.warn('Undo snapshot failed', e);
  }
  updateLayerUI();
}

function undo() {
  const L = layers[activeLayer];
  if (L.undo.length === 0) return;
  const current = L.ctx.getImageData(0,0,L.canvas.width,L.canvas.height);
  L.redo.push(current);
  const last = L.undo.pop();
  L.ctx.putImageData(last,0,0);
  updateLayerUI(); compositeRender();
}
function redo() {
  const L = layers[activeLayer];
  if (L.redo.length === 0) return;
  const current = L.ctx.getImageData(0,0,L.canvas.width,L.canvas.height);
  L.undo.push(current);
  const img = L.redo.pop();
  L.ctx.putImageData(img,0,0);
  updateLayerUI(); compositeRender();
}

btnUndo.addEventListener('click', undo);
btnRedo.addEventListener('click', redo);

btnClear.addEventListener('click', () => {
  const L = layers[activeLayer];
  pushUndoSnapshot();
  L.ctx.clearRect(0,0,L.canvas.width,L.canvas.height);
  compositeRender();
});

btnNewLayer.addEventListener('click', () => {
  const L = createLayer(composite.width, composite.height);
  layers.splice(activeLayer+1, 0, L);
  activeLayer++;
  updateLayerUI(); compositeRender();
});

btnToggleLayer.addEventListener('click', () => {
  const L = layers[activeLayer];
  L.visible = !L.visible;
  updateLayerUI(); compositeRender();
});

const state = [
  { drawing:false, prev:null, lastSpeed:0 },
  { drawing:false, prev:null, lastSpeed:0 }
];

function pinchDistance(landmarks) {
  const a = landmarks[4], b = landmarks[8];
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function pinchPoint(landmarks) {
  const a = landmarks[4], b = landmarks[8];
  return { x: (a.x + b.x)/2, y: (a.y + b.y)/2 };
}

function drawPointOnLayer(pt, handIdx, dt) {
  const L = layers[activeLayer];
  const ctx = L.ctx;
  const w = L.canvas.width, h = L.canvas.height;
  const x = pt.x * w, y = pt.y * h;

  const st = state[handIdx];
  let speed = 0;
  if (st.prev) {
    const dx = x - st.prev.x;
    const dy = y - st.prev.y;
    const dist = Math.hypot(dx,dy);
    speed = dt > 0 ? dist / dt : 0;
  }
  st.lastSpeed = speed;

  const baseSize = parseFloat(sizeEl.value);
  const baseOpacity = parseFloat(opacityEl.value);
  let width = baseSize;
  let alpha = baseOpacity;

  const s = Math.min(speed, 2.5);
  if (speedWidthEl.checked) {
    width = baseSize * (0.6 + 1.6 * (s / 2.5));
  }
  if (speedOpacityEl.checked) {
    alpha = baseOpacity * (0.4 + 0.6 * (s / 2.5));
  }

  ctx.strokeStyle = colorEl.value;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;

  if (!st.prev) {
    st.prev = {x,y};
    return;
  }
  ctx.beginPath();
  ctx.moveTo(st.prev.x, st.prev.y);
  ctx.lineTo(x,y);
  ctx.stroke();
  st.prev = {x,y};
  ctx.globalAlpha = 1;
}

function onResults(results) {
  const octx = overlay.getContext('2d');
  octx.clearRect(0,0,overlay.width,overlay.height);

  const now = performance.now();
  if (!onResults.lastTime) onResults.lastTime = now;
  const dt = now - onResults.lastTime;
  onResults.lastTime = now;

  const pinchThresh = parseFloat(sensitivityEl.value);
  const handsCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
  const maxHands = twoHandsEl.checked ? 2 : 1;

  for (let i=0; i<2; i++) {
    if (i >= handsCount || i >= maxHands) {
      if (state[i].drawing) {
        state[i].drawing = false;
        state[i].prev = null;
      }
      continue;
    }
    const lm = results.multiHandLandmarks[i];

    if (showLandmarksEl.checked) {
      drawConnectors(octx, lm, HAND_CONNECTIONS, {color:'#22d3ee', lineWidth:2});
      drawLandmarks(octx, lm, {color:'#eab308', lineWidth:1, radius:2.5});
    }

    const d = pinchDistance(lm);
    const p = pinchPoint(lm);

    const isPinched = d < pinchThresh;
    const st = state[i];
    if (isPinched && !st.drawing) {
      st.drawing = true;
      st.prev = null;
      pushUndoSnapshot();
    } else if (!isPinched && st.drawing) {
      st.drawing = false;
      st.prev = null;
    }

    if (st.drawing) drawPointOnLayer(p, i, dt);
  }
  compositeRender();
}

function resizeCanvases() {
  const w = Math.max(video.videoWidth || 960, 640);
  const h = Math.max(video.videoHeight || 540, 360);
  overlay.width = composite.width = w;
  overlay.height = composite.height = h;
  for (const L of layers) {
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(L.canvas, 0, 0, tmp.width, tmp.height);
    L.canvas.width = tmp.width; L.canvas.height = tmp.height;
    L.ctx.drawImage(tmp, 0, 0);
  }
}

async function start() {
  if (running) return;
  running = true;
  btnStart.disabled = true; btnStop.disabled = false;

  await navigator.mediaDevices.getUserMedia({video:true, audio:false}).then(stream => {
    video.srcObject = stream;
    return video.play();
  });

  resizeCanvases(); ensureLayers();

  hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
  hands.setOptions({
    selfieMode: true,
    maxNumHands: twoHandsEl.checked ? 2 : 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });
  hands.onResults(onResults);

  const cam = new Camera(video, {
    onFrame: async () => { await hands.send({image: video}); },
    width: 960, height: 540
  });
  camera = cam;
  cam.start();
}

function stop() {
  if (!running) return;
  running = false;
  btnStart.disabled = false; btnStop.disabled = true;
  if (camera) camera.stop();
  if (video.srcObject) {
    for (const t of video.srcObject.getTracks()) t.stop();
    video.srcObject = null;
  }
}

btnStart.addEventListener('click', start);
btnStop.addEventListener('click', stop);

btnDownload.addEventListener('click', () => { /* href set in compositeRender */ });

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  if (e.key === ' ') { e.preventDefault(); if (running) stop(); else start(); }
});

ensureLayers(); compositeRender();
