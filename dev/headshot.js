// close-up portraits of every fighter's head: node headshot.js  -> out/heads.png
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const T = path.join(__dirname, 'node_modules/three'); const files = [];
  for (const t of ['P', 'N', 'B', 'R', 'Q', 'K']) {
    const p = await b.newPage({ viewport: { width: 900, height: 620 } });
    await p.route('**/*', r => { const u = r.request().url();
      if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
      const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
      if (u.startsWith('file:')) return r.continue(); return r.abort(); });
    p.on('pageerror', e => console.log('[pageerror]', e.message));
    await p.goto('file://' + path.resolve('out/index.html')); await p.waitForTimeout(800);
    const ok = await p.evaluate(t => { const h = window.__h2h; if (!h.STATS[t]) return false; const a = { t, c: 'w', hp: 100, id: 901 }, d = { t, c: 'b', hp: 100, id: 902 }; const F = h.startFight(a, d, () => {}); F.phase = 'fight'; F.hold = true; F.f.w.ai = F.f.b.ai = null; return true; }, t).catch(e => (console.log(t, e.message.slice(0, 100)), false));
    if (!ok) { await p.close(); continue; }
    await p.waitForTimeout(2500);
    for (const [i, ang] of [[0, 0.5], [1, 0.5], [0, 1.4]].entries()) {
      const url = await p.evaluate(([c, ang]) => { const h = window.__h2h, R = h.R3, T = THREE, mdl = R.models[c], v = new T.Vector3(); mdl.head.getWorldPosition(v);
        const cam = new T.PerspectiveCamera(30, R.camera.aspect, 0.1, 500), dir = c ? -1 : 1; cam.position.set(v.x + dir * Math.cos(ang) * 2.7, v.y + 0.25, v.z + Math.sin(ang) * 2.7); cam.lookAt(v.x, v.y - 0.02, v.z);
        R.renderer.setRenderTarget(null); R.renderer.render(R.scene, cam); return R.renderer.domElement.toDataURL('image/png'); }, [ang[0], ang[1]]);
      const f = `out/head_${t}_${i}.png`; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); files.push(f);
    }
    await p.close();
  }
  execSync(`montage ${files.join(' ')} -tile 3x -geometry 420x290+2+2 -background '#111' out/heads.png`); execSync(`rm ${files.join(' ')}`);
  await b.close();
})();
