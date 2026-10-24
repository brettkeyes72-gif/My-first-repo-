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

// TRUCK glove sizing chart: hand length (tip of longest finger to crease of
// wrist) for each glove size, from truckgloves.com.
const SIZE_CHART = [
  { label: '3', mm: 120 },
  { label: '4', mm: 134 },
  { label: '5', mm: 146 },
  { label: '6', mm: 160 },
  { label: '7', mm: 171 },
  { label: '8', mm: 182 },
  { label: '9', mm: 192 },
  { label: '10', mm: 204 },
  { label: '11', mm: 215 },
];

// How close (as a share of the gap to the next size) a hand has to be to a
// size before we call it that size rather than "between sizes".
const SNAP_TO_SIZE = 0.25;
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
    color: '#38bdf8',
    start: [[0.35, 0.8], [0.65, 0.8]],
  },
  {
    id: 'length',
    title: () => 'Mark your hand length',
    help: () => 'Drag one marker to the crease of your wrist and the other to the tip of your longest finger.',
    color: '#ffc20e',
    start: [[0.5, 0.75], [0.5, 0.2]],
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

// Where a hand length falls on the chart, as a fractional index:
// 0 = size 3 exactly, 1 = size 4 exactly, 5.5 = halfway between 8 and 9.
function chartPosition(lengthMm) {
  const last = SIZE_CHART.length - 1;
  if (lengthMm <= SIZE_CHART[0].mm) return 0;
  if (lengthMm >= SIZE_CHART[last].mm) return last;
  const i = SIZE_CHART.findIndex((row, idx) => lengthMm < SIZE_CHART[idx + 1].mm);
  return i + (lengthMm - SIZE_CHART[i].mm) / (SIZE_CHART[i + 1].mm - SIZE_CHART[i].mm);
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
  let label;
  let note = '';

  let highlighted;

  if (fraction <= SNAP_TO_SIZE) {
    label = SIZE_CHART[lower].label;
    highlighted = [lower];
  } else if (fraction >= 1 - SNAP_TO_SIZE) {
    label = SIZE_CHART[lower + 1].label;
    highlighted = [lower + 1];
  } else {
    highlighted = [lower, lower + 1];
    const small = SIZE_CHART[lower].label;
    const big = SIZE_CHART[lower + 1].label;
    label = `${small} / ${big}`;
    note = `You're between sizes ${small} and ${big}. Choose ${small} for a tighter glove with better dexterity, or ${big} for a little more wiggle room and warmth.`;
  }

  const first = SIZE_CHART[0];
  const last = SIZE_CHART[SIZE_CHART.length - 1];
  if (lengthMm < 90 || lengthMm > 250) {
    note = "That measurement looks unusual. Check that the markers are on the right spots and that the object you chose matches the one in the photo.";
  } else if (lengthMm < first.mm - 5) {
    note = `Your hand is a little shorter than our smallest size (${first.label}), so that's the closest fit.`;
  } else if (lengthMm > last.mm + 5) {
    note = `Your hand is a little longer than our largest size (${last.label}), so that's the closest fit.`;
  }

  $('size-label').textContent = label;
  $('size-number').textContent = 'TRUCK glove size';
  drawGauge(position, highlighted);

  const rows = [['Hand length', formatLength(lengthMm)]];
  $('stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
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

// Dashboard-style gauge: one segment per size, needle at the measured length.
function drawGauge(position, highlighted) {
  const svg = $('gauge');
  const cx = 150;
  const cy = 165;
  const r = 118;
  const n = SIZE_CHART.length;
  const startDeg = 180;
  const sweep = 180;
  const gap = 2; // degrees between segments

  const polar = (deg, radius) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) };
  };
  const arc = (fromDeg, toDeg, radius) => {
    const a = polar(fromDeg, radius);
    const b = polar(toDeg, radius);
    return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y}`;
  };

  // Each size sits in the middle of its segment.
  const needleDeg = startDeg - ((position + 0.5) / n) * sweep;

  let parts = '';
  // Bezel
  parts += `<path d="${arc(180, 0, r + 22)}" fill="none" stroke="#111214" stroke-width="8" />`;
  for (let i = 0; i < n; i++) {
    const from = startDeg - (i / n) * sweep - (i === 0 ? 0 : gap / 2);
    const to = startDeg - ((i + 1) / n) * sweep + (i === n - 1 ? 0 : gap / 2);
    const active = highlighted.includes(i);
    parts += `<path d="${arc(from, to, r)}" fill="none" stroke="${active ? '#ffc20e' : '#3a3e45'}" stroke-width="26" />`;
    const mid = polar((from + to) / 2, r + 0.5);
    parts += `<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="central" font-family="Bebas Neue, Impact, sans-serif" font-size="16" fill="${active ? '#111214' : '#a7a9ad'}">${SIZE_CHART[i].label}</text>`;
  }
  // Minor ticks
  for (let t = 0; t <= n * 4; t++) {
    const deg = startDeg - (t / (n * 4)) * sweep;
    const a = polar(deg, r - 22);
    const b = polar(deg, r - (t % 4 === 0 ? 34 : 28));
    parts += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#6b7078" stroke-width="${t % 4 === 0 ? 2 : 1}" />`;
  }
  // Needle and hub
  const tip = polar(needleDeg, r - 6);
  const tail = polar(needleDeg + 180, 14);
  parts += `<line x1="${tail.x}" y1="${tail.y}" x2="${tip.x}" y2="${tip.y}" stroke="#ff6a13" stroke-width="5" stroke-linecap="round" />`;
  parts += `<circle cx="${cx}" cy="${cy}" r="12" fill="#111214" stroke="#6b7078" stroke-width="2" />`;
  parts += `<circle cx="${cx}" cy="${cy}" r="4" fill="#ff6a13" />`;

  svg.innerHTML = parts;
}

// ---------- Helpers ----------

function showScreen(name) {
  for (const id of ['start', 'measure', 'result']) {
    $(`screen-${id}`).classList.toggle('hidden', id !== name);
  }
  window.scrollTo(0, 0);
}

renderReferenceChoices();
