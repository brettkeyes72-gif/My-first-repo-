// Glove Size Finder
// Measures a hand from a single photo, using a known-size object for scale.

// Reference objects. `mm` is the real-world length the user marks on the photo.
const REFERENCES = [
  {
    id: 'card',
    icon: '💳',
    name: 'Credit card or ID card',
    detail: "Any standard bank card, debit card or driver's license",
    mm: 85.6,
    markHelp: 'Drag the two markers to the two ends of the card\'s long edge.',
  },
  {
    id: 'quarter',
    icon: '🪙',
    name: 'US quarter',
    detail: '25¢ coin',
    mm: 24.26,
    markHelp: 'Drag the two markers to opposite edges of the coin, straight across the middle.',
  },
  {
    id: 'penny',
    icon: '🪙',
    name: 'US penny',
    detail: '1¢ coin',
    mm: 19.05,
    markHelp: 'Drag the two markers to opposite edges of the coin, straight across the middle.',
  },
];

// Glove sizes by hand circumference around the knuckles (inches).
// Replace these with your own brand's chart if it differs.
const SIZE_CHART = [
  { label: 'XS', maxCircumference: 6.75, maxLength: 6.3 },
  { label: 'S', maxCircumference: 7.75, maxLength: 6.9 },
  { label: 'M', maxCircumference: 8.75, maxLength: 7.4 },
  { label: 'L', maxCircumference: 9.75, maxLength: 7.9 },
  { label: 'XL', maxCircumference: 10.75, maxLength: 8.4 },
  { label: 'XXL', maxCircumference: Infinity, maxLength: Infinity },
];

// A photo only shows palm width, so circumference is estimated from it.
// Circumference is roughly 2.5x the palm width once hand thickness is included.
const CIRCUMFERENCE_PER_WIDTH = 2.5;
const MM_PER_INCH = 25.4;
const MAX_IMAGE_SIDE = 2000;

const state = {
  reference: REFERENCES[0],
  image: null, // offscreen canvas holding the (downscaled) photo
  stepIndex: 0,
  points: {}, // step id -> [{x, y}, {x, y}] in image pixels
};

