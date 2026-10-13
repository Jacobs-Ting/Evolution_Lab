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
function drawCreature(ctx, g, r, ph, detail, dorm) {
  if (dorm) return drawTun(ctx, g, r);
  const P = cpal(g);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (r < 3.3 && !detail) {
    ctx.fillStyle = P.fill; ctx.beginPath(); ctx.arc(0, 0, Math.max(1.5, r), 0, TAU); ctx.fill();
    if (g.glow > .4) glowDot(ctx, 0, 0, r * 3, P.glow);
    return;
  }
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
