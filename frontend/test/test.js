import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// アセットを直接import（Viteがパスを最適に処理します）
import leftEyebrowUrl from '../assets/eyebrows/natural_l.png';
import rightEyebrowUrl from '../assets/eyebrows/natural_r.png';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const uploadInput = document.getElementById('upload');

let faceLandmarker = null;
let baseImage = null;
let landmarksData = null;

const params = {
  offsetY: 0,
  angle: 0,
  length: 1.0,
  thickness: 1.0,
  opacity: 0.85,
  color: '#281e14',
  debug: true,
  flipHorizontal: false
};

const testEyebrow = {
  left: new Image(),
  right: new Image(),
  boundsLeft: null,
  boundsRight: null,
  isLoaded: false
};

async function initMediaPipe() {
  try {
    // jsdelivrのCDNからWASMを取得（安定したバージョン指定）
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "IMAGE",
      numFaces: 1
    });
    console.log("✅ [MediaPipe Ready]");
  } catch (err) {
    console.error("❌ [MediaPipe Init Failed]", err);
  }
}

function loadTestEyebrows() {
  testEyebrow.left.src = leftEyebrowUrl;
  testEyebrow.right.src = rightEyebrowUrl;

  let loadedCount = 0;
  const checkDone = () => {
    loadedCount++;
    if (loadedCount === 2) {
      testEyebrow.boundsLeft = getAlphaBoundingBox(testEyebrow.left);
      testEyebrow.boundsRight = getAlphaBoundingBox(testEyebrow.right);
      testEyebrow.isLoaded = true;
      console.log("✅ [Eyebrows Loaded]", {
        left: testEyebrow.boundsLeft,
        right: testEyebrow.boundsRight
      });
      render();
    }
  };

  if (testEyebrow.left.complete) checkDone(); else testEyebrow.left.onload = checkDone;
  if (testEyebrow.right.complete) checkDone(); else testEyebrow.right.onload = checkDone;
}

function getAlphaBoundingBox(img) {
  const tempCanvas = document.createElement('canvas');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w === 0 || h === 0) return { x: 0, y: 0, width: 100, height: 50 };

  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0);

  const data = tempCtx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0, found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  return found ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : { x: 0, y: 0, width: w, height: h };
}

uploadInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  baseImage = new Image();
  baseImage.src = URL.createObjectURL(file);
  await baseImage.decode();

  canvas.width = baseImage.width;
  canvas.height = baseImage.height;

  if (faceLandmarker) {
    const results = faceLandmarker.detect(baseImage);
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      const raw = results.faceLandmarks[0];
      
      landmarksData = {
        screen_left: {
          head: { x: raw[55].x * canvas.width, y: raw[55].y * canvas.height },
          tail: { x: raw[46].x * canvas.width, y: raw[46].y * canvas.height }
        },
        screen_right: {
          head: { x: raw[285].x * canvas.width, y: raw[285].y * canvas.height },
          tail: { x: raw[276].x * canvas.width, y: raw[276].y * canvas.height }
        }
      };
      console.log("✅ [Face Analysis Complete]", landmarksData);
    } else {
      alert("顔が検出できませんでした。別の画像を試してください。");
    }
  }
  render();
});

['offsetY', 'angle', 'length', 'thickness', 'opacity'].forEach(key => {
  document.getElementById(key)?.addEventListener('input', (e) => {
    params[key] = parseFloat(e.target.value);
    const label = document.getElementById(`val-${key}`);
    if (label) label.innerText = e.target.value;
    render();
  });
});

document.getElementById('debugToggle')?.addEventListener('change', (e) => {
  params.debug = e.target.checked;
  render();
});

document.getElementById('flipHorizontal')?.addEventListener('change', (e) => {
  params.flipHorizontal = e.target.checked;
  render();
});

function drawEyebrow(img, head, tail, isScreenLeft, bounds) {
  if (!head || !tail || !img || !bounds) return;

  const centerX = (head.x + tail.x) / 2;
  const centerY = (head.y + tail.y) / 2 + params.offsetY;

  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  
  const baseAngle = Math.atan2(dy, dx);
  const userAngle = (params.angle * (isScreenLeft ? -1 : 1) * Math.PI) / 180;
  const finalAngle = baseAngle + userAngle;

  const landmarkDistance = Math.hypot(dx, dy);

  const renderWidth = landmarkDistance * 1.35 * params.length;
  const scale = renderWidth / bounds.width;
  const renderHeight = bounds.height * scale * params.thickness;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(finalAngle);
  ctx.globalAlpha = params.opacity;

  ctx.drawImage(
    img,
    bounds.x, bounds.y, bounds.width, bounds.height,
    -renderWidth / 2, -renderHeight / 2, renderWidth, renderHeight
  );

  ctx.restore();

  if (params.debug) {
    ctx.save();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(tail.x, tail.y);
    ctx.stroke();

    ctx.fillStyle = '#0088ff';
    ctx.beginPath(); ctx.arc(head.x, head.y, 5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ffff00';
    ctx.beginPath(); ctx.arc(tail.x, tail.y, 5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ff0000';
    ctx.beginPath(); ctx.arc(centerX, centerY, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function render() {
  if (!baseImage) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  if (params.flipHorizontal) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(baseImage, 0, 0);

  if (landmarksData && testEyebrow.isLoaded) {
    drawEyebrow(
      testEyebrow.left,
      landmarksData.screen_left.head,
      landmarksData.screen_left.tail,
      true,
      testEyebrow.boundsLeft
    );

    drawEyebrow(
      testEyebrow.right,
      landmarksData.screen_right.head,
      landmarksData.screen_right.tail,
      false,
      testEyebrow.boundsRight
    );
  }

  ctx.restore();
}

// アプリの起動
(async () => {
  await initMediaPipe();
  loadTestEyebrows();
})();