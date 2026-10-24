// Glove Size Finder
// Measures a hand from a single photo, using a known-size object for scale.

// Reference objects. `mm` is the real-world length the user marks on the photo.
const REFERENCES = [
  {
    id: 'card',
    icon: '💳',
    name: 'Any card the size of a credit card',
    detail: 'A gift card, hotel key, loyalty or library card works best. We blur the card as soon as you mark it.',
    mm: 85.6,
    markHelp: 'Drag the two markers to the top and bottom ends of the card\'s long edge, right on its outer edges. Pinch to zoom for precision.',
  },
  {
    id: 'quarter',
    icon: '🪙',
    name: 'US quarter',
    detail: '25¢ coin',
    mm: 24.26,
    markHelp: 'Drag the two markers to the top and bottom outer edges of the coin, straight across the middle. Pinch to zoom for precision.',
  },
  {
    id: 'penny',
    icon: '🪙',
    name: 'US penny',
    detail: '1¢ coin',
    mm: 19.05,
    markHelp: 'Drag the two markers to the top and bottom outer edges of the coin, straight across the middle. Pinch to zoom for precision.',
  },
];

// TRUCK glove sizing chart: hand length (tip of longest finger to crease of
// wrist) for each glove size, from truckgloves.com, with the matching letter
// size. Youth sizes for 3 and 4 follow common youth glove charts that size
// by hand length (Youth S ~11 cm, Youth M ~14 cm).
const SIZE_CHART = [
  { label: '3', letter: 'Youth S', short: 'YS', in: '4.75', mm: 120 },
  { label: '4', letter: 'Youth M', short: 'YM', in: '5.25', mm: 134 },
  { label: '5', letter: 'XXS', in: '5.75', mm: 146 },
  { label: '6', letter: 'XS', in: '6.25', mm: 160 },
  { label: '7', letter: 'S', in: '6.75', mm: 171 },
  { label: '8', letter: 'M', in: '7.25', mm: 182 },
  { label: '9', letter: 'L', in: '7.5', mm: 192 },
  { label: '10', letter: 'XL', in: '8.0', mm: 204 },
  { label: '11', letter: 'XXL', in: '8.5', mm: 215 },
];

// How close (as a share of the gap to the next size) a hand has to be to a
// size before we call it that size rather than "between sizes".
const SNAP_TO_SIZE = 0.25;
const MM_PER_INCH = 25.4;
const MAX_IMAGE_SIDE = 2000;

const state = {
  reference: REFERENCES[0],
  original: null, // offscreen canvas holding the (downscaled) photo
  image: null, // what's shown: the original, or a copy with the card blurred
  stepIndex: 0,
  points: {}, // step id -> [{x, y, placed}, {x, y, placed}] in image pixels
};

const STEPS = [
  {
    id: 'reference',
    title: () => `Mark the ${state.reference.id === 'card' ? 'card' : 'coin'}`,
    help: () => state.reference.markHelp,
    color: '#c16452',
    start: [[0.5, 0.62], [0.5, 0.42]],
    // The card's long edge points up the photo, along the hand.
    maxTiltDeg: 15,
  },
  {
    id: 'length',
    title: () => 'Mark your hand length',
    help: () => 'Drag one marker to the crease of your wrist and the other to the tip of your longest finger.',
    color: '#b4cc24',
    start: [[0.5, 0.75], [0.5, 0.2]],
    // Hand length is measured straight along the hand, which points up the
    // photo. Stop the line drifting sideways while zoomed in.
    maxTiltDeg: 15,
  },
];

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const loupe = $('loupe');
const loupeCtx = loupe.getContext('2d');

// ---------- Start screen ----------

function renderReferenceChoices() {
  const container = $('reference-choices');
  container.innerHTML = '';
  for (const ref of REFERENCES) {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(ref === state.reference));
    btn.innerHTML = `<span class="icon">${ref.icon}</span><span>${ref.name}<small>${ref.detail}</small></span>`;
    btn.addEventListener('click', () => {
      state.reference = ref;
      renderReferenceChoices();
    });
    container.appendChild(btn);
  }
}

