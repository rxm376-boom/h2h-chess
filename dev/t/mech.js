const { api, run, blank, STATS, MOVESET } = require('./lib.js');
const { makeDuel, simStep } = api;
const mk = (ta, tb, dist) => { const F = makeDuel({ t: ta, c: 'w', hp: STATS[ta].hp }, { t: tb, c: 'b', hp: STATS[tb].hp }, { w: null, b: null }, 999); F.f.w.x = 150; F.f.b.x = 150 + (dist || 40); F.f.w.meter = F.f.b.meter = 100; return F; };
const stepN = (F, sec, inpW, inpB) => { let n = Math.round(sec * 60); const ev = []; while (n-- > 0) { simStep(F, 1 / 60, f => Object.assign(blank(), (typeof (f === F.f.w ? inpW : inpB) === 'function' ? (f === F.f.w ? inpW : inpB)(F, f) : (f === F.f.w ? inpW : inpB)) || {})); ev.push(...F.events); F.events.length = 0; } return ev; };
const once = (F, inpW, inpB) => stepN(F, 1 / 60, inpW, inpB);

// 1. Knight leap reuse
{ const F = mk('N', 'R', 150); once(F, { s: 1 }); console.log('1. leap #1 state', F.f.w.state, 'meter', F.f.w.meter); stepN(F, 3); console.log('   after landing state', F.f.w.state, 'leapUsed', F.f.w.leapUsed, 'meter', F.f.w.meter, 'spCd', F.f.w.spCd);
  once(F, { s: 1 }); console.log('   leap #2 pressed -> state', F.f.w.state, 'meter', F.f.w.meter, '(meter>=50 and nothing happens = bug)');
  stepN(F, .1, { u: 1, uP: 1 }); stepN(F, 1.5); once(F, { s: 1 }); console.log('   after a normal jump, leap #3 -> state', F.f.w.state); }

// 2. input during hitstop
{ const F = mk('P', 'N', 30); once(F, { p: 1 }); let pressedAt = null, got = false;
  for (let i = 0; i < 40; i++) { const hs = F.hitstop > 0; if (hs && pressedAt == null) { pressedAt = i; once(F, { p: 1 }); } else once(F); if (F.f.w.move === 'P2') got = true; }
  console.log('2. P then P pressed on first hitstop frame -> chained to P2?', got, '(false = press eaten during hitstop)'); }
{ // press continuously sampled: how many of 60Hz frames in a jab-hit sequence are "dead" for input
  const F = mk('P', 'N', 30); once(F, { p: 1 }); let dead = 0, tot = 0; for (let i = 0; i < 20; i++) { if (F.hitstop > 0 || F.cine) dead++; tot++; once(F); } console.log('   frames with hitstop in the 20 frames after a jab:', dead); }

// 3. throw during blockstun / hitstun
{ const F = mk('P', 'N', 25); once(F, { p: 1 }); let thrown = false, res = null; for (let i = 0; i < 60; i++) { const f = F.f.w; const ev = once(F, (f.state === 'idle' || f.state==='walk') && F.f.b.state === 'hit' ? { t: 1 } : (F.f.w.state==='attack' && F.f.w.hitRes==='hit' && F.f.w.mt > .15 ? {t:1}:{})); if (F.f.b.state === 'thrown') thrown = true; }
  console.log('3a. jab hit -> throw while victim still in hitstun: grabbed =', thrown); }
{ const F = mk('P', 'N', 25); once(F, { p: 1 }, { r: 1 }); let thrown = false, st = []; for (let i = 0; i < 60; i++) { const f = F.f.w; once(F, (f.state === 'idle') ? { t: 1 } : {}, { r: 1 }); st.push(F.f.b.state[0]); if (F.f.b.state === 'thrown') thrown = true; }
  console.log('3b. jab blocked -> throw on first free frame, defender keeps holding back: grabbed =', thrown, st.join('')); }

// 4. Rook dash frame advantage
for (const blk of [0, 1]) { const F = mk('R', 'N', 70); once(F, { x: 1, r: 1 }, blk ? { r: 1 } : {}); let tFree = null, tOpp = null; for (let i = 1; i < 90; i++) { once(F, {}, blk ? { r: 1 } : {}); if (tFree == null && F.f.w.state === 'idle') tFree = i; if (tFree != null && tOpp == null && !['hit', 'block'].includes(F.f.b.state)) tOpp = i; }
  console.log('4. rook dash', blk ? 'BLOCKED' : 'HIT', '-> rook free at frame', tFree, ', victim free at frame', tOpp, '=> advantage', ((tOpp - tFree) / 60).toFixed(3), 's'); }
// 4b rook dash hit -> fK guaranteed?
{ const F = mk('R', 'N', 70); once(F, { x: 1, r: 1 }); const ev = []; for (let i = 1; i < 90; i++) { const f = F.f.w; ev.push(...once(F, f.state === 'idle' && !f.did ? (f.did = 1, { k: 1, r: 1 }) : {}, { r: 1 })); } console.log('4b. dash hit -> fwd+K while victim holds back:', ev.filter(e => e.type === 'hit' || e.type === 'block').map(e => e.type + ':' + (e.m ? e.m.name : '') + (e.combo ? ' combo' + e.combo : '')).join(', ')); }

// 5. rage art replaces ground special
{ const F = mk('B', 'R', 60); F.f.w.hp = 20; once(F); once(F, { s: 1, l: 1 }); console.log('5. Bishop under 30% presses Special+back on ground -> state', F.f.w.state, 'sp', F.f.w.sp && F.f.w.sp.kind, '(rage = teleport unavailable until rage art is spent)'); }

// 6. max true combo from mashing each string on a passive dummy; loops
for (const t of ['P', 'N', 'B', 'R', 'Q']) for (const btn of ['p', 'k']) {
  const F = mk(t, 'Q', 28); F.f.b.x = 340; F.f.w.x = 312; let maxC = 0, dmg0 = F.f.b.hp, maxD = 0;
  for (let i = 0; i < 60 * 8; i++) { const ev = once(F, { [btn]: i % 6 === 0 ? 1 : 0 }); for (const e of ev) if (e.type === 'hit') { maxC = Math.max(maxC, e.combo); maxD = Math.max(maxD, e.comboDmg); } }
  console.log(`6. ${t} mash ${btn} on passive Queen in corner, 8s: max combo ${maxC} hits / ${maxD} dmg, total dmg ${dmg0 - F.f.b.hp}`);
}
