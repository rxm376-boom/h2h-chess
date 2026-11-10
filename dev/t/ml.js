// audit4 loader: sim with optional source patches (never touches work/src)
const fs = require('fs');
function load(patch) { let code = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'sim.js'), 'utf8'); if (patch) code = patch(code);
  return new Function(code + '\nreturn { STATS, MOVESET, makeDuel, simStep, AI_LV, SEP };')(); }
const blank = () => ({ l: 0, r: 0, u: 0, d: 0, p: 0, k: 0, s: 0, x: 0, t: 0, uP: 0, lP: 0, rP: 0 });
function run(api, ta, tb, opt = {}) { const { STATS, makeDuel, simStep } = api;
  const a = { t: ta, c: 'w', hp: opt.hpA ?? STATS[ta].hp }, d = { t: tb, c: 'b', hp: opt.hpB ?? STATS[tb].hp };
  const lv = { w: opt.script ? null : (opt.lvA ?? opt.lvl ?? 1), b: opt.script2 ? null : (opt.lvl ?? 1) };
  const F = makeDuel(a, d, lv); const mem = { w: {}, b: {} }; const prev = { w: {}, b: {} }; let guard = 0;
  if (opt.init) opt.init(F);
  while (!F.result && guard++ < 60 * 200) {
    simStep(F, 1 / 60, f => { const side = f === F.f.w ? 'w' : 'b', o = side === 'w' ? F.f.b : F.f.w, sc = side === 'w' ? opt.script : opt.script2;
      const i = Object.assign(blank(), sc ? sc(F, f, o, mem[side]) : {});
      if (i.fw) i[o.x > f.x ? 'r' : 'l'] = 1; if (i.bk) i[o.x > f.x ? 'l' : 'r'] = 1; const p = prev[side];
      i.uP = i.u && !p.u ? 1 : 0; i.lP = i.l && !p.l ? 1 : 0; i.rP = i.r && !p.r ? 1 : 0; p.l = i.l; p.r = i.r; p.u = i.u; return i; });
    if (opt.onEvents) opt.onEvents(F, F.events); F.events.length = 0; if (opt.until && opt.until(F)) break; }
  return Object.assign({ time: F.t, F, stuck: !F.result }, F.result || {}); }
function many(api, n, ta, tb, opt) { let w = 0, to = 0, tm = 0, st = 0; for (let i = 0; i < n; i++) { const r = run(api, ta, tb, opt); if (r.stuck) { st++; continue; } if (r.attackerWon) w++; if (r.timeout) to++; tm += r.time; } return { win: w / n, to: to / n, time: tm / n, stuck: st }; }
module.exports = { load, run, many, blank };
