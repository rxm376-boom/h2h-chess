// phone layout check: jump to a live fight frame, then to a jump, then to the win screen
module.exports = async (p, shot) => {
  await p.evaluate(() => { const h = window.__h2h; const a = { t: "N", c: "w", hp: 60, id: 901 }, d = { t: "B", c: "b", hp: 30, id: 902 }; window.F = h.startFight(a, d, () => {}); });
  await p.waitForTimeout(1500); await shot('intro');
  await p.evaluate(() => { const F = window.F; F.phaseT = F.intro.tFight + 0.02; }); await p.waitForTimeout(1200); await shot('fighttip');
  await p.evaluate(() => { const F = window.F; F.phaseT = F.intro.end; }); await p.waitForTimeout(900);
  await p.evaluate(() => { const F = window.F; F.f.w.ai = null; F.f.b.ai = null; F.hold = true; F.f.w.x = 150; F.f.b.x = 230; }); await p.waitForTimeout(1500); await shot('fight');
  await p.evaluate(() => { const F = window.F, f = F.f.w; f.state = "jump"; f.y = 90; f.vy = 0; f.rage = true; }); await p.waitForTimeout(2500); await shot('jump');
  const info = await p.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height), getComputedStyle(e).fontSize]; }; return JSON.stringify({ screen: r('#screen'), stick: r('#stick'), pad: r('.pad'), num: r('.hp .num'), role: r('.role'), tag: r('.tag'), nm: r('.nm'), vw: innerWidth, vh: innerHeight }); });
  console.log(info);
};
