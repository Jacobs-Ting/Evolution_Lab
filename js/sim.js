(function (root) {
'use strict';
const W = 1000, H = 620, CS = 40, GW = Math.ceil(W / CS), GH = Math.ceil(H / CS);
const FS = 20, FW = Math.ceil(W / FS), FH = Math.ceil(H / FS);
const TICK_YEARS = 20000;
const SPLIT = 0.16;
const rnd = Math.random;
function gauss() { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185 * v); }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const c01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const ss = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const SCENES = {
  deep: {
    key: 'deep', name: '深海', sub: '熱泉噴口 · 水深 2,500 公尺', aquatic: true,
    def: { water: 100, light: 14, o2: 35, press: 48, temp: 25 },
    src: [[170, H - 6, 1], [540, H - 6, 1.1], [860, H - 6, .9], [360, H - 150, .5], [700, H - 230, .4]], srcS: 105, heatS: 42, heat: 80,
    zones: ['200 m', '800 m', '1,500 m', '2,500 m'],
    epi: ['abyssalis', 'profunda', 'thermophila', 'tenebrosa', 'hadalis', 'benthica', 'nocturna', 'vulcania', 'pelagica', 'silens']
  },
  mountain: {
    key: 'mountain', name: '高山', sub: '岩坡與高原 · 海拔 1,500–4,500 公尺', aquatic: false,
    def: { water: 35, light: 85, o2: 40, press: 3, temp: 34 },
    src: [[260, H - 70, .6], [720, H - 120, .5]], srcS: 70, heatS: 0, heat: 0,
    zones: ['4,500 m', '3,500 m', '2,500 m', '1,500 m'],
    epi: ['montana', 'alpina', 'nivalis', 'rupestris', 'ventosa', 'altissima', 'glacialis', 'aerea', 'saxatilis', 'borealis']
  },
  cave: {
    key: 'cave', name: '地底', sub: '石灰岩洞穴 · 地下 50–400 公尺', aquatic: false,
    def: { water: 70, light: 16, o2: 30, press: 20, temp: 32 },
    src: [[520, 380, .9], [820, 540, .8], [660, 170, .7], [360, 560, .8], [130, 470, .6]], srcS: 55, heatS: 0, heat: 0, shaft: 230,
    zones: ['50 m', '150 m', '280 m', '400 m'],
    epi: ['cavernicola', 'troglodytes', 'subterranea', 'obscura', 'lapidea', 'stygia', 'umbrosa', 'speluncae', 'caeca', 'calcarea']
  },
  comet: {
    key: 'comet', name: '彗星', sub: '短週期彗星 · 冰核表層 0–50 公尺', aquatic: false, space: true,
    def: { water: 65, light: 60, rad: 45, grav: 20, ecc: 40, o2: 0, press: 0, temp: 50 },
    src: [[150, 90, 1], [420, 80, 1.1], [700, 95, .9], [905, 85, .8]], srcS: 70, heatS: 45, heat: 18,
    zones: ['表面', '5 m', '20 m', '50 m'], boost: 2.2, period: 400, tickYears: 4.2 / 400, aAU: 2.6,
    epi: ['cometaria', 'glacialis', 'orbitalis', 'stellaris', 'vacua', 'perihelia', 'nebulosa', 'interstellaris', 'sublimata', 'halleyi']
  }
};
const surfY = x => 58 + 12 * Math.sin(x * .013) + 8 * Math.sin(x * .037 + 1);

const S = {
  W, H, TICK_YEARS, SCENES, scene: null, params: {}, mods: { temp: 0, o2: 0, light: 0, rad: 0 }, env: null, orbit: null, surfY,
  agents: [], species: new Map(), nextSp: 1, uid: 0, tick: 0, log: [], milestones: {}, extinct: 0, capA: 650, capH: 420,
  fL: new Float32Array(FW * FH), fC: new Float32Array(FW * FH), fT: new Float32Array(FW * FH), fW: new Float32Array(FW * FH), fR: new Float32Array(FW * FH),
  fieldDirty: true, grid: Array.from({ length: GW * GH }, () => []), autoN: new Int16Array(GW * GH), FW, FH, FS
};

function eff() {
  const p = S.params, m = S.mods;
  return {
    water: c01(p.water / 100), light: c01((p.light + m.light) / 100), o2: c01((p.o2 + m.o2) / 100),
    press: c01(p.press / 100), tempC: -30 + clamp(p.temp + m.temp, 0, 100) * 1.4,
    rad: c01(((p.rad || 0) + m.rad) / 100), grav: p.grav == null ? 1 : c01(p.grav / 100), ecc: .1 + (p.ecc || 0) / 100 * .85
  };
}
function orbitNow(ecc) {
  const sc = S.scene, P = sc.period, M = 2 * Math.PI * (S.tick % P) / P - .9;
  let E = M; for (let i = 0; i < 10; i++) E = M + ecc * Math.sin(E);
  const r = sc.aAU * (1 - ecc * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + ecc) * Math.sin(E / 2), Math.sqrt(1 - ecc) * Math.cos(E / 2));
  return { r, nu, F: 1 / (r * r), n: Math.floor((S.tick + .9 / (2 * Math.PI) * P) / P) + 1, q: sc.aAU * (1 - ecc), Q: sc.aAU * (1 + ecc), a: sc.aAU, ecc };
}
function computeComet(e) {
  const sc = S.scene, o = orbitNow(e.ecc); S.orbit = o;
  const F = o.F, Tsurf = 394 * Math.pow(o.r, -.5) - 273 + S.mods.temp * 1.4, meanT = -105;
  const act = ss(.12, .7, F);
  e.tempC = Tsurf; e.o2 = .35; e.press = 0;
  for (let fy = 0; fy < FH; fy++) for (let fx = 0; fx < FW; fx++) {
    const x = (fx + .5) * FS, y = (fy + .5) * FS, i = fy * FW + fx;
    const ys = surfY(x), sp = y < ys, depth = sp ? 0 : (y - ys) / (H - ys);
    let hp = 0, vc = 0;
    for (const [sx, sy, st] of sc.src) {
      const d2 = (x - sx) ** 2 + (y - sy) ** 2;
      vc += st * Math.exp(-d2 / (2 * sc.srcS * sc.srcS)); hp += Math.exp(-d2 / (2 * sc.heatS * sc.heatS));
    }
    hp = Math.min(1, hp);
    const lag = ss(0, .55, depth);
    const T = Tsurf * (1 - lag) + meanT * lag + hp * sc.heat * act;
    const liquid = ss(-35, -5, T) * (1 - ss(95, 115, T));
    S.fL[i] = e.light * Math.min(1, F * 3) * (sp ? 1 : Math.exp(-depth * 7));
    S.fC[i] = Math.min(1, .1 + vc * (.15 + 1.1 * act)) * (sp ? .2 : 1);
    S.fT[i] = T;
    S.fW[i] = sp ? 0 : c01(e.water * liquid * (.55 + .7 * hp));
    S.fR[i] = e.rad * (sp ? 1 : Math.exp(-depth * 7)) * (.55 + .45 * Math.min(1.5, F));
  }
  S.fieldDirty = false;
}

