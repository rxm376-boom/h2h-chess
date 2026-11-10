// audit4: things a real, unskilled or lazy player actually does. SEP-aware (throw range is gap < 14). node simple.js [n]
const { load, many } = require('./ml.js'); const api = load(); const n = +(process.argv[2] || 60);
const NEU = new Set(['idle', 'walk', 'crouch']); const gapOf = (f, o) => Math.abs(o.x - f.x) - f.s.hw - o.s.hw;
const tick = (M, k) => { M.n = (M.n || 0) + 1; return M.n % k === 0; };
const S = {
  // mash one button at ~7.5 presses/s while holding forward; never blocks, never breaks throws
  mashP: (F, f, o, M) => ({ fw: 1, p: tick(M, 8) ? 1 : 0 }),
  mashK: (F, f, o, M) => ({ fw: 1, k: tick(M, 8) ? 1 : 0 }),
  mashPK: (F, f, o, M) => { const t = tick(M, 8); return { fw: 1, p: t && (M.n / 8) % 2 < 1 ? 1 : 0, k: t && (M.n / 8) % 2 >= 1 ? 1 : 0 }; },
  mashStandP: (F, f, o, M) => ({ p: tick(M, 8) ? 1 : 0 }),
  mashDownK: (F, f, o, M) => ({ d: 1, k: tick(M, 8) ? 1 : 0 }),
  mashSpecial: (F, f, o, M) => ({ fw: 1, s: tick(M, 8) ? 1 : 0, p: M.n % 8 === 4 ? 1 : 0 }),
  // walk forward, mash throw (no throw breaks)
  walkThrow: (F, f, o, M) => ({ fw: 1, t: tick(M, 8) ? 1 : 0 }),
  // walk forward, throw only in range (gap < 13), breaks throws
  walkThrowSmart: (F, f, o, M) => { if (f.state === 'thrown') return { t: 1 }; if (NEU.has(f.state)) return gapOf(f, o) < 13 ? { t: 1 } : { fw: 1 }; return {}; },
  // jump forward and mash kick
  jumpMashK: (F, f, o, M) => ({ fw: 1, u: 1, k: tick(M, 6) ? 1 : 0 }),
  // mash dash + punch (rook dash, queen dash, sidestep for others)
  mashDashP: (F, f, o, M) => ({ fw: 1, x: tick(M, 8) ? 1 : 0, p: M.n % 8 === 4 ? 1 : 0 }),
  // random masher: random direction held, random button every 8 frames
  random: (F, f, o, M) => { if (tick(M, 8)) { const r = Math.random(), d = Math.random(); M.h = Object.assign(d < .5 ? { fw: 1 } : d < .65 ? { bk: 1 } : d < .75 ? { d: 1 } : d < .85 ? { u: 1, fw: 1 } : {}, r < .35 ? { p: 1 } : r < .7 ? { k: 1 } : r < .8 ? { t: 1 } : r < .88 ? { s: 1 } : r < .94 ? { x: 1 } : {}); return M.h; } const h = Object.assign({}, M.h); delete h.p; delete h.k; delete h.t; delete h.s; delete h.x; return h; },
  // does nothing at all
  afk: () => ({}),
  // holds back only
  holdBack: () => ({ bk: 1 }),
  // crouch-blocks only
  crouchBack: () => ({ bk: 1, d: 1 }),
};
const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(S);
const fmt = r => `${String(Math.round(r.win * 100)).padStart(3)}%${r.to > .1 ? '(to' + Math.round(r.to * 100) + ')' : ''}${r.stuck ? ' STUCK' + r.stuck : ''}`;
for (const name of only) for (const t of ['P', 'N', 'B', 'R', 'Q']) { const row = []; for (const lvl of [0, 1, 2]) { row.push(`L${lvl}:`); for (const opp of ['N', 'B', 'R', 'Q']) row.push(`v${opp} ${fmt(many(api, n, t, opp, { lvl, script: S[name] }))}`); } console.log(`${name.padEnd(14)} as ${t}: ${row.join(' ')}`); }
