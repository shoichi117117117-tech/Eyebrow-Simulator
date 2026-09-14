import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs';

// DOM Element References
const uploadInput = document.getElementById('upload');
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

// State Variables
let faceLandmarker = null;
let baseImage = null;       // Currently rendered canvas background (Original or Eyebrow-Removed)
let originalFile = null;    // Raw uploaded File object
let landmarksData = null;   // Extracted landmark coordinates
let isLoading = false;      // Loading overlay flag

// Preloaded Eyebrow Template Cache
const eyebrowImages = {};
let currentTemplateId = 'natural';

// User Control Parameters
const params = {
  offsetY: 0,
  angle: 0,
  length: 1.0,
  thickness: 1.0,
  sharpness: 0,
  opacity: 0.8,
  color: '#281e14'
};

// Eyebrow Template Definitions
const EYEBROW_TEMPLATES = [
  { id: 'natural', name: '1. Natural Standard', srcLeft: 'assets/eyebrows/natural_l.png', srcRight: 'assets/eyebrows/natural_r.png' },
  { id: 'parallel_korean', name: '2. Straight', srcLeft: 'assets/eyebrows/straight_l.png', srcRight: 'assets/eyebrows/straight_r.png' },
  { id: 'feminine_arch', name: '3. Steep Arch', srcLeft: 'assets/eyebrows/steep_arch_l.png', srcRight: 'assets/eyebrows/steep_arch_r.png' },
  { id: 'rising_sharp', name: '4. Upward', srcLeft: 'assets/eyebrows/upward_l.png', srcRight: 'assets/eyebrows/upward_r.png' },
  { id: 'soft_curved', name: '5. Soft Curve', srcLeft: 'assets/eyebrows/soft_l.png', srcRight: 'assets/eyebrows/soft_r.png' },
  { id: 'intellectual_thin', name: '6. Flat', srcLeft: 'assets/eyebrows/flat_l.png', srcRight: 'assets/eyebrows/flat_r.png' },
  { id: 'bold_boyish', name: '7. Bold Boyish', srcLeft: 'assets/eyebrows/hard_angled_l.png', srcRight: 'assets/eyebrows/hard_angled_r.png' },
  { id: 'cute_short', name: '8. Cute Rounded', srcLeft: 'assets/eyebrows/rounded_l.png', srcRight: 'assets/eyebrows/rounded_r.png' },
  { id: 'mode_cat', name: '9. S Curve', srcLeft: 'assets/eyebrows/s_curve_l.png', srcRight: 'assets/eyebrows/s_curve_r.png' },
  { id: 'drooping_soft', name: '10. Gentle Bald', srcLeft: 'assets/eyebrows/bald_l.png', srcRight: 'assets/eyebrows/bald_r.png' }
];

// 1. Initialize MediaPipe FaceLandmarker (Identical to Test Implementation)
async function initMediaPipe() {
  try {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'IMAGE',
      numFaces: 1
    });

    console.log('✅ MediaPipe Tasks Vision initialized successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize MediaPipe:', err);
  }
}

// Preload Eyebrow PNG Assets
function preloadEyebrowTemplates() {
  EYEBROW_TEMPLATES.forEach(tmpl => {
    eyebrowImages[tmpl.id] = {
      left: new Image(),
      right: new Image(),
      isLoaded: false
    };

    const target = eyebrowImages[tmpl.id];
    let loadedCount = 0;

    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        target.isLoaded = true;
        render();
      }
    };

    target.left.onload = checkLoaded;
    target.right.onload = checkLoaded;
    target.left.src = tmpl.srcLeft;
    target.right.src = tmpl.srcRight;
  });
}

// 2. Handle Image Upload and AI Processing Workflow
if (uploadInput) {
  uploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !faceLandmarker) return;

    originalFile = file;
    isLoading = true;

    // Load original user image
    const rawImage = new Image();
    rawImage.src = URL.createObjectURL(file);
    await rawImage.decode();

    // Match canvas dimensions with image resolution
    canvas.width = rawImage.width;
    canvas.height = rawImage.height;
    baseImage = rawImage;

    render();

    // Step A: Detect Face Landmarks via MediaPipe JS
    const results = faceLandmarker.detect(rawImage);

    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      const raw = results.faceLandmarks[0];

      // Exact landmarks matching the successful test runner:
      // Person's Left Eyebrow (Screen Right): Landmark 285 -> 276
      // Person's Right Eyebrow (Screen Left): Landmark 46 -> 55
      landmarksData = {
        leftEyebrow: {
          leftPt:  { x: raw[285].x * canvas.width, y: raw[285].y * canvas.height },
          rightPt: { x: raw[276].x * canvas.width, y: raw[276].y * canvas.height }
        },
        rightEyebrow: {
          leftPt:  { x: raw[46].x * canvas.width,  y: raw[46].y * canvas.height },
          rightPt: { x: raw[55].x * canvas.width,  y: raw[55].y * canvas.height }
        }
      };
      console.log('✅ Landmarks extracted successfully:', landmarksData);
    } else {
      console.warn('⚠️ No face detected in uploaded image.');
      landmarksData = null;
    }

    // Step B: Send image to FastAPI backend for eyebrow removal
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/remove-eyebrows', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const removedImage = new Image();
        removedImage.src = data.image; // Base64 data URL
        await removedImage.decode();

        // Swap base background with eyebrow-removed photo
        baseImage = removedImage;
        console.log('✅ Eyebrow removal image received from backend.');
      } else {
        console.warn('⚠️ FastAPI server error. Falling back to original image.');
      }
    } catch (err) {
      console.error('❌ Failed to reach FastAPI backend:', err);
    } finally {
      isLoading = false;
      render();
    }
  });
}