function computeFields() {
  const e = eff(); S.env = e; const sc = S.scene;
  if (sc.space) return computeComet(e);
  S.fR.fill(0);
  for (let fy = 0; fy < FH; fy++) for (let fx = 0; fx < FW; fx++) {
    const x = (fx + .5) * FS, y = (fy + .5) * FS, i = fy * FW + fx;
    let L;
    if (sc.key === 'deep') L = e.light * Math.exp(-y / H * 3.2);
    else if (sc.key === 'mountain') L = e.light * (0.7 + 0.3 * (1 - y / H));
    else L = e.light * (Math.exp(-((x - sc.shaft) ** 2) / (2 * 80 * 80)) * Math.exp(-y / H * 1.1) + 0.03);
    let C = 0, hp = 0;
    for (const [sx, sy, s] of sc.src) {
      const d2 = (x - sx) ** 2 + (y - sy) ** 2;
      C += s * Math.exp(-d2 / (2 * sc.srcS * sc.srcS));
      if (sc.heatS) hp += Math.exp(-d2 / (2 * sc.heatS * sc.heatS));
    }
    C = Math.min(1, C);
    let T = e.tempC;
    if (sc.key === 'deep') T += sc.heat * Math.min(1, hp);
    else if (sc.key === 'mountain') T -= (1 - y / H) * 22;
    else T += (y / H) * 4;
    let Wv = 1;
    if (sc.key === 'mountain') Wv = c01(e.water + (y / H) * 0.22 + C * 0.4);
    else if (sc.key === 'cave') Wv = c01(e.water + (y / H) * 0.12 + C * 0.15);
    S.fL[i] = L; S.fC[i] = C; S.fT[i] = T; S.fW[i] = Wv;
  }
  S.fieldDirty = false;
}
function fIdx(x, y) { return Math.min(FH - 1, (y / FS) | 0) * FW + Math.min(FW - 1, (x / FS) | 0); }
function fieldAt(x, y) { const i = fIdx(x, y); return { L: S.fL[i], C: S.fC[i], T: S.fT[i], W: S.fW[i], R: S.fR[i] }; }

const FLT = ['size', 'speed', 'armor', 'spikes', 'eyeSize', 'glow', 'radial', 'd', 'chemo', 'tOpt', 'tW', 'pTol', 'dry', 'dorm', 'shield', 'sail'];
const DK = [['size', 1.3, 1], ['speed', 1, 1], ['armor', 1, 1], ['spikes', 1, 1], ['eyeN', 1, 6], ['eyeSize', .4, 1], ['glow', 1, 1],
  ['limbs', 1, 4], ['segs', 1, 7], ['tent', 1, 7], ['radial', .8, 1], ['d', 1.6, 1], ['chemo', .6, 1], ['tOpt', 1, 1], ['pTol', .6, 1], ['dry', .6, 1], ['dorm', .8, 1], ['shield', .8, 1], ['sail', 1, 1]];
const DKW = DK.reduce((s, k) => s + k[1], 0);
function gdist(a, b) {
  let s = 0;
  for (const [k, w, sc] of DK) { const d = (a[k] - b[k]) / sc; s += w * d * d; }
  return Math.sqrt(s / DKW);
}

