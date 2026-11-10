// quick contact sheet of the poses changed after audit 1: node quick.js <pieces> [dummy]
const { chromium } = require('playwright'); const path = require('path'); const { execSync } = require('child_process');
(async () => {
  const [pieces = "PNBRQ", dummy = "N"] = process.argv.slice(2); const w = 560, h = 315;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const T = path.join(__dirname, 'node_modules/three');
  for (const t of pieces) {
    const p = await b.newPage({ viewport: { width: w, height: h + 60 }, deviceScaleFactor: 1 });
    await p.route('**/*', r => { const u = r.request().url();
      if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
      const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
      if (u.startsWith('file:') || u.includes('fonts.g')) return r.continue(); return r.abort(); });
    p.on('pageerror', e => console.log('[pageerror]', e.message));
    await p.goto('file://' + path.resolve(__dirname, 'out/index.html')); await p.waitForTimeout(600);
    const files = []; let n = 0;
    const shot = async label => { await p.waitForTimeout(900); const f = `out/q_${t}_${String(n++).padStart(2, '0')}.png`; await p.locator('#screen').screenshot({ path: f });
      execSync(`convert ${f} -gravity south -fill white -undercolor '#000a' -pointsize 18 -annotate +0+4 ' ${t} ${label} ' ${f}`); files.push(f); };
    await p.evaluate(([t, dummy]) => { const h = window.__h2h; const a = { t, c: "w", hp: h.STATS[t].hp, id: 901 }, d = { t: dummy, c: "b", hp: h.STATS[dummy].hp, id: 902 };
      const F = window.F = h.startFight(a, d, () => {}); F.phase = "fight"; F.hold = true; document.getElementById("hud").className = "hud"; F.f.b.ai = null; F.f.w.ai = null;
      window.reset = dist => { for (const f of [F.f.w, F.f.b]) Object.assign(f, { y: 0, z: 0, vx: 0, vy: 0, state: "idle", move: null, hp: f.max, st: 0, stT: 5, juggle: 0, sp: null, dash: null, step: null, inv: 0, grab: null, thrower: null, meter: 100, flash: 0, rage: false, rageUsed: false, ko: false, won: false, blockLow: false, buf: null, spCd: 0, dashCd: 0, combo: 0, splatted: false });
        F.f.w.x = 170; F.f.b.x = 170 + (dist || 60); F.f.w.face = 1; F.f.b.face = -1; F.hitstop = 0; F.cine = null; F.proj.length = 0; F.result = null; F.phase = "fight"; F.t = 1; };
      window.step = (sec, inp) => { let k = Math.round(sec * 120); while (k-- > 0) { if (F.hitstop > 0) F.hitstop = 0; h.sim.simStep(F, 1 / 120, f => Object.assign(h.sim.blankInput(), (inp && f === F.f.w) ? inp : {})); } };
    }, [t, dummy]);
    const S = [["idle", `reset(64)`],
      ["launcher hits", `reset(34); window.__h2h.sim.startMove(F,F.f.w,'fK'); step(F.f.w.ms.fK.su+0.1)`], ["launch +.2", `step(0.2)`],
      ["throw a", `reset(26); window.__h2h.sim.startThrow(F,F.f.w); step(0.34)`], ["throw b", `step(0.16)`], ["throw c", `step(0.12)`],
      ["special", `reset(110); step(0.02,{s:1}); step(0.75)`], ["special 2", `step(0.25)`],
      ["rage", `reset(40); F.f.w.hp = F.f.w.max*0.2; F.f.w.rage = true; step(0.02,{s:1,d:1}); step(1.2)`], ["rage 2", `step(0.9)`], ["rage 3", `step(0.4)`], ["rage fin", `step(0.36)`], ["rage end", `step(0.25)`]];
    for (const [label, code] of S) { await p.evaluate(code); await shot(label); }
    execSync(`montage ${files.join(' ')} -tile 5x -geometry ${w * 0.7}x${h * 0.7}+2+2 -background '#111' out/quick_${t}.png`); execSync(`rm ${files.join(' ')}`);
    console.log('done', t); await p.close();
  }
  await b.close();
})();
