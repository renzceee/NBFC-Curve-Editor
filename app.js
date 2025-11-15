const bundledJsonUrl = 'Acer Nitro AN515-58.json';
const statusPanel = document.getElementById('statusPanel');
const generalForm = document.getElementById('generalForm');
const fanCards = document.getElementById('fanCards');
const generalSection = document.getElementById('generalSection');
const fanSection = document.getElementById('fanSection');
const registerSection = document.getElementById('registerSection');
const registerList = document.getElementById('registerList');
const downloadBtn = document.getElementById('downloadJson');
const applyBtn = document.getElementById('applyConfig');
const addRegisterBtn = document.getElementById('addRegisterEntry');
const filePicker = document.getElementById('filePicker');
const advancedToggle = document.getElementById('advancedToggle');
const toastContainer = document.getElementById('toastContainer');

const TEMP_MIN = 0;
const TEMP_MAX = 110;
const SPEED_MIN = 0;
const SPEED_MAX = 100;
const CURVE_PADDING = 40;
const CURVE_WIDTH = 760;
const CURVE_HEIGHT = 320;

const fanStates = new Map();

let baselineData = null;
let currentData = null;
let contentVisible = false;
let currentFileName = 'fan-profile.json';

window.addEventListener('error', (event) => {
  if (!statusPanel) return;
  statusPanel.textContent = `Runtime error: ${event.message}`;
  statusPanel.className = 'status-panel error';
});

window.addEventListener('resize', handleWindowResize);

init();

function init() {
  attachEvents();
  setContentVisible(false);
  setStatus('Load an NBFC fan curve to edit.');
}

async function applyCurrentConfig() {
  if (!currentData) {
    setStatus('No profile loaded to apply.', true);
    showToast('Load a profile before applying.', 'error');
    return;
  }
  try {
    const response = await fetch('http://localhost:3000/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: currentData,
        fileName: currentFileName || `${currentData.NotebookModel || 'fan-profile'}.json`,
      }),
    });
    const result = await response.json();
    if (!response.ok || result.status !== 'ok') {
      throw new Error(result.message || 'Apply helper reported an error.');
    }
    setStatus('Curve applied via helper.', false, true);
    showToast('Apply command sent.', 'success');
  } catch (err) {
    setStatus(`Failed to apply curve: ${err.message}`, true);
    showToast('Apply failed.', 'error');
  }
}

function attachEvents() {
  filePicker.addEventListener('change', handleFileUpload);
  downloadBtn.addEventListener('click', downloadCurrentJson);
  applyBtn.addEventListener('click', applyCurrentConfig);
  addRegisterBtn.addEventListener('click', addRegisterEntry);
  if (advancedToggle) {
    advancedToggle.addEventListener('change', () => {
      setAdvancedVisible(advancedToggle.checked);
    });
  }
}

async function loadBundledJson() {
  try {
    setStatus('Loading bundled JSON…');
    const res = await fetch(bundledJsonUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setData(data, 'Bundled profile loaded.');
  } catch (err) {
    setStatus(`Failed to load bundled JSON: ${err.message}`, true);
  }
}

function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      currentFileName = file.name;
      setData(parsed, `Loaded ${file.name}.`);
    } catch (err) {
      setStatus(`Invalid JSON: ${err.message}`, true);
    }
  };
  reader.readAsText(file);
}

function setData(data, message) {
  const cloned = JSON.parse(JSON.stringify(data));
  currentData = cloned;
  baselineData = JSON.parse(JSON.stringify(data));
  normalizeAllCurves(currentData);
  normalizeAllCurves(baselineData);
  fanStates.clear();
  renderGeneral(currentData);
  renderFans(currentData);
  renderRegisters(currentData);
  setContentVisible(true);
  setAdvancedVisible(advancedToggle?.checked ?? false);
  downloadBtn.disabled = false;
  applyBtn.disabled = false;
  setStatus(message, false, true);
}

function setAdvancedVisible(visible) {
  if (!contentVisible) {
    document.querySelectorAll('[data-advanced="true"]').forEach((el) => {
      el.style.display = 'none';
    });
    return;
  }
  const sections = document.querySelectorAll('[data-advanced="true"]');
  sections.forEach((el) => {
    el.style.display = visible ? '' : 'none';
  });
}