function seedGenome(x, y) {
  const f = fieldAt(x, y);
  return {
    size: .04 + rnd() * .06, speed: .05 + rnd() * .1, armor: 0, spikes: 0, eyeN: 0, eyeSize: .3, glow: 0,
    limbs: 0, segs: 1, tent: 0, radial: rnd() * .45, d: rnd() * .3,
    chemo: f.C > f.L ? .7 + rnd() * .3 : rnd() * .3,
    tOpt: S.scene.space ? c01(.4 + gauss() * .05) : c01((f.T + 30) / 140 + gauss() * .04), tW: S.scene.space ? .5 + rnd() * .15 : .25 + rnd() * .15,
    pTol: c01(S.env.press + gauss() * .08), dry: c01((S.scene.space ? .35 : .2) + gauss() * .1), hue: rnd(),
    dorm: S.scene.space ? .25 + rnd() * .2 : 0, shield: S.scene.space ? rnd() * .25 : 0, sail: 0
  };
}

function mutate(p) {
  const g = { ...p }; let macro = null;
  const mr = .25 * (1 + S.env.rad * 1.5);
  for (const k of FLT) if (rnd() < mr) g[k] = c01(g[k] + gauss() * .06);
  g.hue = (g.hue + gauss() * .012 + 1) % 1;
  if (rnd() < .05) g.eyeN = clamp(g.eyeN + (rnd() < .5 ? -1 : 1), 0, 8);
  if (rnd() < .04) g.limbs = clamp(g.limbs + (rnd() < .5 ? -1 : 1), 0, 5);
  if (rnd() < .04) g.segs = clamp(g.segs + (rnd() < .5 ? -1 : 1), 1, 10);
  if (rnd() < .05) g.tent = clamp(g.tent + (rnd() < .5 ? -1 : 1), 0, 10);
  if (rnd() < .008) {
    const t = rnd() * 4 | 0;
    if (t === 0) { g.segs = Math.min(10, g.segs + 2); macro = '體節複製'; }
    else if (t === 1) { g.limbs = Math.min(5, g.limbs + 1); macro = '新附肢'; }
    else if (t === 2) { g.eyeN = Math.min(8, g.eyeN + 2); macro = '眼點複製'; }
    else { g.tent = Math.min(10, g.tent + 3); macro = '觸手增生'; }
  }
  if (S.scene.space && rnd() < .004) {
    const t = rnd() * 3 | 0;
    if (t === 0) { g.sail = c01(g.sail + .3); macro = '薄膜帆'; }
    else if (t === 1) { g.shield = c01(g.shield + .3); macro = '黑色素堆積'; }
    else { g.dorm = c01(g.dorm + .25); g.dry = c01(g.dry + .2); macro = '隱生基因'; }
  }
  if (g.d < .4 && rnd() < .006) { g.d = c01(g.d + .32); g.speed = c01(g.speed + .18); g.size = c01(g.size + .04); macro = '吞噬作用'; }
  return [g, macro];
}

function makeAgent(x, y, g, sp, e) {
  return { x, y, ang: rnd() * 6.283, e, age: 0, g, sp, r: 2.2 + g.size * 15, ph: rnd() * 6.283, cd: 0, id: ++S.uid, dead: false, tumble: 0 };
}