// ---------- Loading a photo ----------

// Takes any drawable source (photo or camera frame), downscales it and starts
// the marking steps.
function useImage(source, width, height) {
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
  const off = document.createElement('canvas');
  off.width = Math.round(width * scale);
  off.height = Math.round(height * scale);
  off.getContext('2d').drawImage(source, 0, 0, off.width, off.height);

  state.original = off;
  state.image = off;
  state.points = {};
  state.stepIndex = 0;
  showScreen('measure');
  enterStep();
}

$('photo-input').addEventListener('change', (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    // Browsers apply the photo's rotation (EXIF) when drawing, so it appears upright.
    URL.revokeObjectURL(url);
    stopCamera();
    useImage(img, img.naturalWidth, img.naturalHeight);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert("Sorry, that photo couldn't be opened. Please try another one.");
  };
  img.src = url;
});

// ---------- Camera ----------

// The phone counts as flat when tilted less than this in any direction.
const LEVEL_TOLERANCE_DEG = 3;

const camera = { stream: null, levelSeen: false, isLevel: false };
const video = $('camera-video');

$('camera-btn').addEventListener('click', async () => {
  // iPhones only share motion data after the user allows it, and the request
  // has to come straight from a tap.
  if (typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch (e) { /* no level */ }
  }
  showScreen('camera');
  startCamera();
});

async function startCamera() {
  camera.levelSeen = false;
  camera.isLevel = false;
  $('level').classList.add('hidden');
  updateShutter();
  setCameraStatus('Starting camera…');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setCameraStatus("This browser can't open the camera. Go back and choose a photo instead.");
    return;
  }
  try {
    camera.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
    });
  } catch (e) {
    setCameraStatus("We couldn't open the camera. Check camera permission for this site, or go back and choose a photo instead.");
    return;
  }
  video.srcObject = camera.stream;
  await video.play().catch(() => {});
  window.addEventListener('deviceorientation', onOrientation);
  // No motion data after a moment means no level on this device; allow
  // the photo anyway.
  setTimeout(() => {
    if (camera.stream && !camera.levelSeen) {
      setCameraStatus("Hold the phone flat, straight above your hand, then take the photo.");
      updateShutter();
    }
  }, 1500);
}

video.addEventListener('loadedmetadata', () => {
  const ratio = video.videoWidth / video.videoHeight;
  const wrap = $('camera-wrap');
  wrap.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
  wrap.style.maxWidth = `calc(62vh * ${ratio})`;
});

function stopCamera() {
  window.removeEventListener('deviceorientation', onOrientation);
  if (camera.stream) camera.stream.getTracks().forEach((t) => t.stop());
  camera.stream = null;
  video.srcObject = null;
}

// beta is front-to-back tilt, gamma is side-to-side; both are 0 when the
// phone lies flat, which is how it is held when pointing straight down.
function onOrientation(event) {
  if (event.beta === null || event.gamma === null) return;
  camera.levelSeen = true;
  $('level').classList.remove('hidden');
  const tilt = Math.hypot(event.beta, event.gamma);
  camera.isLevel = tilt <= LEVEL_TOLERANCE_DEG;

  // Bubble moves like a spirit level: away from the low side, reaching the
  // edge of the ring at 15 degrees.
  const range = 15;
  const ringRadius = 26;
  const reach = Math.min(tilt, range) / Math.max(tilt, 0.001);
  const bx = (event.gamma * reach * ringRadius) / range;
  const by = (event.beta * reach * ringRadius) / range;
  $('level-bubble').style.transform = `translate(${-bx}px, ${-by}px)`;
  $('level').classList.toggle('is-level', camera.isLevel);

  setCameraStatus(camera.isLevel ? 'Level. Hold steady and take the photo.' : 'Tilt the phone until the bubble is in the center.');
  updateShutter();
}

function updateShutter() {
  const ready = Boolean(camera.stream) && (!camera.levelSeen || camera.isLevel);
  $('shutter-btn').disabled = !ready;
}

function setCameraStatus(text) {
  $('camera-status').textContent = text;
}

