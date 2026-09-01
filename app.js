/* ==================================================================
   UI WIRING

   Canvas rendering, control panel, and the animation loop. All the
   actual physics lives in fput-engine.js (window.FPUT.Chain) — this
   file only reads that state and draws it / reacts to control input.
   ================================================================== */

(function () {

  const NUM_MODES_SHOWN = 6;
  const MODE_COLORS = ['#e62b82', '#c88a4a', '#8b93a3', '#a877a8', '#4bcabc', '#5a9bc8'];

  const chainCanvas = document.getElementById('chainCanvas');
  const energyCanvas = document.getElementById('energyCanvas');
  const chainCtx = chainCanvas.getContext('2d');
  const energyCtx = energyCanvas.getContext('2d');

  const el = {
    N: document.getElementById('ctrlN'),
    alpha: document.getElementById('ctrlAlpha'),
    mode: document.getElementById('ctrlMode'),
    amp: document.getElementById('ctrlAmp'),
    order: document.getElementById('ctrlOrder'),
    speed: document.getElementById('ctrlSpeed'),
    valN: document.getElementById('valN'),
    valAlpha: document.getElementById('valAlpha'),
    valMode: document.getElementById('valMode'),
    valAmp: document.getElementById('valAmp'),
    valSpeed: document.getElementById('valSpeed'),
    btnRun: document.getElementById('btnRun'),
    btnReset: document.getElementById('btnReset'),
    statT: document.getElementById('statT'),
    statDt: document.getElementById('statDt'),
    statSteps: document.getElementById('statSteps'),
    timeReadout: document.getElementById('timeReadout'),
    thermalizedReadout: document.getElementById('thermalizedReadout'),
    metaN: document.getElementById('metaN'),
    legend: document.getElementById('legend'),
  };

  let chain, dt, stepsPerFrame, running = true;
  let energyHistory = []; // array of arrays, one per mode

  function buildLegend() {
    el.legend.innerHTML = '';
    for (let n = 1; n <= NUM_MODES_SHOWN; n++) {
      const item = document.createElement('span');
      item.className = 'item';
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = MODE_COLORS[n - 1];
      item.appendChild(sw);
      item.appendChild(document.createTextNode('mode ' + n));
      el.legend.appendChild(item);
    }
  }

  function resizeCanvases() {
    [chainCanvas, energyCanvas].forEach(c => {
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.round(rect.width * dpr));
      c.height = Math.max(1, Math.round(rect.height * dpr));
    });
  }

  function setup() {
    const N = parseInt(el.N.value, 10);
    const alpha = parseFloat(el.alpha.value);
    const mode = parseInt(el.mode.value, 10);
    const amp = parseFloat(el.amp.value);

    chain = new FPUT.Chain(N, 1.0, 1.0, 1.0, alpha);
    chain.setNormalMode(mode, amp);

    const T = chain.fundamentalPeriod();
    const perCycle = 260;
    dt = T / perCycle;

    const speed = parseInt(el.speed.value, 10);
    stepsPerFrame = Math.max(1, Math.round(perCycle / 140)) * speed;

    energyHistory = [];
    for (let n = 1; n <= NUM_MODES_SHOWN; n++) energyHistory.push([]);

    el.statT.textContent = T.toFixed(3);
    el.statDt.textContent = dt.toFixed(4);
    el.statSteps.textContent = stepsPerFrame;
    el.metaN.textContent = N;
    el.thermalizedReadout.textContent = 'watching mode ' + mode;
  }

  function drawChain() {
    const w = chainCanvas.width, h = chainCanvas.height;
    chainCtx.clearRect(0, 0, w, h);

    const N = chain.N;
    const marginX = w * 0.04;
    const usableW = w - marginX * 2;
    const midY = h / 2;

    const amp0 = parseFloat(el.amp.value) || 1;
    const scale = (h * 0.34) / amp0;

    chainCtx.strokeStyle = 'rgba(208, 39, 255, 0.6)';
    chainCtx.lineWidth = 1;
    chainCtx.beginPath();
    chainCtx.moveTo(0, midY);
    chainCtx.lineTo(w, midY);
    chainCtx.stroke();

    const px = i => marginX + (usableW * i) / (N - 1);
    const py = i => midY - chain.y[i] * scale;

    for (let i = 0; i < N - 1; i++) {
      const stretch = Math.abs(chain.y[i + 1] - chain.y[i]);
      const tension = Math.min(1, stretch * 3.2);
      const r = Math.round(230 + (200 - 230) * tension);
      const g = Math.round(43 + (138 - 43) * tension);
      const b = Math.round(130 + (74 - 130) * tension);
      chainCtx.strokeStyle = `rgb(${r},${g},${b})`;
      chainCtx.lineWidth = Math.max(1, 1.4 * (w / 700));
      chainCtx.beginPath();
      chainCtx.moveTo(px(i), py(i));
      chainCtx.lineTo(px(i + 1), py(i + 1));
      chainCtx.stroke();
    }

    const rad = Math.max(2, Math.min(4.5, (usableW / N) * 0.28));
    for (let i = 0; i < N; i++) {
      const fixed = (i === 0 || i === N - 1);
      chainCtx.fillStyle = fixed ? '#ffffff' : '#ffffff';
      chainCtx.beginPath();
      chainCtx.arc(px(i), py(i), fixed ? rad * 0.8 : rad, 0, Math.PI * 2);
      chainCtx.fill();
    }
  }

  function drawEnergy() {
    const w = energyCanvas.width, h = energyCanvas.height;
    energyCtx.clearRect(0, 0, w, h);

    const maxPoints = 480;
    for (let n = 0; n < NUM_MODES_SHOWN; n++) {
      if (energyHistory[n].length > maxPoints) energyHistory[n].shift();
    }

    let ceiling = 1e-9;
    for (let n = 0; n < NUM_MODES_SHOWN; n++) {
      for (const val of energyHistory[n]) if (val > ceiling) ceiling = val;
    }
    ceiling *= 1.12;

    const padTop = h * 0.08, padBottom = h * 0.12;
    const plotH = h - padTop - padBottom;
    const len = energyHistory[0].length;
    if (len < 2) return;

    const xStep = w / (maxPoints - 1);
    const xOffset = w - (len - 1) * xStep;

    for (let n = 0; n < NUM_MODES_SHOWN; n++) {
      energyCtx.strokeStyle = MODE_COLORS[n];
      energyCtx.lineWidth = Math.max(1, 1.5 * (w / 700));
      energyCtx.beginPath();
      const hist = energyHistory[n];
      for (let i = 0; i < hist.length; i++) {
        const x = xOffset + i * xStep;
        const y = padTop + plotH - (hist[i] / ceiling) * plotH;
        if (i === 0) energyCtx.moveTo(x, y); else energyCtx.lineTo(x, y);
      }
      energyCtx.stroke();
    }
  }

  function frame() {
    if (running) {
      const order = parseInt(el.order.value, 10);
      for (let s = 0; s < stepsPerFrame; s++) {
        chain.step(order, dt);
      }
      for (let n = 1; n <= NUM_MODES_SHOWN; n++) {
        energyHistory[n - 1].push(chain.modeEnergy(n));
      }
      el.timeReadout.textContent = chain.t.toFixed(3);
    }
    drawChain();
    drawEnergy();
    requestAnimationFrame(frame);
  }

  function bindControls() {
    const syncLabels = () => {
      el.valN.textContent = el.N.value;
      el.valAlpha.textContent = parseFloat(el.alpha.value).toFixed(2);
      el.valMode.textContent = el.mode.value;
      el.valAmp.textContent = parseFloat(el.amp.value).toFixed(2);
      el.valSpeed.textContent = el.speed.value + '\u00d7';
    };

    [el.N, el.alpha, el.mode, el.amp].forEach(input => {
      input.addEventListener('input', () => { syncLabels(); setup(); });
    });
    el.order.addEventListener('change', syncLabels);
    el.speed.addEventListener('input', () => { syncLabels(); setup(); });

    el.btnRun.addEventListener('click', () => {
      running = !running;
      el.btnRun.textContent = running ? 'pause' : 'resume';
      el.btnRun.classList.toggle('paused', !running);
    });

    el.btnReset.addEventListener('click', () => { setup(); });

    syncLabels();
  }

  window.addEventListener('resize', resizeCanvases);

  buildLegend();
  bindControls();
  resizeCanvases();
  setup();
  requestAnimationFrame(frame);

})();