/* ---------- naming ---------- */
function traitList(g) {
  const t = [];
  if (g.eyeN === 0 && g.d > .45) t.push(['盲眼', 'Caeco', .55]);
  if (g.eyeN >= 4) t.push(['多眼', 'Argo', g.eyeN / 8 + .3]);
  else if (g.eyeN > 0 && g.eyeSize > .65) t.push(['巨眼', 'Megalops', g.eyeSize]);
  if (g.glow > .45) t.push(['發光', 'Lampro', g.glow + .2]);
  if (g.armor > .55) t.push(['重甲', 'Ostraco', g.armor]);
  if (g.spikes > .45) t.push(['棘刺', 'Acantho', g.spikes]);
  if (g.tent >= 4) t.push(['觸手', 'Plocamo', g.tent / 10 + .3]);
  if (g.segs >= 6) t.push(['多節', 'Polymero', g.segs / 10 + .2]);
  if (g.limbs >= 3) t.push(['多足', 'Myrio', g.limbs / 5 + .2]);
  if (g.size > .6) t.push(['巨型', 'Giganto', g.size + .1]);
  else if (g.size < .1) t.push(['微', 'Micro', .12]);
  if (g.eyeN > 0 && g.eyeN < 4 && !(g.eyeSize > .65)) t.push(['眼點', 'Ocello', .2 + g.eyeN * .04]);
  if (g.glow > .25 && g.glow <= .45) t.push(['微光', 'Phengo', g.glow * .6]);
  if (g.armor > .3 && g.armor <= .55) t.push(['殼', 'Testo', g.armor * .5]);
  if (g.segs >= 2 && g.segs < 6) t.push(['鏈', 'Catena', .15 + g.segs * .03]);
  if (g.tent >= 1 && g.tent < 4) t.push(['鞭', 'Mastigo', .15 + g.tent * .04]);
  if (g.limbs >= 1 && g.limbs < 3) t.push(['足', 'Podo', .2 + g.limbs * .05]);
  if (g.radial > .45 && g.radial <= .62) t.push(['星', 'Astro', g.radial * .4]);
  const tc = -30 + g.tOpt * 140;
  if (tc > 55) t.push(['嗜熱', 'Pyro', .4 + (tc - 55) / 100]);
  else if (tc < 0) t.push(['冰原', 'Cryo', .4 - tc / 100]);
  if (g.pTol > .62 && g.armor < .3) t.push(['膠質', 'Hyalo', g.pTol]);
  if (g.dry > .6) t.push(['旱生', 'Xero', g.dry]);
  if (g.shield > .5) t.push(['黑殼', 'Melano', g.shield + .1]);
  if (g.dorm > .55) t.push(['隱生', 'Cryptobio', g.dorm]);
  if (g.sail > .4) t.push(['帆', 'Histio', g.sail + .25]);
  t.sort((a, b) => b[2] - a[2]);
  return t;
}
function nounOf(g) {
  const aq = S.scene.aquatic;
  if (g.sail > .55) return g.d < .45 ? ['星帆', 'velella'] : ['帆獸', 'histiotherium'];
  if (g.dorm > .5 && g.limbs >= 2 && g.d > .45 && g.size < .45) return ['熊蟲', 'tardigrada'];
  if (g.radial > .62 && g.segs <= 3) {
    if (g.d < .45) return aq ? ['海葵', 'actinia'] : ['星苔', 'asteria'];
    return aq ? ['水母', 'medusa'] : ['星蛛', 'asterarachne'];
  }
  if (g.d < .3) {
    if (g.chemo > .6) return g.size < .2 ? ['菌', 'bacter'] : ['菌毯', 'myces'];
    return g.size < .2 ? ['藻', 'phycus'] : (aq ? ['藻樹', 'dendron'] : ['苔蕨', 'pteris']);
  }
  if (g.d < .5) return g.size < .2 ? ['變形蟲', 'amoeba'] : ['濾食蟲', 'colax'];
  if (g.d < .72) {
    if (g.limbs >= 2) return aq ? ['蝦', 'caris'] : ['甲蟲', 'coleus'];
    if (g.segs >= 4) return ['蠕蟲', 'vermis'];
    return ['草食蟲', 'phagus'];
  }
  if (g.glow > .45 && g.eyeN > 0) return ['鮟鱇', 'lophius'];
  if (g.tent >= 3) return aq ? ['烏賊', 'teuthis'] : ['觸手獸', 'plocamus'];
  if (g.limbs >= 2 && g.armor > .4) return ['蠍', 'scorpius'];
  if (g.size > .55) return ['巨獸', 'therium'];
  if (g.segs >= 4) return ['蜈', 'scolopendra'];
  return ['獵蟲', 'thera'];
}
const HUEW = ['赤', '橙', '金', '黃', '碧', '翠', '青', '藍', '靛', '紫', '緋', '紅'];
const VAR = ['', '·乙', '·丙', '·丁', '·戊', '·己', '·庚', '·辛', '·壬', '·癸'];
const nameCount = new Map();
function nameSpecies(g) {
  const t = traitList(g), n = nounOf(g);
  let cn = t.slice(0, 2).map(x => x[0]).join('') || HUEW[Math.floor(g.hue * 12) % 12];
  cn += n[0];
  const k = nameCount.get(cn) || 0; nameCount.set(cn, k + 1);
  if (k > 0) cn += k < 10 ? VAR[k] : ('·' + (k + 1) + '型');
  const gen = ((t[0] ? t[0][1] : '') + n[1]);
  const la = gen.charAt(0).toUpperCase() + gen.slice(1).toLowerCase() + ' ' + S.scene.epi[(rnd() * S.scene.epi.length) | 0];
  return { cn, la };
}

function newSpecies(g, parent, x, y) {
  const id = S.nextSp++; const nm = nameSpecies(g);
  const f = fieldAt(x, y);
  const sp = { id, parent, proto: { ...g }, born: S.tick, died: null, pop: 0, maxPop: 0, cn: nm.cn, la: nm.la, hue: g.hue, birthT: f.T, birthL: f.L, notable: false, rep: null };
  S.species.set(id, sp);
  return sp;
}

function addLog(kind, text) {
  S.log.unshift({ kind, text, tick: S.tick });
  if (S.log.length > 80) S.log.pop();
}

