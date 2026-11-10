const { run } = require('./lib.js'); const S = require('./strat.js');
const [name, a, b, lvl = 2, n = 60, arg] = process.argv.slice(2);
const c = { raw: 0, counter: 0, combo: 0, blocked: 0, aiHit: 0, whiff: 0, swings: 0 }; let w = 0;
for (let i = 0; i < n; i++) { const r = run(a, b, { lvl: +lvl, scriptSide: 'w', script: arg ? S[name](arg) : S[name], onEvents: (F, ev) => { for (const e of ev) {
  if (e.type === 'swing' && e.f.color === 'w') c.swings++;
  if (e.type === 'hit' && e.by.color === 'w') { if (e.combo > 1) c.combo++; else if (e.counter) c.counter++; else c.raw++; }
  if (e.type === 'hit' && e.by.color === 'b') c.aiHit++;
  if (e.type === 'block' && e.f.color === 'b') c.blocked++; } } }); if (r.attackerWon) w++; }
for (const k in c) c[k] = +(c[k] / n).toFixed(1); console.log(name, a, b, 'L' + lvl, 'win', (w / n).toFixed(2), JSON.stringify(c));
