// Duel profiler: node perf.js [pairs e.g. QR,NB,BP] [real=0|1] [html]
// Runs CPU-vs-CPU duels on a phone-sized touch page with a fake 60 Hz clock and reports draw calls, triangles,
// shader programs compiled mid-fight (each one is a visible hitch on a phone), script time per frame and page errors.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const pairs = (process.argv[2] || 'QR,NB,RP').split(','), real = process.argv[3] === '1', html = process.argv[4] || 'out/index.html';
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const T = path.join(__dirname, 'node_modules/three');
  await p.route('**/*', r => { const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
    const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
    if (u.startsWith('file:')) return r.continue(); return r.abort(); });
  let errs = 0;
  p.on('pageerror', e => { errs++; console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')); });
  p.on('console', m => { if (m.type() === 'error') { console.log('[console.error]', m.text().slice(0, 300)); } });
  await p.addInitScript(() => { // fake clock: every animation frame is exactly 1/60 s
    let now = 1000; const q = []; window.__clk = { n: 0 };
    performance.now = () => now;
    window.requestAnimationFrame = fn => { q.push(fn); return q.length; };
    window.__pump = () => { now += 1000 / 60; window.__clk.n++; const l = q.splice(0); for (const f of l) f(now); };
  });
  await p.goto('file://' + path.resolve(__dirname, html)); await p.waitForTimeout(800);
  for (const pr of pairs) for (const stage of (process.env.STAGES || '0,1,2').split(',').map(Number)) {
    const res = await p.evaluate(async ([a, d, stage, real]) => {
      const h = window.__h2h, R3 = h.R3; h.CONFIG.human = null;
      let done = null;
      if (R3.composer && R3.composer.__r) R3.composer.render = R3.composer.__r;
      const F = h.startFight({ t: a, c: 'w', hp: h.STATS[a].hp, id: 901 }, { t: d, c: 'b', hp: h.STATS[d].hp, id: 902 }, r => { done = r; }, { stage, ai: 2 });
      F.skip = false;
      const info = R3.renderer.info; info.autoReset = false;
      const rr = R3.renderer.render.bind(R3.renderer); let skipDraw = !real;
      const out = { pair: a + d, stage, frames: 0, maxCalls: 0, maxTris: 0, fightCalls: 0, fightN: 0, compiles: [], js: 0, worst: 0, heap0: 0 };
      let progs = 0, phase = '', t0 = Date.now();
      const realNow = Date.now; let jsAcc = 0;
      for (let i = 0; i < 60 * 70 && !done; i++) {
        const draw = real || i % 20 === 0 || F.phase !== phase; // sample real renders
        if (R3.composer) R3.composer.__r = R3.composer.__r || R3.composer.render;
        if (R3.composer) R3.composer.render = draw ? R3.composer.__r : () => {};
        info.reset();
        const s = window.__realPerf ? 0 : 0; const ts = realNow();
        window.__pump();
        const el = realNow() - ts; if (!draw) { jsAcc += el; out.frames++; out.worst = Math.max(out.worst, el); }
        if (draw) { out.maxCalls = Math.max(out.maxCalls, info.render.calls); out.maxTris = Math.max(out.maxTris, info.render.triangles); if (F.phase === 'fight') { out.fightCalls += info.render.calls; out.fightN++; } }
        const np = info.programs ? info.programs.length : 0;
        if (np > progs && progs && window.__seen) { for (const pg of info.programs) if (!window.__seen.has(pg.cacheKey)) { const o = [...window.__seen].sort((x, y) => { const d = k => { const A = k.split(','), B = pg.cacheKey.split(','); let n = 0; for (let i = 0; i < B.length; i++) if (A[i] !== B[i]) n++; return n; }; return d(x) - d(y); })[0].split(','); console.error('NEWPROG ' + F.phase + ' ' + pg.name + ' diff: ' + pg.cacheKey.split(',').map((v, i) => v !== o[i] ? i + ':' + o[i] + '>' + v : '').filter(Boolean).join(' ').slice(0, 200)); } }
        window.__seen = new Set(info.programs.map(pg => pg.cacheKey));
        if (np !== progs) { out.compiles.push(`${F.phase}@${(F.phase === 'fight' ? F.t : F.phaseT || F.outroT || 0).toFixed(1)}:${np - progs > 0 ? '+' : ''}${np - progs}`); progs = np; }
        phase = F.phase;
        if (i % 50 === 0) await new Promise(r => setTimeout(r, 0));
        if (F.ending) { await new Promise(r => setTimeout(r, 800)); }
      }
      for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 30)); window.__pump(); }
      out.js = +(jsAcc / Math.max(1, out.frames)).toFixed(3); out.fightCalls = Math.round(out.fightCalls / Math.max(1, out.fightN));
      out.ended = !!done; out.meshes = 0; R3.scene.traverse(o => { if (o.isMesh && o.visible) out.meshes++; });
      out.geoms = info.memory.geometries; out.kids = R3.scene.children.length; out.lights = 0; R3.scene.traverse(o => { if (o.isLight && o.visible) out.lights++; }); out.tex = info.memory.textures; out.wall = Date.now() - t0;
      return out;
    }, [pr[0], pr[1], stage, real]);
    console.log(JSON.stringify(res));
  }
  console.log('page errors:', errs);
  await b.close();
})();