/* ---------- public actions ---------- */
function setScene(key) { S.scene = SCENES[key]; S.params = { ...S.scene.def }; reset(); }
function reset() {
  S.agents = []; S.species = new Map(); S.nextSp = 1; S.tick = 0; S.log = []; S.milestones = {};
  S.mods = { temp: 0, o2: 0, light: 0, rad: 0 }; S.extinct = 0; S.rootN = 0; nameCount.clear(); computeFields();
}
function setParam(k, v) { S.params[k] = v; S.fieldDirty = true; }
function sprinkle(cx, cy, n, spread, scatter) {
  let made = 0;
  const x0 = clamp(cx, 4, W - 4), y0 = clamp(cy, 4, H - 4);
  const g0 = seedGenome(x0, y0);
  const sp = newSpecies(g0, null, x0, y0);
  sp.cn = '始祖細胞' + (S.rootN < 10 ? VAR[S.rootN] : ('·' + (S.rootN + 1)));
  S.rootN++;
  for (let i = 0; i < n; i++) {
    const x = scatter ? 20 + rnd() * (W - 40) : clamp(cx + gauss() * spread, 4, W - 4);
    const y = scatter ? 20 + rnd() * (H - 40) : clamp(cy + gauss() * spread, 4, H - 4);
    const g = scatter ? { ...seedGenome(x, y), hue: g0.hue, radial: g0.radial } : { ...g0, tOpt: c01(g0.tOpt + gauss() * .03), chemo: c01(g0.chemo + gauss() * .05) };
    S.agents.push(makeAgent(x, y, g, sp.id, S.scene.space ? 20 : 12));
    made++;
  }
  if (!S.milestones.seed) { S.milestones.seed = 1; addLog('event', `撒下第一批原始細胞，演化開始。`); }
  return made;
}
function sprinkleScatter(n) { return sprinkle(W / 2, H / 2, n, 0, true); }
function event(kind) {
  const m = S.mods;
  if (kind === 'meteor') {
    let k = 0; for (const a of S.agents) if (rnd() < .75) { a.dead = true; k++; }
    m.light -= 55; m.temp -= 10;
    addLog('event', `隕石撞擊！${k} 個個體死亡，塵埃遮蔽了光線。`);
  } else if (kind === 'ice') { m.temp -= 26; addLog('event', '冰河期降臨，氣溫驟降。'); }
  else if (kind === 'volcano') { m.temp += 18; m.o2 -= 20; m.light -= 18; addLog('event', '大規模火山爆發：升溫、缺氧、火山灰蔽日。'); }
  else if (kind === 'oxygen') { m.o2 += 35; addLog('event', '大氧化事件：含氧量急升。'); }
  else if (kind === 'flare') { m.rad += 40; m.temp += 8; m.light += 20; addLog('event', '恆星閃焰！輻射暴增，突變率飆升。'); }
  else if (kind === 'dust') { m.light -= 45; addLog('event', '彗髮塵埃大爆發，星光被遮蔽。'); }
  else if (kind === 'graze') { m.temp += 30; addLog('event', '軌道擾動，彗星近距離掠過恆星，表面急遽升溫。'); }
  S.fieldDirty = true;
}

