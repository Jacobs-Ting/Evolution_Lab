/* ---------- procedural creature renderer ---------- */
const TAU = Math.PI * 2;
function cpal(g) {
  const hue = g.hue * 360;
  const gel = g.pTol > .6 && g.armor < .3 && g.size > .15;
  const sh = g.shield || 0;
  const sat = 42 + g.armor * 14 + g.d * 22 - sh * 24;
  const lit = gel ? 74 - sh * 30 : 56 - g.armor * 16 - sh * 30;
  return {
    hue, gel,
    fill: `hsla(${hue},${sat}%,${lit}%,${gel ? .42 : 1})`,
    fill2: `hsla(${(hue + 18) % 360},${sat + 8}%,${gel ? 80 : lit + 12}%,${gel ? .35 : 1})`,
    edge: `hsla(${hue},${sat + 12}%,${gel ? 88 : Math.max(14, lit - 30)}%,${gel ? .9 : 1})`,
    organ: `hsla(${(hue + 330) % 360},55%,40%,.7)`,
    glow: `hsl(${175 + (g.hue * 50 | 0)},95%,68%)`,
    frond: `hsl(${(hue * .3 + 95) % 360},48%,${g.chemo > .6 ? 60 : 40}%)`
  };
}
function glowDot(ctx, x, y, rad, col) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, col); gr.addColorStop(.35, col.replace('hsl', 'hsla').replace(')', ',.45)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); ctx.restore();
}
function drawSail(ctx, g, r, ph, P, radial) {
  const span = r * (1.2 + g.sail * 3.2), fl = Math.sin(ph * .6) * .08;
  ctx.fillStyle = `hsla(${(P.hue + 40) % 360},75%,78%,.26)`;
  ctx.strokeStyle = `hsla(${(P.hue + 40) % 360},70%,85%,.55)`; ctx.lineWidth = Math.max(.5, r * .05);
  if (radial) {
    const n = 8; ctx.beginPath();
    for (let k = 0; k <= n * 2; k++) { const a = k / (n * 2) * TAU, rr = span * (k % 2 ? .82 : 1) * (1 + fl); k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.fill();
    for (let k = 0; k < n; k++) { const a = k / n * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * span, Math.sin(a) * span); ctx.stroke(); }
    return;
  }
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(r * .3, 0);
    ctx.quadraticCurveTo(r * .2, side * span * (1.05 + fl), -span * .35, side * span * (1 + fl));
    ctx.quadraticCurveTo(-span * .75, side * span * .55, -span * .9, 0);
    ctx.closePath(); ctx.fill();
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-span * .3 * k, side * span * (1 - k * .22)); ctx.stroke(); }
  }
}
function drawTun(ctx, g, r) {
  const P = cpal(g), rr = Math.max(1.4, r * .62);
  ctx.fillStyle = `hsla(${P.hue},18%,${38 - (g.shield || 0) * 18}%,.95)`;
  ctx.beginPath(); ctx.ellipse(0, 0, rr * 1.25, rr * .8, 0, 0, TAU); ctx.fill();
  if (rr > 2.5) {
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(.4, rr * .12);
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * rr * .45, -rr * .7); ctx.lineTo(k * rr * .45, rr * .7); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,235,255,.35)'; ctx.lineWidth = Math.max(.4, rr * .1);
    ctx.beginPath(); ctx.ellipse(0, 0, rr * 1.25, rr * .8, 0, 3.6, 5.4); ctx.stroke();
  }
}

