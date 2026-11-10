// node t/meshcount.js [html] : meshes per fighter model and per scene part
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const T = path.join(__dirname, '../node_modules/three');
  await p.route('**/*', r => { const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
    const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
    if (u.startsWith('file:')) return r.continue(); return r.abort(); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', process.argv[2] || 'out/index.html')); await p.waitForTimeout(800);
  for (const pr of ['PN', 'BR', 'QQ']) console.log(pr, JSON.stringify(await p.evaluate(async ([a, d]) => {
    const h = window.__h2h, R3 = h.R3; const t0 = performance.now();
    const F = h.startFight({ t: a, c: 'w', hp: 50, id: 1 }, { t: d, c: 'b', hp: 50, id: 2 }, () => {}, { stage: 0 }); F.hold = true;
    const ms = Math.round(performance.now() - t0);
    const cnt = o => { let n = 0, t = 0; o.traverse(c => { if (c.isMesh && c.visible) { n++; t += (c.geometry.index ? c.geometry.index.count : c.geometry.attributes.position.count) / 3; } }); return [n, Math.round(t)]; };
    const out = { startMs: ms, w: cnt(R3.models[0].root), b: cnt(R3.models[1].root), scene: cnt(R3.scene) };
    await new Promise(r => setTimeout(r, 300)); h.endFight(Object.assign(F, { result: { attackerWon: true, attackerHp: 1, defenderHp: 0 } })); await new Promise(r => setTimeout(r, 1200));
    return out; }, [pr[0], pr[1]])));
  await b.close();
})();