const STEPS = [
  {
    id: 'reference',
    title: () => `Mark the ${state.reference.id === 'card' ? 'card' : 'coin'}`,
    help: () => state.reference.markHelp,
    color: '#2563eb',
    start: [[0.35, 0.8], [0.65, 0.8]],
  },
  {
    id: 'width',
    title: () => 'Mark your palm width',
    help: () => 'Drag the markers to the outer edges of your hand, across the knuckles (not including your thumb).',
    color: '#dc2626',
    start: [[0.3, 0.45], [0.7, 0.45]],
  },
  {
    id: 'length',
    title: () => 'Mark your hand length (optional)',
    help: () => 'Drag one marker to the crease of your wrist and the other to the tip of your middle finger.',
    color: '#16a34a',
    start: [[0.5, 0.75], [0.5, 0.2]],
    optional: true,
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

$('photo-input').addEventListener('change', (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    // Browsers apply the photo's rotation (EXIF) when drawing, so it appears upright.
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const off = document.createElement('canvas');
    off.width = Math.round(img.naturalWidth * scale);
    off.height = Math.round(img.naturalHeight * scale);
    off.getContext('2d').drawImage(img, 0, 0, off.width, off.height);
    URL.revokeObjectURL(url);

    state.image = off;
    state.points = {};
    state.stepIndex = 0;
    showScreen('measure');
    enterStep();
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert("Sorry, that photo couldn't be opened. Please try another one.");
  };
  img.src = url;
});

// ---------- Measuring screen ----------

let view = { scale: 1, cssWidth: 0, cssHeight: 0 };

function layoutCanvas() {
  const img = state.image;
  const wrapWidth = $('canvas-wrap').clientWidth;
  const maxHeight = window.innerHeight * 0.6;
  const scale = Math.min(wrapWidth / img.width, maxHeight / img.height);
  const dpr = window.devicePixelRatio || 1;

  view = { scale, cssWidth: img.width * scale, cssHeight: img.height * scale };
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
  ctx.drawImage(state.image, 0, 0, view.cssWidth, view.cssHeight);

  STEPS.forEach((step, i) => {
    const pts = state.points[step.id];
    if (!pts || i > state.stepIndex) return;
    drawMeasurement(pts, step.color, i === state.stepIndex);
  });
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

function toCss(p) {
  return { x: p.x * view.scale, y: p.y * view.scale };
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Dragging. Touching anywhere picks up the nearest marker, so markers can be
// grabbed even when a finger covers them. The marker keeps its offset from the
// finger so it stays visible while moving.
let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  const pos = eventPos(event);
  const pts = state.points[currentStep().id];
  let nearest = 0;
  let best = Infinity;
  pts.forEach((p, i) => {
    const c = toCss(p);
    const d = Math.hypot(c.x - pos.x, c.y - pos.y);
    if (d < best) { best = d; nearest = i; }
  });
  const c = toCss(pts[nearest]);
  // A tap far from any marker jumps the nearest marker there.
  const offset = best < 44 ? { x: c.x - pos.x, y: c.y - pos.y } : { x: 0, y: 0 };
  drag = { index: nearest, offset, pointerId: event.pointerId };
  canvas.setPointerCapture(event.pointerId);
  moveDrag(pos);
  event.preventDefault();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  moveDrag(eventPos(event));
  event.preventDefault();
});

const endDrag = (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag = null;
  loupe.classList.add('hidden');
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function eventPos(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function moveDrag(pos) {
  const x = clamp(pos.x + drag.offset.x, 0, view.cssWidth);
  const y = clamp(pos.y + drag.offset.y, 0, view.cssHeight);
  const p = state.points[currentStep().id][drag.index];
  p.x = x / view.scale;
  p.y = y / view.scale;
  draw();
  drawLoupe({ x, y });
}

// Magnified view above the finger, for precise placement on small screens.
function drawLoupe(cssPoint) {
  const size = loupe.width;
  const zoom = 3;
  const srcSize = size / zoom / view.scale; // in image pixels
  const p = { x: cssPoint.x / view.scale, y: cssPoint.y / view.scale };

  loupeCtx.fillStyle = '#000';
  loupeCtx.fillRect(0, 0, size, size);
  loupeCtx.drawImage(
    state.image,
    p.x - srcSize / 2, p.y - srcSize / 2, srcSize, srcSize,
    0, 0, size, size,
  );
  loupeCtx.strokeStyle = currentStep().color;
  loupeCtx.lineWidth = 2;
  loupeCtx.beginPath();
  loupeCtx.moveTo(size / 2 - 12, size / 2);
  loupeCtx.lineTo(size / 2 + 12, size / 2);
  loupeCtx.moveTo(size / 2, size / 2 - 12);
  loupeCtx.lineTo(size / 2, size / 2 + 12);
  loupeCtx.stroke();

  const offsetX = (canvas.offsetLeft || 0);
  let left = offsetX + cssPoint.x - 70;
  let top = cssPoint.y - 180;
  if (top < 0) top = cssPoint.y + 60; // flip below when near the top edge
  left = clamp(left, 0, $('canvas-wrap').clientWidth - 140);
  loupe.style.left = `${left}px`;
  loupe.style.top = `${top}px`;
  loupe.classList.remove('hidden');
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

$('next-btn').addEventListener('click', () => {
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

function sizeIndexFor(value, key) {
  return SIZE_CHART.findIndex((row) => value < row[key]);
}

function formatNumericSize(inches) {
  return (Math.round(inches * 2) / 2).toFixed(1).replace(/\.0$/, '');
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

  const widthMm = distance(state.points.width) * mmPerPx;
  const circumferenceIn = (widthMm * CIRCUMFERENCE_PER_WIDTH) / MM_PER_INCH;
  const lengthMm = state.points.length ? distance(state.points.length) * mmPerPx : null;
  const lengthIn = lengthMm ? lengthMm / MM_PER_INCH : null;

  // Gloves have to fit both around the hand and along it, so take the larger size.
  const byCircumference = sizeIndexFor(circumferenceIn, 'maxCircumference');
  const byLength = lengthIn ? sizeIndexFor(lengthIn, 'maxLength') : -1;
  const sizeIndex = Math.max(byCircumference, byLength);
  const size = SIZE_CHART[sizeIndex];

  $('size-label').textContent = size.label;
  $('size-number').textContent = `Numeric size ${formatNumericSize(circumferenceIn)}`;

  const rows = [
    ['Palm width', `${(widthMm / 10).toFixed(1)} cm · ${(widthMm / MM_PER_INCH).toFixed(2)} in`],
    ['Est. hand circumference', `${(circumferenceIn * 2.54).toFixed(1)} cm · ${circumferenceIn.toFixed(2)} in`],
  ];
  if (lengthMm) {
    rows.push(['Hand length', `${(lengthMm / 10).toFixed(1)} cm · ${lengthIn.toFixed(2)} in`]);
  }
  $('stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  let note = '';
  if (widthMm < 55 || widthMm > 130) {
    note = "That measurement looks unusual. Check that the markers are on the right spots and that the object you chose matches the one in the photo.";
  } else if (byLength > byCircumference) {
    note = 'Your fingers are long for your palm width, so we sized up to make sure the fingers fit.';
  } else if (!lengthMm) {
    note = 'Tip: adding your hand length makes the recommendation more accurate.';
  }
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
  state.points = {};
  showScreen('start');
});

// ---------- Helpers ----------

function showScreen(name) {
  for (const id of ['start', 'measure', 'result']) {
    $(`screen-${id}`).classList.toggle('hidden', id !== name);
  }
  window.scrollTo(0, 0);
}

renderReferenceChoices();
