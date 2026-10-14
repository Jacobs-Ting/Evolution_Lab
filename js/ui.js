/* ---------- UI ---------- */
(function () {
const W = SIM.W, H = SIM.H;
const $ = id => document.getElementById(id);
const dpr = () => Math.min(2, window.devicePixelRatio || 1);
let speed = 4, tool = 'look', selId = null, selAgent = null, frameN = 0, lastLog = null, bg = null, bgKey = '';
const particles = [];

/* ----- formatting ----- */
const fmtLux = v => { const l = Math.round(Math.pow(v / 100, 2) * 100000); return l >= 1000 ? (l / 1000).toFixed(l >= 10000 ? 0 : 1) + 'k lux' : l + ' lux'; };
const fmtO2 = v => (v * .35).toFixed(1) + '%';
const fmtAtm = v => Math.round(1 + 1100 * Math.pow(v / 100, 2)).toLocaleString() + ' atm';
const fmtT = v => Math.round(-30 + v * 1.4) + '°C';
function fmtLen(size) {
  const m = 1e-5 * Math.pow(10, size * 5.3);
  if (m < 1e-3) return Math.round(m * 1e6) + ' µm';
  if (m < 1e-2) return (m * 1e3).toFixed(1) + ' mm';
  if (m < 1) return (m * 100).toFixed(m < .1 ? 1 : 0) + ' cm';
  return m.toFixed(1) + ' m';
}
const dietLabel = d => d < .3 ? '生產者' : d < .5 ? '混合營養' : d < .72 ? '草食' : '掠食';

/* ----- scenes ----- */
const sceneBox = $('scenes');
for (const k of ['deep', 'mountain', 'cave', 'comet']) {
  const sc = SIM.SCENES[k], b = document.createElement('button');
  b.className = 'scene'; b.dataset.k = k; b.setAttribute('aria-pressed', 'false');
  b.innerHTML = `<b>${sc.name}</b><span>${sc.sub.split(' · ')[0]}</span>`;
  b.onclick = () => { if (SIM.scene.key !== k) startScene(k, false); };
  sceneBox.appendChild(b);
}

/* ----- params ----- */
const fmtGrav = v => { const g = Math.pow(10, -5 + v / 100 * 5); return g >= .1 ? g.toFixed(2) + ' g' : '1/' + Math.round(1 / g).toLocaleString() + ' g'; };
const PARAMS_STD = [
  { k: 'water', label: '水分', hint: '乾燥環境淘汰不耐旱者，催生防水外皮', fmt: v => v + '%' },
  { k: 'light', label: '光線', hint: '光合作用的能源；黑暗裡眼睛會退化', fmt: fmtLux, mod: 'light' },
  { k: 'o2', label: '含氧量', hint: '高氧容許巨大體型，低氧讓生物保持微小', fmt: fmtO2, mod: 'o2' },
  { k: 'press', label: '水壓', hint: '高壓下硬殼吃虧，膠質軟體占優勢', fmt: fmtAtm },
  { k: 'temp', label: '溫度', hint: '偏離最適溫度的生物會大量耗能', fmt: fmtT, mod: 'temp' }
];
const PARAMS_COMET = [
  { k: 'water', label: '冰與揮發物', hint: '近日點時融成液態水薄膜，是唯一的繁殖窗口', fmt: v => v + '%' },
  { k: 'light', label: '恆星亮度', hint: '光合作用的能源，強度隨距離平方遞減', fmt: v => (v / 60).toFixed(2) + ' 倍太陽', mod: 'light' },
  { k: 'rad', label: '輻射', hint: '打碎 DNA、提高突變率，逼出黑色素屏蔽', fmt: v => (Math.pow(v / 100, 2) * 20).toFixed(1) + ' Sv/年', mod: 'rad' },
  { k: 'grav', label: '重力', hint: '微重力下不需骨架，身體可以巨大又脆弱', fmt: fmtGrav },
  { k: 'ecc', label: '軌道偏心率', hint: '越偏心，近日點越熱、遠日點越冷越漫長', fmt: v => (.1 + v / 100 * .85).toFixed(2) }
];
let PARAMS = PARAMS_STD;
const pBox = $('params'); let pEls = {};
function buildParams() {
  PARAMS = SIM.scene.space ? PARAMS_COMET : PARAMS_STD;
  pBox.innerHTML = ''; pEls = {};
  for (const p of PARAMS) {
    const d = document.createElement('div'); d.className = 'param';
    d.innerHTML = `<div class="param-row"><label for="p_${p.k}">${p.label}</label><output id="o_${p.k}"></output></div>
      <input type="range" id="p_${p.k}" min="0" max="100" step="1"><div class="hint">${p.hint}</div>`;
    pBox.appendChild(d);
    const inp = d.querySelector('input');
    inp.oninput = () => { SIM.setParam(p.k, +inp.value); syncParam(p); };
    pEls[p.k] = { inp, out: d.querySelector('output'), label: d.querySelector('label') };
  }
}
function syncParam(p) {
  const e = pEls[p.k], v = SIM.params[p.k];
  e.inp.value = v; e.inp.style.setProperty('--p', v + '%');
  if (p.k === 'water' && SIM.scene.aquatic) { e.out.textContent = '全浸水 100%'; e.inp.disabled = true; return; }
  e.inp.disabled = false;
  let txt = p.fmt(v);
  const m = p.mod ? SIM.mods[p.mod] : 0;
  e.out.innerHTML = txt + (Math.abs(m) >= 1 ? `<i>→ ${p.fmt(Math.max(0, Math.min(100, v + m)))}</i>` : '');
}
function syncAllParams() {
  if (pEls.press) pEls.press.label.textContent = SIM.scene.aquatic ? '水壓' : SIM.scene.key === 'cave' ? '岩層壓力' : '氣壓';
  for (const p of PARAMS) syncParam(p);
}

/* ----- events ----- */
const EVENTS_STD = [['meteor', '隕石撞擊', '七成個體死亡，塵埃蔽日'], ['ice', '冰河期', '氣溫驟降 36°C'], ['volcano', '火山爆發', '升溫、缺氧、火山灰'], ['oxygen', '大氧化事件', '含氧量急升']];
const EVENTS_COMET = [['meteor', '隕石撞擊', '七成個體死亡，碎屑蔽日'], ['flare', '恆星閃焰', '輻射暴增，突變率飆升'], ['dust', '彗髮塵暴', '噴發的塵埃遮蔽星光'], ['graze', '近距掠日', '軌道擾動，表面急遽升溫']];
function buildEvents() {
  const list = SIM.scene.space ? EVENTS_COMET : EVENTS_STD, box = $('events');
  box.innerHTML = list.map(([k, t, d]) => `<button class="ev" data-ev="${k}"><b>${t}</b><span>${d}</span></button>`).join('');
  box.querySelectorAll('.ev').forEach(b => b.onclick = () => {
    SIM.event(b.dataset.ev);
    if (b.dataset.ev === 'meteor' || b.dataset.ev === 'flare') flash = 1;
    syncAllParams(); refreshAll();
  });
}
let flash = 0;

/* ----- vertebrate mutation rate ----- */
const vr = $('vertRate'), vrOut = $('vertRateOut');
function syncVR() { vr.style.setProperty('--p', (vr.value / 50 * 100) + '%'); vrOut.textContent = (vr.value / 10).toFixed(1) + '×'; }
vr.oninput = () => { SIM.vertRate = vr.value / 10; syncVR(); };
SIM.vertRate = vr.value / 10; syncVR();

/* ----- tools & speed ----- */
function setTool(t) {
  tool = t; $('toolLook').setAttribute('aria-pressed', t === 'look'); $('toolSow').setAttribute('aria-pressed', t === 'sow');
  $('win').classList.toggle('sow', t === 'sow');
}
$('toolLook').onclick = () => setTool('look');
$('toolSow').onclick = () => setTool('sow');
$('sowRandom').onclick = () => { SIM.sprinkleScatter(50); $('hint').hidden = true; refreshAll(); };
$('resetBtn').onclick = () => { SIM.reset(); selId = null; selAgent = null; $('hint').hidden = false; setTool('sow'); refreshAll(); };
document.querySelectorAll('#speeds button').forEach(b => b.onclick = () => {
  speed = +b.dataset.s; document.querySelectorAll('#speeds button').forEach(x => x.setAttribute('aria-pressed', x === b));
});

/* ----- canvas ----- */
const cv = $('world'), ctx = cv.getContext('2d');
function fitCanvas() {
  const r = cv.getBoundingClientRect(), k = dpr();
  const w = Math.max(1, Math.round(r.width * k)), h = Math.max(1, Math.round(r.height * k));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; bgKey = ''; }
}
cv.addEventListener('click', ev => {
  const r = cv.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * H;
  if (tool === 'sow') { SIM.sprinkle(x, y, 14, 16); $('hint').hidden = true; refreshAll(); return; }
  let best = null, bd = 30 * 30;
  for (const a of SIM.agents) { const d = (a.x - x) ** 2 + (a.y - y) ** 2 - a.r * a.r; if (d < bd) { bd = d; best = a; } }
  if (best) { selAgent = best; select(best.sp); }
});

/* ----- background ----- */
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function buildBg() {
  const sc = SIM.scene, c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
  const g = c.getContext('2d'), s = c.width / W; g.scale(s, s);
  const R = rng(7);
  if (sc.key === 'deep') {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#15415a'); gr.addColorStop(.35, '#0b2236'); gr.addColorStop(1, '#03060d');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0a0f17'; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, H - 14 - R() * 14); g.lineTo(W, H); g.fill();
    for (const [x, y, st] of sc.src) {
      if (y > H - 20) {
        const hgt = 60 + st * 40;
        g.fillStyle = '#16120f'; g.beginPath(); g.moveTo(x - 26, H); g.lineTo(x - 9, H - hgt); g.lineTo(x + 9, H - hgt); g.lineTo(x + 26, H); g.fill();
        g.strokeStyle = 'rgba(255,120,60,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 7, H - hgt + 2); g.lineTo(x + 7, H - hgt + 2); g.stroke();
        const hg = g.createRadialGradient(x, H - hgt, 0, x, H - hgt, 70); hg.addColorStop(0, 'rgba(255,140,70,.28)'); hg.addColorStop(1, 'rgba(255,140,70,0)');
        g.fillStyle = hg; g.beginPath(); g.arc(x, H - hgt, 70, 0, TAU); g.fill();
      } else {
        const mg = g.createRadialGradient(x, y, 0, x, y, 60); mg.addColorStop(0, 'rgba(200,170,255,.18)'); mg.addColorStop(1, 'rgba(200,170,255,0)');
        g.fillStyle = mg; g.beginPath(); g.arc(x, y, 60, 0, TAU); g.fill();
        g.fillStyle = 'rgba(230,220,255,.25)'; for (let k = 0; k < 30; k++) { g.beginPath(); g.arc(x + (R() - .5) * 60, y + (R() - .5) * 26, 1 + R() * 2, 0, TAU); g.fill(); }
      }
    }
  } else if (sc.key === 'mountain') {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#d7e1ea'); gr.addColorStop(.22, '#aab8c2'); gr.addColorStop(.48, '#7f8a83'); gr.addColorStop(.72, '#5f6f4a'); gr.addColorStop(1, '#3e4e2f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 500; k++) { const y = R() * H * .3; g.fillStyle = `rgba(255,255,255,${.25 + R() * .4})`; g.beginPath(); g.arc(R() * W, y, .8 + R() * 1.8, 0, TAU); g.fill(); }
    for (let k = 0; k < 160; k++) { const y = H * (.28 + R() * .3), x = R() * W; g.fillStyle = `rgba(40,44,48,${.12 + R() * .15})`; g.beginPath(); g.ellipse(x, y, 4 + R() * 10, 3 + R() * 5, R() * 3, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(30,50,20,.35)'; g.lineWidth = 1.2;
    for (let k = 0; k < 700; k++) { const x = R() * W, y = H * (.6 + R() * .4); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 4, y - 4 - R() * 6); g.stroke(); }
    for (const [x, y] of sc.src) { g.fillStyle = 'rgba(90,150,190,.55)'; g.beginPath(); g.ellipse(x, y, 46, 14, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(220,240,255,.5)'; g.beginPath(); g.ellipse(x, y, 46, 14, 0, 0, TAU); g.stroke(); }
  } else if (sc.key === 'comet') {
    g.fillStyle = '#03040a'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(230,235,255,${.3 + R() * .6})`; g.fillRect(R() * W, R() * 80, R() < .1 ? 1.8 : 1, R() < .1 ? 1.8 : 1); }
    const gr = g.createLinearGradient(0, 50, 0, H); gr.addColorStop(0, '#1d1b20'); gr.addColorStop(.12, '#2a2c33'); gr.addColorStop(.4, '#3d4c5f'); gr.addColorStop(1, '#1b2840');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 5) g.lineTo(x, SIM.surfY(x)); g.lineTo(W, H); g.fill();
    g.strokeStyle = 'rgba(180,210,240,.08)'; g.lineWidth = 2;
    for (let k = 1; k < 9; k++) { g.beginPath(); for (let x = 0; x <= W; x += 10) { const y = SIM.surfY(x) + k * 62 + Math.sin(x * .01 + k) * 6; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    for (let k = 0; k < 400; k++) { const x = R() * W, y = SIM.surfY(x) + R() * (H - 60); g.fillStyle = `rgba(${R() < .5 ? '10,10,14' : '200,225,255'},${.15 + R() * .2})`; g.beginPath(); g.arc(x, y, .6 + R() * 1.6, 0, TAU); g.fill(); }
    for (let k = 0; k < 7; k++) { const x = 40 + R() * (W - 80), y = SIM.surfY(x) + 4, rr = 10 + R() * 22; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y, rr, rr * .3, 0, 0, Math.PI); g.fill(); }
    for (const [x, y] of sc.src) {
      g.fillStyle = '#0b0b0f'; g.beginPath(); g.ellipse(x, SIM.surfY(x) + 2, 16, 6, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(220,240,255,.45)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, SIM.surfY(x) + 2, 17, 6.5, 0, 0, TAU); g.stroke();
      const cg = g.createRadialGradient(x, y, 0, x, y, 55); cg.addColorStop(0, 'rgba(160,210,255,.14)'); cg.addColorStop(1, 'rgba(160,210,255,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(x, y, 55, 0, TAU); g.fill();
    }
  } else {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2c2219'); gr.addColorStop(1, '#0f0b08');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(0,0,0,${.12 + R() * .18})`; g.beginPath(); g.ellipse(R() * W, R() * H, 20 + R() * 60, 8 + R() * 20, R() * 3, 0, TAU); g.fill(); }
    g.fillStyle = '#3a2d22';
    for (let x = 0; x < W; x += 18 + R() * 30) { const hgt = 10 + R() * 50; if (Math.abs(x - sc.shaft) < 60) continue; g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x + 6, 0); g.lineTo(x, hgt); g.fill(); }
    for (let x = 10; x < W; x += 40 + R() * 60) { const hgt = 12 + R() * 40; g.beginPath(); g.moveTo(x - 9, H); g.lineTo(x + 9, H); g.lineTo(x, H - hgt); g.fill(); }
    for (const [x, y] of sc.src) {
      const cg = g.createRadialGradient(x, y, 0, x, y, 55); cg.addColorStop(0, 'rgba(120,230,200,.22)'); cg.addColorStop(1, 'rgba(120,230,200,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(x, y, 55, 0, TAU); g.fill();
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (R() - .5) * 2.2, L = 8 + R() * 16, bx = x + (R() - .5) * 26, by = y + (R() - .5) * 10;
        g.fillStyle = k % 2 ? 'rgba(150,230,210,.55)' : 'rgba(190,150,255,.5)';
        g.beginPath(); g.moveTo(bx - 3 * Math.sin(a), by + 3 * Math.cos(a)); g.lineTo(bx + Math.cos(a) * L, by + Math.sin(a) * L); g.lineTo(bx + 3 * Math.sin(a), by - 3 * Math.cos(a)); g.fill();
      }
    }
  }
  // zone labels
  const lightBg = sc.key === 'mountain';
  g.font = '500 11px "JetBrains Mono", monospace'; g.textBaseline = 'middle';
  sc.zones.forEach((z, i) => {
    const y = H * (sc.space ? [.14, .36, .64, .93] : [.06, .36, .64, .93])[i];
    g.strokeStyle = lightBg ? 'rgba(20,30,40,.45)' : 'rgba(220,230,240,.28)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y); g.lineTo(18, y); g.stroke();
    g.fillStyle = lightBg ? 'rgba(20,30,40,.75)' : 'rgba(220,230,240,.55)'; g.fillText(z, 24, y);
  });
  bg = c; bgKey = sc.key + c.width;
}

/* ----- ambient particles ----- */
function spawnParticles() {
  const sc = SIM.scene.key;
  if (sc === 'deep') {
    if (Math.random() < .5) particles.push({ x: Math.random() * W, y: -4, vx: (Math.random() - .5) * .1, vy: .25 + Math.random() * .3, life: 2400, k: 'snow' });
    for (const [x, y, st] of SIM.SCENES.deep.src) if (y > H - 20 && Math.random() < .35) {
      const hgt = 60 + st * 40;
      particles.push({ x: x + (Math.random() - .5) * 8, y: H - hgt, vx: (Math.random() - .5) * .3, vy: -.5 - Math.random() * .6, life: 160 + Math.random() * 80, k: 'smoke' });
    }
  } else if (sc === 'cave') {
    if (Math.random() < .25) particles.push({ x: SIM.SCENES.cave.shaft + (Math.random() - .5) * 120, y: Math.random() * H * .6, vx: (Math.random() - .5) * .1, vy: .05, life: 300, k: 'mote' });
  } else if (sc === 'comet') {
    const o = SIM.orbit, act = Math.max(0, Math.min(1, (o.F - .12) / .5));
    for (const [x] of SIM.SCENES.comet.src) if (Math.random() < act * .6) {
      particles.push({ x: x + (Math.random() - .5) * 10, y: SIM.surfY(x), vx: (Math.random() - .5) * .5 - .2, vy: -.8 - Math.random() * 1.2, life: 90 + Math.random() * 60, k: 'jet' });
    }
  } else {
    const cold = SIM.env.tempC < 8;
    if (cold && Math.random() < .6) particles.push({ x: Math.random() * W, y: -4, vx: .3 + Math.random() * .4, vy: .5 + Math.random() * .5, life: 1500, k: 'flake' });
  }
  if (particles.length > 400) particles.splice(0, particles.length - 400);
}
function drawParticles(g) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
    if (p.life <= 0 || p.y > H + 5 || p.y < -10) { particles.splice(i, 1); continue; }
    if (p.k === 'smoke') { const a = Math.min(1, p.life / 120) * .35; g.fillStyle = `rgba(20,18,22,${a})`; g.beginPath(); g.arc(p.x, p.y, 4 + (240 - p.life) * .06, 0, TAU); g.fill(); }
    else if (p.k === 'snow') { g.fillStyle = 'rgba(210,230,240,.35)'; g.fillRect(p.x, p.y, 1.4, 1.4); }
    else if (p.k === 'jet') { const a = Math.min(1, p.life / 80) * .55; g.fillStyle = `rgba(215,235,255,${a})`; g.beginPath(); g.arc(p.x, p.y, 1 + (150 - p.life) * .03, 0, TAU); g.fill(); }
    else if (p.k === 'mote') { g.fillStyle = `rgba(255,230,170,${.4 * Math.sin(p.life / 300 * Math.PI)})`; g.fillRect(p.x, p.y, 1.6, 1.6); }
    else { g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(p.x, p.y, 1.4, 0, TAU); g.fill(); }
  }
}