function setStatus(message, isError = false, isSuccess = false) {
  statusPanel.textContent = message;
  statusPanel.className = 'status-panel';
  if (isError) statusPanel.classList.add('error');
  else if (isSuccess) statusPanel.classList.add('success');
}

function showToast(message, type = 'success') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`.trim();
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade');
  }, 2800);
  setTimeout(() => {
    toast.remove();
  }, 3400);
}

function setContentVisible(visible) {
  contentVisible = visible;
  if (fanSection) fanSection.style.display = visible ? '' : 'none';
  if (generalSection) generalSection.style.display = visible ? '' : 'none';
  if (registerSection) registerSection.style.display = visible ? '' : 'none';

  if (!visible) {
    fanCards.innerHTML = '';
    generalForm.innerHTML = '';
    registerList.innerHTML = '';
    downloadBtn.disabled = true;
    applyBtn.disabled = true;
  } else {
    setAdvancedVisible(advancedToggle?.checked ?? false);
  }
}

function renderGeneral(data) {
  generalForm.innerHTML = '';
  const fields = [
    ['NotebookModel', 'text'],
    ['Author', 'text'],
    ['EcPollInterval', 'number'],
    ['CriticalTemperature', 'number'],
    ['CriticalTemperatureOffset', 'number'],
    ['ReadWriteWords', 'checkbox'],
  ];
  fields.forEach(([key, type]) => {
    const label = document.createElement('label');
    label.innerHTML = `<span>${key}</span>`;
    const input = document.createElement('input');
    input.type = type;
    if (type === 'checkbox') {
      input.checked = Boolean(data[key]);
      input.addEventListener('change', () => (currentData[key] = input.checked));
    } else {
      input.value = data[key];
      input.addEventListener('input', () => (currentData[key] = parseValue(input.value, type)));
    }
    label.appendChild(input);
    generalForm.appendChild(label);
  });
}

function renderFans(data) {
  fanCards.innerHTML = '';
  data.FanConfigurations.forEach((fan, index) => {
    const card = document.createElement('article');
    card.className = 'fan-card';
    card.appendChild(createFanHeader(fan, index));
    card.appendChild(createFanBody(fan, index));
    fanCards.appendChild(card);
  });
}

function createFanHeader(fan, index) {
  const header = document.createElement('div');
  header.className = 'fan-card-header';
  const title = document.createElement('h3');
  title.textContent = fan.FanDisplayName || `Fan ${index + 1}`;
  header.appendChild(title);
  return header;
}

function createFanBody(fan, index) {
  const container = document.createElement('div');
  const fields = [
    ['FanDisplayName', 'text'],
    ['ReadRegister', 'number'],
    ['WriteRegister', 'number'],
    ['MinSpeedValue', 'number'],
    ['MaxSpeedValue', 'number'],
    ['MinSpeedValueRead', 'number'],
    ['MaxSpeedValueRead', 'number'],
    ['IndependentReadMinMaxValues', 'checkbox'],
    ['ResetRequired', 'checkbox'],
    ['FanSpeedResetValue', 'number'],
  ];
  const grid = document.createElement('div');
  grid.className = 'form-grid';
  grid.setAttribute('data-advanced', 'true');
  fields.forEach(([key, type]) => {
    const label = document.createElement('label');
    label.innerHTML = `<span>${key}</span>`;
    const input = document.createElement('input');
    input.type = type;
    const currentValue = fan[key];
    if (type === 'checkbox') {
      input.checked = Boolean(currentValue);
      input.addEventListener('change', () => (currentData.FanConfigurations[index][key] = input.checked));
    } else {
      input.value = currentValue;
      input.addEventListener('input', () => {
        currentData.FanConfigurations[index][key] = parseValue(input.value, type);
      });
    }
    label.appendChild(input);
    grid.appendChild(label);
  });
  container.appendChild(grid);
  container.appendChild(createCurveSection(fan, index));
  return container;
}

function createCurveSection(fan, fanIndex) {
  const section = document.createElement('section');
  section.className = 'curve-section';

  const header = document.createElement('div');
  header.className = 'curve-header';
  header.innerHTML = '<h4>Curve editor</h4><p>Drag points on the graph or use the inputs to fine-tune temperatures and fan speeds.</p>';
  section.appendChild(header);

  const canvas = document.createElement('canvas');
  canvas.className = 'curve-canvas';
  section.appendChild(canvas);

  const controls = document.createElement('div');
  controls.className = 'curve-controls';

  const tempLabel = document.createElement('label');
  tempLabel.innerHTML = '<span>Temperature (°C)</span>';
  const tempInput = document.createElement('input');
  tempInput.type = 'number';
  tempInput.min = TEMP_MIN;
  tempInput.max = TEMP_MAX;
  tempInput.step = 1;
  tempLabel.appendChild(tempInput);

  const speedLabel = document.createElement('label');
  speedLabel.innerHTML = '<span>Fan speed (%)</span>';
  const speedInput = document.createElement('input');
  speedInput.type = 'number';
  speedInput.min = SPEED_MIN;
  speedInput.max = SPEED_MAX;
  speedInput.step = 0.5;
  speedLabel.appendChild(speedInput);

  const infoLabel = document.createElement('label');
  infoLabel.innerHTML = '<span>Selected point</span>';
  const infoDisplay = document.createElement('div');
  infoDisplay.className = 'curve-info';
  infoDisplay.textContent = 'Click or drag any point to start editing.';
  infoLabel.appendChild(infoDisplay);

  controls.append(tempLabel, speedLabel, infoLabel);
  section.appendChild(controls);

  const actions = document.createElement('div');
  actions.className = 'curve-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'primary';
  addBtn.textContent = 'Add point';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'ghost danger';
  removeBtn.textContent = 'Remove point';

  const resetBtn = document.createElement('button');
  resetBtn.className = 'ghost';
  resetBtn.textContent = 'Reset to stock';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'ghost';
  copyBtn.textContent = 'Copy curve';

  const pasteBtn = document.createElement('button');
  pasteBtn.className = 'ghost';
  pasteBtn.textContent = 'Paste curve';

  actions.append(addBtn, removeBtn, resetBtn, copyBtn, pasteBtn);
  section.appendChild(actions);

  const elements = { canvas, tempInput, speedInput, infoDisplay, removeBtn };
  const state = initializeFanCurveState(fanIndex, fan, elements);

  tempInput.addEventListener('input', () => handleTempInput(state));
  speedInput.addEventListener('input', () => handleSpeedInput(state));
  addBtn.addEventListener('click', () => addCurvePoint(fanIndex));
  removeBtn.addEventListener('click', () => removeCurvePoint(fanIndex));
  resetBtn.addEventListener('click', () => resetFanCurve(fanIndex));
  copyBtn.addEventListener('click', () => copyCurveWithoutBoundaries(fanIndex));
  pasteBtn.addEventListener('click', () => pasteCurveWithoutBoundaries(fanIndex));

  return section;
}

function initializeFanCurveState(fanIndex, fan, elements) {
  const points = fanPointsFromData(fan);
  const existingState = fanStates.get(fanIndex);
  const state = {
    fanIndex,
    canvas: elements.canvas,
    ctx: null,
    width: CURVE_WIDTH,
    height: CURVE_HEIGHT,
    points,
    tempMin: TEMP_MIN,
    tempMax: TEMP_MAX,
    speedMin: SPEED_MIN,
    speedMax: SPEED_MAX,
    selectedIndex: null,
    draggingIndex: null,
    hoverIndex: null,
    elements,
    resizeObserver: existingState?.resizeObserver ?? null,
  };

  // derive per-fan ranges so the curve uses the available canvas space
  if (points.length) {
    const temps = points.map((p) => p.temp);
    const speeds = points.map((p) => p.speed);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);
    state.tempMin = minTemp === maxTemp ? TEMP_MIN : minTemp;
    state.tempMax = minTemp === maxTemp ? TEMP_MAX : maxTemp;
    state.speedMin = minSpeed === maxSpeed ? SPEED_MIN : minSpeed;
    state.speedMax = minSpeed === maxSpeed ? SPEED_MAX : maxSpeed;
  }

  state.selectedIndex = Math.min(
    existingState?.selectedIndex ?? (points.length > 2 ? 1 : 0),
    points.length - 1
  );

  configureCurveCanvas(state);
  attachCurveEventHandlers(state);
  attachResizeObserver(state);
  fanStates.set(fanIndex, state);
  updateCurveControls(state);
  drawFanCurve(state);
  return state;
}

function configureCurveCanvas(state) {
  const dpr = window.devicePixelRatio || 1;
  const parentRect = state.canvas.getBoundingClientRect();
  const logicalWidth = Math.max(parentRect.width || CURVE_WIDTH, 320);
  const logicalHeight = Math.max(parentRect.height || CURVE_HEIGHT * (logicalWidth / CURVE_WIDTH), 200);
  state.canvas.width = logicalWidth * dpr;
  state.canvas.height = logicalHeight * dpr;
  const ctx = state.canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.ctx = ctx;
  state.width = logicalWidth;
  state.height = logicalHeight;
}

function attachCurveEventHandlers(state) {
  const canvas = state.canvas;

  canvas.addEventListener('pointerdown', (event) => handleCurvePointerDown(event, state));
  canvas.addEventListener('pointermove', (event) => handleCurvePointerMove(event, state));
  canvas.addEventListener('pointerup', (event) => handleCurvePointerUp(event, state));
  canvas.addEventListener('pointerleave', (event) => handleCurvePointerUp(event, state));
}

function handleCurvePointerDown(event, state) {
  event.preventDefault();
  const pointer = getPointerPosition(event, state);
  const hitIndex = hitTestPoint(pointer, state);

  if (hitIndex !== null) {
    state.selectedIndex = hitIndex;
    state.draggingIndex = hitIndex;
    state.canvas.setPointerCapture(event.pointerId);
    updatePointFromPointer(pointer, state);
  } else {
    state.selectedIndex = null;
    updateCurveControls(state);
    drawFanCurve(state);
  }
}

function handleCurvePointerMove(event, state) {
  const pointer = getPointerPosition(event, state);
  if (state.draggingIndex !== null) {
    updatePointFromPointer(pointer, state);
    return;
  }

  const hitIndex = hitTestPoint(pointer, state);
  if (hitIndex !== state.hoverIndex) {
    state.hoverIndex = hitIndex;
    drawFanCurve(state);
  }
}

function handleCurvePointerUp(event, state) {
  if (state.draggingIndex !== null) {
    try {
      state.canvas.releasePointerCapture(event.pointerId);
    } catch (err) {
      /* ignore */
    }
  }
  state.draggingIndex = null;
  state.hoverIndex = null;
  updateCurveControls(state);
  drawFanCurve(state);
}

function updatePointFromPointer(position, state) {
  const idx = state.draggingIndex;
  if (idx === null || idx === undefined) return;
  const dataPoint = pointerToData(position, state);
  const isBoundary = idx === 0 || idx === state.points.length - 1;

  if (!isBoundary) {
    state.points[idx].temp = clampPointTemperature(state, idx, Math.round(dataPoint.temp));
  }
  state.points[idx].speed = clampPointSpeed(dataPoint.speed);

  persistFanCurve(state);
  updateCurveControls(state);
  drawFanCurve(state);
}

function handleTempInput(state) {
  const idx = state.selectedIndex;
  if (idx === null || idx === undefined) return;
  if (idx === 0 || idx === state.points.length - 1) return;
  const value = Number(state.elements.tempInput.value);
  if (Number.isNaN(value)) return;
  state.points[idx].temp = clampPointTemperature(state, idx, Math.round(value));
  persistFanCurve(state);
  updateCurveControls(state);
  drawFanCurve(state);
}

function handleSpeedInput(state) {
  const idx = state.selectedIndex;
  if (idx === null || idx === undefined) return;
  const value = Number(state.elements.speedInput.value);
  if (Number.isNaN(value)) return;
  state.points[idx].speed = clampPointSpeed(value);
  persistFanCurve(state);
  updateCurveControls(state);
  drawFanCurve(state);
}

function addCurvePoint(fanIndex) {
  const state = fanStates.get(fanIndex);
  if (!state) return;
  if (state.points.length < 2) return;

  const baseIndex = Math.min(state.selectedIndex ?? state.points.length - 2, state.points.length - 2);
  const nextIndex = baseIndex + 1;
  const prevPoint = state.points[baseIndex];
  const nextPoint = state.points[nextIndex];
  if (!nextPoint) return;

  if (nextPoint.temp - prevPoint.temp <= 1) {
    setStatus('Not enough temperature gap to add a new point.', true);
    return;
  }

  const newTemp = Math.round((prevPoint.temp + nextPoint.temp) / 2);
  const newSpeed = Number(((prevPoint.speed + nextPoint.speed) / 2).toFixed(1));
  state.points.splice(nextIndex, 0, { temp: newTemp, speed: newSpeed });
  state.selectedIndex = nextIndex;

  persistFanCurve(state);
  updateCurveControls(state);
  drawFanCurve(state);
  setStatus('Point added.', false, true);
  showToast('Point added.', 'success');
}

function removeCurvePoint(fanIndex) {
  const state = fanStates.get(fanIndex);
  if (!state || state.selectedIndex === null || state.selectedIndex === undefined) return;
  const idx = state.selectedIndex;
  if (idx === 0 || idx === state.points.length - 1) {
    setStatus('Boundary points cannot be removed.', true);
    return;
  }
  state.points.splice(idx, 1);
  state.selectedIndex = Math.min(idx, state.points.length - 2);

  persistFanCurve(state);
  updateCurveControls(state);
  drawFanCurve(state);
  setStatus('Point removed.', false, true);
  showToast('Point removed.', 'success');
}

function resetFanCurve(fanIndex) {
  if (!baselineData) return;
  const fan = currentData.FanConfigurations[fanIndex];
  const baselineFan = baselineData.FanConfigurations?.[fanIndex];
  if (!fan || !baselineFan) return;

  fan.TemperatureThresholds = baselineFan.TemperatureThresholds.map((t) => ({
    UpThreshold: t.UpThreshold,
    DownThreshold: t.DownThreshold,
    FanSpeed: t.FanSpeed,
  }));
  normalizeFanCurve(fan);

  const state = fanStates.get(fanIndex);
  if (!state) return;
  state.points = fanPointsFromData(fan);
  state.selectedIndex = Math.min(state.selectedIndex ?? (state.points.length > 2 ? 1 : 0), state.points.length - 1);

  persistFanCurve(state);
  updateCurveControls(state);
  drawFanCurve(state);
  setStatus('Fan curve reset to stock.', false, true);
  showToast('Reset to stock.', 'success');
}

async function copyCurveWithoutBoundaries(fanIndex) {
  const fan = currentData?.FanConfigurations?.[fanIndex];
  if (!fan) {
    setStatus('No fan data available to copy.', true);
    showToast('No fan data to copy.', 'error');
    return;
  }
  const thresholds = fan.TemperatureThresholds || [];
  if (thresholds.length <= 2) {
    setStatus('Not enough points to copy (need interior points).', true);
    showToast('Need interior points to copy.', 'error');
    return;
  }
  const interiorPoints = thresholds.slice(1, -1).map((t) => ({
    UpThreshold: t.UpThreshold,
    DownThreshold: t.DownThreshold,
    FanSpeed: t.FanSpeed,
  }));
  try {
    await navigator.clipboard.writeText(JSON.stringify(interiorPoints, null, 2));
    setStatus('Curve copied (without boundaries).', false, true);
    showToast('Copy curve success.', 'success');
  } catch (err) {
    setStatus(`Copy failed: ${err.message}`, true);
    showToast('Copy curve failed.', 'error');
  }
}

async function pasteCurveWithoutBoundaries(fanIndex) {
  const state = fanStates.get(fanIndex);
  const fan = currentData?.FanConfigurations?.[fanIndex];
  if (!state || !fan) {
    setStatus('No fan data available to paste.', true);
    showToast('No fan data to paste.', 'error');
    return;
  }
  try {
    const clipboardText = await navigator.clipboard.readText();
    const parsed = JSON.parse(clipboardText);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Clipboard does not contain a curve array.');
    }
    const thresholds = fan.TemperatureThresholds || [];
    if (thresholds.length < 2) {
      setStatus('Current curve missing boundaries.', true);
      showToast('Current curve missing boundaries.', 'error');
      return;
    }
    const start = thresholds[0];
    const end = thresholds[thresholds.length - 1];
    const interiorPoints = parsed
      .map((point) => ({
        temp: clampNumber(Math.round(point.UpThreshold ?? point.temp ?? start.UpThreshold), start.UpThreshold + 1, end.UpThreshold - 1),
        speed: clampPointSpeed(point.FanSpeed ?? point.speed ?? start.FanSpeed ?? 0),
      }))
      .sort((a, b) => a.temp - b.temp)
      .filter((point, idx, arr) => idx === 0 || point.temp > arr[idx - 1].temp);

    const newPoints = [
      { temp: start.UpThreshold, speed: start.FanSpeed },
      ...interiorPoints,
      { temp: end.UpThreshold, speed: end.FanSpeed },
    ];

    state.points = newPoints;
    persistFanCurve(state);
    updateCurveControls(state);
    drawFanCurve(state);
    setStatus('Curve pasted.', false, true);
    showToast('Paste curve success.', 'success');
  } catch (err) {
    setStatus(`Paste failed: ${err.message}`, true);
    showToast('Paste curve failed.', 'error');
  }
}

function persistFanCurve(state) {
  const fan = currentData.FanConfigurations[state.fanIndex];
  fan.TemperatureThresholds = state.points.map((point, idx) => ({
    UpThreshold: point.temp,
    DownThreshold: idx === 0 ? TEMP_MIN : state.points[idx - 1].temp,
    FanSpeed: point.speed,
  }));
}

function updateCurveControls(state) {
  const point = state.points[state.selectedIndex ?? -1];
  const { tempInput, speedInput, infoDisplay, removeBtn } = state.elements;

  if (!point) {
    tempInput.value = '';
    tempInput.disabled = true;
    speedInput.value = '';
    speedInput.disabled = true;
    infoDisplay.textContent = 'Click any point on the graph to edit it.';
    removeBtn.disabled = true;
    return;
  }

  const isBoundary = state.selectedIndex === 0 || state.selectedIndex === state.points.length - 1;
  tempInput.disabled = isBoundary;
  tempInput.value = point.temp;
  speedInput.disabled = false;
  speedInput.value = point.speed;
  infoDisplay.textContent = `${point.temp}°C → ${point.speed}% ${isBoundary ? '(boundary)' : ''}`;
  removeBtn.disabled = isBoundary || state.points.length <= 2;
}

function drawFanCurve(state) {
  const ctx = state.ctx;
  if (!ctx) return;
  ctx.clearRect(0, 0, state.width, state.height);
  drawCurveGrid(ctx, state);

  const baselinePoints = baselineData?.FanConfigurations?.[state.fanIndex]
    ? fanPointsFromData(baselineData.FanConfigurations[state.fanIndex])
    : null;
  if (baselinePoints) {
    drawCurvePath(ctx, state, baselinePoints, {
      color: 'rgba(148, 163, 184, 0.5)',
      width: 2,
      dash: [6, 6],
    });
  }

  drawCurvePath(ctx, state, state.points, {
    color: '#4f8bff',
    width: 3,
  });
  drawCurvePoints(ctx, state);
}

function drawCurveGrid(ctx, state) {
  const area = getCurveArea(state);
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;

  const horizontalSteps = 4;
  for (let i = 0; i <= horizontalSteps; i += 1) {
    const y = area.top + ((area.bottom - area.top) / horizontalSteps) * i;
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.right, y);
    ctx.stroke();
  }

  const verticalSteps = 5;
  for (let i = 0; i <= verticalSteps; i += 1) {
    const x = area.left + ((area.right - area.left) / verticalSteps) * i;
    ctx.beginPath();
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.bottom);
    ctx.stroke();
  }
  // axis labels (temperature and speed ranges)
  ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
  ctx.font = '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(`${Math.round(state.tempMin)}°C`, area.left, area.bottom + 6);
  const maxTempLabel = `${Math.round(state.tempMax)}°C`;
  const tempWidth = ctx.measureText(maxTempLabel).width;
  ctx.fillText(maxTempLabel, area.right - tempWidth, area.bottom + 6);

  // temperature ticks every 10°C within the current range
  ctx.textBaseline = 'top';
  const tempStep = 10;
  for (let t = Math.ceil(state.tempMin / tempStep) * tempStep; t < state.tempMax; t += tempStep) {
    const x = mapRange(t, state.tempMin, state.tempMax, area.left, area.right);
    ctx.beginPath();
    ctx.moveTo(x, area.bottom);
    ctx.lineTo(x, area.bottom + 4);
    ctx.stroke();
    const label = `${t}°`;
    const w = ctx.measureText(label).width;
    ctx.fillText(label, x - w / 2, area.bottom + 6);
  }

  ctx.textBaseline = 'middle';
  const maxSpeedLabel = `${Math.round(state.speedMax)}%`;
  const minSpeedLabel = `${Math.round(state.speedMin)}%`;
  ctx.fillText(maxSpeedLabel, area.left - ctx.measureText(maxSpeedLabel).width - 6, area.top);
  ctx.fillText(minSpeedLabel, area.left - ctx.measureText(minSpeedLabel).width - 6, area.bottom);

  // speed ticks every 10% within the current range
  const speedStep = 10;
  for (let s = Math.ceil(state.speedMin / speedStep) * speedStep; s < state.speedMax; s += speedStep) {
    const y = mapRange(s, state.speedMax, state.speedMin, area.top, area.bottom);
    ctx.beginPath();
    ctx.moveTo(area.left - 4, y);
    ctx.lineTo(area.left, y);
    ctx.stroke();
    const label = `${s}%`;
    const w = ctx.measureText(label).width;
    ctx.fillText(label, area.left - w - 8, y);
  }

  ctx.restore();
}

function drawCurvePath(ctx, state, points, { color, width, dash = [] }) {
  if (!points?.length) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((point, idx) => {
    const coords = getPointCanvasCoords(point, state);
    if (idx === 0) ctx.moveTo(coords.x, coords.y);
    else ctx.lineTo(coords.x, coords.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawCurvePoints(ctx, state) {
  const area = getCurveArea(state);
  state.points.forEach((point, idx) => {
    const coords = getPointCanvasCoords(point, state);
    const isSelected = idx === state.selectedIndex;
    const isHover = idx === state.hoverIndex;
    const isBoundary = idx === 0 || idx === state.points.length - 1;
    const radius = isSelected ? 7 : isHover ? 6 : 5;

    ctx.save();
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#4f8bff' : isBoundary ? 'rgba(148, 163, 184, 0.9)' : '#f5f7ff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(5, 7, 14, 0.8)';
    ctx.stroke();
    ctx.restore();

    // draw small label with temp and speed next to each point
    const label = `${Math.round(point.temp)}° / ${point.speed.toFixed(1)}%`;
    ctx.save();
    ctx.font = '10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    let baseLine = 'bottom';
    let labelX = coords.x + 6;
    let labelY = coords.y - 6;
    const labelWidth = ctx.measureText(label).width;

    if (labelX + labelWidth > area.right) labelX = area.right - labelWidth - 4;
    if (labelX < area.left) labelX = area.left + 4;
    if (labelY < area.top + 6) {
      baseLine = 'top';
      labelY = coords.y + 12;
    }
    if (labelY > area.bottom - 4) labelY = area.bottom - 4;

    ctx.textBaseline = baseLine;
    ctx.fillText(label, labelX, labelY);
    ctx.restore();
  });
}

function getPointerPosition(event, state) {
  const rect = state.canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * state.width;
  const y = ((event.clientY - rect.top) / rect.height) * state.height;
  return { x, y };
}

function hitTestPoint(position, state) {
  const radius = 10;
  for (let i = 0; i < state.points.length; i += 1) {
    const coords = getPointCanvasCoords(state.points[i], state);
    const distance = Math.hypot(coords.x - position.x, coords.y - position.y);
    if (distance <= radius) return i;
  }
  return null;
}

function pointerToData(position, state) {
  const area = getCurveArea(state);
  const clampedX = clampNumber(position.x, area.left, area.right);
  const clampedY = clampNumber(position.y, area.top, area.bottom);
  const temp = mapRange(clampedX, area.left, area.right, state.tempMin, state.tempMax);
  const speed = mapRange(clampedY, area.bottom, area.top, state.speedMin, state.speedMax);
  return { temp, speed };
}

function getCurveArea(state) {
  return {
    left: CURVE_PADDING,
    right: state.width - CURVE_PADDING,
    top: CURVE_PADDING,
    bottom: state.height - CURVE_PADDING,
  };
}

function getPointCanvasCoords(point, state) {
  const area = getCurveArea(state);
  const x = mapRange(point.temp, state.tempMin, state.tempMax, area.left, area.right);
  const y = mapRange(point.speed, state.speedMax, state.speedMin, area.top, area.bottom);
  return { x, y };
}

function clampPointTemperature(state, index, value) {
  const prev = state.points[index - 1];
  const next = state.points[index + 1];
  const min = prev ? prev.temp + 1 : state.tempMin;
  const max = next ? next.temp - 1 : state.tempMax;
  return clampNumber(value, min, max);
}

function clampPointSpeed(value) {
  if (Number.isNaN(value)) return SPEED_MIN;
  return clampNumber(Math.round(value * 10) / 10, SPEED_MIN, SPEED_MAX);
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  const ratio = (value - inMin) / (inMax - inMin);
  return outMin + ratio * (outMax - outMin);
}

function fanPointsFromData(fan) {
  return fan.TemperatureThresholds.map((threshold) => ({
    temp: threshold.UpThreshold,
    speed: Number(threshold.FanSpeed.toFixed ? threshold.FanSpeed.toFixed(1) : threshold.FanSpeed),
  }));
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAllCurves(data) {
  if (!data?.FanConfigurations) return;
  data.FanConfigurations.forEach((fan) => normalizeFanCurve(fan));
}

function normalizeFanCurve(fan) {
  if (!fan?.TemperatureThresholds || fan.TemperatureThresholds.length === 0) return;

  fan.TemperatureThresholds.sort((a, b) => a.UpThreshold - b.UpThreshold);

  fan.TemperatureThresholds = fan.TemperatureThresholds.map((t, index, arr) => {
    const up = clampNumber(Math.round(t.UpThreshold), TEMP_MIN, TEMP_MAX);
    const speed = clampPointSpeed(t.FanSpeed);
    const down = index === 0 ? TEMP_MIN : arr[index - 1].UpThreshold;
    return {
      UpThreshold: up,
      DownThreshold: down,
      FanSpeed: speed,
    };
  });
}

function renderRegisters(data) {
  registerList.innerHTML = '';
  data.RegisterWriteConfigurations.forEach((entry, index) => {
    registerList.appendChild(createRegisterEntry(entry, index));
  });
}

function createRegisterEntry(entry, index) {
  const container = document.createElement('article');
  container.className = 'register-entry';
  const grid = document.createElement('div');
  grid.className = 'form-grid';
  const fields = [
    ['WriteMode', 'text'],
    ['WriteOccasion', 'text'],
    ['Register', 'number'],
    ['Value', 'number'],
    ['ResetRequired', 'checkbox'],
    ['ResetValue', 'number'],
    ['ResetWriteMode', 'text'],
  ];
  fields.forEach(([key, type]) => {
    const label = document.createElement('label');
    label.innerHTML = `<span>${key}</span>`;
    const input = document.createElement('input');
    input.type = type;
    if (type === 'checkbox') {
      input.checked = Boolean(entry[key]);
      input.addEventListener('change', () => (currentData.RegisterWriteConfigurations[index][key] = input.checked));
    } else {
      input.value = entry[key];
      input.addEventListener('input', () => {
        currentData.RegisterWriteConfigurations[index][key] = parseValue(input.value, type);
      });
    }
    label.appendChild(input);
    grid.appendChild(label);
  });
  const descriptionLabel = document.createElement('label');
  descriptionLabel.innerHTML = '<span>Description</span>';
  const textarea = document.createElement('textarea');
  textarea.className = 'json-field';
  textarea.value = entry.Description || '';
  textarea.addEventListener('input', () => {
    currentData.RegisterWriteConfigurations[index].Description = textarea.value;
  });
  descriptionLabel.appendChild(textarea);
  grid.appendChild(descriptionLabel);
  container.appendChild(grid);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'icon-button remove';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    currentData.RegisterWriteConfigurations.splice(index, 1);
    renderRegisters(currentData);
    setStatus('Register entry removed.', false, true);
  });
  container.appendChild(removeBtn);

  return container;
}

function addRegisterEntry() {
  if (!currentData) return;
  const newEntry = {
    WriteMode: '',
    WriteOccasion: '',
    Register: 0,
    Value: 0,
    ResetRequired: false,
    ResetValue: 0,
    ResetWriteMode: '',
    Description: '',
  };
  currentData.RegisterWriteConfigurations.push(newEntry);
  renderRegisters(currentData);
  setStatus('Register entry added.', false, true);
}

function parseValue(value, type) {
  if (type === 'number') return parseFloat(value) || 0;
  return value;
}

function downloadCurrentJson() {
  const blob = new Blob([JSON.stringify(currentData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${currentData.NotebookModel?.replace(/\s+/g, '_') || 'fan-profile'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus('JSON exported.', false, true);
  showToast('Download ready.', 'success');
}

function handleWindowResize() {
  fanStates.forEach((state) => {
    configureCurveCanvas(state);
    drawFanCurve(state);
  });
}

function attachResizeObserver(state) {
  if (typeof ResizeObserver === 'undefined') return;
  if (state.resizeObserver) state.resizeObserver.disconnect();
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === state.canvas.parentElement) {
        configureCurveCanvas(state);
        drawFanCurve(state);
        break;
      }
    }
  });
  state.resizeObserver = observer;
  const parent = state.canvas.parentElement;
  if (parent) observer.observe(parent);
}
