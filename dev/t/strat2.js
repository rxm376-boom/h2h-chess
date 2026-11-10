// Audit 2: extra scripted "human" tactics vs the CPU. node strat2.js <test> [n]
const { api, run, many, STATS, MOVESET } = require('./lib.js');
const S1 = require('./strat.js');
const NEU = new Set(['idle', 'walk', 'crouch']);
const range = m => m.reach + (m.step > 0 ? m.step * m.su * 0.75 : 0);
const press = slot => { const i = {}; const d = slot.length === 2 ? slot[0] : '', b = slot[slot.length - 1]; if (d === 'f') i.fw = 1; if (d === 'b') i.bk = 1; if (d === 'd') i.d = 1; if (d === 'u') i.u = 1; i[b === 'P' ? 'p' : 'k'] = 1; return i; };
const gapOf = (f, o) => Math.abs(o.x - f.x) - f.s.hw - o.s.hw;
const lead = (f, o, by) => f.hp / f.max > o.hp / o.max + (by || 0.03);
// what a person sees: the opponent's state DELAY frames ago
const seen = (M, o, F, delay) => { const q = M.q || (M.q = []); q.push({ st: o.state, mv: o.move, mt: o.mt, y: o.y, x: o.x, t: F.t }); if (q.length > delay + 1) q.shift(); return q[0]; };
const S = {
  // get any life lead, then run: jump / double-jump / air-dash / teleport away until the clock runs out
  leadRun: (F, f, o, M) => { if (f.state === 'thrown') return { t: 1 }; const g = gapOf(f, o);
    if (!lead(f, o, 0.02)) return S1.jumpIn && f.s.jump ? S1.spam(f.ms.K ? 'K' : 'P')(F, f, o, M) : S1.spam('P')(F, f, o, M);
    const cornered = f.x < 60 || f.x > 324;
    if (f.state === 'jump') { if (f.s.dash && f.s.dash.air && f.airDash && g < 70) return { x: 1, [cornered ? 'fw' : 'bk']: 1 }; if (f.airJ > 0 && f.vy > 0 && g < 80) return { u: 1, [cornered ? 'fw' : 'bk']: 1 }; return { [cornered ? 'fw' : 'bk']: 1 }; }
    if (NEU.has(f.state)) { if (f.t === 'B' && f.meter >= 50 && f.spCd <= 0 && g < 40) return cornered ? { s: 1 } : { s: 1, bk: 1 };
      if (f.s.dash && f.dashCd <= 0 && g < 50 && !cornered && f.t === 'Q') return { x: 1, bk: 1 };
      if (f.s.jump && g < 90) return { u: 1, [cornered ? 'fw' : 'bk']: 1 }; return { bk: 1 }; }
    return { bk: 1 }; },
  // lead, then just block (stand), tech throws
  leadBlock: (F, f, o, M) => { if (f.state === 'thrown') return { t: 1 }; if (!lead(f, o, 0.02)) return S1.spam(f.ms.fP ? 'fP' : 'P')(F, f, o, M); return { bk: 1 }; },
  // throw loop: after any knockdown walk up and throw on wake-up; otherwise jab into throw
  okiThrow: (F, f, o, M) => { const g = gapOf(f, o); if (f.state === 'thrown') return { t: 1 };
    if (NEU.has(f.state)) { if (o.state === 'down' || o.state === 'fall') return g > 6 ? { fw: 1 } : {}; if (o.state === 'getup') return o.st < 0.09 && g < 8 ? { t: 1 } : g > 6 ? { fw: 1 } : {};
      if (g < 8) return { t: 1 }; return { fw: 1 }; } return {}; },
  // meaty sweep / low loop on wake-up
  okiLow: (F, f, o, M) => { const g = gapOf(f, o), m = f.ms.dK, edge = Math.abs(o.x - f.x) - o.s.hw; if (f.state === 'thrown') return { t: 1 };
    if (NEU.has(f.state)) { const inR = edge < range(m) - 4; if (o.state === 'down' || o.state === 'fall') return inR ? {} : { fw: 1 }; if (o.state === 'getup') return o.st < m.su - 0.02 && inR ? press('dK') : inR ? {} : { fw: 1 };
      return inR ? press('dK') : { fw: 1 }; } return {}; },
  // stand just outside the opponent's reach, poke with the longest safe button when they step in
  rangePoke: slot => (F, f, o, M) => { const m = f.ms[slot], edge = Math.abs(o.x - f.x) - o.s.hw; if (f.state === 'thrown') return { t: 1 };
    if (NEU.has(f.state)) { if (edge < range(m) - 2 && edge > range(m) - 14) return press(slot); if (edge <= range(m) - 14) return { bk: 1 }; return { fw: 1 }; } return {}; },
  // knight: neutral/back jump with air kick whenever the opponent is close
  hopKick: (F, f, o, M) => { const cd = Math.abs(o.x - f.x); if (f.state === 'thrown') return { t: 1 };
    if (f.state === 'jump') return !f.move && f.vy > -60 && cd < f.ms.aK.reach + o.s.hw + 10 ? { k: 1 } : {};
    if (NEU.has(f.state)) return cd < 75 ? { u: 1 } : { fw: 1 }; return {}; },
  // knight dive kick whenever there is meter, otherwise the K string
  diveSpam: (F, f, o, M) => { const g = gapOf(f, o); if (f.state === 'thrown') return { t: 1 }; M.n = (M.n || 0) + 1;
    if (NEU.has(f.state)) { if (f.meter >= 50 && f.spCd <= 0 && g > 20 && g < 110) return { s: 1 }; return g < 14 ? press('K') : { fw: 1 }; }
    if (f.state === 'attack' && M.n % 4 === 0) return { k: 1 }; return {}; },
  // jump-in but with the knight's double jump to bait the anti-air
  baitJump: (F, f, o, M) => { const cd = Math.abs(o.x - f.x); if (f.state === 'thrown') return { t: 1 };
    if (f.state === 'jump') { if (f.airJ > 0 && f.vy > 20 && cd < 70 && f.y > 20) return { u: 1, fw: 1 }; return (!f.move && f.vy > 0 && cd < f.ms.aK.reach + o.s.hw + 6 && f.y < 70) ? { k: 1, fw: 1 } : { fw: 1 }; }
    if (NEU.has(f.state)) { M.c = (M.c || 0) + 1; if (cd < 46 && M.c % 2) return press('K'); return { u: 1, fw: 1 }; }
    if (f.state === 'attack') { M.n = (M.n || 0) + 1; return M.n % 4 === 0 ? { k: 1 } : {}; } return {}; },
  // rook: armoured dash every time it is up, jab string otherwise
  dashLoop: (F, f, o, M) => { const g = gapOf(f, o); if (f.state === 'thrown') return { t: 1 }; M.n = (M.n || 0) + 1;
    if (NEU.has(f.state)) { if (f.dashCd <= 0 && g > 6 && g < 75) return { x: 1, fw: 1 }; if (g < 12) return press('P'); return { fw: 1 }; }
    if (f.state === 'attack' && M.n % 4 === 0) return { p: 1 }; return {}; },
  // queen: beam when there is meter and room, heel kick string up close, back-dash out
  queenZone: (F, f, o, M) => { const g = gapOf(f, o); if (f.state === 'thrown') return { t: 1 }; M.n = (M.n || 0) + 1;
    if (NEU.has(f.state)) { if (f.meter >= 50 && f.spCd <= 0 && g > 50) return { s: 1 }; if (g < 18) return press('K'); if (g < 40 && f.dashCd <= 0) return { x: 1, bk: 1 }; return g > 90 ? { fw: 1 } : { bk: 1 }; }
    if (f.state === 'attack' && M.n % 4 === 0) return { k: 1 }; return {}; },
  // "intermediate person": sees the CPU 13 frames (0.22 s) late. Blocks what it sees, ducks slow lows, punishes after a block, throws a blocker, anti-airs late, otherwise pokes
  human: delay => (F, f, o, M) => { const v = seen(M, o, F, delay), g = gapOf(f, o), edge = Math.abs(o.x - f.x) - o.s.hw; if (f.state === 'thrown') return Math.random() < 0.5 ? { t: 1 } : {}; M.n = (M.n || 0) + 1;
    const fast = f.ms.P.proj ? 'K' : 'P', poke = f.ms.fP ? 'fP' : 'P';
    if (f.state === 'attack') return M.n % 4 === 0 && f.hitRes === 'hit' ? { [f.move[f.move.length - 1] === 'K' ? 'k' : 'p']: 1 } : {};
    if (f.state === 'block') { M.blocked = F.t; return { bk: 1 }; }
    if (!NEU.has(f.state)) return {};
    if (M.blocked && F.t - M.blocked < 0.3) { M.blocked = 0; if (edge < range(f.ms[fast]) - 3) return press(fast); }
    const vm = v.st === 'attack' && v.mv ? o.ms[v.mv] : null;
    if (vm && !vm.proj && g < 60) return vm.lvl === 'low' && vm.su >= 0.2 ? { bk: 1, d: 1 } : { bk: 1 };
    if (v.st === 'special' || v.st === 'dash') return { bk: 1 };
    if (v.y > 10 && g < 50) return f.ms.uP ? press('uP') : { bk: 1 };
    if (F.proj.some(p => p.owner === o && Math.abs(p.x - f.x) < 80)) return { bk: 1 };
    if (v.st === 'block' && g < 8) return { t: 1 };
    if (edge < range(f.ms[poke]) - 3) return Math.random() < 0.6 ? press(poke) : Math.random() < 0.5 ? press(fast) : press(f.ms.dK ? 'dK' : 'dP');
    return Math.random() < 0.85 ? { fw: 1 } : { bk: 1 }; },
};
module.exports = S;
if (require.main === module) {
  const [which, n = 150] = process.argv.slice(2);
  const fmt = r => `${String(Math.round(r.win * 100)).padStart(3)}%${r.to > .15 ? '(to' + Math.round(r.to * 100) + ')' : ''}${r.stuck ? ' STUCK' + r.stuck : ''}`;
  const table = (name, script, types, opps, lvls) => { for (const t of types) { const row = []; for (const lvl of lvls || [1, 2]) for (const opp of opps || ['N', 'B', 'R', 'Q']) row.push(`L${lvl}v${opp} ${fmt(many(+n, t, opp, { lvl, scriptSide: 'w', script }))}`); console.log(`${name.padEnd(12)} as ${t}: ${row.join(' ')}`); } };
  const T = {
    run: () => { table('leadRun', S.leadRun, ['N', 'B', 'Q', 'P']); table('leadBlock', S.leadBlock, ['N', 'B', 'R', 'Q']); },
    oki: () => { table('okiThrow', S.okiThrow, ['P', 'N', 'B', 'R', 'Q']); table('okiLow', S.okiLow, ['P', 'N', 'B', 'Q']); },
    poke: () => { for (const [t, slots] of [['N', ['fP', 'bK', 'K']], ['B', ['fP', 'dK', 'dP', 'bP']], ['R', ['fK', 'fP']], ['Q', ['fP', 'bK', 'K']], ['P', ['fP', 'K']]]) for (const s of slots) table('poke ' + s, S.rangePoke(s), [t]); },
    air: () => { table('hopKick', S.hopKick, ['N', 'Q']); table('diveSpam', S.diveSpam, ['N']); table('baitJump', S.baitJump, ['N', 'Q']); table('jumpIn', S1.jumpIn, ['N', 'Q']); },
    misc: () => { table('dashLoop', S.dashLoop, ['R']); table('rookDash', S1.rookDash, ['R']); table('queenZone', S.queenZone, ['Q']); table('bishopKeep', S1.bishopKeep, ['B']); },
    human: () => { for (const d of [10, 13, 18]) table('human d' + d, S.human(d), ['P', 'N', 'B', 'R', 'Q'], ['N', 'B', 'R', 'Q'], [0, 1, 2]); },
  };
  T[which]();
}