/* ----- world render ----- */
function render() {
  fitCanvas();
  const sc = SIM.scene;
  if (bgKey !== sc.key + cv.width) buildBg();
  const s = cv.width / W;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bg, 0, 0);
  ctx.setTransform(s, 0, 0, s, 0, 0);
  const e = SIM.env;
  // dynamic light
  if (sc.key === 'deep') {
    const gr = ctx.createLinearGradient(0, 0, 0, H * .5); gr.addColorStop(0, `rgba(150,210,230,${e.light * .35})`); gr.addColorStop(1, 'rgba(150,210,230,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H * .5);
  } else if (sc.key === 'cave') {
    const x = sc.shaft, gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgba(255,220,150,${.15 + e.light * .45})`); gr.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 150, H); ctx.lineTo(x - 150, H); ctx.fill();
  } else if (sc.key === 'comet') {
    const o = SIM.orbit, F = Math.min(1.2, o.F * 2.2) * e.light / .6;
    const sg = ctx.createRadialGradient(W, 0, 0, W, 0, 520); sg.addColorStop(0, `rgba(255,236,190,${Math.min(.55, F * .4)})`); sg.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    if (e.tempC < -30) { ctx.fillStyle = `rgba(175,205,255,${Math.min(.28, (-30 - e.tempC) / 220)})`; ctx.fillRect(0, 0, W, H); }
  } else {
    ctx.fillStyle = `rgba(255,248,220,${e.light * .12})`; ctx.fillRect(0, 0, W, H);
  }
  spawnParticles(); drawParticles(ctx);
  // creatures
  const A = SIM.agents, ph0 = frameN * .02;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.g.radial > .62 && a.g.segs <= 3 && !(a.g.spine > .5) ? a.ph * .05 : a.ang);
    if (a.g.spine > .5 && sc.aquatic && Math.cos(a.ang) < 0) ctx.scale(1, -1);
    drawCreature(ctx, a.g, a.r * 1.2, a.ph, false, a.dorm);
    ctx.restore();
  }
  // selection
  if (selId != null) {
    const sp = SIM.species.get(selId);
    ctx.strokeStyle = 'rgba(214,171,85,.85)'; ctx.lineWidth = 1.4 / s * dpr();
    if (sp && sp.pop <= 80) for (const a of A) if (a.sp === selId) { ctx.beginPath(); ctx.arc(a.x, a.y, a.r * 1.6 + 5, 0, TAU); ctx.stroke(); }
    if (selAgent && !selAgent.dead) { ctx.lineWidth = 2.2 / s * dpr(); ctx.beginPath(); ctx.arc(selAgent.x, selAgent.y, selAgent.r * 1.8 + 9 + Math.sin(ph0 * 4) * 2, 0, TAU); ctx.stroke(); }
  }
  // climate tint from events
  const mt = SIM.mods.temp;
  if (Math.abs(mt) > 2) { ctx.fillStyle = mt < 0 ? `rgba(160,200,255,${Math.min(.22, -mt / 120)})` : `rgba(255,110,60,${Math.min(.18, mt / 120)})`; ctx.fillRect(0, 0, W, H); }
  if (SIM.mods.light < -2) { ctx.fillStyle = `rgba(30,24,20,${Math.min(.45, -SIM.mods.light / 120)})`; ctx.fillRect(0, 0, W, H); }
  if (sc.space) drawOrbit(ctx);
  if (flash > 0) { ctx.fillStyle = `rgba(255,220,180,${flash * .8})`; ctx.fillRect(0, 0, W, H); flash = Math.max(0, flash - .04); }
}

function drawOrbit(g) {
  const o = SIM.orbit; if (!o) return;
  const bw = 170, bh = 104, x0 = W - bw - 12, y0 = 10;
  g.fillStyle = 'rgba(5,8,18,.78)'; g.strokeStyle = 'rgba(214,171,85,.5)'; g.lineWidth = 1;
  g.beginPath(); g.roundRect ? g.roundRect(x0, y0, bw, bh, 6) : g.rect(x0, y0, bw, bh); g.fill(); g.stroke();
  const A = 58, B = A * Math.sqrt(1 - o.ecc * o.ecc), cx = x0 + 70, cy = y0 + 50, sx = cx + A * o.ecc;
  g.strokeStyle = 'rgba(200,210,230,.4)'; g.beginPath(); g.ellipse(cx, cy, A, B, 0, 0, TAU); g.stroke();
  const sg = g.createRadialGradient(sx, cy, 0, sx, cy, 9); sg.addColorStop(0, '#fff3c4'); sg.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = sg; g.beginPath(); g.arc(sx, cy, 9, 0, TAU); g.fill();
  const k = A / o.a, px = sx + o.r * Math.cos(o.nu) * k, py = cy - o.r * Math.sin(o.nu) * k;
  if (o.F > .15) {
    const dx = px - sx, dy = py - cy, L = Math.hypot(dx, dy) || 1, tl = Math.min(26, o.F * 30);
    g.strokeStyle = 'rgba(170,220,255,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py); g.lineTo(px + dx / L * tl, py + dy / L * tl); g.stroke();
  }
  g.fillStyle = '#6fe0cf'; g.beginPath(); g.arc(px, py, 3, 0, TAU); g.fill();
  g.font = '500 10px "JetBrains Mono", monospace'; g.fillStyle = 'rgba(236,230,214,.9)'; g.textBaseline = 'alphabetic';
  g.fillText(o.r.toFixed(2) + ' AU', x0 + 8, y0 + bh - 20);
  g.fillStyle = 'rgba(152,161,182,.95)'; g.fillText('第 ' + o.n + ' 圈', x0 + 8, y0 + bh - 8);
  g.fillText(o.r < (o.q + o.Q) / 2 ? (o.nu > -1.2 && o.nu < 1.2 ? '近日點附近' : '') : '遠日段', x0 + 92, y0 + bh - 8);
}

/* ----- portraits ----- */
const bboxCache = new Map();
function bbox(sp) {
  if (bboxCache.has(sp.id)) return bboxCache.get(sp.id);
  const c = document.createElement('canvas'); c.width = c.height = 420;
  const g = c.getContext('2d'); g.translate(210, 210);
  drawCreature(g, sp.proto, 40, 0, true);
  const d = g.getImageData(0, 0, 420, 420).data;
  let x0 = 420, y0 = 420, x1 = 0, y1 = 0;
  for (let y = 0; y < 420; y += 2) for (let x = 0; x < 420; x += 2) if (d[(y * 420 + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const b = x1 > x0 ? { cx: (x0 + x1) / 2 - 210, cy: (y0 + y1) / 2 - 210, w: x1 - x0 + 4, h: y1 - y0 + 4 } : { cx: 0, cy: 0, w: 80, h: 80 };
  bboxCache.set(sp.id, b); return b;
}
function drawPortrait(c, sp, ph, pad) {
  const k = dpr(), r = c.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * k)), h = Math.max(1, Math.round(r.height * k));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  if (!sp) return;
  const b = bbox(sp), sc = Math.min(w * (1 - pad) / b.w, h * (1 - pad) / b.h, 3.2 * k);
  g.translate(w / 2, h / 2); g.scale(sc, sc); g.translate(-b.cx, -b.cy);
  drawCreature(g, sp.proto, 40, ph, true);
}

/* ----- species selection ----- */
function complexity(g) { return (g.spine || 0) * 12 + (g.jaw || 0) * 5 + g.segs + g.limbs * 1.5 + g.tent + g.eyeN + g.glow * 5 + g.armor * 3 + g.spikes * 4 + g.size * 6 + g.d * 4 + (g.pTol > .62 && g.armor < .3 ? 2 : 0); }
function liveNotable() { return [...SIM.species.values()].filter(s => s.died === null && s.pop > 0 && s.notable); }
function autoSelect() {
  const L = liveNotable(); if (!L.length) { selId = null; return; }
  L.sort((a, b) => complexity(b.proto) * Math.log(2 + b.pop) - complexity(a.proto) * Math.log(2 + a.pop));
  select(L[0].id); selAgent = null;
}
function select(id) { selId = id; renderCard(); renderGallery(); renderTree(); }

function renderCard() {
  const sp = selId != null ? SIM.species.get(selId) : null;
  if (!sp) {
    $('sName').textContent = '尚無物種'; $('sLatin').textContent = ''; $('sMeta').innerHTML = '';
    $('sTraits').innerHTML = ''; $('sWhy').innerHTML = '<li>撒下細胞，等它們繁衍、突變、分化，新物種會出現在這裡。</li>';
    $('badge').hidden = true; return;
  }
  const g = sp.proto, par = sp.parent ? SIM.species.get(sp.parent) : null;
  $('sName').textContent = sp.cn; $('sLatin').textContent = sp.la;
  const b = $('badge'); b.hidden = false;
  if (sp.died === null) { b.textContent = '現存'; b.className = 'badge live'; } else { b.textContent = '已滅絕'; b.className = 'badge'; }
  $('sMeta').innerHTML = `<span>族群 <b>${sp.pop}</b></span><span>出現於 <b>${SIM.fmtYears(sp.born)}</b></span>` +
    (sp.died !== null ? `<span>滅絕於 <b>${SIM.fmtYears(sp.died)}</b></span>` : '') +
    `<span>祖先 <b>${par ? par.cn : '原始海洋'}</b></span>`;
  const rows = [
    ['體長', g.size, fmtLen(g.size)], ['食性', g.d, dietLabel(g.d)], ['速度', g.speed, Math.round(g.speed * 100) + '%'],
    ['眼睛', g.eyeN / 8, g.eyeN + ' 隻'], ['附肢', g.limbs / 5, g.spine > .5 ? (SIM.scene.aquatic ? (g.limbs ? '肉鰭 ' + g.limbs + ' 對' : '鰭') : g.limbs >= 2 ? '四肢' : '無肢') : g.limbs + ' 對'], ['體節', g.segs / 10, g.segs + ' 節'],
    ['觸手', g.tent / 10, g.tent + ' 條'], ['甲殼', g.armor, Math.round(g.armor * 100) + '%'], ['棘刺', g.spikes, Math.round(g.spikes * 100) + '%'],
    ['發光', g.glow, Math.round(g.glow * 100) + '%'], ['最適溫', g.tOpt, Math.round(-30 + g.tOpt * 140) + '°C'],
    ['耐壓', g.pTol, fmtAtm(g.pTol * 100)], ['耐旱', g.dry, Math.round(g.dry * 100) + '%']
  ];
  rows.unshift(['脊椎', g.spine, g.spine > .5 ? '有脊椎' : '無'], ['下顎', g.jaw, g.jaw > .5 ? '有頜' : g.spine > .5 ? '無頜' : '—']);
  if (SIM.scene.space || g.dorm > .05 || g.shield > .05 || g.sail > .05) rows.push(
    ['隱生休眠', g.dorm, Math.round(g.dorm * 100) + '%'], ['黑色素', g.shield, Math.round(g.shield * 100) + '%'], ['太陽帆', g.sail, Math.round(g.sail * 100) + '%']);
  if (SIM.scene.space) rows.splice(rows.findIndex(r => r[0] === '耐壓'), 1);
  $('sTraits').innerHTML = rows.map(([l, v, t]) => `<span>${l}</span><span class="bar"><i style="width:${Math.round(Math.min(1, v) * 100)}%"></i></span><span class="v">${t}</span>`).join('');
  $('sWhy').innerHTML = SIM.explain(sp).map(x => `<li>${x}</li>`).join('');
}

function renderGallery() {
  const L = liveNotable();
  const byPop = [...L].sort((a, b) => b.pop - a.pop).slice(0, 5);
  const rest = L.filter(s => !byPop.includes(s) && s.pop >= 3).sort((a, b) => complexity(b.proto) - complexity(a.proto)).slice(0, 3);
  const list = [...byPop, ...rest];
  if (selId != null && !list.some(s => s.id === selId)) { const s = SIM.species.get(selId); if (s) list.unshift(s); if (list.length > 8) list.pop(); }
  const box = $('gallery');
  box.innerHTML = list.map(s => `<button class="sp" data-id="${s.id}" aria-pressed="${s.id === selId}"><canvas></canvas><b>${s.cn}</b><em>${s.la}</em><span class="pop">${s.died === null ? s.pop + ' 隻' : '已滅絕'}</span></button>`).join('');
  box.querySelectorAll('.sp').forEach((el, i) => { el.onclick = () => { selAgent = null; select(+el.dataset.id); }; drawPortrait(el.querySelector('canvas'), list[i], .6, .18); });
}

/* ----- tree ----- */
let treeRows = [];
function renderTree() {
  const c = $('tree'), k = dpr(), rect = c.getBoundingClientRect();
  const all = [...SIM.species.values()].filter(s => s.notable);
  const h0 = Math.max(120, Math.min(320, all.length * 6 + 20));
  c.style.height = h0 + 'px';
  const w = Math.round(rect.width * k), h = Math.round(h0 * k);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, w, h);
  const cw = rect.width, ch = h0;
  const ids = new Set(all.map(s => s.id));
  const parentOf = s => { let p = s.parent; while (p && !ids.has(p)) { const q = SIM.species.get(p); p = q ? q.parent : null; } return p; };
  const kids = new Map(); const roots = [];
  for (const s of all) { const p = parentOf(s); s._p = p; if (p) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(s); } else roots.push(s); }
  const order = [];
  const walk = s => { order.push(s); (kids.get(s.id) || []).sort((a, b) => a.born - b.born).forEach(walk); };
  roots.sort((a, b) => a.born - b.born).forEach(walk);
  treeRows = order;
  $('treeNow').textContent = SIM.fmtYears(SIM.tick);
  if (!order.length) { g.fillStyle = '#98a1b6'; g.font = '12px "Noto Sans TC", sans-serif'; g.fillText('物種分化後會長出分支', 10, 24); return; }
  const pad = 6, rh = (ch - pad * 2) / order.length, T = Math.max(1, SIM.tick);
  const X = t => pad + (t / T) * (cw - pad * 2), Y = i => pad + rh * (i + .5);
  const rowOf = new Map(order.map((s, i) => [s.id, i]));
  order.forEach((s, i) => {
    const live = s.died === null, end = live ? T : s.died, y = Y(i);
    const col = live ? `hsl(${s.hue * 360},62%,64%)` : 'rgba(152,161,182,.4)';
    if (s._p != null && rowOf.has(s._p)) {
      g.strokeStyle = 'rgba(152,161,182,.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(X(s.born), Y(rowOf.get(s._p))); g.lineTo(X(s.born), y); g.stroke();
    }
    g.strokeStyle = s.id === selId ? '#d6ab55' : col; g.lineWidth = s.id === selId ? 3 : Math.max(1, Math.min(2.4, rh * .6));
    g.beginPath(); g.moveTo(X(s.born), y); g.lineTo(Math.max(X(s.born) + 1.5, X(end)), y); g.stroke();
    if (live) { g.fillStyle = col; g.beginPath(); g.arc(X(end) - 2, y, Math.max(1.6, Math.min(3, rh * .5)), 0, TAU); g.fill(); }
  });
}
$('tree').addEventListener('click', ev => {
  if (!treeRows.length) return;
  const r = ev.currentTarget.getBoundingClientRect(), y = ev.clientY - r.top;
  const i = Math.max(0, Math.min(treeRows.length - 1, Math.floor((y - 6) / ((r.height - 12) / treeRows.length))));
  selAgent = null; select(treeRows[i].id);
});

/* ----- log & stats ----- */
function renderLog() {
  if (SIM.log[0] === lastLog) return; lastLog = SIM.log[0];
  $('log').innerHTML = SIM.log.slice(0, 50).map(l => `<li class="${l.kind}"><time>${SIM.fmtYears(l.tick)}</time><span>${l.text}</span></li>`).join('');
}
function renderStats() {
  $('sTime').textContent = SIM.fmtYears(SIM.tick);
  $('sPop').textContent = SIM.agents.length.toLocaleString();
  $('sLive').textContent = liveNotable().length;
  $('sDead').textContent = SIM.extinct;
  const e = SIM.env, sc = SIM.scene;
  if (sc.space) {
    const o = SIM.orbit, dz = SIM.agents.length ? Math.round(SIM.agents.filter(a => a.dorm).length / SIM.agents.length * 100) : 0;
    $('caption').innerHTML = `<span><b>彗星</b> · 冰核表層 0–50 公尺</span><span>距恆星 <b>${o.r.toFixed(2)} AU</b>（近日 ${o.q.toFixed(2)} / 遠日 ${o.Q.toFixed(2)}）</span><span>表面 <b>${Math.round(e.tempC)}°C</b></span><span>第 <b>${o.n}</b> 圈公轉</span><span>休眠中 <b>${dz}%</b></span>`;
    return;
  }
  let t = `<span><b>${sc.name}</b> · ${sc.sub.split(' · ')[1]}</span><span>環境溫度 <b>${Math.round(e.tempC)}°C</b>${sc.key === 'deep' ? `（噴口 <b>${Math.round(e.tempC + sc.heat)}°C</b>）` : sc.key === 'mountain' ? `（峰頂 <b>${Math.round(e.tempC - 22)}°C</b>）` : ''}</span><span>含氧 <b>${(e.o2 * 35).toFixed(1)}%</b></span>`;
  $('caption').innerHTML = t;
}
function refreshAll() { renderStats(); renderLog(); renderGallery(); renderTree(); if (selId == null || !SIM.species.get(selId)) autoSelect(); else renderCard(); syncAllParams(); }

/* ----- scene start ----- */
function startScene(k, demo) {
  SIM.setScene(k); buildParams(); buildEvents(); bboxCache.clear(); particles.length = 0; selId = null; selAgent = null; lastLog = null;
  document.querySelectorAll('.scene').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === k));
  if (demo) {
    SIM.sprinkleScatter(70);
    for (let i = 0; i < 1300; i++) SIM.step();
    $('hint').hidden = true; setTool('look');
  } else { $('hint').hidden = false; setTool('sow'); }
  bgKey = ''; refreshAll(); if (!demo) renderCard();
}

/* ----- loop ----- */
function loop() {
  frameN++;
  if (speed > 0) {
    const t0 = performance.now(); let n = 0;
    while (n < speed && performance.now() - t0 < 14) { SIM.step(); n++; }
  }
  render();
  const sp = selId != null ? SIM.species.get(selId) : null;
  drawPortrait($('portrait'), sp, frameN * .05, .22);
  if (frameN % 10 === 0) { renderStats(); renderLog(); }
  if (frameN % 45 === 0) {
    if (sp && sp.died !== null && selAgent == null && frameN % 450 === 0) autoSelect(); else renderCard();
    if (selId == null) autoSelect();
    if (Math.abs(SIM.mods.temp) + Math.abs(SIM.mods.o2) + Math.abs(SIM.mods.light) > 0) syncAllParams();
  }
  if (frameN % 90 === 0) { renderGallery(); renderTree(); }
  requestAnimationFrame(loop);
}
window.addEventListener('resize', () => { bgKey = ''; renderTree(); renderGallery(); });
startScene('deep', true);
requestAnimationFrame(loop);
})();