/* ---------- vertebrates ---------- */
function vSpine(n, L, amp, ph, k, tailOnly) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = L * .5 - t * L;
    const y = Math.sin(ph * 1.6 - t * k) * amp * Math.pow(t, tailOnly ? 1.4 : .9);
    pts.push({ t, x, y });
  }
  return pts;
}
function outline(ctx, pts, wf) {
  ctx.beginPath();
  pts.forEach((p, i) => { const w = wf(p.t); i ? ctx.lineTo(p.x, p.y - w) : ctx.moveTo(p.x, p.y - w); });
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i], w = wf(p.t); ctx.lineTo(p.x, p.y + w); }
  ctx.closePath();
}
function at(pts, t) {
  const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i, a = pts[i], b = pts[i + 1];
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, ang: Math.atan2(b.y - a.y, b.x - a.x) + Math.PI };
}
function drawFish(ctx, g, r, ph, P, detail) {
  const eel = g.segs >= 7, shark = g.jaw > .5 && g.d > .78 && g.size > .4, agn = g.jaw < .5;
  const L = r * (2.5 + g.segs * .14 + (eel ? 1.2 : 0));
  const h = r * (eel ? .36 : .6 + g.armor * .1 + (shark ? .05 : 0));
  const amp = r * (eel ? .45 : .2) * (.5 + g.speed);
  const pts = vSpine(16, L, amp, ph, eel ? 7 : 4.2, !eel);
  const wf = t => eel ? h * (t < .1 ? .45 + 5.5 * t : 1 - .75 * t) : h * (t < .2 ? .35 + .65 * Math.sqrt(t / .2) : 1 - .84 * Math.pow((t - .2) / .8, 1.25));
  const lw = Math.max(.7, r * .07);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const tail = pts[pts.length - 1], pre = pts[pts.length - 3], ta = Math.atan2(tail.y - pre.y, tail.x - pre.x);
  const finCol = P.gel ? P.fill2 : `hsla(${(P.hue + 12) % 360},45%,${P.gel ? 75 : 46}%,.85)`;
  // caudal fin
  ctx.save(); ctx.translate(tail.x, tail.y); ctx.rotate(ta);
  const cf = r * (eel ? .35 : .75 + g.speed * .55);
  ctx.fillStyle = finCol; ctx.beginPath(); ctx.moveTo(-r * .1, 0);
  if (eel) { ctx.ellipse(cf * .4, 0, cf, cf * .45, 0, 0, TAU); }
  else if (g.speed > .45 || shark) {
    ctx.quadraticCurveTo(cf * .5, -cf * .2, cf * 1.05, -cf * (shark ? 1.15 : .95));
    ctx.quadraticCurveTo(cf * .55, -cf * .1, cf * .62, 0);
    ctx.quadraticCurveTo(cf * .55, cf * .1, cf * (shark ? .8 : 1.05), cf * (shark ? .65 : .95));
    ctx.quadraticCurveTo(cf * .5, cf * .2, -r * .1, 0);
  } else { ctx.quadraticCurveTo(cf * .9, -cf * .95, cf * 1.05, 0); ctx.quadraticCurveTo(cf * .9, cf * .95, -r * .1, 0); }
  ctx.fill(); ctx.strokeStyle = P.edge; ctx.lineWidth = lw * .6; ctx.stroke();
  if (detail && !eel) { ctx.strokeStyle = 'rgba(0,0,0,.18)'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cf * .9, k * cf * .35); ctx.stroke(); } }
  ctx.restore();
  // dorsal fin(s)
  const dfin = (t0, t1, hgt, spiny) => {
    const a = at(pts, t0), b = at(pts, t1), m = at(pts, (t0 + t1) / 2);
    ctx.fillStyle = finCol; ctx.beginPath(); ctx.moveTo(a.x, a.y - wf(t0) * .9);
    ctx.quadraticCurveTo(m.x + r * .1, m.y - wf((t0 + t1) / 2) - hgt * 1.3, b.x - r * .05, b.y - wf(t1) - hgt * (shark ? .1 : .35));
    ctx.lineTo(b.x, b.y - wf(t1) * .9); ctx.closePath(); ctx.fill(); ctx.strokeStyle = P.edge; ctx.lineWidth = lw * .5; ctx.stroke();
    if (spiny) { ctx.strokeStyle = P.edge; ctx.lineWidth = Math.max(.6, r * .05);
      for (let k = 0; k <= 4; k++) { const q = at(pts, t0 + (t1 - t0) * k / 4); ctx.beginPath(); ctx.moveTo(q.x, q.y - wf(q.t || t0) * .8); ctx.lineTo(q.x + r * .08, q.y - wf(t0 + (t1 - t0) * k / 4) - hgt * (1.5 - k * .15)); ctx.stroke(); } }
  };
  if (eel) dfin(.25, .95, r * .18, false);
  else if (shark) dfin(.32, .48, r * .95, false);
  else { dfin(.3, .55, r * (.4 + g.spikes * .3), g.spikes > .3); if (g.segs >= 4) dfin(.62, .74, r * .22, false); }
  // anal fin
  if (!eel) { const a = at(pts, .66), b = at(pts, .78); ctx.fillStyle = finCol; ctx.beginPath(); ctx.moveTo(a.x, a.y + wf(.66) * .9); ctx.lineTo(b.x - r * .15, b.y + wf(.78) + r * .3); ctx.lineTo(b.x, b.y + wf(.78) * .9); ctx.fill(); }
  // pelvic / lobe fins (behind body)
  const flap = Math.sin(ph * 2.2) * .35;
  const lobe = (t, sz) => {
    const q = at(pts, t); ctx.save(); ctx.translate(q.x, q.y + wf(t) * .55); ctx.rotate(.75 + flap);
    ctx.fillStyle = `hsla(${P.hue},40%,40%,.95)`; ctx.beginPath(); ctx.ellipse(-sz * .5, 0, sz * .6, sz * .22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = finCol; ctx.beginPath(); ctx.ellipse(-sz * 1.05, 0, sz * .45, sz * .3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.edge; ctx.lineWidth = lw * .5; ctx.stroke(); ctx.restore();
  };
  if (g.limbs >= 2) lobe(.62, r * .55);
  // body
  outline(ctx, pts, wf);
  ctx.fillStyle = P.fill; ctx.fill();
  ctx.save(); outline(ctx, pts, wf); ctx.clip();
  ctx.fillStyle = P.gel ? 'rgba(255,255,255,.12)' : 'rgba(255,248,230,.28)';
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y + wf(p.t) * .15) : ctx.moveTo(p.x, p.y + wf(p.t) * .15));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + h * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(-L, -h * 3, L * 2, h * 2.55);
  if (detail && g.armor > .25 && !P.gel) {
    ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = Math.max(.5, r * .035);
    for (let i = 3; i < 13; i++) for (let k = -1; k <= 1; k++) { const p = pts[i]; ctx.beginPath(); ctx.arc(p.x - r * .1, p.y + k * wf(p.t) * .55, r * .17, -1.1, 1.1); ctx.stroke(); }
  }
  if (g.armor > .4 && agn || g.armor > .55) { const hx = pts[0].x; ctx.fillStyle = 'rgba(30,24,20,.42)'; ctx.beginPath(); ctx.ellipse(hx - L * .1, pts[1].y, L * .2, h * 1.05, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,210,.25)'; ctx.lineWidth = Math.max(.5, r * .05); ctx.beginPath(); ctx.ellipse(hx - L * .1, pts[1].y, L * .17, h * .85, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  outline(ctx, pts, wf); ctx.strokeStyle = P.edge; ctx.lineWidth = lw; ctx.stroke();
  // lateral line
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(.5, r * .04);
  ctx.beginPath(); for (let i = 3; i < 15; i++) { const p = pts[i]; i > 3 ? ctx.lineTo(p.x, p.y - wf(p.t) * .1) : ctx.moveTo(p.x, p.y - wf(p.t) * .1); } ctx.stroke();
  // gills
  const gq = at(pts, .19); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = Math.max(.6, r * .06);
  if (agn) { ctx.fillStyle = 'rgba(0,0,0,.45)'; for (let k = 0; k < 6; k++) { const q = at(pts, .13 + k * .022); ctx.beginPath(); ctx.arc(q.x, q.y + wf(q.t || .15) * .05, Math.max(.6, r * .055), 0, TAU); ctx.fill(); } }
  else if (shark) { for (let k = 0; k < 5; k++) { const q = at(pts, .15 + k * .025); ctx.beginPath(); ctx.moveTo(q.x, q.y - h * .35); ctx.lineTo(q.x - r * .04, q.y + h * .35); ctx.stroke(); } }
  else { ctx.beginPath(); ctx.arc(gq.x + r * .35, gq.y, h * .8, Math.PI * .72, Math.PI * 1.28); ctx.stroke(); }
  // pectoral fin (in front of body)
  if (g.limbs >= 1) lobe(.28, r * .6);
  else { const q = at(pts, .27); ctx.save(); ctx.translate(q.x, q.y + h * .25); ctx.rotate(.55 + flap);
    ctx.fillStyle = finCol; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-r * .45, r * .05, -r * (shark ? 1 : .7), r * (shark ? .55 : .3)); ctx.quadraticCurveTo(-r * .3, -r * .08, 0, 0); ctx.fill(); ctx.restore(); }
  // head: mouth, eyes, lure, photophores
  const hd = pts[0];
  if (agn) { ctx.fillStyle = 'rgba(20,10,10,.7)'; ctx.beginPath(); ctx.arc(hd.x - r * .02, hd.y + h * .15, Math.max(.7, h * .2), 0, TAU); ctx.fill(); }
  else {
    const gape = g.d > .72 ? (Math.sin(ph * 2.6) * .5 + .5) * h * .35 : h * .06, mx = hd.x - L * (shark ? .1 : .07);
    ctx.fillStyle = 'rgba(25,10,12,.85)'; ctx.beginPath(); ctx.moveTo(hd.x + r * .02, hd.y + h * .1); ctx.lineTo(mx, hd.y + h * .25); ctx.lineTo(hd.x, hd.y + h * .1 + gape); ctx.closePath(); ctx.fill();
    if (g.d > .72 && (detail || r > 6)) { ctx.fillStyle = '#f2ecdc'; const n = 5; for (let k = 0; k < n; k++) { const u = k / n, x = hd.x - (hd.x - mx) * u, y = hd.y + h * .1 + h * .15 * u; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - r * .05, y + r * .1); ctx.lineTo(x - r * .1, y); ctx.fill(); } }
  }
  const ne = g.eyeN;
  if (ne > 0) {
    const er = Math.max(.9, h * (.16 + g.eyeSize * .22));
    for (let k = 0; k < Math.min(ne - 1, 4) + 1; k++) {
      const q = at(pts, .07 + k * .045), ey = q.y - h * (k % 2 ? .05 : .32);
      ctx.fillStyle = '#f4f0e2'; ctx.beginPath(); ctx.arc(q.x, ey, er * (k ? .75 : 1), 0, TAU); ctx.fill();
      ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.arc(q.x + er * .15, ey, er * (k ? .75 : 1) * .6, 0, TAU); ctx.fill();
      if (detail) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(q.x + er * .3, ey - er * .3, er * .18, 0, TAU); ctx.fill(); }
    }
  } else { const q = at(pts, .07); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(q.x, q.y - h * .3, Math.max(.6, h * .1), 0, TAU); ctx.fill(); }
  if (g.glow > .2) for (let k = 0; k < 7; k++) { const q = at(pts, .2 + k * .1); glowDot(ctx, q.x, q.y + wf(q.t || .2) * .7, Math.max(1.3, r * .16 * g.glow + r * .05), P.glow); }
  if (g.glow > .45 && g.d > .6) {
    const bx = hd.x + r * .8, by = hd.y - h * 1.6 + Math.sin(ph) * r * .15;
    ctx.strokeStyle = P.edge; ctx.lineWidth = Math.max(.6, r * .05); ctx.beginPath(); ctx.moveTo(hd.x - L * .1, hd.y - h * .8); ctx.quadraticCurveTo(hd.x + r * .2, hd.y - h * 2.2, bx, by); ctx.stroke();
    glowDot(ctx, bx, by, r * (.35 + g.glow * .3), P.glow);
  }
}
function drawTetrapod(ctx, g, r, ph, P, detail) {
  const frog = g.segs <= 3 && g.limbs >= 2, legless = g.limbs < 2, cave = SIM.scene.key === 'cave' && g.eyeN === 0;
  const L = r * (legless ? 3.4 + g.segs * .2 : frog ? 1.7 : 2.6 + g.segs * .12);
  const big = g.d > .78 && g.size > .45;
  const amp = r * (legless ? .45 : frog ? 0 : .22);
  const pts = vSpine(16, L, amp, ph * (legless ? 1 : .9), legless ? 6.5 : 3.5, false);
  const hw = r * (big ? .62 : .5);
  const wf = legless ? (t => r * .38 * (t < .06 ? .55 + 7.5 * t : t > .92 ? 1 - (t - .92) * 9 : 1))
    : frog ? (t => r * (t < .25 ? .45 + .9 * t : t < .8 ? .68 + .1 * Math.sin((t - .25) / .55 * Math.PI) : .78 - (t - .8) * 3.3))
    : (t => t < .16 ? hw * (.55 + 2.8 * t) : t < .22 ? hw * (1 - (t - .16) * 2.5) : t < .6 ? hw * (.88 + .18 * Math.sin((t - .22) / .38 * Math.PI)) : hw * .88 * Math.pow(1 - (t - .6) / .4, 1.1) + r * .02);
  const sk = cave ? 'hsl(350,35%,82%)' : P.fill, sk2 = cave ? 'hsl(350,40%,72%)' : P.fill2;
  const edge = cave ? 'hsl(350,30%,55%)' : P.edge, lw = Math.max(.7, r * .07);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // legs
  if (!legless) {
    const leg = (t, side, hind, phase) => {
      const q = at(pts, t), w = wf(t), sw = Math.sin(ph * 2.2 + phase);
      const len = r * (hind ? (frog ? 1.25 : .8) : (frog ? .55 : .7)) * (big ? 1.15 : 1);
      const bx = q.x, by = q.y + side * w * .8;
      const dir = hind ? -1 : 1;
      const kx = bx + dir * (frog && hind ? -len * .1 : len * .25 + sw * len * .25), ky = by + side * len * (frog && hind ? .55 : .7);
      const fx = kx + dir * (frog && hind ? len * .65 : len * .3 - sw * len * .2), fy = ky + side * len * (frog && hind ? -.05 : .25);
      ctx.strokeStyle = sk; ctx.lineWidth = Math.max(1.1, r * (hind && frog ? .26 : .18));
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = edge; ctx.lineWidth = Math.max(.5, r * .06);
      const toes = 4;
      for (let k = 0; k < toes; k++) { const a = (dir > 0 ? 0 : Math.PI) + side * (-.5 + k * .38); const tl = r * (frog && hind ? .32 : .2);
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(a) * tl, fy + Math.sin(a) * tl * side * side); ctx.stroke();
        if (detail) { ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * tl, fy + Math.sin(a) * tl, Math.max(.5, r * .045), 0, TAU); ctx.fill(); } }
    };
    const fT = frog ? .3 : .24, hT = frog ? .78 : .58;
    leg(fT, -1, false, 0); leg(fT, 1, false, Math.PI); leg(hT, -1, true, Math.PI); leg(hT, 1, true, 0);
  }
  // external gills (axolotl / olm)
  if (cave || (g.eyeN === 0 && !legless)) {
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const q = at(pts, .17), a = side * (1.9 + k * .32) + Math.sin(ph + k) * .1, len = r * (.5 - k * .06);
      ctx.strokeStyle = 'hsl(352,70%,62%)'; ctx.lineWidth = Math.max(.7, r * .07);
      const ex = q.x + Math.cos(a) * len, ey = q.y + Math.sin(a) * len + side * wf(.17) * .6;
      ctx.beginPath(); ctx.moveTo(q.x, q.y + side * wf(.17) * .7); ctx.lineTo(ex, ey); ctx.stroke();
      if (detail) { ctx.lineWidth = Math.max(.4, r * .025); for (let j = 1; j < 4; j++) { const u = j / 4, px = q.x + (ex - q.x) * u, py = q.y + side * wf(.17) * .7 + (ey - q.y - side * wf(.17) * .7) * u; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - r * .08, py + side * r * .07); ctx.stroke(); } }
    }
  }
  // body
  outline(ctx, pts, wf); ctx.fillStyle = sk; ctx.fill();
  ctx.save(); outline(ctx, pts, wf); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,.12)'; pts.forEach(p => { if (p.t > .05) { ctx.beginPath(); ctx.ellipse(p.x, p.y, L / 30, wf(p.t) * .35, 0, 0, TAU); ctx.fill(); } });
  if (legless) { ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = Math.max(.5, r * .04); for (let i = 2; i < 15; i++) { const p = pts[i]; ctx.beginPath(); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r); ctx.stroke(); } }
  else if (!cave) {
    ctx.fillStyle = sk2;
    for (let i = 3; i < (frog ? 13 : 14); i += 2) for (const side of [-1, 1]) { const p = pts[i]; ctx.beginPath(); ctx.arc(p.x + (i % 4 ? r * .1 : 0), p.y + side * wf(p.t) * .45, Math.max(.6, wf(p.t) * .2), 0, TAU); ctx.fill(); }
  }
  if (g.armor > .45) { ctx.fillStyle = 'rgba(40,30,25,.4)'; for (let i = 3; i < 12; i++) { const p = pts[i]; ctx.fillRect(p.x - L / 36, p.y - wf(p.t) * .3, L / 20, wf(p.t) * .6); } }
  ctx.restore();
  outline(ctx, pts, wf); ctx.strokeStyle = edge; ctx.lineWidth = lw; ctx.stroke();
  if (g.spikes > .35) { ctx.fillStyle = edge; for (let i = 4; i < 13; i++) { const p = pts[i]; ctx.beginPath(); ctx.moveTo(p.x - r * .08, p.y); ctx.lineTo(p.x + r * .05, p.y - r * .05); ctx.lineTo(p.x + r * .05, p.y + r * .05); ctx.fill(); } }
  if (g.glow > .25) for (let i = 3; i < 13; i += 2) for (const side of [-1, 1]) { const p = pts[i]; glowDot(ctx, p.x, p.y + side * wf(p.t) * .5, Math.max(1.3, r * .2 * g.glow + r * .05), P.glow); }
  // eyes on top of head
  const hd = at(pts, frog ? .1 : .07);
  if (g.eyeN > 0) {
    const er = Math.max(.9, r * (.13 + g.eyeSize * .16) * (frog ? 1.35 : 1));
    for (const side of [-1, 1]) { const ex = hd.x - r * .05, ey = hd.y + side * wf(.08) * .62;
      ctx.fillStyle = frog ? sk : '#f4f0e2'; ctx.beginPath(); ctx.arc(ex, ey, er * 1.15, 0, TAU); ctx.fill();
      ctx.fillStyle = frog ? '#d9b44a' : '#f4f0e2'; ctx.beginPath(); ctx.arc(ex, ey, er * .9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.ellipse(ex + er * .1, ey, er * .55, er * (frog ? .3 : .55), 0, 0, TAU); ctx.fill(); }
    if (g.eyeN > 2) for (let k = 2; k < Math.min(g.eyeN, 5); k++) { const q = at(pts, .12 + (k - 2) * .04); ctx.fillStyle = '#f4f0e2'; ctx.beginPath(); ctx.arc(q.x, q.y, er * .6, 0, TAU); ctx.fill(); ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.arc(q.x, q.y, er * .35, 0, TAU); ctx.fill(); }
  } else if (legless) { ctx.fillStyle = 'rgba(0,0,0,.35)'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(hd.x - r * .1, hd.y + side * r * .16, Math.max(.5, r * .05), 0, TAU); ctx.fill(); } }
  if (big && detail) { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(.6, r * .05); ctx.beginPath(); ctx.moveTo(pts[0].x - r * .05, pts[0].y); ctx.lineTo(hd.x - r * .5, hd.y); ctx.stroke(); }
}
function drawVert(ctx, g, r, ph, P, detail) {
  if (SIM.scene.aquatic) drawFish(ctx, g, r, ph, P, detail);
  else drawTetrapod(ctx, g, r, ph, P, detail);
}
function drawCreature(ctx, g, r, ph, detail, dorm) {
  if (dorm) return drawTun(ctx, g, r);
  const P = cpal(g);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (r < 3.3 && !detail && !(g.spine > .5)) {
    ctx.fillStyle = P.fill; ctx.beginPath(); ctx.arc(0, 0, Math.max(1.5, r), 0, TAU); ctx.fill();
    if (g.glow > .4) glowDot(ctx, 0, 0, r * 3, P.glow);
    return;
  }
  if (g.spine > .5) return drawVert(ctx, g, r, ph, P, detail);
  const radial = g.radial > .62 && g.segs <= 3;
  if ((g.sail || 0) > .15) drawSail(ctx, g, r, ph, P, radial);
  if (radial) return drawRadial(ctx, g, r, ph, P, detail);
  drawBilateral(ctx, g, r, ph, P, detail);
}
function drawBilateral(ctx, g, r, ph, P, detail) {
  const n = g.segs, sp = r * .62, hx = (n - 1) * sp / 2;
  const S = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const rr = n === 1 ? r : r * (.74 - .36 * Math.pow(t, 1.25)) * (i === 0 ? 1.06 : 1);
    S.push({ x: hx - i * sp, y: n > 1 ? Math.sin(ph - i * .9) * r * .13 * (.4 + g.speed) : 0, r: rr });
  }
  const H = S[0], lw = Math.max(.9, r * .1);
  const isCell = n === 1 && g.limbs === 0 && g.size < .22;
  // flagellum
  if (isCell && g.speed > .06) {
    ctx.strokeStyle = P.edge; ctx.lineWidth = Math.max(.7, r * .12); ctx.beginPath();
    for (let k = 0; k <= 12; k++) { const x = -r * 1.05 - k * r * .22, y = Math.sin(ph * 2 - k * .8) * r * .25 * (k / 12 + .3); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  // tentacles
  if (g.tent > 0) {
    const fwd = g.d > .5, base = fwd ? H : S[n - 1], dir = fwd ? 1 : -1, cnt = g.tent;
    const L = r * (1.25 + cnt * .1) * (fwd ? 1 : 1.2);
    ctx.strokeStyle = P.fill2;
    for (let k = 0; k < cnt; k++) {
      const a = (-.85 + 1.7 * (k + .5) / cnt) * (fwd ? 1 : 1.3);
      const bx = base.x + dir * Math.cos(a) * base.r * .8, by = base.y + Math.sin(a) * base.r * .8;
      const w = Math.sin(ph * 1.4 + k * 1.3) * .5;
      const ex = bx + dir * Math.cos(a + w * .6) * L, ey = by + Math.sin(a * 1.4 + w) * L * .75;
      const mx = bx + dir * Math.cos(a - w) * L * .55, my = by + Math.sin(a - w * .8) * L * .5;
      ctx.lineWidth = Math.max(.7, r * .13); ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      if (detail && g.d > .6) { ctx.fillStyle = P.edge; ctx.beginPath(); ctx.arc(ex, ey, r * .07, 0, TAU); ctx.fill(); }
    }
  }
  // legs
  if (g.limbs > 0) {
    const pairs = g.limbs, L = r * (.85 + g.speed * .55);
    ctx.strokeStyle = P.edge; ctx.lineWidth = Math.max(.8, r * .1);
    for (let k = 0; k < pairs; k++) {
      let s, ox = 0;
      if (n === 1) { s = H; ox = (pairs === 1 ? 0 : (k / (pairs - 1) - .5) * r * 1.2); }
      else s = S[Math.min(n - 1, Math.max(0, Math.round((k + .5) * n / pairs - .5)))];
      for (const side of [-1, 1]) {
        const sw = Math.sin(ph * 2.2 + k * 1.7 + (side > 0 ? Math.PI : 0)) * .55;
        const bx = s.x + ox, by = s.y + side * s.r * .75;
        const kx = bx + Math.cos(sw) * L * .35, ky = by + side * L * .62;
        const fx = kx + Math.sin(sw) * L * .5 - L * .18, fy = ky + side * L * .45;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
        if (g.armor > .45 && k === 0 && g.d > .6) { // claw
          ctx.fillStyle = P.edge; ctx.beginPath(); ctx.ellipse(fx + L * .1, fy, L * .22, L * .12, side * .4, 0, TAU); ctx.fill();
        }
      }
    }
  }
  // fronds / filaments for producers
  if (g.d < .3 && g.size > .18) {
    if (g.chemo > .6) {
      ctx.strokeStyle = P.frond; ctx.lineWidth = Math.max(.5, r * .05);
      const m = 10 + n * 4;
      for (let k = 0; k < m; k++) {
        const s = S[k % n], a = k / m * TAU, w = Math.sin(ph + k) * .3;
        ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a) * s.r * .9, s.y + Math.sin(a) * s.r * .9);
        ctx.lineTo(s.x + Math.cos(a + w) * s.r * 1.6, s.y + Math.sin(a + w) * s.r * 1.6); ctx.stroke();
      }
    } else {
      const m = Math.min(7, 2 + n);
      for (let k = 0; k < m; k++) {
        const s = S[Math.min(n - 1, k % n)], side = k % 2 ? 1 : -1, w = Math.sin(ph * .7 + k) * .15;
        const a = side * (1.2 + k * .15) + Math.PI * .15 + w;
        const lx = s.x + Math.cos(Math.PI - .3 + a * .2) * r * .2, ly = s.y;
        const L = r * (1.1 + (k % 3) * .25);
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(Math.PI + a * .55 * side * side - (side > 0 ? -.6 : .6) + w);
        ctx.fillStyle = P.frond; ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(L * .5, -L * .32, L, 0); ctx.quadraticCurveTo(L * .5, L * .32, 0, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = Math.max(.4, r * .04); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * .9, 0); ctx.stroke();
        ctx.restore();
      }
    }
  }
  // spikes
  const nsp = Math.round(g.spikes * 14);
  if (nsp > 0) {
    ctx.fillStyle = P.edge;
    for (let k = 0; k < nsp; k++) {
      const s = S[k % n], side = (k >> 0) % 2 ? 1 : -1, off = ((k / n | 0) % 3 - 1) * .5;
      const a = side * (Math.PI / 2 + off * .6), L = r * (.28 + g.spikes * .42);
      const bx = s.x + Math.cos(a) * s.r * .92, by = s.y + Math.sin(a) * s.r * .92;
      const nx = Math.cos(a), ny = Math.sin(a), tx = -ny, ty = nx, bw = s.r * .2;
      ctx.beginPath(); ctx.moveTo(bx + tx * bw, by + ty * bw); ctx.lineTo(bx + nx * L - tx * L * .15, by + ny * L - ty * L * .15); ctx.lineTo(bx - tx * bw, by - ty * bw); ctx.fill();
    }
  }
  // body segments
  for (let i = n - 1; i >= 0; i--) {
    const s = S[i];
    ctx.fillStyle = i % 2 && n > 2 ? P.fill2 : P.fill;
    ctx.beginPath();
    if (n === 1) ctx.ellipse(s.x, s.y, s.r * 1.15, s.r * .82, 0, 0, TAU);
    else ctx.ellipse(s.x, s.y, s.r * .95, s.r, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.edge; ctx.lineWidth = P.gel ? lw * .6 : .7 + g.armor * r * .16; ctx.stroke();
    if (g.armor > .3 && !P.gel && s.r > 3) {
      ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = Math.max(.6, r * .06);
      ctx.beginPath(); ctx.ellipse(s.x - s.r * .15, s.y, s.r * .5, s.r * .8, 0, -1.2, 1.2); ctx.stroke();
      if (g.armor > .6) { ctx.beginPath(); ctx.ellipse(s.x - s.r * .45, s.y, s.r * .3, s.r * .55, 0, -1.1, 1.1); ctx.stroke(); }
    }
  }
  // gelatinous innards / nucleus
  if (P.gel) {
    ctx.fillStyle = P.organ;
    for (let i = 0; i < n; i++) { const s = S[i]; ctx.beginPath(); ctx.ellipse(s.x - s.r * .1, s.y + s.r * .1, s.r * .32, s.r * .22, .5, 0, TAU); ctx.fill(); }
  } else if (isCell) {
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.arc(-r * .2, r * .1, r * .32, 0, TAU); ctx.fill();
  }
  // mandibles
  if (g.d > .72) {
    const o = Math.sin(ph * 3) * .25 + .35, L = H.r * (.75 + g.armor * .6);
    ctx.strokeStyle = P.edge; ctx.lineWidth = Math.max(1, r * .13);
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(H.x + H.r * .8, H.y + side * H.r * .35);
      ctx.quadraticCurveTo(H.x + H.r * .8 + L * .8, H.y + side * (H.r * .35 + L * o), H.x + H.r * .8 + L, H.y + side * H.r * .05); ctx.stroke();
    }
  }
  // eyes
  if (g.eyeN > 0) {
    const ne = g.eyeN, er = H.r * (.13 + g.eyeSize * .24) * (ne > 4 ? .7 : 1);
    for (let k = 0; k < ne; k++) {
      const a = ne === 1 ? 0 : (-.85 + 1.7 * k / (ne - 1)) * (ne > 4 ? 1.15 : 1);
      const ring = ne > 4 && k % 2 ? .3 : .55;
      const ex = H.x + Math.cos(a) * H.r * ring + H.r * .12, ey = H.y + Math.sin(a) * H.r * (ring + .1);
      ctx.fillStyle = '#f4f0e2'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.arc(ex + er * .3, ey, er * .55, 0, TAU); ctx.fill();
    }
  }
  // lure + photophores
  if (g.glow > .35 && g.d > .6) {
    const bx = H.x + H.r * 1.7, by = H.y - H.r * 1.5 + Math.sin(ph) * H.r * .2;
    ctx.strokeStyle = P.edge; ctx.lineWidth = Math.max(.7, r * .07);
    ctx.beginPath(); ctx.moveTo(H.x + H.r * .1, H.y - H.r * .7); ctx.quadraticCurveTo(H.x + H.r * .4, H.y - H.r * 2.4, bx, by); ctx.stroke();
    glowDot(ctx, bx, by, r * (.35 + g.glow * .35), P.glow);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, Math.max(.8, r * .08), 0, TAU); ctx.fill();
  }
  if (g.glow > .2) {
    const per = Math.max(1, Math.round(g.glow * 3));
    for (let i = 0; i < n; i++) for (let k = 0; k < per; k++) for (const side of [-1, 1]) {
      const s = S[i]; glowDot(ctx, s.x - s.r * .3 + k * s.r * .35, s.y + side * s.r * .55, Math.max(1.4, s.r * .28 * g.glow), P.glow);
    }
  }
}
function drawRadial(ctx, g, r, ph, P, detail) {
  const aq = SIM.scene.aquatic, med = g.d >= .45 && aq;
  const na = Math.min(14, 5 + g.limbs + Math.floor(g.tent / 2) + Math.max(0, g.segs - 1));
  const L = r * (1.05 + g.tent * .07 + (med ? .5 : 0));
  // arms / tentacles
  for (let k = 0; k < na; k++) {
    const a = k / na * TAU + ph * .05, w = Math.sin(ph * 1.3 + k * 1.1) * (med ? .35 : .12);
    const cx = Math.cos(a), cy = Math.sin(a);
    if (med || (g.d < .45 && aq && g.size < .5)) {
      ctx.strokeStyle = P.fill2; ctx.lineWidth = Math.max(.7, r * (med ? .09 : .12));
      ctx.beginPath(); ctx.moveTo(cx * r * .6, cy * r * .6);
      ctx.quadraticCurveTo(Math.cos(a + w) * L * .7, Math.sin(a + w) * L * .7, Math.cos(a - w) * L, Math.sin(a - w) * L); ctx.stroke();
      if (g.glow > .3) glowDot(ctx, Math.cos(a - w) * L, Math.sin(a - w) * L, r * .25, P.glow);
    } else {
      const tx = Math.cos(a + w) * L, ty = Math.sin(a + w) * L, bw = r * .32;
      ctx.fillStyle = k % 2 ? P.fill2 : P.fill;
      ctx.beginPath(); ctx.moveTo(-cy * bw, cx * bw);
      ctx.quadraticCurveTo(cx * L * .6 - cy * bw * .8, cy * L * .6 + cx * bw * .8, tx, ty);
      ctx.quadraticCurveTo(cx * L * .6 + cy * bw * .8, cy * L * .6 - cx * bw * .8, cy * bw, -cx * bw);
      ctx.fill(); ctx.strokeStyle = P.edge; ctx.lineWidth = .6 + g.armor * r * .1; ctx.stroke();
      if (g.spikes > .3) {
        ctx.fillStyle = P.edge;
        for (let j = 1; j <= 3; j++) { const px = cx * L * j / 4, py = cy * L * j / 4; ctx.beginPath(); ctx.arc(px, py, r * .06 * (1 + g.spikes), 0, TAU); ctx.fill(); }
      }
      if (g.eyeN > 0 && k < g.eyeN * 2) { ctx.fillStyle = '#e8473a'; ctx.beginPath(); ctx.arc(tx * .92, ty * .92, Math.max(.8, r * .08), 0, TAU); ctx.fill(); }
      if (g.glow > .3) glowDot(ctx, tx, ty, r * .28, P.glow);
    }
  }
  // disc / bell
  ctx.fillStyle = P.fill; ctx.beginPath();
  if (med) {
    const sc = 10;
    for (let k = 0; k <= sc * 2; k++) { const a = k / (sc * 2) * TAU, rr = r * (.82 + (k % 2) * .08) * (1 + Math.sin(ph * 1.5) * .05); k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  } else ctx.arc(0, 0, r * .62, 0, TAU);
  ctx.fill(); ctx.strokeStyle = P.edge; ctx.lineWidth = .7 + g.armor * r * .12; ctx.stroke();
  ctx.strokeStyle = P.fill2; ctx.lineWidth = Math.max(.6, r * .07);
  ctx.beginPath(); ctx.arc(0, 0, r * (med ? .45 : .32), 0, TAU); ctx.stroke();
  if (P.gel || med) {
    ctx.fillStyle = P.organ;
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + .4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * .28, Math.sin(a) * r * .28, r * .14, r * .08, a, 0, TAU); ctx.fill(); }
  }
  if (med && g.eyeN > 0) for (let k = 0; k < Math.min(8, g.eyeN * 2); k++) { const a = k / Math.min(8, g.eyeN * 2) * TAU; ctx.fillStyle = '#1a1010'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .78, Math.sin(a) * r * .78, Math.max(.7, r * .06), 0, TAU); ctx.fill(); }
}