/* ---------- step ---------- */
function step() {
  S.tick++;
  const m = S.mods; let ch = false;
  for (const k in m) { if (Math.abs(m[k]) > .05) { m[k] *= .996; ch = true; } else m[k] = 0; }
  if (ch && S.tick % 12 === 0) S.fieldDirty = true;
  if (S.scene.space && S.tick % 4 === 0) S.fieldDirty = true;
  if (S.fieldDirty) computeFields();

  const A = S.agents, grid = S.grid, autoN = S.autoN;
  for (let i = 0; i < grid.length; i++) grid[i].length = 0;
  autoN.fill(0);
  for (const a of A) {
    if (a.dead) continue;
    const ci = Math.min(GH - 1, (a.y / CS) | 0) * GW + Math.min(GW - 1, (a.x / CS) | 0);
    a.ci = ci; grid[ci].push(a); if (a.g.d < .45) autoN[ci]++;
  }
  const env = S.env, f = env.o2, P = env.press, G = env.grav, aq = S.scene.aquatic;
  const births = [];
  let nAuto = 0, nHet = 0;
  for (const a of A) if (!a.dead) { if (a.g.d < .45) nAuto++; else nHet++; }

  for (const a of A) {
    if (a.dead) continue;
    const g = a.g, fi = fIdx(a.x, a.y);
    const L = S.fL[fi], C = S.fC[fi], T = S.fT[fi], Wv = S.fW[fi], Rd = S.fR[fi];
    if (Rd > .05 && rnd() < Rd * (1 - g.shield) * (a.dorm ? .0004 : .0015)) { a.dead = true; continue; }
    if (a.dorm) {
      a.e -= (.004 + Rd * (1 - g.shield) * .02) * (1 - g.dorm * .8);
      if (a.e <= 0) { a.dead = true; continue; }
      if ((a.id + S.tick) % 5 === 0) {
        const dv = Math.max(0, Math.abs(T - (-30 + g.tOpt * 140)) - (6 + g.tW * 30));
        if (dv < 8 && (Wv > .2 || g.dry > .7)) a.dorm = false;
      }
      continue;
    }
    a.age++; if (a.cd > 0) a.cd--;
    a.ph += .08 + g.speed * .25;
    const r = a.r;
    // metabolic costs
    let cost = .03
      + r * r * .0016 * (1.35 - f) * (.4 + .6 * G)
      + g.speed * g.speed * .12 * (r / 6)
      + g.armor * .05 * (r / 6) * (1 + P * (1 - g.pTol) * 2)
      + g.spikes * .03 + g.eyeN * g.eyeSize * .012 + g.glow * .04
      + g.limbs * .012 + g.tent * .008 + (g.segs - 1) * .006
      + g.tW * .03 + g.dry * .025 * Wv + Math.max(0, g.pTol - P) * .06;
    const tOptC = -30 + g.tOpt * 140, dev = Math.max(0, Math.abs(T - tOptC) - (6 + g.tW * 30));
    if (g.dorm > .15 && (dev > 16 || (Wv < .08 && g.dry < .6) || a.e < 4) && rnd() < g.dorm * .15) { a.dorm = true; continue; }
    cost += g.dorm * .015 + g.shield * .02 + g.sail * (.02 + G * .08) + Rd * (1 - g.shield) * .15;
    cost += dev * .014;
    cost += Math.max(0, P - g.pTol) * .25 * (.5 + g.armor + g.size * .5);
    cost += (1 - Wv) * (1 - g.dry) * .3;
    // autotrophy
    const auto = Math.pow(1 - g.d, 1.25);
    if (auto > .02) {
      let gain = auto * ((1 - g.chemo) * L * (.3 + .7 * Wv) * (1 + g.sail * 1.2) + g.chemo * C + g.shield * Rd * .7) * 1.5 * (.7 + r * .05) * (S.scene.boost || 1);
      gain /= (1 + .18 * Math.max(0, autoN[a.ci] - 3));
      a.e += gain;
    }
    a.e -= cost;
    if (a.e <= 0) { a.dead = true; continue; }

    // senses
    const eatEff = ss(.12, .55, g.d);
    const loco = aq ? 1 + g.tent * .03 : .55 + Math.min(g.limbs, 4) * .22 * (.3 + .7 * G);
    const v = (.12 + g.speed * 2) * loco * (.6 + .5 * f) + g.sail * L * 1.0;
    const vis = g.eyeN > 0 ? (25 + g.eyeSize * 90 + g.eyeN * 6) * Math.min(1, (L + g.glow * .6) * 2.2) : 0;
    const nonvis = 26 + g.tent * 6 + g.limbs * 3 + r + (eatEff > .1 ? g.glow * 60 * (1 - Math.min(1, L * 2)) : 0);
    const sense = eatEff > .12 ? Math.max(vis, nonvis) : (vis > 0 ? vis * .8 : 0);
    let tgt = null, td = 1e9, thr = null, thd = 1e9;
    const rescan = ((a.id + S.tick) % 3 === 0) || !a.tgt || a.tgt.dead;
    if (!rescan) {
      tgt = a.tgt; td = (tgt.x - a.x) ** 2 + (tgt.y - a.y) ** 2;
      if (td > sense * sense * 1.6) { tgt = null; td = 1e9; }
      thr = a.thr && !a.thr.dead ? a.thr : null; if (thr) thd = (thr.x - a.x) ** 2 + (thr.y - a.y) ** 2;
    } else if (sense > 0) {
      const R = Math.min(2, Math.ceil(sense / CS)), cx = a.ci % GW, cy = (a.ci / GW) | 0, s2 = sense * sense;
      const v2 = (vis * .8) ** 2;
      let budget = 70;
      scan: for (let yy = Math.max(0, cy - R); yy <= Math.min(GH - 1, cy + R); yy++)
        for (let xx = Math.max(0, cx - R); xx <= Math.min(GW - 1, cx + R); xx++) {
          const cell = grid[yy * GW + xx];
          const off = cell.length > 12 ? (rnd() * cell.length) | 0 : 0, lim = Math.min(cell.length, 12);
          for (let jj = 0; jj < lim; jj++) {
            const j = (jj + off) % cell.length;
            if (--budget < 0) break scan;
            const b = cell[j]; if (b === a || b.dead) continue;
            const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
            if (eatEff > .12 && d2 < s2 && d2 < td && canEat(a, b)) { tgt = b; td = d2; }
            if (vis > 0 && d2 < v2 && d2 < thd && b.g.d > .45 && canEat(b, a)) { thr = b; thd = d2; }
          }
        }
    }
    if (rescan) { a.tgt = tgt; a.thr = thr; }
    let spd = v * .45;
    if (thr && (!tgt || thd < td)) {
      a.ang = Math.atan2(a.y - thr.y, a.x - thr.x) + gauss() * .2; spd = v;
    } else if (tgt) {
      a.ang = Math.atan2(tgt.y - a.y, tgt.x - a.x); spd = v;
      const reach = a.r + tgt.r * .6 + g.tent * 1.4;
      if (td < reach * reach && a.cd === 0) {
        a.cd = 6;
        const pr = clamp(.85 - tgt.g.armor * .55 - tgt.g.spikes * .3 + (a.r - tgt.r) * .02, .05, .95);
        if (rnd() < pr) {
          tgt.dead = true;
          const mult = eatEff * (.5 + .5 * f) * (g.d > .7 ? (tgt.g.d < .4 ? .35 : 1) : (tgt.g.d < .4 ? 1 : .5));
          const gain = (Math.max(0, tgt.e) * .7 + tgt.r * tgt.r * .6 + 4) * mult;
          a.e += gain; a.cd = 8 + Math.min(40, gain * .6);
        } else if (tgt.g.spikes > .2) a.e -= tgt.g.spikes * 6;
      }
    } else {
      // run & tumble toward light/chemicals (autotrophs) or wander
      if (auto > .3) {
        if (--a.tumble <= 0) {
          a.tumble = 6;
          const nx = clamp(a.x + Math.cos(a.ang) * 24, 0, W - 1), ny = clamp(a.y + Math.sin(a.ang) * 24, 0, H - 1);
          const ni = fIdx(nx, ny);
          const here = (1 - g.chemo) * L + g.chemo * C, there = (1 - g.chemo) * S.fL[ni] + g.chemo * S.fC[ni];
          if (there < here) a.ang += (rnd() - .5) * 3.5;
        }
        spd = v * .35;
      } else a.ang += gauss() * .25;
    }
    a.x += Math.cos(a.ang) * spd; a.y += Math.sin(a.ang) * spd;
    if (a.x < 3) { a.x = 3; a.ang = Math.PI - a.ang; } else if (a.x > W - 3) { a.x = W - 3; a.ang = Math.PI - a.ang; }
    if (a.y < 3) { a.y = 3; a.ang = -a.ang; } else if (a.y > H - 3) { a.y = H - 3; a.ang = -a.ang; }

    // reproduction
    const thrE = 22 + r * r * .8;
    if (a.e > thrE && (g.d < .45 ? nAuto < S.capA : nHet < S.capH)) {
      if (g.d < .45) nAuto++; else nHet++;
      const [g2, macro] = mutate(g);
      a.e *= .45;
      let sp = a.sp;
      const cur = S.species.get(sp);
      if (gdist(g2, cur.proto) > SPLIT) {
        const ns = newSpecies(g2, sp, a.x, a.y); sp = ns.id;
        if (macro) ns.macro = macro;
      }
      const c = makeAgent(clamp(a.x + gauss() * 4, 3, W - 3), clamp(a.y + gauss() * 4, 3, H - 3), g2, sp, a.e);
      births.push(c);
    }
    const life = 160 + g.size * 600 + (T < 5 ? 100 : 0);
    if (a.age > life) a.dead = true;
  }

  // compact
  let w = 0;
  for (let i = 0; i < A.length; i++) if (!A[i].dead) A[w++] = A[i];
  A.length = w;
  for (const b of births) A.push(b);

  // census
  for (const sp of S.species.values()) if (sp.died === null) { sp.pop = 0; sp.rep = null; }
  for (const a of A) { const sp = S.species.get(a.sp); sp.pop++; if (!sp.rep || a.age > sp.rep.age) sp.rep = a; }
  for (const sp of S.species.values()) {
    if (sp.died !== null) continue;
    if (sp.pop > sp.maxPop) sp.maxPop = sp.pop;
    if (!sp.notable && sp.maxPop >= 6) { sp.notable = true; announce(sp); }
    if (sp.pop === 0) {
      sp.died = S.tick;
      if (sp.notable) { S.extinct++; addLog('death', `${sp.cn} 滅絕（存續 ${fmtSpan(sp.died - sp.born)}）。`); }
    }
  }
}
function canEat(a, b) {
  return (b.sp !== a.sp || a.g.d - b.g.d > .15) && b.r <= a.r * 1.05 + a.g.tent * .6 && (a.g.d > .7 || b.g.d < .5);
}

