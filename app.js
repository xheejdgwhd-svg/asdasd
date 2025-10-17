// AI Hand-Drawing v2.0 using TensorFlow.js handpose
let model, video, canvas, ctx;
let drawing = false;
let prevPoint = null;
let pinchThreshold = 0.04;
let sensitivity = 1;
let smoothing = 0.6;
let hintEl = document.getElementById('hint');

async function setupCamera() {
  video = document.getElementById('video');
  const stream = await navigator.mediaDevices.getUserMedia({video:true});
  video.srcObject = stream;
  await new Promise(r => video.onloadedmetadata = r);
  return video;
}

async function loadModel() {
  const handPose = window.handPoseDetection;
  const modelType = handPose.SupportedModels.MediaPipeHands;
  model = await handPose.createDetector(modelType, {
    runtime:'tfjs',
    modelType:'lite',
    maxHands:1
  });
}

function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
function midPoint(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}

function drawLine(p1,p2,width,alpha){
  ctx.strokeStyle = `rgba(0,224,255,${alpha})`;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p1.x,p1.y);
  ctx.lineTo(p2.x,p2.y);
  ctx.stroke();
}

async function detect() {
  if (!model || !video) return;
  const hands = await model.estimateHands(video, {flipHorizontal:true});
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if (hands.length>0) {
    const hand = hands[0];
    const thumb = hand.keypoints3D.find(p=>p.name==='thumb_tip');
    const index = hand.keypoints3D.find(p=>p.name==='index_finger_tip');
    if (!thumb||!index) return requestAnimationFrame(detect);
    const d = distance(thumb,index);

    // autocalibration phase
    if (autoCalib.active && Date.now()-autoCalib.start<2000){
      autoCalib.samples.push(d);
    } else if (autoCalib.active && !autoCalib.done){
      const avg = autoCalib.samples.reduce((a,b)=>a+b)/autoCalib.samples.length;
      pinchThreshold = avg * 0.8;
      autoCalib.done = true;
      hintEl.classList.remove('show');
    }

    const pinch = d < pinchThreshold;
    const mid = midPoint(thumb,index);
    const x = mid.x * canvas.width;
    const y = mid.y * canvas.height;

    if (pinch && !drawing){
      drawing = true;
      prevPoint = {x,y};
    }
    if (!pinch && drawing){
      drawing = false;
      prevPoint = null;
    }

    if (drawing && prevPoint){
      const newPoint = {
        x:prevPoint.x*(1-smoothing)+x*smoothing,
        y:prevPoint.y*(1-smoothing)+y*smoothing
      };
      const spd = Math.hypot(newPoint.x-prevPoint.x,newPoint.y-prevPoint.y);
      const width = 5+Math.min(spd/2,15);
      const alpha = 0.7+Math.min(spd/100,0.3);
      drawLine(prevPoint,newPoint,width,alpha);
      prevPoint = newPoint;
    }
  }
  requestAnimationFrame(detect);
}

let autoCalib = {active:false,done:false,start:0,samples:[]};

async function start() {
  const startBtn=document.getElementById('startBtn');
  const stopBtn=document.getElementById('stopBtn');
  startBtn.disabled=true;
  stopBtn.disabled=false;

  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  hintEl.classList.add('show');
  autoCalib = {active:true,done:false,start:Date.now(),samples:[]};
  detect();
}

async function init() {
  await setupCamera();
  await loadModel();
  start();
}

document.getElementById('startBtn').addEventListener('click', init);
document.getElementById('stopBtn').addEventListener('click', ()=>{
  drawing=false;
  if(video && video.srcObject) video.srcObject.getTracks().forEach(t=>t.stop());
  document.getElementById('startBtn').disabled=false;
  document.getElementById('stopBtn').disabled=true;
});
document.getElementById('clearBtn').addEventListener('click', ()=>ctx.clearRect(0,0,canvas.width,canvas.height));
document.getElementById('downloadBtn').addEventListener('click', e=>{
  e.target.href = canvas.toDataURL('image/png');
});