// Tint Eyebrow Asset Color Dynamically
function createTintedCanvas(img, hexColor) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return img;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0, w, h);

  const imageData = tempCtx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 40;
  const g = parseInt(hex.substring(2, 4), 16) || 30;
  const b = parseInt(hex.substring(4, 6), 16) || 20;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 20) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }

  tempCtx.putImageData(imageData, 0, 0);
  return tempCanvas;
}

// 3. Render Eyebrow Asset using Vector Math + Slider Modifiers
function drawEyebrow(img, leftPt, rightPt, isScreenLeft) {
  if (!img || !leftPt || !rightPt) return;

  // 1. Calculate vector direction and base angle
  const dx = rightPt.x - leftPt.x;
  const dy = rightPt.y - leftPt.y;
  const baseAngle = Math.atan2(dy, dx);

  // 2. Apply user rotation angle (mirroring left and right directions)
  const userAngle = (params.angle * Math.PI) / 180;
  const adjustedUserAngle = isScreenLeft ? -userAngle : userAngle;
  const finalAngle = baseAngle + adjustedUserAngle;

  // 3. Calculate X-offset parallel shift relative to nasal bridge
  const distance = Math.hypot(dx, dy);
  const shiftAmount = distance * (params.sharpness * 0.1); 

  // Invert shift direction for left vs right eyebrow to move closer/further symmetrically
  const direction = isScreenLeft ? -1 : 1;
  const shiftX = Math.cos(baseAngle) * shiftAmount * direction;
  const shiftY = Math.sin(baseAngle) * shiftAmount * direction;

  // 4. Compute final center point combining Y-offset and X-shift
  const centerX = (leftPt.x + rightPt.x) / 2 + shiftX;
  const centerY = (leftPt.y + rightPt.y) / 2 + params.offsetY + shiftY;

  // 5. Calculate render dimensions
  const renderWidth = distance * 1.35 * params.length;
  const aspectRatio = img.naturalHeight > 0 ? (img.naturalHeight / img.naturalWidth) : 0.3;
  const renderHeight = renderWidth * aspectRatio * params.thickness;

  // 6. Generate tinted asset canvas and draw on stage
  const tintedCanvas = createTintedCanvas(img, params.color);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(finalAngle);
  ctx.globalAlpha = params.opacity;

  ctx.drawImage(
    tintedCanvas,
    -renderWidth / 2,
    -renderHeight / 2,
    renderWidth,
    renderHeight
  );

  ctx.restore();
}

// Control Input Listeners
['offsetY', 'angle', 'length', 'thickness', 'sharpness', 'opacity'].forEach(key => {
  const input = document.getElementById(key);
  if (input) {
    input.addEventListener('input', (e) => {
      params[key] = parseFloat(e.target.value);
      const valDisplay = document.getElementById(`val-${key}`);
      if (valDisplay) valDisplay.innerText = e.target.value;
      render();
    });
  }
});

const colorPicker = document.getElementById('colorPicker');
if (colorPicker) {
  colorPicker.addEventListener('input', (e) => {
    params.color = e.target.value;
    render();
  });
}

// Select eyebrow colors
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const selectedColor = e.target.getAttribute('data-color');
    params.color = selectedColor;
    if (colorPicker) colorPicker.value = selectedColor;
    render();
  });
});

// UI Template Selector Logic
function initTemplateUI() {
  const container = document.getElementById('template-buttons-container');
  if (!container) return;

  container.innerHTML = '';
  EYEBROW_TEMPLATES.forEach((tmpl, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `template-btn ${index === 0 ? 'active' : ''}`;
    btn.innerText = tmpl.name;

    btn.addEventListener('click', () => {
      document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTemplateId = tmpl.id;
      render();
    });

    container.appendChild(btn);
  });
}

// 4. Main Canvas Render Loop
function render() {
  if (!baseImage) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(baseImage, 0, 0);

  // Render Loading Indicator
  if (isLoading) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Removing eyebrows via AI backend...', canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  // Render Overlay Eyebrows
  if (landmarksData && eyebrowImages[currentTemplateId] && eyebrowImages[currentTemplateId].isLoaded) {
    const activeTemplate = eyebrowImages[currentTemplateId];

    // Person's Left Eyebrow
    drawEyebrow(
      activeTemplate.left,
      landmarksData.leftEyebrow.leftPt,
      landmarksData.leftEyebrow.rightPt,
      true
    );

    // Person's Right Eyebrow
    drawEyebrow(
      activeTemplate.right,
      landmarksData.rightEyebrow.leftPt,
      landmarksData.rightEyebrow.rightPt,
      false
    );
  }
}

// Application Initialization Entry Point
document.addEventListener('DOMContentLoaded', () => {
  initMediaPipe();
  preloadEyebrowTemplates();
  initTemplateUI();
});