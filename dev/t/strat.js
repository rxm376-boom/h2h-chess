const { api, run, many, STATS, MOVESET } = require('./lib.js');
const NEU = new Set(['idle', 'walk', 'crouch']);
const range = m => m.reach + (m.step > 0 ? m.step * m.su * 0.75 : 0);
const press = (slot) => { const i = {}; const d = slot.length === 2 ? slot[0] : '', b = slot[slot.length - 1]; if (d === 'f') i.fw = 1; if (d === 'b') i.bk = 1; if (d === 'd') i.d = 1; if (d === 'u') i.u = 1; i[b === 'P' ? 'p' : 'k'] = 1; return i; };
const S = {
  // spam one move slot, walking in when out of range; mash the same button to continue strings
  spam: slot => (F, f, o, M) => { const m = f.ms[slot], edge = Math.abs(o.x - f.x) - o.s.hw; M.n = (M.n || 0) + 1;
    if (NEU.has(f.state)) return edge < range(m) - 3 ? press(slot) : { fw: 1 };
    if (f.state === 'attack' && M.n % 4 === 0) return { [slot[slot.length - 1] === 'P' ? 'p' : 'k']: 1 }; return {}; },
  throwSpam: (F, f, o, M) => { const gap = Math.abs(o.x - f.x) - f.s.hw - o.s.hw; if (f.state === 'thrown') return { t: 1 }; if (NEU.has(f.state)) return gap < 8 ? { t: 1 } : { fw: 1 }; return {}; },
  // walk in, jab; if jab touched (hit or block) go for throw; else keep walking
  tickThrow: (F, f, o, M) => { const gap = Math.abs(o.x - f.x) - f.s.hw - o.s.hw; if (f.state === 'thrown') return { t: 1 };
    if (NEU.has(f.state)) { if (gap < 8) { M.flip = !M.flip; return M.flip ? { t: 1 } : press(f.ms.P.proj ? 'K' : 'P'); } return { fw: 1 }; } return {}; },
  turtle: (F, f, o, M) => { const gap = Math.abs(o.x - f.x) - f.s.hw - o.s.hw; if (f.state === 'thrown') return { t: 1 };
    const om = o.state === 'attack' && o.move ? o.ms[o.move] : null;
    // block everything (perfect high/low read is NOT assumed: stand block, low block only vs obvious sweeps su>=.2)
    const low = om && om.lvl === 'low' && om.su >= 0.2;
    if (NEU.has(f.state) && om && o.mt >= om.su + om.ac && om.total - o.mt > 0.14 && gap < 14) return press(f.ms.P.proj ? 'K' : 'P');
    if (NEU.has(f.state) && !om && NEU.has(o.state) && gap < 8) return { t: 1 };
    return low ? { bk: 1, d: 1 } : { bk: 1 }; },
  jumpIn: (F, f, o, M) => { const cd = Math.abs(o.x - f.x); if (f.state === 'thrown') return { t: 1 };
    if (f.state === 'jump') return (!f.move && f.vy > 0 && cd < f.ms.aK.reach + o.s.hw + 6 && f.y < 70) ? { k: 1, fw: 1 } : { fw: 1 };
    if (NEU.has(f.state)) { M.c = (M.c || 0) + 1; if (cd < 46 && M.c % 2) return press('K'); return cd < 30 ? { u: 1 } : { u: 1, fw: 1 }; }
    if (f.state === 'attack') { M.n = (M.n || 0) + 1; return M.n % 4 === 0 ? { k: 1 } : {}; } return {}; },
  sweepThrow: (F, f, o, M) => { const gap = Math.abs(o.x - f.x) - f.s.hw - o.s.hw; if (f.state === 'thrown') return { t: 1 };
    if (NEU.has(f.state)) { if (gap < 8 && Math.random() < 0.5) return { t: 1 }; const m = f.ms.dK; return Math.abs(o.x - f.x) - o.s.hw < range(m) - 3 ? press('dK') : { fw: 1 }; } return {}; },
  masher: (F, f, o, M) => { M.n = (M.n || 0) + 1; if (M.n % 5) return M.h || {}; const r = Math.random(); M.h = r < 0.5 ? { fw: 1 } : r < 0.6 ? { bk: 1 } : r < 0.7 ? { d: 1 } : r < 0.8 ? { u: 1, fw: 1 } : {};
    const b = Math.random(); return Object.assign({}, M.h, b < 0.35 ? { p: 1 } : b < 0.7 ? { k: 1 } : b < 0.8 ? { s: 1 } : b < 0.86 ? { t: 1 } : b < 0.9 ? { x: 1 } : {}); },
  // bishop keep-away: retreat, jump back and fire down-bolts, teleport out when cornered / crowded
  bishopKeep: (F, f, o, M) => { const cd = Math.abs(o.x - f.x), gap = cd - f.s.hw - o.s.hw; if (f.state === 'thrown') return { t: 1 };
    if (f.state === 'jump') { const line = f.y - (cd - 14); return (!f.move && Math.abs(line) < 14 && f.y > 20) ? { p: 1 } : {}; }
    if (NEU.has(f.state)) { const cornered = f.x < 50 || f.x > 334;
      if (gap < 34 && f.meter >= 50 && f.spCd <= 0 && !(f.rage && !f.rageUsed)) return cornered ? { s: 1 } : { s: 1, bk: 1 };
      if (gap < 30) return press('bK'); if (gap < 60) return { u: 1, bk: 1 }; if (gap < 110) return { u: 1 }; return { u: 1, fw: 1 }; }
    return {}; },
  // rook: dash in on cooldown, then forward+K if the dash hit, throw if it was blocked; otherwise Hammer string
  rookDash: (F, f, o, M) => { const gap = Math.abs(o.x - f.x) - f.s.hw - o.s.hw; if (f.state === 'thrown') return { t: 1 };
    if (f.state === 'dash') { M.dashed = F.t; return {}; }
    if (NEU.has(f.state)) { if (M.dashed && F.t - M.dashed < 0.12) { M.dashed = 0; return o.state === 'hit' ? press('fK') : gap < 9 ? { t: 1 } : press('P'); }
      if (f.dashCd <= 0 && gap > 10 && gap < 70) return { x: 1, fw: 1 }; if (gap < 12) return press('P'); return { fw: 1 }; }
    if (f.state === 'attack') { M.n = (M.n || 0) + 1; return M.n % 4 === 0 ? { p: 1 } : {}; } return {}; },
  spSpam: (F, f, o, M) => { const gap = Math.abs(o.x - f.x) - f.s.hw - o.s.hw; if (f.state === 'thrown') return { t: 1 };
    if (NEU.has(f.state)) { if (f.meter >= 50 && f.spCd <= 0 && gap > 30) return { s: 1 }; return gap < 16 ? press('P') : gap > 80 ? { fw: 1 } : { bk: 1 }; }
    if (f.state === 'attack') { M.n = (M.n || 0) + 1; return M.n % 4 === 0 ? { p: 1 } : {}; } return {}; },
  stepPunish: (F, f, o, M) => { const gap = Math.abs(o.x - f.x) - f.s.hw - o.s.hw; if (f.state === 'thrown') return { t: 1 }; const om = o.state === 'attack' && o.move ? o.ms[o.move] : null;
    if (NEU.has(f.state)) { if (om && o.mt < om.su * 0.5 && f.dashCd <= 0 && !f.s.dash) return { x: 1 }; if (gap < 12) return press(f.ms.P.proj ? 'K' : 'P'); return { fw: 1 }; }
    if (f.state === 'attack') { M.n = (M.n || 0) + 1; return M.n % 4 === 0 ? { p: 1, k: 0 } : {}; } return {}; },
  idle: () => ({}),
};
module.exports = S;
if (require.main === module) {
  const [which, n = 150] = process.argv.slice(2);
  const tests = {
    spam: () => { for (const t of ['P', 'N', 'B', 'R', 'Q']) for (const slot of Object.keys(MOVESET[t]).filter(k => /^[fbdu]?[PK]$/.test(k) && !MOVESET[t][k].proj)) {
      const row = []; for (const lvl of [1, 2]) for (const opp of ['N', 'B', 'R']) row.push(`L${lvl}v${opp} ${Math.round(many(+n, t, opp, { lvl, scriptSide: 'w', script: S.spam(slot) }).win * 100)}%`);
      console.log(`${t} spam ${slot.padEnd(3)} ${MOVESET[t][slot].name.padEnd(18)} ${row.join('  ')}`); } },
    strat: () => { for (const name of ['throwSpam', 'tickThrow', 'turtle', 'jumpIn', 'sweepThrow', 'masher', 'spSpam', 'stepPunish', 'idle']) for (const t of ['P', 'N', 'B', 'R', 'Q']) {
      if (name === 'jumpIn' && !STATS[t].jump) continue;
      const row = []; for (const lvl of [0, 1, 2]) for (const opp of ['N', 'B', 'R', 'Q']) { const r = many(+n, t, opp, { lvl, scriptSide: 'w', script: S[name] }); row.push(`L${lvl}v${opp} ${String(Math.round(r.win * 100)).padStart(3)}%${r.to > .2 ? '(to' + Math.round(r.to * 100) + ')' : ''}${r.stuck ? ' STUCK' + r.stuck : ''}`); }
      console.log(`${name.padEnd(10)} as ${t}: ${row.join(' ')}`); } },
    special: () => { for (const [name, t] of [['bishopKeep', 'B'], ['rookDash', 'R']]) { const row = []; for (const lvl of [0, 1, 2]) for (const opp of ['P', 'N', 'B', 'R', 'Q']) { const r = many(+n, t, opp, { lvl, scriptSide: 'w', script: S[name] }); row.push(`L${lvl}v${opp} ${Math.round(r.win * 100)}%${r.to > .1 ? '(to' + Math.round(r.to * 100) + ')' : ''}`); } console.log(`${name} as ${t}: ${row.join(' ')}`); } },
  };
  tests[which]();
}