$('shutter-btn').addEventListener('click', () => {
  if (!video.videoWidth) return;
  const w = video.videoWidth;
  const h = video.videoHeight;
  const frame = document.createElement('canvas');
  frame.width = w;
  frame.height = h;
  frame.getContext('2d').drawImage(video, 0, 0, w, h);
  stopCamera();
  useImage(frame, w, h);
});

$('camera-cancel').addEventListener('click', () => {
  stopCamera();
  showScreen('start');
});

// ---------- Measuring screen ----------

// scale: image px -> screen px with the whole photo fitted. zoom and pan
// (tx, ty, in screen px) come from pinching.
let view = { scale: 1, cssWidth: 0, cssHeight: 0, zoom: 1, tx: 0, ty: 0 };
const MAX_ZOOM = 6;

function layoutCanvas() {
  const img = state.image;
  const wrapWidth = $('canvas-wrap').clientWidth;
  // Fit the photo and the buttons below it on screen without scrolling.
  const wrapTop = $('canvas-wrap').getBoundingClientRect().top + window.scrollY;
  const maxHeight = Math.max(260, window.innerHeight - wrapTop - 130);
  const scale = Math.min(wrapWidth / img.width, maxHeight / img.height);
  const dpr = window.devicePixelRatio || 1;

  view = { scale, cssWidth: img.width * scale, cssHeight: img.height * scale, zoom: 1, tx: 0, ty: 0 };
  canvas.style.width = `${view.cssWidth}px`;
  canvas.style.height = `${view.cssHeight}px`;
  canvas.style.margin = '0 auto';
  canvas.width = Math.round(view.cssWidth * dpr);
  canvas.height = Math.round(view.cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function currentStep() {
  return STEPS[state.stepIndex];
}

function enterStep() {
  const step = currentStep();
  // The card is only sharp while it's being marked.
  if (step.id === 'reference') state.image = state.original;
  if (!state.points[step.id]) {
    state.points[step.id] = step.start.map(([fx, fy]) => ({
      x: fx * state.image.width,
      y: fy * state.image.height,
    }));
  }
  $('step-count').textContent = `Step ${state.stepIndex + 1} of ${STEPS.length}`;
  $('step-title').textContent = step.title();
  $('step-help').textContent = step.help();
  $('skip-btn').classList.toggle('hidden', !step.optional);
  $('next-btn').textContent = state.stepIndex === STEPS.length - 1 ? 'See my size' : 'Next';
  layoutCanvas();
}

function draw() {
  ctx.clearRect(0, 0, view.cssWidth, view.cssHeight);
  const k = view.scale * view.zoom;
  ctx.drawImage(state.image, view.tx, view.ty, state.image.width * k, state.image.height * k);

  const step = currentStep();
  if (gesture.mode === 'marker' && step.maxTiltDeg) drawGuide(state.points[step.id]);

  STEPS.forEach((s, i) => {
    const pts = state.points[s.id];
    if (!pts || i > state.stepIndex) return;
    drawMeasurement(pts, s.color, i === state.stepIndex);
  });
  $('zoom-reset').classList.toggle('hidden', view.zoom <= 1.01);
}

function drawMeasurement(pts, color, active) {
  const [a, b] = pts.map(toCss);
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.45;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (active) {
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, 0.25);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
      // Crosshair so the exact point is visible under the circle
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y);
      ctx.lineTo(p.x + 6, p.y);
      ctx.moveTo(p.x, p.y - 6);
      ctx.lineTo(p.x, p.y + 6);
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Faint line running the full height of the photo through both markers, so
// the direction stays visible while the finger covers part of the line.
function drawGuide(pts) {
  const [a, b] = pts.map(toCss);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dy === 0) return;
  const xAt = (y) => a.x + (dx * (y - a.y)) / dy;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(xAt(0), 0);
  ctx.lineTo(xAt(view.cssHeight), view.cssHeight);
  ctx.stroke();
  ctx.restore();
}

// Image px <-> screen px within the canvas
function toCss(p) {
  const k = view.scale * view.zoom;
  return { x: p.x * k + view.tx, y: p.y * k + view.ty };
}

function toImage(c) {
  const k = view.scale * view.zoom;
  return { x: (c.x - view.tx) / k, y: (c.y - view.ty) / k };
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Keep the zoomed photo covering the canvas.
function clampPan() {
  const w = view.cssWidth * view.zoom;
  const h = view.cssHeight * view.zoom;
  view.tx = clamp(view.tx, view.cssWidth - w, 0);
  view.ty = clamp(view.ty, view.cssHeight - h, 0);
}

$('zoom-reset').addEventListener('click', () => {
  view.zoom = 1;
  view.tx = 0;
  view.ty = 0;
  draw();
});

// ---------- Touch gestures ----------
//
// One finger on or near a marker drags it. The marker keeps its offset from
// the finger so it stays visible while moving.
// One finger elsewhere: a tap moves the nearest marker there; a drag pans
// the photo when zoomed in.
// Two fingers pinch to zoom.

const pointers = new Map();
let gesture = { mode: null };
const MARKER_HIT = 44;
const TAP_SLOP = 8;

canvas.addEventListener('pointerdown', (event) => {
  try { canvas.setPointerCapture(event.pointerId); } catch (e) { /* pointer already gone */ }
  pointers.set(event.pointerId, eventPos(event));
  event.preventDefault();

  if (pointers.size === 2) {
    // Undo any marker move the first finger started, then pinch.
    if (gesture.mode === 'marker') Object.assign(gesture.marker, gesture.markerStart);
    startPinch();
    return;
  }
  if (pointers.size > 2) return;

  const pos = eventPos(event);
  const pts = state.points[currentStep().id];
  let nearest = 0;
  let best = Infinity;
  pts.forEach((p, i) => {
    const c = toCss(p);
    const d = Math.hypot(c.x - pos.x, c.y - pos.y);
    if (d < best) { best = d; nearest = i; }
  });

  if (best < MARKER_HIT) {
    const c = toCss(pts[nearest]);
    gesture = {
      mode: 'marker',
      index: nearest,
      marker: pts[nearest],
      markerStart: { ...pts[nearest] },
      offset: { x: c.x - pos.x, y: c.y - pos.y },
    };
    moveMarker(pos);
  } else {
    gesture = { mode: 'pending', start: pos, nearest, panStart: { tx: view.tx, ty: view.ty } };
  }
});

canvas.addEventListener('pointermove', (event) => {
  if (!pointers.has(event.pointerId)) return;
  const pos = eventPos(event);
  pointers.set(event.pointerId, pos);
  event.preventDefault();

  if (gesture.mode === 'pinch') {
    movePinch();
  } else if (gesture.mode === 'marker') {
    moveMarker(pos);
  } else if (gesture.mode === 'pending' || gesture.mode === 'pan') {
    const dx = pos.x - gesture.start.x;
    const dy = pos.y - gesture.start.y;
    if (gesture.mode === 'pending' && Math.hypot(dx, dy) > TAP_SLOP) gesture.mode = 'pan';
    if (gesture.mode === 'pan' && view.zoom > 1) {
      view.tx = gesture.panStart.tx + dx;
      view.ty = gesture.panStart.ty + dy;
      clampPan();
      draw();
    }
  }
});

const endPointer = (event) => {
  if (!pointers.has(event.pointerId)) return;
  const pos = pointers.get(event.pointerId);
  pointers.delete(event.pointerId);

  if (gesture.mode === 'pending' && event.type === 'pointerup') {
    // A tap away from the markers moves the nearest one there.
    gesture = { mode: 'marker', index: gesture.nearest, marker: state.points[currentStep().id][gesture.nearest], offset: { x: 0, y: 0 } };
    moveMarker(pos);
  }
  if (pointers.size === 0) {
    gesture = { mode: null };
    loupe.classList.add('hidden');
    draw();
  } else if (gesture.mode === 'pinch') {
    // One finger lifted: wait for both to lift before doing anything else.
    gesture = { mode: 'done' };
  }
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
// Stop iOS Safari zooming the whole page on pinch.
document.addEventListener('gesturestart', (e) => e.preventDefault());

function eventPos(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function startPinch() {
  const [a, b] = [...pointers.values()];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  gesture = {
    mode: 'pinch',
    startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    startZoom: view.zoom,
    anchor: toImage(mid), // photo point under the fingers stays under them
  };
  loupe.classList.add('hidden');
}

function movePinch() {
  const [a, b] = [...pointers.values()];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  view.zoom = clamp(gesture.startZoom * (dist / gesture.startDist), 1, MAX_ZOOM);
  const k = view.scale * view.zoom;
  view.tx = mid.x - gesture.anchor.x * k;
  view.ty = mid.y - gesture.anchor.y * k;
  clampPan();
  draw();
}

function moveMarker(pos) {
  const step = currentStep();
  const pts = state.points[step.id];
  const p = gesture.marker;
  const target = toImage({ x: pos.x + gesture.offset.x, y: pos.y + gesture.offset.y });
  p.x = clamp(target.x, 0, state.image.width);
  p.y = clamp(target.y, 0, state.image.height);
  if (step.maxTiltDeg) {
    const other = pts[1 - gesture.index];
    // A marker the user hasn't placed yet slides sideways to follow, so the
    // line can be moved anywhere. A placed marker stays put and the one being
    // dragged is held to the angle instead.
    if (other.placed) limitTilt(p, other, step.maxTiltDeg);
    else followTilt(other, p, step.maxTiltDeg);
  }
  p.placed = true;
  draw();
  drawLoupe(p);
}

// Keep the line from `anchor` to `p` within `maxDeg` of vertical, keeping its
// length, by rotating `p` around `anchor`.
function limitTilt(p, anchor, maxDeg) {
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  const len = Math.hypot(dx, dy);
  const max = (maxDeg * Math.PI) / 180;
  if (len === 0 || Math.atan2(Math.abs(dx), Math.abs(dy)) <= max) return;
  p.x = anchor.x + Math.sign(dx) * len * Math.sin(max);
  p.y = anchor.y + (dy < 0 ? -1 : 1) * len * Math.cos(max);
  p.x = clamp(p.x, 0, state.image.width);
  p.y = clamp(p.y, 0, state.image.height);
}

// Move `follower` sideways just enough to keep the line from `p` within
// `maxDeg` of vertical.
function followTilt(follower, p, maxDeg) {
  const maxDx = Math.abs(follower.y - p.y) * Math.tan((maxDeg * Math.PI) / 180);
  const dx = follower.x - p.x;
  if (Math.abs(dx) > maxDx) follower.x = p.x + Math.sign(dx) * maxDx;
}

// Magnified view above the finger, for precise placement on small screens.
// `p` is in image px.
function drawLoupe(p) {
  const size = loupe.width;
  const loupeZoom = 3;
  const srcSize = size / loupeZoom / (view.scale * view.zoom); // in image pixels

  loupeCtx.fillStyle = '#000';
  loupeCtx.fillRect(0, 0, size, size);
  loupeCtx.drawImage(
    state.image,
    p.x - srcSize / 2, p.y - srcSize / 2, srcSize, srcSize,
    0, 0, size, size,
  );
  // The measurement line, so its direction is visible while zoomed in
  const pts = state.points[currentStep().id];
  const toLoupe = (q) => ({
    x: ((q.x - p.x) / srcSize) * size + size / 2,
    y: ((q.y - p.y) / srcSize) * size + size / 2,
  });
  const a = toLoupe(pts[0]);
  const b = toLoupe(pts[1]);
  loupeCtx.save();
  loupeCtx.setLineDash([6, 4]);
  loupeCtx.lineWidth = 2;
  loupeCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  loupeCtx.beginPath();
  loupeCtx.moveTo(a.x, a.y);
  loupeCtx.lineTo(b.x, b.y);
  loupeCtx.stroke();
  loupeCtx.restore();

  loupeCtx.strokeStyle = currentStep().color;
  loupeCtx.lineWidth = 2;
  loupeCtx.beginPath();
  loupeCtx.moveTo(size / 2 - 12, size / 2);
  loupeCtx.lineTo(size / 2 + 12, size / 2);
  loupeCtx.moveTo(size / 2, size / 2 - 12);
  loupeCtx.lineTo(size / 2, size / 2 + 12);
  loupeCtx.stroke();

  const c = toCss(p);
  const offsetX = (canvas.offsetLeft || 0);
  let left = offsetX + c.x - 70;
  let top = c.y - 180;
  if (top < 0) top = c.y + 60; // flip below when near the top edge
  left = clamp(left, 0, $('canvas-wrap').clientWidth - 140);
  loupe.style.left = `${left}px`;
  loupe.style.top = `${top}px`;
  loupe.classList.remove('hidden');
}

// Pixelate the card once it has been marked so card numbers and names aren't
// visible for the rest of the steps. The photo never leaves the phone, but
// people may screenshot it. The marked line is the card's long edge, so the
// card is a rectangle around it with the standard 85.6 x 54 mm proportions.
const CARD_ASPECT = 53.98 / 85.6;

function blurCard() {
  const [a, b] = state.points.reference;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 10) return;
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const margin = 1.15; // cover marker placement error and rounded corners
  const w = len * margin;
  const h = len * CARD_ASPECT * margin;

  const img = document.createElement('canvas');
  img.width = state.original.width;
  img.height = state.original.height;
  const g = img.getContext('2d');
  g.drawImage(state.original, 0, 0);
  const blockSize = Math.max(6, len / 14);
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(img.width / blockSize));
  small.height = Math.max(1, Math.round(img.height / blockSize));
  const sctx = small.getContext('2d');
  sctx.drawImage(img, 0, 0, small.width, small.height);

  g.save();
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2);
  g.rotate(angle);
  g.beginPath();
  g.rect(-w / 2, -h / 2, w, h);
  g.rotate(-angle);
  g.translate(-(a.x + b.x) / 2, -(a.y + b.y) / 2);
  g.clip();
  g.imageSmoothingEnabled = false;
  g.drawImage(small, 0, 0, img.width, img.height);
  g.restore();
  state.image = img;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

$('next-btn').addEventListener('click', () => {
  if (currentStep().id === 'reference' && state.reference.id === 'card') blurCard();
  if (state.stepIndex < STEPS.length - 1) {
    state.stepIndex += 1;
    enterStep();
  } else {
    showResult();
  }
});

$('skip-btn').addEventListener('click', () => {
  delete state.points[currentStep().id];
  showResult();
});

$('back-btn').addEventListener('click', () => {
  if (state.stepIndex === 0) {
    showScreen('start');
  } else {
    state.stepIndex -= 1;
    enterStep();
  }
});

window.addEventListener('resize', () => {
  if (!$('screen-measure').classList.contains('hidden')) layoutCanvas();
});

// ---------- Result ----------

function distance(pts) {
  return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
}

// Where a hand length falls on the chart, as a fractional index:
// 0 = size 3 exactly, 1 = size 4 exactly, 5.5 = halfway between 8 and 9.
function chartPosition(lengthMm) {
  const last = SIZE_CHART.length - 1;
  if (lengthMm <= SIZE_CHART[0].mm) return 0;
  if (lengthMm >= SIZE_CHART[last].mm) return last;
  const i = SIZE_CHART.findIndex((row, idx) => lengthMm < SIZE_CHART[idx + 1].mm);
  return i + (lengthMm - SIZE_CHART[i].mm) / (SIZE_CHART[i + 1].mm - SIZE_CHART[i].mm);
}

// "9 (L)", or just "3" for sizes without a letter
function sizeName(row) {
  return row.letter ? `${row.label} (${row.letter})` : row.label;
}

function formatLength(mm) {
  return `${(mm / MM_PER_INCH).toFixed(2)} in · ${Math.round(mm)} mm`;
}

function showResult() {
  const refPx = distance(state.points.reference);
  if (refPx < 5) {
    alert('The two markers for your reference object are too close together. Please place them on its edges.');
    state.stepIndex = 0;
    enterStep();
    return;
  }
  const mmPerPx = state.reference.mm / refPx;
  const lengthMm = distance(state.points.length) * mmPerPx;

  const position = chartPosition(lengthMm);
  const lower = Math.floor(position);
  const fraction = position - lower;
  let note = '';
  let highlighted;

  if (fraction <= SNAP_TO_SIZE) {
    highlighted = [lower];
  } else if (fraction >= 1 - SNAP_TO_SIZE) {
    highlighted = [lower + 1];
  } else {
    highlighted = [lower, lower + 1];
    const small = sizeName(SIZE_CHART[lower]);
    const big = sizeName(SIZE_CHART[lower + 1]);
    note = `You're between sizes ${small} and ${big}. Choose ${small} for a tighter glove with better dexterity, or ${big} for a little more wiggle room and warmth.`;
  }
  const rows = highlighted.map((i) => SIZE_CHART[i]);

  const first = SIZE_CHART[0];
  const last = SIZE_CHART[SIZE_CHART.length - 1];
  if (lengthMm < 90 || lengthMm > 250) {
    note = "That measurement looks unusual. Check that the markers are on the right spots and that the object you chose matches the one in the photo.";
  } else if (lengthMm < first.mm - 5) {
    note = `Your hand is a little shorter than our smallest size (${sizeName(first)}), so that's the closest fit.`;
  } else if (lengthMm > last.mm + 5) {
    note = `Your hand is a little longer than our largest size (${sizeName(last)}), so that's the closest fit.`;
  }

  $('size-label').textContent = rows.map((r) => r.label).join(' / ');
  const letters = rows.filter((r) => r.letter).map((r) => r.letter).join(' / ');
  $('size-letter').textContent = letters;
  $('size-letter').classList.toggle('hidden', !letters);
  $('measured').textContent = `Your hand length: ${formatLength(lengthMm)}`;
  renderChart(lengthMm, highlighted);
  $('result-note').textContent = note;
  $('result-note').classList.toggle('hidden', !note);

  showScreen('result');
}

$('redo-btn').addEventListener('click', () => {
  state.stepIndex = 0;
  showScreen('measure');
  enterStep();
});

$('restart-btn').addEventListener('click', () => {
  state.image = null;
  state.original = null;
  state.points = {};
  showScreen('start');
});

// The official sizing chart, with the customer's size highlighted and a
// marker on a ruler showing where their hand length falls.
function renderChart(lengthMm, highlighted) {
  const first = SIZE_CHART[0].mm;
  const last = SIZE_CHART[SIZE_CHART.length - 1].mm;
  const pad = (last - first) * 0.06;
  const min = first - pad;
  const max = last + pad;
  const pct = (mm) => `${((clamp(mm, min, max) - min) / (max - min)) * 100}%`;

  const ticks = SIZE_CHART.map((row, i) => `
    <span class="tick${highlighted.includes(i) ? ' is-match' : ''}" style="left:${pct(row.mm)}">
      <span class="tick-label">${row.label}${row.letter ? `<small>${row.short || row.letter}</small>` : ''}</span>
    </span>`).join('');
  $('ruler').innerHTML = `
    <div class="ruler-track"></div>
    ${ticks}
    <span class="pin" style="left:${pct(lengthMm)}"><span class="pin-label">You</span></span>`;

  $('size-rows').innerHTML = SIZE_CHART.map((row, i) => {
    const match = highlighted.includes(i);
    let tag = 'Your size';
    if (highlighted.length > 1) tag = i === highlighted[0] ? 'Snug fit' : 'Roomy fit';
    return `<tr${match ? ' class="is-match"' : ''}>
      <td><span class="row-size">${row.label}</span><span class="row-letter">${row.letter || ''}</span>${match ? `<span class="your-size">${tag}</span>` : ''}</td>
      <td>${row.in} in <span class="mm">/ ${row.mm} mm</span></td>
    </tr>`;
  }).join('');
}

// ---------- Helpers ----------

function showScreen(name) {
  if (name !== 'camera') stopCamera();
  document.body.dataset.screen = name;
  for (const id of ['start', 'camera', 'measure', 'result']) {
    $(`screen-${id}`).classList.toggle('hidden', id !== name);
  }
  window.scrollTo(0, 0);
}

renderReferenceChoices();
