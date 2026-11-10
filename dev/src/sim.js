/* =====================================================================
   Duel rules, move sets and simulation. No DOM in this section: the same
   code runs headless for balance testing (thousands of CPU-vs-CPU duels).
   Units: x in arena pixels (384 wide), y = height above the floor, seconds.
   ===================================================================== */
const AR = { W: 384, L: 14, R: 370, G: 760 };
const SP_COST = 50, SP_MAX = 100, SP_START = 25;
const STEP_DUR = 0.36, STEP_INV = [0.03, 0.25], MAX_SEP = 196;

const STATS = {
  P: { name: "Pawn", hp: 58, pow: 1.0, spd: 64, jump: 195, airJumps: 0, dash: null, hw: 15, sp: "rush", lastStand: true, value: 1,
       style: "Scrapper", spName: "Shoulder rush", throwName: "Shield Toss", rageName: "PAWN STORM",
       notes: ["Boxer with a shield: fast jabs, body blows, a slide tackle", "Sidestep instead of a dash", "Hits 50% harder below 25% HP"] },
  N: { name: "Knight", hp: 112, pow: 1.12, airPow: 1.25, spd: 68, jump: 292, airJumps: 1, dash: null, hw: 15, sp: "leap", deflect: 2, value: 3,
       style: "Jumper", spName: "L-leap dive kick (knocks down)", throwName: "Rodeo Vault", rageName: "CAVALRY CHARGE",
       notes: ["Kick specialist: flip-kick launcher, spinning heel", "Highest jump + double jump, air attacks hit 25% harder and kick bolts away", "Sidestep instead of a dash"] },
  B: { name: "Bishop", hp: 101, pow: 1.22, spd: 60, jump: 240, airJumps: 0, dash: null, hw: 15, sp: "blink", value: 3.2,
       style: "Diagonal zoner", spName: "Diagonal teleport (hold back to retreat)", throwName: "Crook Hook", rageName: "DIVINE DIAGONAL",
       notes: ["Punch fires a 45° bolt: up from the ground, down from the air. Bolts ignore armor", "Long staff pokes keep enemies out", "Sidestep instead of a dash"] },
  R: { name: "Rook", hp: 110, pow: 1.2, spd: 42, jump: 0, airJumps: 0, dash: { spd: 330, dur: 0.22, dmg: 6, air: false, cd: 1.7 }, hw: 16, sp: "quake", armor: 0.9, value: 5,
       style: "Tank", spName: "Floor shockwave (jump over it)", throwName: "Tower Slam", rageName: "FORTRESS CRASH",
       notes: ["Can't jump. Slow, heavy, long wind-ups", "Straight dash that hits", "Armor: takes 10% less, shrugs off light hits", "Up + punch = anti-air uppercut"] },
  Q: { name: "Queen", hp: 138, pow: 1.25, spd: 76, jump: 252, airJumps: 1, dash: { spd: 320, dur: 0.18, dmg: 0, air: true, cd: 0.42 }, hw: 15, sp: "beam", value: 9,
       style: "All-rounder", spName: "Royal bolt (high, duck it)", throwName: "Royal Decree", rageName: "CHECKMATE",
       notes: ["Scepter strings up to 5 hits", "Dashes both ways, also in the air", "Double jump"] },
  K: { name: "King", hp: 0, value: 0 },
};

/* Move archetypes: startup / active / recovery in seconds, damage before the piece's power,
   ha / ba = advantage (seconds) for the attacker on hit / on block, reach from the body centre, h = strike height. */
