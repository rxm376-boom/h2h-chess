// audit helper: duel with optional scripted "human" on one side
const api = require('../harness.js');
const { STATS, makeDuel, simStep, MOVESET } = api;
const blank = () => ({ l: 0, r: 0, u: 0, d: 0, p: 0, k: 0, s: 0, x: 0, t: 0, uP: 0, lP: 0, rP: 0 });
// script(F, me, opp, mem) -> input (uses 'fw','bk' helpers)
function run(ta, tb, opt = {}) {
  const a = { t: ta, c: 'w', hp: opt.hpA ?? STATS[ta].hp }, d = { t: tb, c: 'b', hp: opt.hpB ?? STATS[tb].hp };
  const lv = { w: opt.scriptSide === 'w' ? null : (opt.lvA ?? opt.lvl ?? 1), b: opt.scriptSide === 'b' ? null : (opt.lvB ?? opt.lvl ?? 1) };
  // attacker colour can be swapped: opt.attBlack makes black (right side) the attacker
  const F = opt.attBlack ? makeDuel(d, a, lv) : makeDuel(a, d, lv);
  const mem = {}; let guard = 0; const log = opt.log;
  const prev = { l: 0, r: 0, u: 0 };
  while (!F.result && guard++ < 60 * 200) {
    simStep(F, 1 / 60, f => {
      const o = f === F.f.w ? F.f.b : F.f.w;
      const i = Object.assign(blank(), opt.script ? opt.script(F, f, o, mem) : {});
      if (i.fw) { i[o.x > f.x ? 'r' : 'l'] = 1; } if (i.bk) { i[o.x > f.x ? 'l' : 'r'] = 1; }
      i.uP = i.u && !prev.u ? 1 : 0; i.lP = i.l && !prev.l ? 1 : 0; i.rP = i.r && !prev.r ? 1 : 0;
      prev.l = i.l; prev.r = i.r; prev.u = i.u;
      return i;
    });
    if (opt.onEvents) opt.onEvents(F, F.events);
    F.events.length = 0;
  }
  if (!F.result) return { stuck: true, F };
  return Object.assign({ time: F.t, F }, F.result);
}
function many(n, ta, tb, opt) {
  let w = 0, to = 0, tm = 0, stuck = 0, hpw = 0;
  for (let i = 0; i < n; i++) { const r = run(ta, tb, opt); if (r.stuck) { stuck++; continue; } const aWon = opt && opt.attBlack ? !r.attackerWon : r.attackerWon; if (aWon) w++; if (r.timeout) to++; tm += r.time; }
  return { win: w / n, to: to / n, time: tm / n, stuck };
}
module.exports = { api, run, many, blank, STATS, MOVESET };
