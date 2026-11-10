// Contact sheets of poses. usage: node sheet.js <piece> <mode: moves|states|intro|win> [dummy] [w h]
const { chromium } = require('playwright'); const path = require('path'); const { execSync } = require('child_process');
(async () => {
  const [t, mode, dummy = "R", w = 720, h = 405, cam = ""] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h + 60 }, deviceScaleFactor: 1 });
  const T = path.join(__dirname, 'node_modules/three');
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
    const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
    if (u.startsWith('file:') || u.includes('fonts.g')) return r.continue();
    return r.abort();
  });
  p.on('console', m => { if (m.type() === 'error') console.log('[error]', m.text()); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('file://' + path.resolve(__dirname, 'out/h2h-chess.html'));
  await p.waitForTimeout(800);
  const files = []; let n = 0;
  const shot = async (label) => {
    await p.waitForTimeout(260);
    const f = `out/s_${t}_${mode}_${String(n++).padStart(2, '0')}.png`;
    await p.locator('#screen').screenshot({ path: f });
    execSync(`convert ${f} -gravity south -fill white -undercolor '#000a' -pointsize 20 -annotate +0+4 ' ${label.replace(/'/g, '')} ' ${f}`);
    files.push(f);
  };
  await p.evaluate(([t, dummy, mode, cam]) => {
    const h = window.__h2h; const a = { t, c: "w", hp: h.STATS[t].hp, id: 901 }, d = { t: dummy, c: "b", hp: h.STATS[dummy].hp, id: 902 };
    window.F = h.startFight(a, d, () => {}); const F = window.F;
    if (mode !== "intro") { F.phase = "fight"; F.hold = true; document.getElementById("hud").className = "hud"; document.getElementById("hud").style.display = "none"; }
    F.f.b.ai = null; F.f.w.ai = null;
    if (cam) h.R3.dbgCam = JSON.parse(cam);
    window.reset = (dist) => { for (const f of [F.f.w, F.f.b]) Object.assign(f, { y: 0, z: 0, vx: 0, vy: 0, state: "idle", move: null, hp: f.max, st: 0, stT: 5, juggle: 0, sp: null, dash: null, step: null, inv: 0, grab: null, thrower: null, meter: 100, flash: 0, rage: false, rageUsed: false, ko: false, won: false, blockLow: false, buf: null, spCd: 0, dashCd: 0, combo: 0, splatted: false });
      F.f.w.x = 170; F.f.b.x = 170 + (dist || 60); F.f.w.face = 1; F.f.b.face = -1; F.hitstop = 0; F.cine = null; F.proj.length = 0; F.result = null; F.phase = "fight"; F.t = 1; };
    window.step = (sec, inp) => { let k = Math.round(sec * 120); while (k-- > 0) { if (F.hitstop > 0) F.hitstop = 0; h.sim.simStep(F, 1 / 120, f => Object.assign(h.sim.blankInput(), (inp && f === F.f.w) ? inp : {})); } };
  }, [t, dummy, mode, cam]);
  await p.waitForTimeout(400);
  if (mode === "moves") {
    const moves = await p.evaluate(t => Object.entries(window.__h2h.MOVESET[t]).map(([k, m]) => ({ k, name: m.name, su: m.su, ac: m.ac, rc: m.rc, air: !!m.air, reach: m.reach || 60, proj: !!m.proj })), t);
    for (const m of moves) {
      for (const ph of ["wind", "hit", "rec"]) {
        if (ph === "rec" && (m.air || m.proj)) continue;
        await p.evaluate(([m, ph]) => { const F = window.F, f = F.f.w, h = window.__h2h; reset(ph === "rec" ? 120 : Math.max(26, m.reach - 6));
          if (m.air) { f.y = 55; f.vy = -60; f.state = "jump"; F.f.b.x = f.x + 30; }
          h.sim.startMove(F, f, m.k);
          step(ph === "wind" ? m.su * 0.5 : ph === "hit" ? m.su + Math.min(0.03, m.ac * 0.5) : m.su + m.ac + m.rc * 0.5);
        }, [m, ph]);
        await shot(`${m.k} ${m.name} ${ph}`);
      }
    }
  } else if (mode === "states") {
    const S = [
      ["idle", `reset(70)`], ["walk fwd", `reset(120); step(0.4,{r:1})`], ["walk back", `reset(60); step(0.3,{l:1})`], ["crouch", `reset(70); step(0.2,{d:1})`],
      ["jump up", `reset(90); step(0.12,{u:1,uP:1}); step(0.1,{u:1})`], ["jump fall", `reset(90); step(0.02,{u:1,uP:1}); step(0.5)`],
      ["block high", `reset(40); F.f.w.state='block'; F.f.w.st=.3; F.f.w.stT=.05; F.f.w.blockLow=false`], ["block low", `reset(40); F.f.w.state='block'; F.f.w.st=.3;F.f.w.stT=.05; F.f.w.blockLow=true`],
      ["hit high", `reset(40); Object.assign(F.f.w,{state:'hit',st:.3,stT:.04,hitKind:'high'})`], ["hit mid", `reset(40); Object.assign(F.f.w,{state:'hit',st:.3,stT:.04,hitKind:'mid'})`], ["hit low", `reset(40); Object.assign(F.f.w,{state:'hit',st:.3,stT:.04,hitKind:'low'})`],
      ["fall", `reset(60); Object.assign(F.f.w,{state:'fall',y:40,vy:-80,vx:-60,stT:.2}); step(0.05)`], ["down", `reset(60); Object.assign(F.f.w,{state:'down',st:.6,stT:.3})`], ["getup", `reset(60); Object.assign(F.f.w,{state:'getup',st:.15,stT:.15})`],
      ["dash/step", `reset(120); step(0.1,{x:1,r:1})`], ["step2", `reset(120); step(0.2,{x:1,r:1})`], ["throw reach", `reset(120); window.__h2h.sim.startThrow(F,F.f.w); step(0.1)`],
      ["throw a", `reset(26); window.__h2h.sim.startThrow(F,F.f.w); step(0.3)`], ["throw b", `reset(26); window.__h2h.sim.startThrow(F,F.f.w); step(0.52)`], ["throw c", `reset(26); window.__h2h.sim.startThrow(F,F.f.w); step(0.72)`],
      ["special a", `reset(110); step(0.02,{s:1}); step(0.6)`], ["special b", `reset(110); step(0.02,{s:1}); step(0.85)`], ["special c", `reset(110); step(0.02,{s:1}); step(1.05)`], ["special d", `reset(110); step(0.02,{s:1}); step(1.3)`],
      ["win", `reset(110); Object.assign(F.f.w,{state:'win',stT:1.2})`], ["lose", `reset(110); Object.assign(F.f.w,{state:'lose',stT:1.2})`], ["ko", `reset(60); Object.assign(F.f.w,{state:'ko',stT:1.2, ko:true})`],
    ];
    for (const [label, code] of S) { await p.evaluate(code); await shot(label); }
    // rage art
    await p.evaluate(`reset(40); F.f.w.hp = F.f.w.max*0.2; F.f.w.rage = true; step(0.02,{s:1,d:1});`);
    for (let i = 0; i < 9; i++) { await p.evaluate(`step(${i === 0 ? 0.3 : 0.38})`); await shot(`rage ${i}`); }
  } else if (mode === "intro") {
    const end = await p.evaluate(() => { const F = window.F; F.hold = true; return F.intro.end; });
    for (let t = 0.1; t < end + 0.2; t += 0.22) { await p.evaluate(t => { window.F.phaseT = t; }, t); await shot(`intro ${t.toFixed(2)}`); }
  }
  execSync(`montage ${files.join(' ')} -tile 6x -geometry ${Math.round(w / 2.2)}x${Math.round(h / 2.2)}+2+2 -background '#111' out/sheet_${t}_${mode}.png`);
  execSync(`rm ${files.join(' ')}`);
  console.log('done', files.length);
  await b.close();
})();
