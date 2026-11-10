const { run } = require('./lib.js'); const S = require('./strat.js');
const [name, a, b, lvl = 2, n = 60, arg] = process.argv.slice(2);
const st = {}, cnt = {}; let w = 0, tm = 0;
for (let i = 0; i < n; i++) { const r = run(a, b, { lvl: +lvl, scriptSide: 'w', script: arg ? S[name](arg) : S[name], onEvents: (F, ev) => { for (const e of ev) { if (e.type === 'hit') { const k = (e.by.color === 'w' ? 'ME ' : 'AI ') + e.m.name + (e.counter ? '*' : ''); st[k] = (st[k] || 0) + e.dmg; } if (e.type === 'block' || e.type === 'armor') { const k = e.type + ' by ' + (e.f.color === 'w' ? 'ME' : 'AI'); cnt[k] = (cnt[k] || 0) + 1; } } } }); if (r.attackerWon) w++; tm += r.time; }
console.log('win', w / n, 'time', (tm / n).toFixed(1));
console.log(Object.entries(st).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ' ' + (v / n).toFixed(1)).join(' | '));
console.log(Object.entries(cnt).map(([k, v]) => k + ' ' + (v / n).toFixed(1)).join(' | '));
