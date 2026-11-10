// Real-clock check of the duel loop: preload, model reuse, deferred shadow step-down and a deliberately broken frame.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const T = path.join(__dirname, '../node_modules/three');
  await p.route('**/*', r => { const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
    const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
    if (u.startsWith('file:')) return r.continue(); return r.abort(); });
  let errs = 0; p.on('pageerror', e => { errs++; console.log('[pageerror]', e.message); });
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) console.log('[err]', m.text().slice(0, 160)); });
  await p.goto('file://' + path.resolve(__dirname, '../out/index.html') + '?preload=1');
  await p.waitForFunction(() => { const R = window.__h2h.R3; return R.modelCache && Object.keys(R.modelCache).length === 10; }, null, { timeout: 120000 });
  console.log('preload done:', await p.evaluate(() => JSON.stringify({ ok: __h2h.R3.ok, sets: !!__h2h.R3.sets, models: Object.keys(__h2h.R3.modelCache).join(' '), fight: !!__h2h.fight })));
  await p.screenshot({ path: 'out/e2e_board.png' });
  const duel = async (a, d, stage, tweak, label, after) => {
    await p.evaluate(([a, d, stage, tweak]) => { const h = window.__h2h; h.CONFIG.human = null; window.__res = null; if (tweak) eval(tweak);
      h.startFight({ t: a, c: 'w', hp: 34, id: 901 }, { t: d, c: 'b', hp: 34, id: 902 }, r => { window.__res = r; }, { stage, ai: 2 }).skip = true; }, [a, d, stage, tweak]);
    await p.waitForFunction(() => window.__h2h.fight && window.__h2h.fight.phase === 'fight' && window.__h2h.fight.t > 1.5, null, { timeout: 240000 });
    await p.screenshot({ path: `out/e2e_${label}.png` });
    if (after) await p.evaluate(after);
    await p.waitForFunction(() => window.__res, null, { timeout: 600000 });
    console.log(label, await p.evaluate(() => JSON.stringify({ res: window.__res, shadows: __h2h.R3.renderer.shadowMap.enabled, kids: __h2h.R3.scene.children.length, fight: !!__h2h.fight, layerHidden: document.getElementById('fightLayer').hidden })));
    await p.waitForTimeout(600);
  };
  if (!process.argv.includes('--draw')) await duel('Q', 'R', 2, '', 'd1');
  if (!process.argv.includes('--quick')) await duel('Q', 'R', 2, '', 'd2_reuse');
  if (!process.argv.includes('--quick')) await duel('N', 'B', 0, 'h.R3.qPend = true; h.R3.q = { n: 0, acc: 0, lvl: 2 }; if (h.R3.bloom) h.R3.bloom.enabled = false; h.R3.qScale = 0.67;', 'd3_lowq');
  if (!process.argv.includes('--draw')) await duel('B', 'P', 1, '', 'd4_broken_hud', `document.getElementById('mvName').remove(); for (const e of document.querySelectorAll('#dmgs span, .combo, .callo')) e.remove(); 1`);
  if (process.argv.includes('--draw')) await duel('R', 'N', 0, '', 'd5_broken_draw', `{ const R = __h2h.R3; R.glow.g = null; } 1`);
  console.log('after broken draw: 3D on =', await p.evaluate(() => __h2h.R3.ok));
  console.log('page errors', errs);
  await b.close();
})();
