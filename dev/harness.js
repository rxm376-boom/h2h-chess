// Headless balance harness: node harness.js [n] [levels] [types]
const fs = require('fs');
const code = fs.readFileSync(__dirname + '/src/sim.js', 'utf8');
const api = new Function(code + '\nreturn { STATS, MOVESET, HITS, makeDuel, simStep, AI_LV, ARCH };')();
module.exports = api;
function duel(ta, tb, lvA, lvB, hpA, hpB, stats) {
  const { STATS, makeDuel, simStep } = api;
  const a = { t: ta, c: 'w', hp: hpA ?? STATS[ta].hp }, d = { t: tb, c: 'b', hp: hpB ?? STATS[tb].hp };
  const F = makeDuel(a, d, { w: lvA, b: lvB });
  let guard = 0;
  while (!F.result && guard++ < 60 * 80) {
    simStep(F, 1 / 60);
    if (stats) for (const e of F.events) { if (e.type === 'hit') { const k = e.by.t + ':' + (e.m.name); stats[k] = (stats[k] || 0) + e.dmg; } }
    F.events.length = 0;
  }
  if (!F.result) throw new Error('duel did not end ' + ta + tb);
  F.result.time = F.t;
  return F.result;
}
api.duel = duel;
if (require.main === module) {
  const n = +(process.argv[2] || 300), lvls = (process.argv[3] || '1,2').split(',').map(Number), types = (process.argv[4] || 'P,N,B,R,Q').split(',');
  for (const lvl of lvls) {
    console.log(`\nCPU level ${lvl} vs itself. Row = attacker (left side), column = defender. Win % for the row piece [timeout %], n=${n} each`);
    console.log('     ' + types.map(t => t.padStart(10)).join(''));
    const M = {};
    for (const a of types) {
      let row = a.padEnd(5);
      for (const b of types) { let w = 0, to = 0, tm = 0; for (let i = 0; i < n; i++) { const r = duel(a, b, lvl, lvl); if (r.attackerWon) w++; if (r.timeout) to++; tm += r.time; } M[a + b] = w / n; row += (Math.round(w / n * 100) + '% [' + Math.round(to / n * 100) + ']').padStart(10); }
      console.log(row);
    }
    // side-neutral matchup: average of attacking and defending
    console.log('Side-neutral (avg of both seats): ' + ['NB', 'RN', 'RB', 'QR', 'QN', 'QB', 'NP', 'BP', 'RP', 'QP'].filter(k => types.includes(k[0]) && types.includes(k[1])).map(k => `${k[0]}>${k[1]} ${Math.round((M[k] + 1 - M[k[1] + k[0]]) / 2 * 100)}%`).join('  '));
  }
}