const ARCH = {
  jab:    { su: .10, ac: .05, rc: .13, dmg: 5,  lvl: "high", ha: .06,  ba: .0,   push: 60,  reach: 34, h: 49, r: 5, light: true },
  cross:  { su: .11, ac: .05, rc: .17, dmg: 7,  lvl: "high", ha: .05,  ba: -.04, push: 85,  reach: 37, h: 48, r: 5 },
  body:   { su: .14, ac: .06, rc: .20, dmg: 8,  lvl: "mid",  ha: .04,  ba: -.06, push: 90,  reach: 34, h: 33, r: 6 },
  lunge:  { su: .17, ac: .08, rc: .24, dmg: 10, lvl: "mid",  ha: .05,  ba: -.08, push: 130, reach: 38, h: 36, r: 6, step: 170 },
  heavy:  { su: .27, ac: .08, rc: .30, dmg: 15, lvl: "high", ha: .12,  ba: -.05, push: 180, reach: 39, h: 47, r: 7, ch: "kd" },
  lowjab: { su: .12, ac: .05, rc: .16, dmg: 4,  lvl: "low",  ha: .02,  ba: -.12, push: 50,  reach: 32, h: 12, r: 5, light: true, crouch: true },
  kick:   { su: .15, ac: .07, rc: .22, dmg: 9,  lvl: "mid",  ha: .04,  ba: -.07, push: 115, reach: 43, h: 32, r: 6 },
  launch: { su: .21, ac: .08, rc: .40, dmg: 8,  lvl: "mid",  ha: 0,    ba: -.26, push: 40,  reach: 36, h: 40, r: 7, launch: true },
  sweep:  { su: .22, ac: .08, rc: .36, dmg: 8,  lvl: "low",  ha: 0,    ba: -.30, push: 90,  reach: 45, h: 7,  r: 6, kd: true, crouch: true, track: true },
  spin:   { su: .24, ac: .09, rc: .32, dmg: 13, lvl: "high", ha: .10,  ba: -.08, push: 165, reach: 45, h: 48, r: 7, track: true, ch: "kd" },
  airP:   { su: .07, ac: 9, rc: 0, dmg: 7,  lvl: "mid", ha: .12, ba: .02, push: 70,  reach: 30, h: 22, r: 7, air: true, light: true },
  airK:   { su: .09, ac: 9, rc: 0, dmg: 10, lvl: "mid", ha: .14, ba: .03, push: 100, reach: 34, h: 10, r: 8, air: true },
  cast:   { su: .14, ac: .01, rc: .24, proj: "bolt" },
  airCast:{ su: .09, ac: .01, rc: .26, proj: "bolt", air: true },
};
const mv = (name, arch, o) => Object.assign({ name, arch, anim: arch }, ARCH[arch], o || {});
const MOVESET = {
  P: {
    P:   mv("Jab", "jab", { next: { P: "P2", K: "PK" } }),
    P2:  mv("Cross", "cross", { next: { P: "P3", K: "P2K" } }),
    P3:  mv("Body Hook", "body", { dmg: 9, ha: .08, anim: "hook" }),
    PK:  mv("Shin Kick", "lowjab", { dmg: 5, anim: "lowkick", reach: 38, h: 9, crouch: false, light: false, su: .16 }),
    P2K: mv("Boot", "kick", { dmg: 10, push: 150, su: .17 }),
    fP:  mv("Shield Bash", "lunge", { dmg: 9, ba: -.02, push: 175, anim: "bash" }),
    bP:  mv("Haymaker", "heavy"),
    dP:  mv("Shin Jab", "lowjab"),
    K:   mv("Front Kick", "kick", { next: { P: "KP" } }),
    KP:  mv("Overhand", "cross", { dmg: 8, lvl: "mid", h: 42, anim: "overhand", su: .16 }),
    fK:  mv("Rising Knee", "launch", { reach: 31, su: .19, anim: "knee" }),
    bK:  mv("Heel Spin", "spin"),
    dK:  mv("Slide Tackle", "sweep", { step: 190, reach: 40, anim: "slide" }),
    aP:  mv("Drop Punch", "airP"),
    aK:  mv("Hop Kick", "airK"),
  },
  N: {
    P:   mv("Hoof Jab", "jab", { next: { P: "P2" } }),
    P2:  mv("Backfist", "cross", { next: { K: "P2K" }, anim: "backfist" }),
    P2K: mv("Crescent Kick", "kick", { dmg: 10, lvl: "high", h: 47, next: { K: "P2KK" }, anim: "crescent", track: true }),
    P2KK:mv("Hind Kick", "kick", { dmg: 12, su: .2, push: 190, kd: true, anim: "sidekick", reach: 46, ba: -.14 }),
    fP:  mv("Lance Thrust", "lunge", { reach: 46 }),
    bP:  mv("Rearing Smash", "heavy", { lvl: "mid", h: 40, su: .30, dmg: 14, anim: "smash" }),
    dP:  mv("Low Jab", "lowjab"),
    K:   mv("Roundhouse", "kick", { track: true, dmg: 10, next: { K: "KK" }, anim: "round" }),
    KK:  mv("Spinning Heel", "spin", { su: .22 }),
    fK:  mv("Flip Kick", "launch", { hop: 215, anim: "flip", su: .19, reach: 38, h: 34, r: 9, rc: .46 }),
    bK:  mv("Mule Kick", "spin", { lvl: "mid", h: 34, anim: "sidekick", reach: 47, track: false, push: 200 }),
    dK:  mv("Hoof Sweep", "sweep"),
    aP:  mv("Dive Fist", "airP"),
    aK:  mv("Stomp Dive", "airK", { dmg: 11 }),
  },
  B: {
    P:   mv("Bolt", "cast", { rc: .3 }),
    fP:  mv("Crozier Thrust", "lunge", { reach: 52, dmg: 8, step: 90, next: { P: "fP2" }, anim: "sthrust", ba: -.15, rc: .28, bpush: 40, su: .18 }),
    fP2: mv("Second Thrust", "lunge", { reach: 54, dmg: 7, step: 90, next: { K: "fP2K" }, anim: "sthrust2", su: .16, ba: -.16, rc: .28, bpush: 40 }),
    fP2K:mv("Benediction", "heavy", { lvl: "mid", h: 38, reach: 52, dmg: 11, kd: true, su: .24, anim: "staffsmash", ba: -.14 }),
    bP:  mv("Censer Arc", "heavy", { lvl: "mid", h: 40, reach: 52, dmg: 13, su: .29, anim: "staffsmash", push: 190 }),
    dP:  mv("Ankle Tap", "lowjab", { reach: 50, anim: "stafflow", su: .15, rc: .2 }),
    K:   mv("Push Kick", "kick", { dmg: 7, push: 200, next: { K: "KK" } }),
    KK:  mv("Staff Whirl", "spin", { lvl: "mid", h: 36, reach: 52, dmg: 10, anim: "whirl", su: .2 }),
    fK:  mv("Crook Lift", "launch", { reach: 46, su: .24, anim: "stafflift" }),
    bK:  mv("Retreat Kick", "kick", { step: -150, dmg: 7, ba: -.02, reach: 46, anim: "retreat" }),
    dK:  mv("Staff Sweep", "sweep", { reach: 56, su: .25, anim: "staffsweep" }),
    aP:  mv("Falling Bolt", "airCast", { rc: .32 }),
    aK:  mv("Sandal Drop", "airK", { dmg: 8 }),
  },
  R: {
    P:   mv("Hammer Fist", "jab", { su: .13, rc: .16, dmg: 7, lvl: "mid", h: 40, light: false, next: { P: "P2" }, anim: "hammer", ha: .04, ba: -.03 }),
    P2:  mv("Mortar Fist", "cross", { su: .14, dmg: 9, lvl: "mid", h: 38, next: { P: "P3" }, anim: "body", ba: -.08 }),
    P3:  mv("Keystone Smash", "heavy", { lvl: "mid", h: 42, dmg: 14, kd: true, su: .26, anim: "smash", ba: -.16 }),
    fP:  mv("Battering Ram", "lunge", { step: 230, dmg: 9, push: 190, anim: "bash", su: .2, ba: -.1 }),
    bP:  mv("Wrecking Ball", "heavy", { su: .34, dmg: 18, ba: .05, push: 230, reach: 42, anim: "wreck", kd: true }),
    dP:  mv("Foundation Punch", "lowjab", { su: .17, dmg: 6, light: false, rc: .22, reach: 34 }),
    uP:  mv("Turret Uppercut", "launch", { su: .15, reach: 32, h: 54, h0: 30, r: 9, dmg: 10, anim: "upper", rc: .36, ba: -.2 }),
    K:   mv("Stomp Kick", "kick", { su: .18, dmg: 10, rc: .26 }),
    fK:  mv("Drawbridge Boot", "kick", { su: .27, dmg: 14, kd: true, push: 210, reach: 47, ba: -.15, anim: "bigboot", rc: .34 }),
    bK:  mv("Tower Lariat", "spin", { su: .28, dmg: 15, anim: "lariat", reach: 42 }),
    dK:  mv("Low Stomp", "sweep", { su: .2, dmg: 8, kd: false, ha: .03, ba: -.2, reach: 38, rc: .3, track: false, anim: "lowkick", crouch: false }),
  },
  Q: {
    P:   mv("Scepter Flick", "jab", { reach: 38, next: { P: "P2" }, anim: "flick" }),
    P2:  mv("Backhand", "cross", { reach: 40, next: { P: "P3", K: "P2K" }, anim: "backfist" }),
    P3:  mv("Royal Thrust", "body", { reach: 44, next: { K: "P3K" }, anim: "thrust" }),
    P2K: mv("Shin Cut", "lowjab", { dmg: 6, anim: "lowkick", reach: 40, h: 9, crouch: false, light: false, su: .17, rc: .22 }),
    P3K: mv("High Heel", "kick", { lvl: "high", h: 48, dmg: 9, next: { K: "P3KK" }, anim: "crescent" }),
    P3KK:mv("Coronation", "heavy", { lvl: "mid", h: 40, dmg: 13, kd: true, su: .24, anim: "axe", ba: -.15, reach: 42 }),
    fP:  mv("Lunging Thrust", "lunge", { reach: 46, anim: "thrust" }),
    bP:  mv("Sovereign Slash", "heavy", { reach: 44, anim: "slash" }),
    dP:  mv("Low Flick", "lowjab", { reach: 36 }),
    K:   mv("Heel Kick", "kick", { next: { K: "KK" } }),
    KK:  mv("Pirouette", "spin", { su: .22 }),
    fK:  mv("Crescent Rise", "launch"),
    bK:  mv("Sidewinder", "spin", { lvl: "mid", h: 34, anim: "sidekick", reach: 47, track: false, push: 200 }),
    dK:  mv("Train Sweep", "sweep"),
    aP:  mv("Scepter Dive", "airP", { reach: 34 }),
    aK:  mv("Stiletto", "airK"),
  },
};
// Strings are pressure, not free damage: every follow-up hit is minus on block, and the last hit of a string is punishable.
for (const t in MOVESET) {
  const chained = new Set(); for (const k in MOVESET[t]) for (const b in (MOVESET[t][k].next || {})) chained.add(MOVESET[t][k].next[b]);
  for (const k of chained) { const m = MOVESET[t][k]; if (m.next) m.ba = Math.min(m.ba, -0.1); else { m.ba = Math.min(m.ba, -0.17); m.bpush = Math.min(m.push, 60); } }
}
for (const t in MOVESET) for (const k in MOVESET[t]) { const m = MOVESET[t][k]; m.key = k; m.total = m.su + m.ac + m.rc; }
const HITS = {
  rush:  { name: "Shoulder Rush", dmg: 10, lvl: "mid",  hs: .36, bs: .18, push: 140, ch: "kd" },
  leap:  { name: "Dive Kick",     dmg: 12, lvl: "mid",  hs: .3,  bs: .2,  push: 110, kd: true, airy: true },
  bolt:  { name: "Bolt",          dmg: 8,  lvl: "mid",  hs: .28, bs: .14, push: 70,  proj: true, pierce: true },
  wave:  { name: "Shockwave",     dmg: 10, lvl: "low",  hs: .4,  bs: .2,  push: 120, kd: true, proj: true },
  beam:  { name: "Royal Bolt",    dmg: 10, lvl: "high", hs: .3,  bs: .14, push: 90,  proj: true },
  rdash: { name: "Dash",          dmg: 6,  lvl: "mid",  hs: .34, bs: .2,  push: 150 },
  rage:  { name: "Rage Art",      dmg: 24, lvl: "mid",  hs: .5,  bs: .32, push: 220, kd: true, rage: true },
  throw: { name: "Throw",         dmg: 13, lvl: "throw", hs: .5, bs: 0,   push: 0,   kd: true },
};
const INPUT_LABEL = { P: "Punch", fP: "Forward + Punch", bP: "Back + Punch", dP: "Down + Punch", uP: "Up + Punch", K: "Kick", fK: "Forward + Kick", bK: "Back + Kick", dK: "Down + Kick", aP: "Air Punch", aK: "Air Kick" };

