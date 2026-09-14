// ==========================================
// Debug & Test Runner Module (Correct Position Mapping)
// ==========================================

const MOCK_LANDMARKS = {
    // 画面左側の位置
    left_position: [
      { x: 300, y: 200 },
      { x: 320, y: 190 },
      { x: 340, y: 185 },
      { x: 360, y: 190 },
      { x: 380, y: 200 }
    ],
    // 画面右側の位置
    right_position: [
      { x: 420, y: 200 },
      { x: 440, y: 190 },
      { x: 460, y: 185 },
      { x: 480, y: 190 },
      { x: 500, y: 200 }
    ]
  };
  
  let isTestModeActive = false;
  
  function safeHexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return { r: 90, g: 61, b: 40 };
    const cleanHex = hex.replace('#', '').trim();
    
    if (cleanHex.length === 3) {
      return {
        r: parseInt(cleanHex[0] + cleanHex[0], 16),
        g: parseInt(cleanHex[1] + cleanHex[1], 16),
        b: parseInt(cleanHex[2] + cleanHex[2], 16)
      };
    }
    
    if (cleanHex.length === 6) {
      const bigint = parseInt(cleanHex, 16);
      return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
      };
    }
  
    return { r: 90, g: 61, b: 40 };
  }
  
  function testCreateTintedImage(img, hexColor) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
  
    if (!w || !h) return img;
  
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const offCtx = offCanvas.getContext('2d');
  
    offCtx.drawImage(img, 0, 0, w, h);
  
    const imageData = offCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const rgb = safeHexToRgb(hexColor);
  
    const ALPHA_THRESHOLD = 30;
  
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
  
      if (alpha < ALPHA_THRESHOLD) {
        data[i + 3] = 0;
      } else {
        data[i]     = rgb.r;
        data[i + 1] = rgb.g;
        data[i + 2] = rgb.b;
      }
    }
  
    offCtx.putImageData(imageData, 0, 0);
    return offCanvas;
  }
  
  function testGetAlphaBoundingBox(img) {
    const tempCanvas = document.createElement('canvas');
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
  
    if (!w || !h) return { x: 0, y: 0, width: 100, height: 50 };
  
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);
  
    const imageData = tempCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
  
    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;
  
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > 30) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
  
    if (!found) return { x: 0, y: 0, width: w, height: h };
  
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }
  
  function testDrawEyebrowTinted(img, bounds, pts) {
    if (!pts || pts.length < 2 || !img || !img.complete || !bounds) return;
  
    const head = pts[0];
    const tail = pts[pts.length - 1];
  
    const offsetY = (typeof params !== 'undefined' && params.offsetY) ? params.offsetY : 0;
    const centerX = (head.x + tail.x) / 2;
    const centerY = (head.y + tail.y) / 2 + offsetY;
  
    const dx = tail.x - head.x;
    const dy = tail.y - head.y;
    const angle = Math.atan2(dy, dx);
  
    const lengthMult = (typeof params !== 'undefined' && params.length) ? params.length : 1.0;
    const thicknessMult = (typeof params !== 'undefined' && params.thickness) ? params.thickness : 1.0;
    const targetOpacity = (typeof params !== 'undefined' && params.opacity !== undefined) ? params.opacity : 1.0;
    const targetColor = (typeof params !== 'undefined' && params.color) ? params.color : '#5a3d28';
  
    const landmarkDistance = Math.hypot(dx, dy);
    const renderWidth = landmarkDistance * 1.1 * lengthMult;
    const scale = renderWidth / bounds.width;
    const renderHeight = bounds.height * scale * thicknessMult;
  
    const tintedCanvas = testCreateTintedImage(img, targetColor);
  
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);
    ctx.globalAlpha = targetOpacity;
  
    ctx.drawImage(
      tintedCanvas,
      bounds.x, bounds.y, bounds.width, bounds.height,
      -renderWidth / 2, -renderHeight / 2, renderWidth, renderHeight
    );
  
    ctx.restore();
  }
  
  function createMockBaseImage(width = 800, height = 600) {
    const dummyCanvas = document.createElement('canvas');
    dummyCanvas.width = width;
    dummyCanvas.height = height;
    const dCtx = dummyCanvas.getContext('2d');
  
    dCtx.fillStyle = '#f0f0f0';
    dCtx.fillRect(0, 0, width, height);
  
    dCtx.strokeStyle = '#cccccc';
    dCtx.lineWidth = 4;
    dCtx.beginPath();
    dCtx.ellipse(400, 300, 180, 230, 0, 0, Math.PI * 2);
    dCtx.stroke();
  
    dCtx.fillStyle = '#aaaaaa';
    dCtx.beginPath();
    dCtx.arc(340, 260, 15, 0, Math.PI * 2);
    dCtx.arc(460, 260, 15, 0, Math.PI * 2);
    dCtx.fill();
  
    const img = new Image();
    img.src = dummyCanvas.toDataURL();
    return img;
  }
  
  function setupTestUI() {
    let selectEl = document.getElementById('debug-template-select');
    
    if (!selectEl) {
      const container = document.createElement('div');
      container.id = 'debug-ui-container';
      container.style.position = 'fixed';
      container.style.top = '10px';
      container.style.left = '10px';
      container.style.zIndex = '99999';
      container.style.background = 'rgba(0, 0, 0, 0.8)';
      container.style.color = '#fff';
      container.style.padding = '10px 15px';
      container.style.borderRadius = '8px';
      container.style.fontFamily = 'sans-serif';
      container.style.fontSize = '14px';
  
      const label = document.createElement('label');
      label.innerText = 'DEBUG Template: ';
      label.style.marginRight = '8px';
  
      selectEl = document.createElement('select');
      selectEl.id = 'debug-template-select';
      selectEl.style.padding = '4px 8px';
      selectEl.style.borderRadius = '4px';
  
      selectEl.addEventListener('change', (e) => {
        currentTemplateId = e.target.value;
        runTestEnvironment();
      });
  
      container.appendChild(label);
      container.appendChild(selectEl);
      document.body.appendChild(container);
    }
  
    selectEl.innerHTML = '';
    if (typeof EYEBROW_TEMPLATES !== 'undefined') {
      EYEBROW_TEMPLATES.forEach(tmpl => {
        const opt = document.createElement('option');
        opt.value = tmpl.id;
        opt.innerText = tmpl.name || tmpl.id;
        if (tmpl.id === currentTemplateId) opt.selected = true;
        selectEl.appendChild(opt);
      });
    }
  }
  
  async function runTestEnvironment() {
    isTestModeActive = true;
    setupTestUI();
  
    baseImage = createMockBaseImage(800, 600);
    await baseImage.decode();
  
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
  
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImage, 0, 0);
  
    const targetTemplate = eyebrowImages[currentTemplateId];
  
    if (targetTemplate) {
      if (!targetTemplate.isLoaded) {
        await new Promise(r => setTimeout(r, 200));
      }
  
      const leftBounds = testGetAlphaBoundingBox(targetTemplate.left);
      const rightBounds = testGetAlphaBoundingBox(targetTemplate.right);
  
      // 画面左側の位置に「右眉画像 (targetTemplate.right)」を描画
      testDrawEyebrowTinted(targetTemplate.right, rightBounds, MOCK_LANDMARKS.left_position);
      // 画面右側の位置に「左眉画像 (targetTemplate.left)」を描画
      testDrawEyebrowTinted(targetTemplate.left, leftBounds, MOCK_LANDMARKS.right_position);
    }
  }
  
  if (typeof render === 'function') {
    const originalRender = render;
    window.render = function() {
      if (isTestModeActive) {
        runTestEnvironment();
      } else {
        originalRender();
      }
    };
  }
  
  window.addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') {
      runTestEnvironment();
    }
  });