const MILES = [
  ['eye', g => g.eyeN >= 2 && g.eyeSize > .3, '首次出現能成像的眼睛'],
  ['pred', g => g.d > .72, '首批掠食者出現，食物網多了一層'],
  ['glow', g => g.glow > .5, '首次出現生物發光'],
  ['gel', g => g.pTol > .62 && g.armor < .3 && g.size > .25, '首次出現膠質軟體生物'],
  ['giant', g => g.size > .6, '首次出現巨型生物'],
  ['armor', g => g.armor > .6, '首次出現重甲防禦'],
  ['legs', g => g.limbs >= 3, '首次出現多對附肢'],
  ['radial', g => g.radial > .65 && g.size > .25, '首次出現輻射對稱的大型生物'],
  ['segs', g => g.segs >= 6, '首次出現高度分節的身體'],
  ['blind', g => g.eyeN === 0 && g.d > .6 && g.size > .3, '出現眼睛完全退化的掠食者'],
  ['dorm', g => g.dorm > .6, '首次出現能長期隱生休眠的生物'],
  ['sail', g => g.sail > .5, '首次出現靠光壓漂移的太陽帆生物'],
  ['melan', g => g.shield > .6 && g.d < .4, '首次出現以黑色素吸收輻射維生的生物']
];
function announce(sp) {
  const par = sp.parent ? S.species.get(sp.parent) : null;
  if (par) {
    const tr = traitList(sp.proto).slice(0, 2).map(x => x[0]).join('、');
    addLog('birth', `新物種 ${sp.cn} 從 ${par.cn} 分化出來${sp.macro ? `（${sp.macro}突變）` : ''}${tr ? `，特徵：${tr}` : ''}。`);
  }
  for (const [k, test, txt] of MILES) if (!S.milestones[k] && test(sp.proto)) {
    S.milestones[k] = 1; addLog('mile', `里程碑：${txt}（${sp.cn}）。`);
  }
}
function fmtYears(t) {
  const y = t * (S.scene && S.scene.tickYears || TICK_YEARS);
  if (y < 1e4) return (y < 100 ? y.toFixed(1) : Math.round(y).toLocaleString()) + ' 年';
  if (y < 1e6) return (y / 1e4).toFixed(0) + ' 萬年';
  if (y < 1e8) return (y / 1e6).toFixed(1) + ' 百萬年';
  return (y / 1e8).toFixed(2) + ' 億年';
}
function fmtSpan(t) { return fmtYears(t); }

