const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const pairs = (process.argv[2] || "PN,BR,QQ").split(",");
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const T = path.join(__dirname, 'node_modules/three');
  await p.route('**/*', r => { const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
    const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
    if (u.startsWith('file:') || u.includes('fonts.g')) return r.continue(); return r.abort(); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  for (const pr of pairs) {
    await p.goto('file://' + path.resolve(__dirname, 'out/h2h-chess.html')); await p.waitForTimeout(700);
    await p.evaluate(([a, d]) => { const h = window.__h2h; const F = window.F = h.startFight({ t: a, c: "w", hp: h.STATS[a].hp, id: 901 }, { t: d, c: "b", hp: h.STATS[d].hp, id: 902 }, () => {});
      F.phase = "fight"; F.hold = true; document.getElementById("hud").style.display = "none"; F.f.w.x = 164; F.f.b.x = 220; F.f.w.stT = F.f.b.stT = 5;
      h.R3.dbgCam = { p: [0, 4.6, 14.5], l: [0, 3.9, 0] }; }, pr.split(""));
    await p.waitForTimeout(1500);
    await p.locator('#screen').screenshot({ path: `out/close_${pr}.png` }); console.log(pr);
  }
  await b.close();
})();
