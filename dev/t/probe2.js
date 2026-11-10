const { api, run, many, STATS, MOVESET } = require('./lib.js');
const S = require('./strat.js');
const NEU = new Set(['idle', 'walk', 'crouch']);
// 1. pure hold-back (no punish, never low-blocks): HP% lost in 30 s and who wins
for (const lvl of [0, 1, 2]) { const row = [];
  for (const [me, opp] of [['N', 'N'], ['N', 'R'], ['R', 'N'], ['B', 'R'], ['Q', 'N'], ['N', 'Q'], ['N','B']]) {
    let lost = 0, thr = 0, lows = 0, n = 150, surv = 0;
    for (let i = 0; i < n; i++) { const r = run(me, opp, { lvl, scriptSide: 'w', script: (F, f) => f.state === 'thrown' ? { t: 1 } : { bk: 1 }, onEvents: (F, ev) => { for (const e of ev) if (e.type === 'hit' && e.f === F.f.w) { if (e.m.lvl === 'throw') thr += e.dmg; else if (e.m.lvl === 'low') lows += e.dmg; } } });
      lost += 1 - r.attackerHp / STATS[me].hp; if (r.timeout) surv++; }
    row.push(`${me}v${opp}: lost ${Math.round(lost / n * 100)}% hp, survived 30s ${Math.round(surv / n * 100)}% (throw dmg ${(thr / n).toFixed(0)}, low dmg ${(lows / n).toFixed(0)})`); }
  console.log(`1. hold-back-only vs L${lvl}: ` + row.join(' | ')); }
// 2. one hit then run: land any hit, then hold back forever
for (const lvl of [1, 2]) { const row = [];
  for (const [me, opp] of [['N', 'R'], ['N', 'N'], ['B', 'R'], ['R', 'N'], ['Q', 'R'], ['P', 'N']]) {
    const r = many(150, me, opp, { lvl, scriptSide: 'w', script: (F, f, o, M) => { if (f.state === 'thrown') return { t: 1 }; const lead = f.hp / f.max > o.hp / o.max + 0.08; if (lead) return { bk: 1 }; return S.spam(f.ms.fP ? 'fP' : 'P')(F, f, o, M); } });
    row.push(`${me}v${opp} ${Math.round(r.win * 100)}% (timeouts ${Math.round(r.to * 100)}%)`); }
  console.log(`2. get an 8% life lead with fP pokes, then just hold back, L${lvl}: ` + row.join('  ')); }
// 3. where pawn-jab-vs-rook damage comes from
{ const st = {}; let cnt = { counter: 0, hits: 0, armor: 0 }; let w = 0, n = 200;
  for (let i = 0; i < n; i++) { const r = run('P', 'R', { lvl: 2, scriptSide: 'w', script: S.spam('P'), onEvents: (F, ev) => { for (const e of ev) { if (e.type === 'hit') { const k = e.by.t + ':' + e.m.name; st[k] = (st[k] || 0) + e.dmg; if (e.by.t === 'P') { cnt.hits++; if (e.counter) cnt.counter++; } } if (e.type === 'armor') cnt.armor++; } } }); if (r.attackerWon) w++; }
  console.log('3. Pawn jab-mash vs Hard Rook: pawn wins', Math.round(w / n * 100) + '%', JSON.stringify(Object.fromEntries(Object.entries(st).map(([k, v]) => [k, +(v / n).toFixed(1)]))), 'pawn hits/duel', (cnt.hits / n).toFixed(1), 'counter share', (cnt.counter / cnt.hits).toFixed(2), 'armor absorbs/duel', (cnt.armor / n).toFixed(1)); }
// 4. launcher value: launch then best simple follow-up on a passive dummy (damage of full combo)
for (const t of ['P', 'N', 'B', 'R', 'Q']) { const { makeDuel, simStep } = api; const lk = t === 'R' ? 'uP' : 'fK'; let best = 0, bestSeq = '';
  for (const fu of [['P'], ['K'], ['fP'], ['P', 'P', 'P'], ['K', 'K'], ['fP', 'P', 'K'], ['P', 'P', 'K', 'K'], ['bP'], ['bK'], ['dK'],['fK'],['uP']]) {
    if (fu.some(k => k.length === 2 && !MOVESET[t][k])) continue;
    for (const delay of [0, .1, .2, .3, .4]) {
      const F = makeDuel({ t, c: 'w', hp: STATS[t].hp }, { t: 'N', c: 'b', hp: 104 }, { w: null, b: null }, 99); F.f.w.x = 150; F.f.b.x = 150 + MOVESET[t][lk].reach - 2;
      let q = [lk], launchedAt = null, cd = 0, dmg = 0, fuq = fu.slice(), n = 0;
      for (let i = 0; i < 60 * 4; i++) { simStep(F, 1 / 60, f => { if (f !== F.f.w) return { l: 0, r: 0, u: 0, d: 0, p: 0, k: 0, s: 0, x: 0, t: 0 };
          const inp = { l: 0, r: 0, u: 0, d: 0, p: 0, k: 0, s: 0, x: 0, t: 0, uP: 0, lP: 0, rP: 0 }; n++;
          if (i === 0) { if (lk === 'uP') { inp.u = 1; inp.p = 1; } else { inp.r = 1; inp.k = 1; } return inp; }
          if (launchedAt != null && F.t - launchedAt >= delay && fuq.length && (NEU.has(f.state) ? true : (f.state === 'attack' && n % 3 === 0))) { const a = fuq[0]; if (NEU.has(f.state) || (f.ms[f.move].next && f.ms[f.move].next[a])) { fuq.shift(); if (a[0] === 'f') inp.r = 1; if (a[0] === 'b') inp.l = 1; if (a[0] === 'd') inp.d = 1; if (a[0] === 'u') inp.u = 1; inp[a[a.length - 1] === 'P' ? 'p' : 'k'] = 1; } }
          else if (launchedAt != null && NEU.has(f.state) && F.t - launchedAt < delay) inp.r = 1;
          return inp; });
        for (const e of F.events) { if (e.type === 'launch') launchedAt = F.t; if (e.type === 'hit') dmg += e.dmg; } F.events.length = 0; }
      if (dmg > best) { best = dmg; bestSeq = lk + ' > ' + fu.join(',') + ' (delay ' + delay + ')'; } } }
  console.log(`4. ${t} best simple launcher combo on passive Knight: ${best} dmg  [${bestSeq}]  (launcher alone ${Math.round(MOVESET[t][lk].dmg * STATS[t].pow)})`); }
