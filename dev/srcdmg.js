const api = require('./harness.js'); const [a, b, lvl = 1, n = 300] = process.argv.slice(2);
if (process.argv[6]) new Function('STATS', 'MOVESET', 'HITS', 'AI_LV', 'ARCH', process.argv[6])(api.STATS, api.MOVESET, api.HITS, api.AI_LV, api.ARCH);
const st = {}; let w = 0; for (let i = 0; i < n; i++) { if (api.duel(a, b, +lvl, +lvl, null, null, st).attackerWon) w++; if (!api.duel(b, a, +lvl, +lvl, null, null, st).attackerWon) w++; }
console.log(a + '>' + b, (w / n * 50).toFixed(0) + '%');
for (const t of [a, b]) console.log(t, Object.entries(st).filter(([k]) => k[0] === t).sort((x, y) => y[1] - x[1]).map(([k, v]) => k.slice(2) + ' ' + (v / n / 2).toFixed(1)).join(', '));