/* ---------- explanations ---------- */
function explain(sp) {
  const g = sp.proto, e = S.env, out = [];
  const tc = -30 + g.tOpt * 140, lowLight = sp.birthL < .25;
  if (g.d < .3) {
    if (g.chemo > .6) out.push(S.scene.space ? '不靠星光，而是分解彗星噴口湧出的有機分子取得能量。彗星冰裡確實含有胺基酸甘胺酸等有機物。' : '不靠陽光，而是從熱泉或礦脈湧出的化學物質中取得能量，這叫化學合成，就像熱泉旁的硫細菌。');
    else out.push('靠光合作用把光變成能量，是這個生態系的生產者。');
  } else if (g.d < .5) out.push('半自營半攝食：還保有一點光合或化學合成能力，同時開始吞食更小的細胞。');
  else if (g.d < .72) out.push('草食者，專門啃食生產者。');
  else out.push('掠食者，會獵捕其他動物。');
  if (g.eyeN === 0 && g.d > .45 && lowLight) out.push('環境幾乎無光，維持眼睛卻要耗能，祖先的眼睛因此逐漸退化消失，改用觸覺和化學感知。');
  else if (g.eyeN >= 4) out.push(`有 ${g.eyeN} 隻眼睛。光線充足時，多眼能更早發現掠食者或獵物。`);
  else if (g.eyeN > 0 && g.eyeSize > .65) out.push('眼睛特別大，能在微弱光線下收集更多光子，深海魚也有這種適應。');
  if (g.glow > .45 && g.d > .6 && lowLight) out.push('在黑暗中用生物發光誘使獵物靠近，跟鮟鱇魚頭上的發光誘餌是同一套策略。');
  else if (g.glow > .45) out.push('身上有發光器。');
  if (S.scene.space) {
    if (g.shield > .5 && g.d < .4) out.push('細胞裡堆滿黑色素，不但擋住輻射，還能把輻射能量轉成化學能，就像車諾比反應爐裡長出的黑色真菌。');
    else if (g.shield > .5) out.push('黑色素外殼擋住宇宙射線和紫外線，保護 DNA 不被打碎。');
    if (g.dorm > .5) out.push('環境惡劣時會脫水進入隱生狀態，代謝幾乎停止，靠這招撐過遠日點的漫長寒冬，就像曾在太空真空中存活的水熊蟲。');
    if (g.sail > .4) out.push('長出巨大的薄膜帆，既是光合作用的葉面，也能乘著恆星光壓漂移。');
    if (g.size > .5 && e.grav < .35) out.push('彗星重力只有地球的萬分之一，不需要骨骼支撐，身體可以長得巨大又脆弱。');
  } else if (g.size > .6 && e.o2 > .45) out.push('含氧量高，大體型的呼吸成本較低，所以長得特別巨大，類似石炭紀翼展 70 公分的巨脈蜻蜓。');
  else if (g.size > .6) out.push('體型巨大，被吃的風險低，但需要大量食物。');
  else if (g.size < .12 && e.o2 < .35) out.push('含氧量低，小體型靠擴散就能取得足夠的氧，因此一直維持微小。');
  if (g.pTol > .62 && g.armor < .3 && g.size > .2) out.push('在高壓下，硬殼和氣腔都很吃虧，牠演化成柔軟透明的膠質身體，內外壓力平衡。');
  if (g.armor > .55) out.push('厚重的甲殼可以擋下掠食者的攻擊，代價是動作變慢、耗能變高。');
  if (g.spikes > .45) out.push('全身棘刺讓掠食者吞下時付出代價，常常放棄。');
  if (tc > 55) out.push(`最適溫度約 ${Math.round(tc)}°C，蛋白質在高溫下仍保持穩定，屬於嗜熱生物。`);
  else if (tc < 0) out.push(`最適溫度約 ${Math.round(tc)}°C，體內可能有抗凍蛋白，防止細胞結冰。`);
  if (g.dry > .6) out.push('環境乾燥，牠長出防水的蠟質外皮減少失水，就像沙漠甲蟲。');
  if (g.tent >= 3 && g.d > .5) out.push(`${g.tent} 條觸手大幅擴大了捕食範圍。`);
  if (g.limbs >= 2 && !S.scene.aquatic) out.push(`${g.limbs} 對附肢讓牠在岩面上移動得更快，沒有腳的生物在陸地上幾乎寸步難行。`);
  if (g.segs >= 5) out.push(`身體分成 ${g.segs} 節。分節來自基因複製，重複的模組讓身體更靈活，也是日後各節特化的原料。`);
  if (g.radial > .62 && g.segs <= 3) out.push('輻射對稱，沒有前後之分，適合漂浮或固著，從各個方向感知環境。');
  return out;
}

S.setScene = setScene; S.reset = reset; S.setParam = setParam; S.sprinkle = sprinkle; S.sprinkleScatter = sprinkleScatter;
S.event = event; S.step = step; S.fieldAt = fieldAt; S.fmtYears = fmtYears; S.explain = explain; S.computeFields = computeFields;
S.traitList = traitList;
root.SIM = S;
})(typeof window !== 'undefined' ? window : globalThis);
