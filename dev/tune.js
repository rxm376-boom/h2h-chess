// node tune.js n 'JS overrides' -> side-neutral summary at levels 1 and 2 (and 0 with flag)
const api = require('./harness.js');
const n = +(process.argv[2] || 150);
if (process.argv[3]) new Function('STATS', 'MOVESET', 'HITS', 'AI_LV', 'ARCH', process.argv[3])(api.STATS, api.MOVESET, api.HITS, api.AI_LV, api.ARCH);
const pairs = ['NB', 'RN', 'RB', 'QR', 'QN', 'QB', 'NP', 'BP', 'RP', 'QP'];
const lv = (process.argv[4] || '1,2').split(',').map(Number);
for (const lvl of lv) {
  let line = `L${lvl}: `, tos = '';
  for (const k of pairs) {
    let w = 0, to = 0, tm = 0;
    for (let i = 0; i < n; i++) { const r = api.duel(k[0], k[1], lvl, lvl); if (r.attackerWon) w++; if (r.timeout) to++; tm += r.time; const r2 = api.duel(k[1], k[0], lvl, lvl); if (!r2.attackerWon) w++; if (r2.timeout) to++; tm += r2.time; }
    line += `${k[0]}>${k[1]} ${Math.round(w / n * 50)}%(${(tm / n / 2).toFixed(0)}s,to${Math.round(to / n * 50)})  `;
  }
  for (const t of ['N', 'B', 'R']) { let w = 0, to = 0; for (let i = 0; i < n; i++) { const r = api.duel(t, t, lvl, lvl); if (r.attackerWon) w++; if (r.timeout) to++; } tos += ` ${t}${t}: att ${Math.round(w / n * 100)}% to ${Math.round(to / n * 100)}%`; }
  console.log(line + '\n   mirrors:' + tos);
}