const blankInput = () => ({ l: 0, r: 0, u: 0, d: 0, p: 0, k: 0, s: 0, x: 0, t: 0, uP: 0, lP: 0, rP: 0 });
const NEUTRAL = new Set(["idle", "walk", "crouch"]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const spReady = f => f.spCd <= 0 && f.meter >= SP_COST;
const lastStandOn = f => f.s.lastStand && f.hp / f.max < 0.25;
const faceOpp = (f, o) => { if (o.x !== f.x) f.face = o.x > f.x ? 1 : -1; };
function gainMeter(F, f, n) { const was = f.meter; f.meter = Math.min(SP_MAX, f.meter + n); if (was < SP_COST && f.meter >= SP_COST) F.events.push({ type: "call", f, text: "SPECIAL READY", tone: "sp" }); }
const call = (F, f, text, tone) => F.events.push({ type: "call", f, text, tone });

function makeFighter(p, isAtt, aiLvl) {
  const s = STATS[p.t], left = p.c === "w";
  return {
    p, t: p.t, s, ms: MOVESET[p.t], color: p.c, isAtt,
    x: left ? 132 : 252, y: 0, z: 0, vx: 0, vy: 0, face: left ? 1 : -1,
    hp: p.hp, max: s.hp, state: "idle", st: 0, move: null, mt: 0, hitDone: false, hitRes: null, spawned: false, chain: 0, buf: null,
    spCd: 0, meter: SP_START, dashCd: 0, sp: null, dash: null, step: null, inv: 0, combo: 0, comboDmg: 0, comboT: 0, walkT: 0, flash: 0, ko: false, blockLow: false,
    airJ: s.airJumps, airDash: true, leapUsed: false, tap: { dir: null, t: 9 }, splatted: false, hitPush: 0, hitKind: "mid", stT: 0,
    rage: false, rageUsed: false, juggle: 0, grab: null, thrower: null,
    inp: blankInput(), ai: aiLvl == null ? null : { lvl: aiLvl, think: 0.35 + Math.random() * 0.2, hold: { l: 0, r: 0, u: 0, d: 0 }, queue: [], seen: null, reactT: 0, plan: null, punished: null },
  };
}
function makeDuel(att, def, aiLvls, seconds) {
  const fa = makeFighter(att, true, aiLvls[att.c]), fd = makeFighter(def, false, aiLvls[def.c]);
  return { t: 0, seconds: seconds || 30, f: { [att.c]: fa, [def.c]: fd }, att: fa, def: fd, proj: [], result: null, hitstop: 0, cine: null, events: [], flip: false };
}

/* One simulation tick. getInput(f) supplies a human fighter's input. */
function simStep(F, dt, getInput) {
  if (F.result) return;
  if (F.cine) { latchInput(F, getInput); cineStep(F, dt); if (F.cine) return; }
  if (F.hitstop > 0) { latchInput(F, getInput); F.hitstop -= dt; return; }
  F.t += dt; F.flip = !F.flip;
  const w = F.f.w, b = F.f.b, order = F.flip ? [[w, b], [b, w]] : [[b, w], [w, b]];
  for (const [f, o] of order) {
    f.inp = f.ai ? aiInput(F, f, o, dt) : (getInput ? getInput(f) : blankInput());
    if (f.latch) { f.inp = Object.assign({}, f.inp, f.latch); f.latch = null; }
  }
  for (const [f, o] of order) update(F, f, o, dt);
  separate(w, b);
  updateProj(F, dt);
  const dead = F.att.hp <= 0 ? F.att : F.def.hp <= 0 ? F.def : null; // a double KO goes to the defender
  if (!F.cine && (dead || F.t >= F.seconds)) endDuel(F, dead);
}
// Presses made during hit-stop or a cut-in freeze are kept and delivered on the next live tick, so strings never drop inputs
function latchInput(F, getInput) {
  if (!getInput) return;
  for (const f of [F.f.w, F.f.b]) if (!f.ai) {
    const I = getInput(f);
    if (I.p) f.buf = { b: "P", t: 0.22 }; else if (I.k) f.buf = { b: "K", t: 0.22 };
    for (const k of ["s", "x", "t", "uP", "lP", "rP"]) if (I[k]) (f.latch = f.latch || {})[k] = 1;
  }
}
function endDuel(F, dead) {
  const attackerWon = dead ? dead === F.def : (F.att.hp / F.att.max) > (F.def.hp / F.def.max) + 1e-9;
  const loser = attackerWon ? F.def : F.att, winner = attackerWon ? F.att : F.def;
  winner.hp = Math.max(1, winner.hp); winner.ko = false; /* double KO: the survivor keeps 1 HP */
  F.result = { attackerWon, attackerHp: F.att.hp, defenderHp: F.def.hp, timeout: !dead, perfect: winner.hp >= winner.p.hp && !!dead };
  if (dead) { if (loser.state !== "fall" && loser.state !== "ko") { loser.state = "fall"; loser.vy = -150; loser.vx = -loser.face * 60; loser.y = Math.max(loser.y, 1); } loser.ko = true; }
  else if (loser.y <= 0) { loser.state = "lose"; loser.vx = 0; }
  loser.sp = null; loser.move = null; loser.dash = null; loser.step = null; loser.z = 0;
  winner.vx = 0; winner.sp = null; winner.move = null; winner.dash = null; winner.step = null; winner.z = 0; winner.won = true;
  if (winner.y <= 0) winner.state = "win"; else if (winner.state !== "jump") winner.state = "jump";
  F.hitstop = 0; F.cine = null;
  F.events.push({ type: "ko", f: loser, w: winner, timeout: !dead, perfect: F.result.perfect });
}

function tryDash(F, f, dir) {
  const D = f.s.dash;
  if (!D || f.dashCd > 0) return false;
  if (f.y > 0 && (!D.air || !f.airDash)) return false;
  if (f.y > 0) f.airDash = false;
  f.dash = { dir, t: D.dur, hit: false };
  f.state = "dash"; f.dashCd = D.cd; f.move = null; f.vx = dir * D.spd; f.vy = 0;
  F.events.push({ type: "dash", f });
  return true;
}
function tryStep(F, f, dir) {
  if (f.dashCd > 0 || f.y > 0) return false;
  f.state = "step"; f.step = { t: 0, dir: dir || 1 }; f.dashCd = 0.85; f.vx = 0; f.move = null;
  F.events.push({ type: "step", f });
  return true;
}
const stepInv = f => f.state === "step" && f.step && f.step.t >= STEP_INV[0] && f.step.t <= STEP_INV[1];

function pickMove(f, btn, I, fw, bk) {
  const ms = f.ms;
  if (btn === "P") return I.u && ms.uP ? "uP" : I.d && ms.dP ? "dP" : fw && ms.fP ? "fP" : bk && ms.bP ? "bP" : "P";
  return I.d && ms.dK ? "dK" : fw && ms.fK ? "fK" : bk && ms.bK ? "bK" : "K";
}
function startMove(F, f, name, chained) {
  const m = f.ms[name];
  f.move = name; f.mt = 0; f.hitDone = false; f.hitRes = null; f.spawned = false;
  if (!m.air) {
    f.state = "attack";
    if (m.step) f.vx = f.face * m.step; else if (!chained) f.vx = 0;
    if (m.hop) { f.vy = -m.hop; f.y = Math.max(f.y, 0.01); }
  }
  F.events.push({ type: "swing", f, m });
}

function update(F, f, o, dt) {
  f.spCd = Math.max(0, f.spCd - dt); f.dashCd = Math.max(0, f.dashCd - dt);
  f.inv = Math.max(0, f.inv - dt); f.flash = Math.max(0, f.flash - dt); f.stT += dt;
  if (f.comboT > 0) { f.comboT -= dt; if (f.comboT <= 0) { f.combo = 0; f.comboDmg = 0; } }
  f.tap.t += dt;
  if (f.buf) { f.buf.t -= dt; if (f.buf.t <= 0) f.buf = null; }
  if (!f.rage && f.hp > 0 && f.hp / f.max < 0.3) { f.rage = true; call(F, f, "RAGE", "rage"); F.events.push({ type: "rage", f }); }
  const I = f.inp;
  if (I.p) f.buf = { b: "P", t: 0.2 }; else if (I.k) f.buf = { b: "K", t: 0.2 };
  let tapDash = 0;
  for (const [key, dir] of [["lP", -1], ["rP", 1]]) if (I[key]) { if (f.tap.dir === dir && f.tap.t < 0.26) tapDash = dir; f.tap = { dir, t: 0 }; }
  const prev = f.state;

  switch (f.state) {
    case "idle": case "walk": case "crouch": {
      faceOpp(f, o); f.splatted = false;
      const fw = f.face > 0 ? I.r : I.l, bk = f.face > 0 ? I.l : I.r;
      if (I.t) { f.buf = null; startThrow(F, f); break; }
      if (I.x || tapDash) { if (f.s.dash ? tryDash(F, f, tapDash || (bk ? -f.face : f.face)) : tryStep(F, f, I.d ? -1 : 1)) break; }
      if (I.s && f.rage && !f.rageUsed && (I.d || !spReady(f))) { startRage(F, f, o); break; } // rage art: down + special (or special with no meter)
      if (I.s && spReady(f) && startSpecial(F, f, o)) break;
      if (f.buf && f.buf.b === "P" && I.u && f.ms.uP) { f.buf = null; f.chain = 0; startMove(F, f, "uP"); break; }
      if (I.u && f.s.jump > 0) { f.state = "jump"; f.vy = -f.s.jump; f.y = 0.01; f.vx = fw ? f.s.spd * 1.3 * f.face : bk ? -f.s.spd * 1.1 * f.face : 0; f.move = null; f.airJ = f.s.airJumps; f.airDash = true; f.leapUsed = false; F.events.push({ type: "jump", f }); break; }
      if (f.buf) { const name = pickMove(f, f.buf.b, I, fw, bk); f.buf = null; f.chain = 0; startMove(F, f, name); break; }
      if (I.d) { f.state = "crouch"; f.vx = 0; }
      else if (fw) { f.state = "walk"; f.vx = f.s.spd * f.face; }
      else if (bk) { f.state = "walk"; f.vx = -f.s.spd * 0.75 * f.face; }
      else { f.state = "idle"; f.vx = 0; }
      if (f.state === "walk") f.walkT += dt * (f.vx * f.face > 0 ? 1 : -1);
      break;
    }
    case "jump": {
      const fw = f.face > 0 ? I.r : I.l, bk = f.face > 0 ? I.l : I.r;
      if (!f.move) faceOpp(f, o);
      if (I.uP && f.airJ > 0 && f.vy > -f.s.jump * 0.6) { f.airJ--; f.vy = -f.s.jump * 0.85; f.vx = fw ? f.s.spd * 1.3 * f.face : bk ? -f.s.spd * 1.1 * f.face : f.vx * 0.5; f.move = null; f.stT = 0; F.events.push({ type: "jump", f, air: true }); break; }
      if ((I.x || tapDash) && f.s.dash && f.s.dash.air && tryDash(F, f, tapDash || (bk ? -f.face : f.face))) break;
      if (I.s && spReady(f) && (f.s.sp === "leap" || f.s.sp === "blink") && startSpecial(F, f, o)) break;
      if (!f.move && f.buf) { const k = f.buf.b === "P" ? "aP" : "aK"; f.buf = null; if (f.ms[k]) startMove(F, f, k); }
      if (f.move) { f.mt += dt; moveTick(F, f, o); }
      break;
    }
    case "dash": {
      const D = f.dash; D.t -= dt;
      f.vx = D.dir * f.s.dash.spd; f.vy = 0;
      if (f.s.dash.dmg && !D.hit && D.dir === f.face) {
        const hit = strikeHits(f, o, { reach: 16, h: 32, r: 8 });
        if (hit) { // contact ends the dash with real recovery: a little plus on hit, punishable on block
          const res = resolveHit(F, f, o, HITS.rdash, hit);
          f.dash = null; f.state = "land"; f.st = res === "block" ? 0.4 : 0.38; f.stT = 0; f.vx = 0; break;
        }
      }
      if (D.t <= 0) { f.dash = null; f.vx *= 0.25; f.state = f.y > 0 ? "jump" : "idle"; }
      break;
    }
    case "step": {
      const S = f.step; S.t += dt; f.vx = 0;
      f.z = Math.sin(Math.min(1, S.t / STEP_DUR) * Math.PI) * 15 * S.dir;
      if (S.t >= STEP_INV[1] + 0.02 && f.buf) { // a sidestep can be cancelled into an attack once the dodge window has passed
        const fw = f.face > 0 ? I.r : I.l, bk = f.face > 0 ? I.l : I.r, name = pickMove(f, f.buf.b, I, fw, bk);
        f.buf = null; f.chain = 0; f.step = null; f.z = 0; faceOpp(f, o); startMove(F, f, name); break;
      }
      if (S.t >= STEP_DUR) { f.state = "idle"; f.step = null; f.z = 0; }
      break;
    }
    case "attack": {
      const m = f.ms[f.move]; f.mt += dt;
      f.vx *= Math.exp(-(m.step && f.mt < m.su + m.ac ? 3.5 : 13) * dt);
      moveTick(F, f, o);
      if (f.state !== "attack") break;
      const win = f.mt >= m.su + m.ac * 0.5 && f.mt <= m.su + m.ac + m.rc * 0.6;
      if (win && f.buf && m.next && m.next[f.buf.b]) { const nx = m.next[f.buf.b]; f.buf = null; f.chain++; startMove(F, f, nx, true); break; }
      if (win && I.s && f.hitRes === "hit" && f.y <= 0 && spReady(f) && startSpecial(F, f, o)) break;
      if (f.mt >= m.total && f.y <= 0) { f.state = m.crouch && I.d ? "crouch" : "idle"; f.move = null; }
      break;
    }
    case "special": updateSpecial(F, f, o, dt); break;
    case "throw": updateThrow(F, f, o, dt); break;
    case "thrown": {
      const th = f.thrower;
      if (!th || th.state !== "throw" || !th.grab) { f.state = "idle"; f.thrower = null; break; }
      f.vx = 0; f.x = clamp(th.x + th.face * (th.s.hw + f.s.hw + (th.t === "R" || th.t === "Q" ? 2 : 10)), AR.L + f.s.hw, AR.R - f.s.hw); f.face = -th.face;
      if (I.t && th.grab.t < 0.3) breakThrow(F, th, f);
      break;
    }
    case "hit": case "block": f.st -= dt; f.vx *= Math.exp(-9 * dt); if (f.st <= 0) { f.state = I.d ? "crouch" : "idle"; } break;
    case "down": f.st -= dt; f.vx = 0; if (f.st <= 0) { f.state = "getup"; f.st = 0.3; } break;
    case "getup": f.st -= dt; f.inv = 0.05; if (f.st <= 0) f.state = "idle"; break;
    case "land": f.st -= dt; f.vx = 0; if (f.st <= 0) f.state = "idle"; break;
  }
  if (f.state !== prev) f.stT = 0;
  physics(F, f, dt);
}

function physics(F, f, dt) {
  const air = f.y > 0;
  if (air && f.state !== "dash") f.vy += AR.G * dt;
  f.x += f.vx * dt; f.y -= f.vy * dt;
  if (f.y <= 0) {
    f.y = 0;
    if (air) {
      f.leapUsed = false;
      if (f.state === "jump") { f.state = f.won ? "win" : "land"; f.st = !f.move ? 0.07 : f.hitRes === "block" ? (f.s.airJumps ? 0.17 : 0.24) : f.hitRes === "hit" ? 0.07 : 0.15; /* a blocked or whiffed jump attack can be punished on landing */ f.stT = 0; f.move = null; f.vx = 0; F.events.push({ type: "land", f }); }
      else if (f.state === "fall") { f.state = f.ko ? "ko" : "down"; f.st = 0.55; f.stT = 0; f.vx = 0; f.juggle = 0; F.events.push({ type: "slamdown", f, x: f.x }); if (f.ko) F.events.push({ type: "shatter", f }); }
      else if (f.state === "special" && f.sp && f.sp.kind === "leap") { f.state = "land"; f.st = 0.22; f.stT = 0; f.sp = null; f.vx = 0; F.events.push({ type: "crater", x: f.x, f }); }
      else if (f.state === "attack") { f.vx *= 0.3; F.events.push({ type: "land", f }); }
      else if (f.state === "hit" || f.state === "block") f.vx *= 0.5;
    }
    f.vy = 0;
  }
  if (f.y > 150) { f.y = 150; if (f.vy < 0) f.vy = 0; }
  const r = f.s.hw, xl = AR.L + r, xr = AR.R - r;
  if (f.x < xl || f.x > xr) {
    f.x = clamp(f.x, xl, xr);
    if (f.state === "hit" && !f.splatted && f.hitPush >= 150 && Math.abs(f.vx) > 55 && f.hp > 0) { // wall splat
      f.splatted = true; f.st = 0.55; f.stT = 0; f.vx = 0; f.hitKind = "splat"; f.hp = Math.max(1, f.hp - 3);
      F.events.push({ type: "splat", f, x: f.x < AR.W / 2 ? AR.L : AR.R, h: 34 }); F.hitstop = 0.08;
    } else if (f.state === "fall" && Math.abs(f.vx) > 40) { f.vx *= -0.35; F.events.push({ type: "splat", f, x: f.x < AR.W / 2 ? AR.L : AR.R, h: f.y + 26, soft: true }); }
  }
}

function separate(a, b) {
  const far = Math.abs(b.x - a.x) - MAX_SEP;
  if (far > 0) { // the camera keeps both fighters in frame: whoever is backing away gets held
    const s = Math.sign(b.x - a.x), aAway = a.vx * s < 0, bAway = b.vx * s > 0;
    if (aAway && !bAway) a.x += s * far; else if (bAway && !aAway) b.x -= s * far; else { a.x += s * far / 2; b.x -= s * far / 2; }
  }
  if (a.y > 22 || b.y > 22) return;
  if (a.state === "ko" || b.state === "ko" || a.state === "ragecine" || b.state === "ragecine") return;
  const min = a.s.hw + b.s.hw;
  const dx = b.x - a.x, d = Math.abs(dx);
  if (d >= min) return;
  const s = dx === 0 ? (a.face > 0 ? 1 : -1) : Math.sign(dx);
  const push = (min - d) / 2;
  a.x -= s * push; b.x += s * push;
  const ra = a.s.hw, rb = b.s.hw;
  a.x = clamp(a.x, AR.L + ra, AR.R - ra); b.x = clamp(b.x, AR.L + rb, AR.R - rb);
  if (Math.abs(b.x - a.x) < min - 0.5) {
    if (a.x <= AR.L + ra + 0.5 || a.x >= AR.R - ra - 0.5) b.x = a.x + s * min; else a.x = b.x - s * min;
  }
}

function moveTick(F, f, o) {
  const m = f.ms[f.move]; if (!m) return;
  if (m.proj) {
    if (!f.spawned && f.mt >= m.su) {
      f.spawned = true;
      const air = f.y > 0;
      if (F.proj.filter(p => p.owner === f).length < (f.s.maxBolts || 2)) {
        const p = { kind: "bolt", owner: f, x: f.x + f.face * 14, h: f.y + (air ? 30 : 50), vx: f.face * 150, vh: air ? -150 : 150, life: 2.5, hit: HITS.bolt };
        F.proj.push(p); F.events.push({ type: "muzzle", f, x: p.x, h: p.h, small: true });
      }
    }
    if (m.air && f.mt > m.su + m.rc) f.move = null;
    return;
  }
  if (f.hitDone) return;
  if (!(f.mt >= m.su && (m.air || f.mt < m.su + m.ac))) return;
  const hit = strikeHits(f, o, m);
  if (hit) { f.hitDone = true; f.hitRes = resolveHit(F, f, o, m, hit); }
}

function hurtbox(f) {
  const hw = f.s.hw, air = f.y > 0;
  const crouch = f.state === "crouch" || (f.state === "attack" && f.ms[f.move] && f.ms[f.move].crouch) || (f.state === "block" && f.blockLow);
  return { x0: f.x - hw, x1: f.x + hw, y0: f.y + (air ? 6 : 0), y1: f.y + (crouch ? 36 : air ? 46 : 58) };
}
function hittable(o, m) {
  if (o.state === "down" || o.state === "ko" || o.state === "getup" || o.state === "thrown" || o.state === "ragevictim" || o.state === "ragecine") return false;
  if (o.inv > 0 || o.juggle >= 6) return false;
  if (stepInv(o) && !(m && m.track)) return false;
  return true;
}
function circleRect(x, y, r, b) { const cx = clamp(x, b.x0, b.x1), cy = clamp(y, b.y0, b.y1); return (cx - x) ** 2 + (cy - y) ** 2 <= r * r; }
// a strike is a capsule from just in front of the body out to the reach of the limb or weapon
function strikeHits(f, o, m) {
  if (!hittable(o, m)) return null;
  if (!m.track && f.chain > 0 && !o.s.dash && o.dashCd > 0.35 && o.y <= 0) return null; /* a sidestep takes you off the line of the whole string, not just its first hit (for half a second) */
  if (m.air && f.y > 0 && o.state === "attack" && o.move) { const om = o.ms[o.move]; if ((om.launch || o.move === "uP") && o.mt < om.su + om.ac + 0.03) return null; } // launchers and the rook uppercut are true anti-airs: jump attacks cannot stuff them
  const b = hurtbox(o), h1 = f.y + m.h, h0 = m.h0 != null ? f.y + m.h0 : h1;
  for (let i = 0; i <= 3; i++) {
    const k = i / 3, x = f.x + f.face * (6 + (m.reach - 6) * k), h = h0 + (h1 - h0) * k;
    if (circleRect(x, h, m.r, b)) return { x: clamp(f.x + f.face * m.reach, b.x0 + 2, b.x1 - 2), h: clamp(h1, b.y0 + 2, b.y1 - 2) };
  }
  return null;
}
function isBlocking(def, att, lvl) {
  if (def.y > 0 || lvl === "throw") return false;
  if (!(NEUTRAL.has(def.state) || def.state === "block")) return false;
  const I = def.inp;
  const holdingBack = att.x > def.x ? I.l : I.r;
  if (!holdingBack) return false;
  if (lvl === "low") return !!I.d;
  return !I.d || lvl === "high";
}
function dmgMult(att, def, m) {
  let mult = att.s.pow;
  if ((m.air || m.airy) && att.s.airPow) mult *= att.s.airPow;
  if (lastStandOn(att)) mult *= 1.5;
  if (att.rage) mult *= 1.15;
  if (def.s.armor && !m.pierce) mult *= def.s.armor; // bishop bolts ignore armor
  return mult;
}

// Returns "hit", "block" or "armor"
function resolveHit(F, att, def, m, at) {
  const away = Math.sign(def.x - att.x) || -def.face;
  const mAtt = att.state === "attack" && att.move ? att.ms[att.move] : null;
  const remain = mAtt && mAtt === m ? Math.max(0, m.total - att.mt) : 0.2;
  if (isBlocking(def, att, m.lvl)) {
    def.state = "block"; def.stT = 0; def.st = m.bs != null ? m.bs : Math.max(0.08, remain + m.ba); def.blockLow = !!def.inp.d; def.vx = away * (m.bpush != null ? m.bpush : m.push) * 0.9;
    if (att.state === "attack") att.vx = -away * 40;
    // chip: blocking is safe but not free, so sitting on a small lead until the clock runs out does not work
    const chip = m.lvl === "throw" || m.dmg < 8 ? 0 : Math.min(def.hp - 1, Math.max(1, Math.round(m.dmg * att.s.pow * 0.18)));
    if (chip > 0) { def.hp -= chip; F.events.push({ type: "chip", f: def, dmg: chip }); }
    F.hitstop = 0.05;
    gainMeter(F, def, 4); gainMeter(F, att, 2);
    F.events.push({ type: "block", x: at.x, h: at.h, f: def, by: att, heavy: m.dmg >= 12 || !!m.rage });
    if (m.rage) F.events.push({ type: "boom", x: at.x, h: at.h, f: att });
    return "block";
  }
  let mult = dmgMult(att, def, m);
  // counter-hit: caught during the startup or active frames of their own attack, special, dash or throw attempt
  const dm = def.state === "attack" && def.move ? def.ms[def.move] : null;
  const counter = m.lvl !== "throw" && ((dm && def.mt < dm.su + dm.ac) || (def.state === "special" && def.mt < 0.2 && !(def.sp && def.sp.kind === "rage")) || def.state === "dash" || (def.state === "throw" && !def.grab));
  if (counter) mult *= 1.25;
  const airborne = def.y > 0 || def.state === "fall";
  if (airborne && def.juggle > 1) mult *= Math.max(0.4, 1 - 0.13 * (def.juggle - 1));
  const dmg = Math.max(1, Math.round(m.dmg * mult));
  def.hp = Math.max(0, def.hp - dmg);
  def.flash = 0.14;
  if (!m.rage) gainMeter(F, att, dmg * 1.5 + 2);
  gainMeter(F, def, dmg * 1.2);
  const comboing = def.state === "hit" || def.state === "fall" || def.state === "thrown";
  att.combo = comboing ? att.combo + 1 : 1; att.comboDmg = comboing ? att.comboDmg + dmg : dmg; att.comboT = 1.0;
  const heavy = dmg >= 12 || counter || !!m.launch || !!m.rage || m.lvl === "throw" || !!m.kd;
  F.hitstop = m.rage ? 0.2 : heavy ? 0.11 : 0.065;
  F.events.push({ type: "hit", x: at.x, h: at.h, dmg, heavy, counter, lvl: m.lvl, f: def, by: att, m, combo: att.combo, comboDmg: att.comboDmg });
  if (counter) call(F, att, "COUNTER HIT", "counter");
  // super armor during a rush or rage art; rook armor shrugs off light hits on the ground
  if (def.hp > 0 && def.sp && (def.sp.kind === "rage" || (def.sp.kind === "rush" && !m.launch && !m.kd))) return "armor";
  if (def.hp > 0 && def.s.armor && def.y === 0 && def.state !== "hit" && def.state !== "land" && !(def.state === "attack" && def.move && def.mt > def.ms[def.move].su + def.ms[def.move].ac) && (m.light || (def.state === "dash" && !m.kd && !m.launch && !m.proj && m.dmg < 9))) { F.events.push({ type: "armor", f: def }); return "armor"; }
  def.sp = null; def.move = null; def.dash = null; def.step = null; def.z = 0; def.grab = null;
  def.hitKind = m.lvl === "low" ? "low" : m.lvl === "high" ? "high" : heavy ? "gut" : "mid"; def.stT = 0; def.hitPush = m.push;
  const kd = m.kd || (counter && m.ch === "kd");
  if (def.hp <= 0) {
    def.state = "fall"; def.vy = -230; def.vx = away * 135; def.y = Math.max(def.y, 1); def.ko = true;
  } else if (airborne) { // juggle
    def.juggle = Math.max(1, def.juggle) + 1;
    def.state = "fall"; def.vy = m.launch ? -290 : def.juggle >= 5 ? -60 : -190; def.vx = away * 45; def.y = Math.max(def.y, 1);
    if (def.juggle >= 3) call(F, att, "JUGGLE", "combo");
  } else if (m.launch || (counter && m.ch === "launch")) {
    def.state = "fall"; def.vy = -350; def.vx = away * 24; def.y = 1; def.juggle = 1;
    if (mAtt === m) att.mt = Math.max(att.mt, m.total - 0.2); // launchers recover fast on hit so the juggle is real
    call(F, att, "LAUNCH!", "launch"); F.events.push({ type: "launch", f: def });
  } else if (kd) {
    def.state = "fall"; def.vy = -160; def.vx = away * Math.max(90, m.push * 0.7); def.y = Math.max(def.y, 1);
  } else {
    def.state = "hit"; def.st = m.hs != null ? m.hs * (counter ? 1.3 : 1) : Math.max(0.12, remain + m.ha + (counter ? 0.08 : 0)); def.vx = away * m.push;
  }
  return "hit";
}

/* Throws: unblockable, short reach, break by pressing throw early in the grab */
function startThrow(F, f) { f.state = "throw"; f.mt = 0; f.grab = null; f.move = null; f.vx = f.face * 40; F.events.push({ type: "swing", f, m: { arch: "throw" } }); }
function updateThrow(F, f, o, dt) {
  f.mt += dt; f.vx *= Math.exp(-17 * dt);
  if (!f.grab) {
    if (f.mt >= 0.08 && f.mt < 0.17) {
      const reach = f.s.hw + o.s.hw + 9;
      const ok = o.y === 0 && Math.abs(o.x - f.x) < reach && o.inv <= 0 && !["down", "ko", "getup", "fall", "thrown", "dash", "throw", "step", "hit", "block", "ragecine", "ragevictim"].includes(o.state) && !(o.sp && o.sp.kind === "rage");
      if (ok) {
        f.grab = { t: 0 }; o.state = "thrown"; o.stT = 0; o.thrower = f; o.move = null; o.sp = null; o.dash = null; o.vx = 0;
        if (o.ai) o.ai.breakRoll = Math.random() < AI_LV[o.ai.lvl].brk;
        call(F, f, f.s.throwName.toUpperCase(), "throw"); F.hitstop = 0.05; F.events.push({ type: "grab", f, o });
      } else if (o.state === "throw" && !o.grab && Math.abs(o.x - f.x) < reach) { breakThrow(F, f, o); return; }
    }
    if (f.mt >= 0.5) f.state = "idle";
    return;
  }
  f.grab.t += dt; f.vx = 0;
  if (f.grab.t >= 0.62) {
    o.state = "idle";
    resolveHit(F, f, o, HITS.throw, { x: o.x, h: 28 });
    if (o.hp > 0 || true) { o.vx = f.face * 150; o.vy = -230; o.y = 1; o.state = "fall"; o.thrower = null; }
    F.events.push({ type: "slam", f: o, x: o.x });
    f.grab = null; f.state = "land"; f.st = 0.34; f.stT = 0;
  }
}
function breakThrow(F, th, v) {
  const d = Math.sign(v.x - th.x) || th.face;
  for (const [f, dir] of [[th, -d], [v, d]]) { f.state = "hit"; f.hitKind = "mid"; f.stT = 0; f.st = 0.24; f.vx = dir * 170; f.grab = null; f.thrower = null; f.hitPush = 0; }
  F.events.push({ type: "block", x: (th.x + v.x) / 2, h: 36, f: v, by: th, heavy: true }); call(F, v, "THROW BREAK", "sp");
}

/* Rage art: once per duel below 30% HP, press Down + Special. Armored dash; if it lands, a scripted finishing sequence plays. */
function startRage(F, f, o) {
  f.rageUsed = true; f.state = "special"; f.sp = { kind: "rage", dur: 0.7 }; f.mt = 0; f.hitDone = false; f.move = null; f.vx = 0; faceOpp(f, o);
  F.cine = { kind: "freeze", t: 0, dur: 0.9, f, label: f.s.rageName, rage: true };
  F.events.push({ type: "cine", f, rage: true });
}
function startRageCine(F, att, def) {
  const total = Math.max(1, Math.round(HITS.rage.dmg * dmgMult(att, def, HITS.rage)));
  const share = [0.12, 0.12, 0.12, 0.14, 0.5];
  const parts = share.map(p => Math.max(1, Math.round(total * p)));
  parts[4] = Math.max(1, total - parts[0] - parts[1] - parts[2] - parts[3]);
  att.state = "ragecine"; att.stT = 0; att.sp = null; att.vx = 0; att.vy = 0; att.y = 0;
  def.state = "ragevictim"; def.stT = 0; def.sp = null; def.move = null; def.dash = null; def.step = null; def.z = 0; def.grab = null; def.vx = 0; def.vy = 0; def.y = 0;
  const gap = { P: 41, N: 43, B: 54, R: 43, Q: 45 }[att.t] || 40; // stand off at the reach of the art's strikes so bodies do not overlap
  def.x = clamp(att.x + att.face * gap, AR.L + def.s.hw, AR.R - def.s.hw); att.x = clamp(def.x - att.face * gap, AR.L + att.s.hw, AR.R - att.s.hw); def.face = -att.face;
  F.proj.length = 0;
  F.cine = { kind: "rage", t: 0, dur: 1.78, f: att, o: def, ticks: [0.34, 0.58, 0.82, 1.06, 1.7], parts, i: 0, total: 0, rage: true, label: att.s.rageName };
  F.events.push({ type: "rageart", f: att, o: def });
}
function cineStep(F, dt) {
  const c = F.cine; c.t += dt;
  if (c.kind === "rage") {
    while (c.i < c.ticks.length && c.t >= c.ticks[c.i]) {
      const last = c.i === c.ticks.length - 1, d = c.parts[c.i], def = c.o, att = c.f;
      def.hp = Math.max(last ? 0 : 1, def.hp - d); c.total += d; def.flash = 0.14; c.i++;
      att.combo = c.i; att.comboDmg = c.total; att.comboT = 1.2;
      F.events.push({ type: "hit", x: def.x - def.face * 4, h: last ? 40 : 30 + Math.random() * 20, dmg: d, heavy: last, counter: false, lvl: "mid", f: def, by: att, m: HITS.rage, combo: c.i, comboDmg: c.total, rageTick: true, last });
      if (last) {
        const away = att.face;
        def.state = "fall"; def.stT = 0; def.vy = -250; def.vx = away * 190; def.y = 1; def.juggle = 6; if (def.hp <= 0) def.ko = true;
        att.state = "land"; att.st = 0.4; att.stT = 0; att.finT = F.t;
        F.events.push({ type: "boom", x: def.x, h: 34, f: att });
      }
    }
  }
  if (c.t >= c.dur) F.cine = null;
}

/* Specials */
function startSpecial(F, f, o) {
  const k = f.s.sp;
  if (k === "leap" && f.leapUsed) return false;
  if (f.meter < SP_COST) return false;
  f.meter -= SP_COST;
  f.spCd = 0.5; f.hitDone = false; f.mt = 0; f.move = null; f.buf = null;
  if (k === "blink") { // instant diagonal teleport: toward the enemy, or away when holding back
    const bk = f.face > 0 ? f.inp.l : f.inp.r, dir = bk ? -f.face : f.face;
    F.events.push({ type: "blink", f, x: f.x, y: f.y });
    if (f.y > 0) { f.x += dir * 62; f.y = 0; f.vy = 0; f.vx = 0; f.state = "land"; f.st = 0.12; }
    else { f.x += dir * 66; f.y = 64; f.vy = 0; f.vx = 0; f.state = "jump"; f.airJ = 0; }
    f.x = clamp(f.x, AR.L + f.s.hw, AR.R - f.s.hw); f.stT = 0;
    f.inv = 0.2; faceOpp(f, o);
    F.events.push({ type: "blinkIn", f });
    return true;
  }
  f.state = "special"; f.stT = 0;
  F.cine = { kind: "freeze", t: 0, dur: 0.36, f, label: f.s.spName.replace(/\s*\(.*\)\s*/, "").toUpperCase() };
  F.events.push({ type: "cine", f, kind: k });
  if (k === "rush") f.sp = { kind: k, dur: 0.4 };
  else if (k === "leap") { f.sp = { kind: k, phase: "rise" }; f.vy = -300; f.vx = 0; f.y = Math.max(f.y, 1); f.leapUsed = true; }
  else if (k === "quake") f.sp = { kind: k, dur: 0.6, fired: false };
  else if (k === "beam") f.sp = { kind: k, dur: 0.42, fired: false };
  return true;
}
function updateSpecial(F, f, o, dt) {
  const sp = f.sp; if (!sp) { f.state = f.y > 0 ? "jump" : "idle"; return; }
  f.mt += dt;
  if (sp.kind === "rush") {
    const active = f.mt > 0.08 && f.mt < 0.3;
    f.vx = active ? f.face * 250 : f.vx * Math.exp(-20 * dt);
    if (active && !f.hitDone) {
      const hit = strikeHits(f, o, { reach: 18, h: 34, r: 8 });
      if (hit) { f.hitDone = true; resolveHit(F, f, o, HITS.rush, hit); f.vx = -f.face * 40; }
    }
    if (f.mt >= sp.dur) { f.state = "idle"; f.sp = null; }
  } else if (sp.kind === "rage") {
    const active = f.mt > 0.06 && f.mt < 0.5;
    f.vx = active && !f.hitDone ? f.face * 430 : f.vx * Math.exp(-13 * dt);
    if (active && !f.hitDone) {
      const hit = strikeHits(f, o, { reach: 20, h: 34, r: 11, track: true });
      if (hit) {
        f.hitDone = true;
        if (isBlocking(o, f, "mid")) { resolveHit(F, f, o, HITS.rage, hit); f.vx = -f.face * 60; }
        else { startRageCine(F, f, o); return; }
      }
    }
    if (f.mt >= sp.dur) { f.state = "idle"; f.sp = null; }
  } else if (sp.kind === "leap") {
    if (sp.phase === "rise" && f.vy > -40) { sp.phase = "dive"; faceOpp(f, o); f.vx = f.face * 200; f.vy = 240; f.mt = 0; }
    if (sp.phase === "dive" && !f.hitDone) {
      const hit = strikeHits(f, o, { reach: 22, h: 4, h0: 20, r: 8 });
      if (hit) { f.hitDone = true; const res = resolveHit(F, f, o, HITS.leap, hit); f.vx = -f.face * 60;
        if (res === "block") { f.state = "jump"; f.sp = null; f.move = null; f.vy = -210; f.vx = -f.face * 120; f.stT = 0; f.airJ = 0; } } /* a blocked dive kick springs back off the guard instead of landing in the opponent's lap */
    }
  } else if (sp.kind === "quake") {
    f.vx = 0;
    if (!sp.fired && f.mt > 0.26) {
      sp.fired = true; F.events.push({ type: "slam", f, x: f.x + f.face * 14, quake: true });
      F.proj.push({ kind: "wave", owner: f, x: f.x + f.face * 18, h: 5, vx: f.face * 175, vh: 0, life: 2.2, hit: HITS.wave });
    }
    if (f.mt >= sp.dur) { f.state = "idle"; f.sp = null; }
  } else if (sp.kind === "beam") {
    f.vx = 0;
    if (!sp.fired && f.mt > 0.16) { sp.fired = true; F.events.push({ type: "muzzle", f, x: f.x + f.face * 22, h: 46 }); F.proj.push({ kind: "beam", owner: f, x: f.x + f.face * 22, h: 46, vx: f.face * 270, vh: 0, life: 3, hit: HITS.beam }); }
    if (f.mt >= sp.dur) { f.state = "idle"; f.sp = null; }
  }
}

function updateProj(F, dt) {
  for (const p of F.proj) {
    p.x += p.vx * dt; p.h += p.vh * dt; p.life -= dt;
    if (p.x < AR.L || p.x > AR.R || p.h > 220) p.life = 0;
    if (p.h <= 1 && p.kind === "bolt") { p.life = 0; F.events.push({ type: "fizz", x: p.x, h: 1, p }); }
    const o = p.owner === F.f.w ? F.f.b : F.f.w;
    if (p.life > 0 && p.kind === "bolt" && o.s.deflect && ((o.state === "special" && o.sp && o.sp.kind === "leap") || (o.s.deflect > 1 && o.y > 0 && o.move && o.mt < o.ms[o.move].su + 0.28)) && circleRect(p.x, p.h, 9, hurtbox(o))) { p.life = 0; F.events.push({ type: "fizz", x: p.x, h: p.h, p }); F.events.push({ type: "deflect", f: o }); }
    if (p.life > 0 && hittable(o, null) && circleRect(p.x, p.h, p.kind === "wave" ? 6 : 5, hurtbox(o))) { p.life = 0; resolveHit(F, p.owner, o, p.hit, { x: p.x, h: p.h }); }
  }
  for (const a of F.proj) for (const b of F.proj)
    if (a !== b && a.owner !== b.owner && a.life > 0 && b.life > 0 && Math.abs(a.x - b.x) < 9 && Math.abs(a.h - b.h) < 10) { a.life = b.life = 0; F.events.push({ type: "fizz", x: a.x, h: a.h, p: a }); }
  F.proj = F.proj.filter(p => p.life > 0);
}

/* ---------- CPU fighter ---------- */
const AI_LV = [
  { react: .30, block: .22, read: .30, punish: .15, aggro: .45, combo: .35, brk: .15, zone: .5 },
  { react: .21, block: .44, read: .50, punish: .44, aggro: .56, combo: .60, brk: .40, zone: .75 },
  { react: .13, block: .70, read: .75, punish: .72, aggro: .70, combo: .88, brk: .70, zone: 1 },
];
let JUMPY = 0.3; // better CPUs jump in less: a waiting opponent can anti-air
const AI_W = { P: 3, fP: 2, bP: .5, dP: 1.1, K: 2, fK: .6, bK: .8, dK: 1.2 };
const tLand = o => (-o.vy + Math.sqrt(o.vy * o.vy + 2 * AR.G * Math.max(0, o.y))) / AR.G; // seconds until an airborne fighter touches down
const moveRange = m => m.reach + (m.step > 0 ? m.step * m.su * 0.75 : 0);
function aiString(f, slot, L) { // follow a string to its end, branching at random
  const q = [slot]; let m = f.ms[slot];
  while (m && m.next && Math.random() < L.combo) { const ks = Object.keys(m.next), b = ks[(Math.random() * ks.length) | 0]; q.push(b); m = f.ms[m.next[b]]; }
  return q;
}
function aiInput(F, f, o, dt) {
  const A = f.ai, L = AI_LV[A.lvl], s = f.s, ms = f.ms;
  const out = blankInput();
  const cd = Math.abs(o.x - f.x), gap = cd - s.hw - o.s.hw, edge = cd - o.s.hw; // edge: my centre to their near side
  const toward = o.x > f.x ? "r" : "l", away = toward === "r" ? "l" : "r";
  const rnd = Math.random;
  A.think -= dt;
  if (f.state === "thrown") { if (A.breakRoll && f.thrower && f.thrower.grab && f.thrower.grab.t > 0.1 + 0.07 * (2 - A.lvl)) out.t = 1; return out; }
  const canRage = f.rage && !f.rageUsed;
  const free = NEUTRAL.has(f.state);
  const setHold = h => { A.hold = Object.assign({ l: 0, r: 0, u: 0, d: 0 }, h); };

  // how long the opponent has done nothing but block or back off; a turtle gets thrown and swept
  A.passive = (o.state === "attack" || o.state === "special" || o.state === "throw" || o.state === "dash" || o.y > 0) ? 0 : (A.passive || 0) + dt;
  const turtle = A.passive > 1.1, hurry = F.seconds - F.t < 10 && f.hp / f.max <= o.hp / o.max;
  // the same thing over and over gets figured out: every repeat makes the CPU block and punish it more (Normal and Hard)
  const wise = F.t - (A.repT || -9) < 3 ? Math.min(3, (A.rep || 1) - 1) * 0.24 * A.lvl : 0;
  // --- reactions to threats ---
  const om = o.state === "attack" && o.move ? o.ms[o.move] : null;
  const inc = F.proj.find(p => p.owner === o && Math.abs(p.x - f.x) < 110 && Math.sign(p.vx) === Math.sign(f.x - p.x) && (p.kind !== "bolt" || Math.abs((p.h - 30) - Math.abs(p.x - f.x) * Math.sign(-p.vh)) < 40));
  let threat = null;
  if (om && !om.proj && o.mt < om.su + om.ac && cd - s.hw < moveRange(om) + 10) threat = { id: "m" + o.move + (o.mt < dt * 1.5 ? F.t.toFixed(2) : ""), lvl: om.lvl, m: om, until: om.su + om.ac - o.mt };
  else if (o.state === "special" && o.sp && (o.sp.kind === "rush" || o.sp.kind === "rage") && cd < 130) threat = { id: "s" + o.sp.kind, lvl: "mid", until: 0.3 };
  else if (o.state === "special" && o.sp && o.sp.kind === "leap" && cd < 80) threat = { id: "sleap", lvl: "mid", until: 0.3 };
  else if (o.state === "dash" && o.s.dash.dmg && cd < 90) threat = { id: "dash", lvl: "mid", until: 0.2 };
  else if (o.state === "jump" && o.y > 8 && f.y <= 0 && cd < 88 && !(o.move && o.ms[o.move].proj) && (o.move || o.vy > -140 || o.vx * (f.x - o.x) > 0)) // anyone coming down near us, with or without a button pressed yet
    threat = { id: "air" + o.airJ, lvl: "mid", until: tLand(o) + 0.08, air: true, early: !o.move };
  else if (inc) threat = { id: "p" + inc.kind, lvl: inc.kind === "wave" ? "low" : inc.kind === "beam" ? "high" : "mid", proj: inc, until: Math.abs(inc.x - f.x) / Math.abs(inc.vx) + 0.08 };
  if (threat) {
    const tid = threat.id.replace(/\d+\.\d+$/, "");
    if (A.seen !== tid) { // the same attack again and again gets read: faster reactions, surer blocks, and a planned answer
      A.seen = tid; A.rolled = false;
      A.rep = A.repId === tid && F.t - (A.repT || 0) < 4 ? A.rep + 1 : 1; A.repId = tid; A.repT = F.t;
      A.reactT = L.react * (0.7 + rnd() * 0.6) / (1 + 0.35 * Math.min(4, A.rep - 1));
    }
    A.reactT -= dt;
    if (A.reactT <= 0 && !A.rolled && free) {
      A.rolled = true;
      const learn = Math.min(4, A.rep - 1) * (0.1 + 0.12 * A.lvl);
      const slow = threat.m ? clamp((threat.m.su - 0.12) * 1.6, 0, 0.35) : 0; /* slow wind-ups are easier to see coming */
      if (rnd() < Math.min(0.97, L.block + learn + slow + (threat.air ? 0.25 : 0))) {
        A.queue = []; const r = rnd();
        if (threat.proj && threat.proj.kind === "wave" && s.jump > 0 && r < 0.75) setHold({ u: 1 });
        else if (threat.proj && threat.proj.kind === "beam" && r < L.read) setHold({ d: 1 });
        else if (!s.dash && threat.m && !threat.m.track && threat.m.su > 0.16 && f.dashCd <= 0 && r < (0.22 + 0.2 * Math.min(3, A.rep - 1)) * L.read) { A.queue = ["X", rnd() < 0.5 ? "K" : "P"]; setHold({}); }
        else if (threat.proj && !s.dash && r < 0.25 * L.read) { A.queue = ["X"]; setHold({}); }
        else if (threat.air && (o.airJ <= 0 || ms.uP || rnd() < 0.3) && r < L.punish * 0.75 + learn) { A.aa = true; setHold({ [away]: 1 }); } // guard, and anti-air as the jump comes down (a jumper who can still double jump mostly just gets blocked)
        else if (threat.lvl === "high" && threat.m && r < 0.25 * L.read) setHold({ d: 1 });
        else { const h = { [away]: 1 }; if (threat.lvl === "low" ? rnd() < L.read : (threat.lvl === "mid" ? false : false)) h.d = 1; setHold(h); }
        A.think = Math.max(A.think, threat.until + 0.07);
      }
    }
  } else A.seen = null;

  // keep guarding through a string instead of walking into its next hit
  if (f.state === "block" && !A.queue.length) { setHold(f.blockLow && rnd() < L.read ? { [away]: 1, d: 1 } : { [away]: 1 }); A.think = Math.max(A.think, f.st + 0.06 + 0.1 * rnd()); }
  if (A.aa) { // timed anti-air
    if (o.y <= 6 || !free) A.aa = false;
    else if (ms.P.proj && cd > 52 && !o.s.deflect) { if (Math.abs((o.y + 28 - 50) - (cd - 14)) < 15 && cd > 26) { A.aa = false; A.queue = ["P"]; setHold({}); A.think = 0.3; } else if (o.vy > 60 && cd < 40) { A.aa = false; setHold({ [away]: 1 }); A.think = 0.3; } }
    else { const k = ms.uP ? "uP" : "fK", tl = tLand(o);
      if (tl <= ms[k].su + 0.13 && tl > ms[k].su - 0.04 && edge < (ms.uP ? 30 : moveRange(ms.fK) + 2)) { A.aa = false; A.queue = [k]; setHold({}); A.think = 0.3; }
      else if (tl < ms[k].su - 0.04) { A.aa = false; setHold({ [away]: 1 }); A.think = tl + 0.1; } // too late to swing: just block it
      else A.think = Math.max(A.think, 0.04); }
  }
  // --- punish a whiffed or blocked move ---
  if (free) {
    let avail = 0;
    if (om && o.mt >= om.su + om.ac) avail = om.total - o.mt;
    else if (o.state === "land") avail = o.st;
    else if (o.state === "throw" && !o.grab && o.mt > 0.17) avail = 0.5 - o.mt;
    else if (o.state === "special" && o.sp && (o.sp.kind === "quake" || o.sp.kind === "beam") && gap < 30) avail = o.sp.dur - o.mt;
    const key = o.state + (o.move || "") + Math.floor(F.t * 2);
    if (avail > 0.01 && avail <= 0.1 && A.punished !== key && f.stT < 0.06 && !A.queue.length && rnd() < L.punish + wise) {
      // small frame advantage after a block: take the turn back with something that will beat their next button
      const c = ["fP", "K", "P", "dP"].filter(k => ms[k] && !ms[k].proj && ms[k].su <= avail + 0.12 && edge < moveRange(ms[k]) - 3).sort((a, b) => ms[b].dmg - ms[a].dmg)[0];
      if (c) { A.punished = key; A.queue = ms[c].next ? aiString(f, c, L) : [c]; setHold({}); A.think = 0.3; }
    }
    if (avail > 0.1 && A.punished !== key) {
      A.punished = key;
      if (rnd() < (L.punish + wise) * (om && om.next ? 0.45 : 1)) {
        const fits = k => ms[k] && !ms[k].proj && ms[k].su < avail - 0.02 && edge < moveRange(ms[k]) - 2;
        const pick = fits("fK") && rnd() < 0.8 ? "fK" : fits("uP") ? "uP" : fits("bP") ? "bP" : fits("K") ? "K" : fits("P") ? "P" : fits("fP") ? "fP" : null;
        if (pick) { A.queue = pick === "P" || pick === "K" ? aiString(f, pick, L) : [pick]; setHold({}); A.think = 0.3; }
      }
    }
  }

  // --- juggle follow-up ---
  if (o.state === "fall" && o.juggle > 0 && o.juggle < 6 && !o.ko && A.think <= 0 && !A.queue.length && free) {
    A.think = 0.1;
    if (rnd() < L.combo + 0.1) {
      const hi = o.y > 46;
      if (ms.uP && hi && edge < 30) { A.queue = ["uP"]; setHold({}); }
      else if (hi && s.jump > 0 && edge < 40 && ms.aK && rnd() < 0.5) { setHold({ u: 1, [toward]: 1 }); A.plan = "airhit"; }
      else if (edge < (ms.P.proj ? moveRange(ms.fP) : moveRange(ms.P)) - 2 && o.y < 52) { A.queue = ms.P.proj ? ["fP", "P"] : aiString(f, "P", L); setHold({}); A.think = 0.25; }
      else setHold({ [toward]: 1 });
    }
  }

  // --- neutral decisions ---
  if (A.think <= 0 && !A.queue.length) {
    A.think = L.react * (0.6 + rnd() * 0.8);
    A.plan = null;
    const opts = [], add = (w, fn) => { if (w > 0) opts.push([w, fn]); };
    const oGround = o.y <= 0 && !["down", "getup", "fall", "ko"].includes(o.state);
    const oDown = o.state === "down" || o.state === "getup";
    const zoner = !!ms.P.proj;
    if (oDown) { add(1, () => setHold(gap > 26 ? { [toward]: 1 } : gap < 12 ? { [away]: 1 } : {})); }
    else {
      // guard up when in range of an opponent who is swinging; the more they repeat themselves, the more often
      const swinging = om && !om.proj && o.mt < om.su + om.ac && cd - s.hw < moveRange(om) + 14;
      if (swinging && rnd() < L.block + 0.18 + wise) { // don't swing into a swing: guard, or break out of repeated pressure
        const out2 = rnd() < (A.rep >= 2 ? 0.3 + 0.15 * A.lvl : 0.08);
        // beat a slow wind-up with something faster when it would land first
        const quick = ["P", "K", "dP"].filter(k => ms[k] && !ms[k].proj && edge < moveRange(ms[k]) - 3).sort((a, b) => ms[a].su - ms[b].su)[0];
        if (quick && ms[quick].su + 0.03 < om.su - o.mt && rnd() < (L.punish + wise) * [0, 0.45, 0.85][A.lvl]) { A.queue = quick === "dP" ? [quick] : aiString(f, quick, L); setHold({}); A.think = 0.25; }
        else if (out2 && s.dash && s.dash.dmg && f.dashCd <= 0) { A.queue = ["X"]; setHold({ [toward]: 1 }); A.think = 0.3; }
        else if (out2 && !s.dash && !om.track && f.dashCd <= 0) { A.queue = ["X", rnd() < 0.5 ? "K" : "P"]; setHold({}); A.think = 0.3; }
        else if (out2 && s.jump > 0 && om.lvl !== "high" && om.arch !== "launch") { setHold({ u: 1, [toward]: 1 }); A.plan = "airhit"; A.think = 0.3; }
        else { setHold({ [away]: 1 }); A.think = 0.1 + rnd() * 0.1; }
        return Object.assign(out, A.hold, A.queue.length ? {} : {});
      }
      const hot = A.passive < 0.7 && oGround && gap < 46 && F.t - (A.repT || -9) < 1.5;
      if (hot && !hurry) add(3.2 * L.block * (1 + 0.35 * Math.min(3, (A.rep || 1) - 1)), () => { setHold({ [away]: 1 }); A.think = 0.22 + rnd() * 0.2; });
      // attacks that reach
      if (oGround) for (const k in AI_W) {
        const m = ms[k]; if (!m || m.proj) continue;
        const rg = moveRange(m);
        if (edge < rg - 3 && edge > rg - 46) {
          let w = AI_W[k] * (0.5 + L.aggro);
          if (m.lvl === "low" && (o.state === "block" || turtle)) w *= 1.8;
          if (hurry) w *= 1.4;
          if (zoner && edge > 30) w *= 1.6;
          add(w, () => { A.queue = (k === "P" || k === "K" || m.next) ? aiString(f, k, L) : [k]; setHold({}); A.think = 0.16 + rnd() * 0.14 + (1 - L.aggro) * 0.45; }); // weaker CPUs leave a gap after each string
        }
      }
      if (oGround && gap < 9 && NEUTRAL.has(o.state)) add((0.9 + L.aggro) * (turtle ? 4 : 1), () => { A.queue = ["T"]; setHold({}); });
      if (turtle && gap >= 9 && oGround) add(3 + 2 * L.aggro, () => { setHold({ [toward]: 1 }); A.think = 0.12; });
      if (hurry && gap >= 9) add(2.5, () => { setHold({ [toward]: 1 }); A.think = 0.12; });
      // answer to a move that keeps coming: get over it or around it
      if (A.rep >= 3 && F.t - A.repT < 1.2 && oGround && s.jump > 0 && gap < 70 && !/^air/.test(A.repId)) add(1.5 + A.lvl, () => { setHold({ u: 1, [toward]: 1 }); A.plan = "airhit"; });
      if (A.rep >= 3 && F.t - A.repT < 1.2 && s.dash && s.dash.dmg && f.dashCd <= 0 && gap > 8) add(1.5 + A.lvl, () => { A.queue = ["X"]; setHold({ [toward]: 1 }); });
      if (canRage && gap < 60) add(2.5 + 2 * L.aggro, () => { A.queue = ["RA"]; setHold({}); });
      // anti-air
      if (o.y > 14 && ms.uP && edge < 34) add(4 * L.punish + 0.5, () => { A.queue = ["uP"]; setHold({}); });
      if (o.y > 14 && !ms.uP && edge < 42 && o.vy > -80) add(1 + 4 * L.punish, () => { A.queue = ["fK"]; setHold({}); });
      if (zoner) {
        // diagonal bolts: line the 45 degree shot up
        const lineUp = Math.abs((o.y + 28 - 50) - (cd - 14));
        if (o.y > 10 && lineUp < 16 + 10 * L.zone && !(o.s.deflect && cd < 75 * L.read + 20)) add(6 * L.zone, () => { A.queue = ["P"]; setHold({}); }); // smarter bishops do not bolt a knight that is about to kick the bolt away
        if (gap < 10 && oGround) add(2.2, () => { A.queue = ["P"]; setHold({}); });
        if (gap > (o.s.deflect ? 60 : 34) && gap < 125 && o.y <= 0) add(2.4 * L.zone * (o.s.jump ? 1 : 2.5) * (o.s.deflect ? 0.6 : 1), () => { A.plan = "airbolt"; const r = rnd(); setHold({ u: 1, [r < 0.45 ? toward : r < 0.65 ? away : "x"]: 1 }); A.think = 0.5; });
        if (gap < 30) add(0.9, () => setHold({ [away]: 1 }));
        if (gap < 30 && spReady(f) && f.x > 70 && f.x < AR.W - 70) add(0.9, () => { setHold({ [away]: 1 }); A.queue = ["S"]; });
        if (gap < 40 && spReady(f) && (f.x < 60 || f.x > AR.W - 60)) add(1.6, () => { setHold({}); A.queue = ["S"]; });
        if (gap > 90) add(2.6, () => setHold({ [toward]: 1 }));
        if (gap > 46) add(1.6 * (0.5 + L.aggro), () => setHold({ [toward]: 1 }));
      } else {
        const far = gap > 46;
        if (far) {
          add(2.2 * (0.6 + L.aggro), () => setHold({ [toward]: 1 }));
          if (s.sp === "beam" && spReady(f)) add(1.6, () => { A.queue = ["S"]; setHold({}); });
          if (s.sp === "quake" && spReady(f) && gap > 60) add(1.5, () => { A.queue = ["S"]; setHold({}); });
          if (s.dash && f.dashCd <= 0) add(1.5, () => { A.queue = ["X"]; setHold({ [toward]: 1 }); });
          if (s.sp === "leap" && spReady(f) && gap < 125) add(1.5, () => { A.queue = ["S"]; setHold({}); });
          if (s.sp === "rush" && spReady(f) && gap < 80) add(1.3, () => { A.queue = ["S"]; setHold({}); });
          if (s.jump > 0) add((s.airJumps ? 1.5 : 0.4) * (o.ms.P.proj && !s.deflect ? 1 - 0.35 * A.lvl : 1 - JUMPY * A.lvl), () => { setHold({ u: 1, [toward]: 1 }); A.plan = "airhit"; }); // smarter CPUs jump less into a bishop's bolts
        } else {
          add(1.0, () => setHold({ [toward]: 1 }));
          if (!hurry) add((1 - L.aggro) * 2.2, () => { setHold({ [away]: 1 }); A.think = 0.2 + rnd() * 0.25; });
          if (spReady(f) && s.sp !== "quake") add(0.7, () => { A.queue = ["S"]; setHold({}); });
          if (s.sp === "quake" && spReady(f) && gap > 30) add(0.6, () => { A.queue = ["S"]; setHold({}); });
          if (s.jump > 0) add((s.airJumps ? 0.9 : 0.3) * (o.ms.P.proj && !s.deflect ? 1 - 0.35 * A.lvl : 1 - JUMPY * A.lvl), () => { setHold({ u: 1, [toward]: gap > 18 ? 1 : 0 }); A.plan = "airhit"; });
          if (!s.dash && f.dashCd <= 0) add(0.25, () => { A.queue = ["X"]; setHold({}); });
        }
      }
    }
    let tot = 0; for (const [w] of opts) tot += w;
    if (tot > 0) { let r = rnd() * tot; for (const [w, fn] of opts) { r -= w; if (r <= 0) { fn(); break; } } } else setHold({ [toward]: 1 });
  }

  // --- turn the plan into inputs ---
  Object.assign(out, A.hold); delete out.x;
  if (A.queue.length) {
    const a = A.queue[0];
    let go = false;
    if (free) go = true;
    else if (f.state === "attack" && f.move) { const m = ms[f.move]; if (m.next && m.next[a]) go = f.mt >= m.su; else if (f.mt > m.su + m.ac) { if (!(a.length === 1 && "PK".includes(a))) {} else A.queue = []; } }
    else if (f.state !== "jump") { if (f.state === "hit" || f.state === "block" || f.state === "fall") A.queue = []; }
    if (go && A.queue.length) {
      A.queue.shift();
      if (a === "S") { if (spReady(f) || canRage) out.s = 1; }
      else if (a === "RA") { if (canRage) { out.s = 1; out.d = 1; } }
      else if (a === "T") out.t = 1;
      else if (a === "X") out.x = 1;
      else {
        const dir = a.length === 2 ? a[0] : "", btn = a[a.length - 1];
        out.l = out.r = out.u = out.d = 0;
        if (dir === "f") out[toward] = 1; else if (dir === "b") out[away] = 1; else if (dir === "d") out.d = 1; else if (dir === "u") out.u = 1;
        out[btn === "P" ? "p" : "k"] = 1;
      }
    }
  }
  if (f.state === "jump") {
    out.u = 0;
    if (A.plan === "airbolt") { const lineUp = (f.y + 30 - 30) - (cd - 14); if (!f.move && f.vy > -160 && Math.abs(lineUp) < 12 + 6 * L.zone && f.y > 24) out.p = 1; }
    else if (!f.move && f.vy > 0 && ms.aK && cd < ms.aK.reach + o.s.hw + 6 && f.y < 70) out.k = 1;
    if (f.airJ > 0 && f.vy > -40 && rnd() < 0.04 * (A.lvl + 1)) out.uP = 1;
    if (f.airJ > 0 && om && (om.launch || o.move === "uP") && o.mt < om.su + om.ac && cd < 64 && f.vy > -120 && rnd() < L.read * 0.5) out.uP = 1; /* double jump over an anti-air, then punish it */
    if (s.sp === "leap" && spReady(f) && f.vy > -60 && cd < 110 && rnd() < 0.05) out.s = 1;
  }
  return out;
}
