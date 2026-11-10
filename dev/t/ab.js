// A/B picture check: node t/ab.js <html> <prefix> [pair] ; seeded random + fake clock, so two builds should draw the same frames
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [html, prefix, pair = 'QR'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const T = path.join(__dirname, '../node_modules/three');
  for (const stage of [0, 1, 2]) {
    const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    await p.route('**/*', r => { const u = r.request().url();
      if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
      const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
      if (u.startsWith('file:')) return r.continue(); return r.abort(); });
    p.on('pageerror', e => console.log('[pageerror]', e.message));
    await p.addInitScript(() => {
      let now = 1000, seed = 12345; const q = [];
      performance.now = () => now; const nr = Math.random; Math.random = () => { if (new Error().stack.split('\n')[2].includes('three')) return nr(); return (seed = (seed * 16807) % 2147483647) / 2147483647; };
      window.__seed = s => { seed = s; };
      window.requestAnimationFrame = fn => { q.push(fn); return q.length; };
      window.__pump = n => { for (let i = 0; i < (n || 1); i++) { now += 1000 / 60; const l = q.splice(0); for (const f of l) f(now); } };
    });
    await p.goto('file://' + path.resolve(html)); await p.waitForTimeout(800);
    await p.evaluate(([a, d, stage]) => { const h = window.__h2h; window.setTimeout = () => 0; window.setInterval = () => 0; h.CONFIG.human = null; window.__seed(777 + stage);
      window.F = h.startFight({ t: a, c: 'w', hp: h.STATS[a].hp, id: 901 }, { t: d, c: 'b', hp: h.STATS[d].hp, id: 902 }, () => {}, { stage, ai: 2 });
      const R3 = h.R3, c = R3.composer, r = c.render; window.__draw = on => { c.render = on ? r : () => {}; }; window.__draw(false); }, [pair[0], pair[1], stage]);
    await p.addStyleTag({ content: '#screen *:not(canvas){visibility:hidden!important} *{animation:none!important;transition:none!important}' });
    let n = 0;
    const shot = async (frames, label) => { await p.evaluate(f => { window.__pump(f - 1); window.__draw(true); window.__pump(1); window.__draw(false); }, frames); await p.waitForTimeout(150);
      await p.locator('#arena3d').screenshot({ path: `${prefix}_${pair}${stage}_${String(n++).padStart(2, '0')}_${label}.png` }); };
    await shot(30, 'introA'); await shot(120, 'introD');
    await p.evaluate(() => { window.__pump(1); while (F.phase === 'intro') window.__pump(1); });
    for (let i = 0; i < 6; i++) await shot(140, 'fight' + i);
    await p.evaluate(() => { let g = 0; while (F.phase === 'fight' && g++ < 4000) window.__pump(1); });
    await shot(20, 'ko'); await shot(50, 'ko2'); await shot(110, 'win');
    console.log('stage', stage, await p.evaluate(() => JSON.stringify({ t: F.t.toFixed(3), r: F.result })));
    await p.close();
  }
  await b.close();
})();
