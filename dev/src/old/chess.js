const GLYPH = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
const VS = "︎";
const COLORNAME = { w: "White", b: "Black" };
const FILES = "abcdefgh";
const opp = c => (c === "w" ? "b" : "w");
const sqName = (r, c) => FILES[c] + (8 - r);

const CLOCK_START = 600; // seconds of thinking time each; the clock stops during duels

/* ---------- Chess rules ---------- */
let S;
let nextId = 1;
function piece(t, c) { return { t, c, hp: STATS[t].hp, moved: false, id: nextId++ }; }
function newState() {
  const B = Array.from({ length: 8 }, () => Array(8).fill(null));
  const back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    B[0][c] = piece(back[c], "b"); B[1][c] = piece("P", "b");
    B[6][c] = piece("P", "w");     B[7][c] = piece(back[c], "w");
  }
  return { board: B, turn: "w", ep: null, over: null, last: null, log: [], healed: [], taken: { w: [], b: [] }, moves: [], clock: { w: CLOCK_START, b: CLOCK_START }, started: false };
}
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const KN = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
const KG = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

function attacked(B, r, c, by) {
  const pd = by === "w" ? 1 : -1;
  for (const dc of [-1, 1]) { const rr = r + pd, cc = c + dc; if (inB(rr, cc)) { const p = B[rr][cc]; if (p && p.c === by && p.t === "P") return true; } }
  for (const [dr, dc] of KN) { const rr = r + dr, cc = c + dc; if (inB(rr, cc)) { const p = B[rr][cc]; if (p && p.c === by && p.t === "N") return true; } }
  for (const [dr, dc] of KG) { const rr = r + dr, cc = c + dc; if (inB(rr, cc)) { const p = B[rr][cc]; if (p && p.c === by && p.t === "K") return true; } }
  const rays = [[1,0,"RQ"],[-1,0,"RQ"],[0,1,"RQ"],[0,-1,"RQ"],[1,1,"BQ"],[1,-1,"BQ"],[-1,1,"BQ"],[-1,-1,"BQ"]];
  for (const [dr, dc, ts] of rays) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) { const p = B[rr][cc]; if (p) { if (p.c === by && ts.includes(p.t)) return true; break; } rr += dr; cc += dc; }
  }
  return false;
}
// How many pieces of one colour bear on a square
function countAtk(B, r, c, by) {
  let n = 0; const pd = by === "w" ? 1 : -1;
  for (const dc of [-1, 1]) { const rr = r + pd, cc = c + dc; if (inB(rr, cc)) { const p = B[rr][cc]; if (p && p.c === by && p.t === "P") n++; } }
  for (const [dr, dc] of KN) { const rr = r + dr, cc = c + dc; if (inB(rr, cc)) { const p = B[rr][cc]; if (p && p.c === by && p.t === "N") n++; } }
  for (const [dr, dc] of KG) { const rr = r + dr, cc = c + dc; if (inB(rr, cc)) { const p = B[rr][cc]; if (p && p.c === by && p.t === "K") n++; } }
  const rays = [[1,0,"RQ"],[-1,0,"RQ"],[0,1,"RQ"],[0,-1,"RQ"],[1,1,"BQ"],[1,-1,"BQ"],[-1,1,"BQ"],[-1,-1,"BQ"]];
  for (const [dr, dc, ts] of rays) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) { const p = B[rr][cc]; if (p) { if (p.c === by && ts.includes(p.t)) n++; break; } rr += dr; cc += dc; }
  }
  return n;
}
// Backup for a capture: the other pieces on each side that bear on the square being fought over
// (counted with the attacker lifted off its own square, so a piece lined up behind it counts too). At most 3 a side.
function backupFor(B, m) {
  const a = B[m.fr][m.fc], N = B.map(row => row.slice()); N[m.fr][m.fc] = null;
  return { a: Math.min(BACKUP_MAX, countAtk(N, m.tr, m.tc, a.c)), d: Math.min(BACKUP_MAX, countAtk(N, m.tr, m.tc, opp(a.c))) };
}
// A pawn with nothing protecting it is simply taken, as in chess. Every other piece gets its duel.
function freeCapture(B, m) {
  if (!m.cap) return false;
  const a = B[m.fr][m.fc], d = B[m.cap.r][m.cap.c];
  return !!d && d.t === "P" && a.t !== "K" && backupFor(B, m).d === 0;
}
// A beaten attacker falls back to its own square badly hurt
const failHp = a => Math.max(1, Math.min(a.hp, Math.ceil(STATS[a.t].hp * 0.25)));
function findKing(B, color) { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = B[r][c]; if (p && p.t === "K" && p.c === color) return [r, c]; } return null; }
function inCheck(B, color) { const k = findKing(B, color); return k ? attacked(B, k[0], k[1], opp(color)) : false; }

function pseudo(St, r, c) {
  const B = St.board, p = B[r][c], out = [];
  if (!p) return out;
  const add = (tr, tc, extra = {}) => out.push(Object.assign({ fr: r, fc: c, tr, tc, cap: B[tr][tc] ? { r: tr, c: tc } : null }, extra));
  if (p.t === "P") {
    const d = p.c === "w" ? -1 : 1, start = p.c === "w" ? 6 : 1, last = p.c === "w" ? 0 : 7;
    if (inB(r + d, c) && !B[r + d][c]) {
      add(r + d, c, { promo: r + d === last });
      if (r === start && !B[r + 2 * d][c]) add(r + 2 * d, c);
    }
    for (const dc of [-1, 1]) {
      const tr = r + d, tc = c + dc; if (!inB(tr, tc)) continue;
      const t = B[tr][tc];
      if (t && t.c !== p.c) add(tr, tc, { promo: tr === last });
      else if (!t && St.ep && St.ep.r === tr && St.ep.c === tc) out.push({ fr: r, fc: c, tr, tc, cap: { r, c: tc }, ep: true });
    }
  } else if (p.t === "N" || p.t === "K") {
    for (const [dr, dc] of (p.t === "N" ? KN : KG)) { const tr = r + dr, tc = c + dc; if (inB(tr, tc) && (!B[tr][tc] || B[tr][tc].c !== p.c)) add(tr, tc); }
    if (p.t === "K" && !p.moved && !attacked(B, r, c, opp(p.c))) {
      for (const [rc, step] of [[7, 1], [0, -1]]) {
        const rook = B[r][rc]; if (!rook || rook.t !== "R" || rook.c !== p.c || rook.moved) continue;
        let clear = true; for (let cc = c + step; cc !== rc; cc += step) if (B[r][cc]) clear = false;
        if (!clear) continue;
        if (attacked(B, r, c + step, opp(p.c)) || attacked(B, r, c + 2 * step, opp(p.c))) continue;
        out.push({ fr: r, fc: c, tr: r, tc: c + 2 * step, cap: null, castle: { rf: rc, rt: c + step } });
      }
    }
  } else {
    const dirs = p.t === "R" ? KG.slice(0, 4) : p.t === "B" ? KG.slice(4) : KG;
    for (const [dr, dc] of dirs) {
      let tr = r + dr, tc = c + dc;
      while (inB(tr, tc)) { const t = B[tr][tc]; if (t) { if (t.c !== p.c) add(tr, tc); break; } add(tr, tc); tr += dr; tc += dc; }
    }
  }
  return out;
}
function simulate(B, m) {
  const N = B.map(row => row.slice());
  const p = N[m.fr][m.fc];
  if (m.cap) N[m.cap.r][m.cap.c] = null;
  N[m.tr][m.tc] = p; N[m.fr][m.fc] = null;
  if (m.castle) { N[m.tr][m.castle.rt] = N[m.tr][m.castle.rf]; N[m.tr][m.castle.rf] = null; }
  return N;
}
function failBoard(B, m) { const N = B.map(row => row.slice()), a = N[m.fr][m.fc]; N[m.fr][m.fc] = Object.assign({}, a, { hp: failHp(a) }); return N; }
function legalFrom(St, r, c) {
  const p = St.board[r][c]; if (!p) return [];
  return pseudo(St, r, c).filter(m => {
    const t = m.cap ? St.board[m.cap.r][m.cap.c] : null;
    if (t && t.t === "K") return false;
    return !inCheck(simulate(St.board, m), p.c);
  });
}
function allLegal(St, color) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = St.board[r][c]; if (p && p.c === color) out.push(...legalFrom(St, r, c)); }
  return out;
}

/* ---------- Chess CPU ---------- */
// Chance the attacker wins a duel. DUEL_ODDS holds measured CPU-vs-CPU win rates at full health
// (thousands of simulated duels per pairing); the health each piece has left then shifts the odds.
const DUEL_ODDS = {
  P: { P: .50, N: .12, B: .15, R: .07, Q: .03 },
  N: { P: .88, N: .50, B: .55, R: .44, Q: .20 },
  B: { P: .85, N: .44, B: .50, R: .35, Q: .18 },
  R: { P: .92, N: .56, B: .66, R: .50, Q: .33 },
  Q: { P: .96, N: .79, B: .81, R: .67, Q: .50 },
};
function duelOdds(a, d, bk) {
  const fa = a.hp / STATS[a.t].hp, fd = d.hp / STATS[d.t].hp;
  // two badly hurt pieces fight a short, swingy duel, so the stronger type's edge shrinks with the health left
  const p0 = 0.5 + (DUEL_ODDS[a.t][d.t] - 0.5) * (0.35 + 0.65 * Math.min(fa, fd));
  const odds = p0 / (1 - p0) * Math.pow(fa / Math.max(0.02, fd), a.t === "P" || d.t === "P" ? 1.3 : 2.4); // a pawn's bar is short and Last Stand makes a hurt pawn dangerous
  const o2 = odds * Math.pow(1.4, bk ? bk.a - bk.d : 0); // each piece of backup is worth roughly this much
  return o2 / (1 + o2);
}
function evalBoard(B, me) {
  let s = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = B[r][c]; if (!p || p.t === "K") continue;
    const st = STATS[p.t];
    let v = st.value * (0.45 + 0.55 * p.hp / st.hp);
    v += (3.5 - Math.abs(3.5 - c)) * 0.03 + (3.5 - Math.abs(3.5 - r)) * 0.03;
    if (p.t === "P") v += (p.c === "w" ? 6 - r : r - 1) * 0.04;
    s += p.c === me ? v : -v;
  }
  for (const color of ["w", "b"]) {
    const k = findKing(B, color); if (!k) continue;
    let n = 0; for (const [dr, dc] of KG) { const r = k[0] + dr, c = k[1] + dc; if (inB(r, c) && B[r][c] && B[r][c].c === color) n++; }
    s += (color === me ? 1 : -1) * n * 0.04;
  }
  return s;
}
function expectMove(B, m, mover, me, cont) {
  const a = B[m.fr][m.fc], d = m.cap ? B[m.cap.r][m.cap.c] : null;
  const promo = m.promo ? 7 * (mover === me ? 1 : -1) : 0;
  if (!d || a.t === "K" || freeCapture(B, m)) return cont(simulate(B, m), false) + promo;
  const p = duelOdds(a, d, backupFor(B, m));
  return p * (cont(simulate(B, m), false) + promo) + (1 - p) * cont(failBoard(B, m), true);
}
const cpuColor = () => opp(CONFIG.human);
function chooseCpuMove(color) {
  const moves = allLegal(S, color);
  const noise = [1.2, 0.35, 0.06][CONFIG.level];
  const deep = CONFIG.level > 0;
  let best = null, bestV = -Infinity;
  for (const m of moves) {
    let v = expectMove(S.board, m, color, color, (B2, failed) => {
      if (failed && inCheck(B2, color)) return -1000;
      if (!deep) return evalBoard(B2, color);
      const replies = allLegal({ board: B2, ep: null }, opp(color));
      if (!replies.length) return inCheck(B2, opp(color)) ? 1000 : 0;
      let worst = Infinity;
      for (const rm of replies) {
        const w = expectMove(B2, rm, opp(color), color, (B3, f2) => (f2 && inCheck(B3, opp(color))) ? 1000 : evalBoard(B3, color));
        if (w < worst) worst = w;
      }
      return worst;
    });
    v += (Math.random() - 0.5) * noise;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}
const isCpuTurn = () => S.turn === cpuColor() && !S.over;
function maybeCpuTurn() {
  if (NET.on) { netPump(); return; }
  if (!isCpuTurn() || fight) return;
  render();
  const g = gameGen; // a new game started while a CPU move is pending must cancel it
  const beat = performance.now() - lastDuelEnd < 600 ? 900 : 0; // let the board breathe after a duel before the CPU replies
  setTimeout(() => {
    if (g !== gameGen || !isCpuTurn() || fight || clashing) return;
    const m = chooseCpuMove(S.turn);
    if (m) { selected = [m.fr, m.fc]; targets = [m]; render(); setTimeout(() => { if (g === gameGen && !fight && !clashing) attemptMove(m); }, 420); }
  }, 380 + beat);
}

/* ---------- Turn flow ---------- */
function log(text, cls = "") { S.log.unshift({ text, cls }); if (S.log.length > 80) S.log.pop(); }

function attemptMove(m) {
  const B = S.board, a = B[m.fr][m.fc];
  const d = m.cap ? B[m.cap.r][m.cap.c] : null;
  selected = null; targets = [];
  netSendMove(m);
  if (!d || a.t === "K" || freeCapture(B, m)) { finishMove(m, null); return; }
  const bk = backupFor(B, m);
  render();
  clashing = true;
  // Cinematic hand-off: the camera pushes in on the square, the attacker lunges, the VS card slams shut,
  // the arena loads behind it, and after the duel a shutter wipe returns to the same square before pulling back out.
  boardFocus(m.cap, 1);
  clash3D(m, () => vsCard(a, d, bk,
    () => { clashing = false; startFight(a, d, res => { boardFocus(m.cap, 1, true); lastDuelEnd = performance.now(); finishMove(m, res); boardFocus(null, 0); }, { hold: true, lightSq: (m.cap.r + m.cap.c) % 2 === 0, stage: stageFor(m.cap.r, m.cap.c), backup: bk }); },
    () => { if (fight) fight.hold = false; }));
}

function finishMove(m, res) {
  const B = S.board, a = B[m.fr][m.fc];
  const d = m.cap ? B[m.cap.r][m.cap.c] : null;
  const mover = a.c;
  const an = `${COLORNAME[a.c]} ${STATS[a.t].name}`;
  let newEp = null, san = sanOf(m);
  if (res && d && (a.c === CONFIG.human || d.c === CONFIG.human)) recordDuel(a.c === CONFIG.human ? res.attackerWon : !res.attackerWon);
  if (res && !res.attackerWon) {
    d.hp = Math.max(1, Math.round(res.defenderHp));
    a.hp = failHp(a);
    san = san.replace(/=.$/, "") + "\u2717";
    log(`${an} attacked ${sqName(m.cap.r, m.cap.c)} and lost. ${STATS[d.t].name} holds with ${d.hp} HP. The ${STATS[a.t].name} falls back with ${a.hp} HP.`, "fight");
    S.last = { fr: m.fr, fc: m.fc, tr: m.cap.r, tc: m.cap.c };
  } else {
    if (res) a.hp = Math.max(1, Math.round(res.attackerHp));
    if (d && !res) log(`${an} captured ${STATS[d.t].name} on ${sqName(m.cap.r, m.cap.c)}. ${a.t === "K" ? "Kings take without a fight." : "An undefended pawn is taken without a fight."}`, "fight");
    else if (d) log(`${an} won the duel and took ${sqName(m.tr, m.tc)} with ${a.hp} HP left.`, "fight");
    else if (m.castle) log(`${COLORNAME[a.c]} castled.`);
    else log(`${an} ${sqName(m.fr, m.fc)} to ${sqName(m.tr, m.tc)}.`);
    if (m.cap) { B[m.cap.r][m.cap.c] = null; S.taken[d.c].push(d.t); }
    B[m.tr][m.tc] = a; B[m.fr][m.fc] = null; a.moved = true;
    if (m.castle) { const rk = B[m.tr][m.castle.rf]; B[m.tr][m.castle.rt] = rk; B[m.tr][m.castle.rf] = null; rk.moved = true; }
    if (a.t === "P" && Math.abs(m.tr - m.fr) === 2) newEp = { r: (m.tr + m.fr) / 2, c: m.fc };
    if (m.promo) {
      const to = "QRBN".includes(m.promoTo) ? m.promoTo : "Q";
      const share = a.hp / STATS.P.hp; a.t = to; a.hp = Math.max(1, Math.round(share * STATS[to].hp));
      log(`Pawn promoted to ${STATS[to].name} with ${a.hp} HP.`);
    }
    S.last = { fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc };
  }
  S.ep = newEp;
  S.turn = opp(mover);
  S.healed = []; S.started = true;

  if (inCheck(B, mover)) {
    S.over = { winner: S.turn, reason: `${COLORNAME[mover]}'s failed capture left its king in check. The king falls.` };
    log(S.over.reason, "fight"); san += "#";
  } else {
    healSide(S.turn);
    const moves = allLegal(S, S.turn);
    if (!moves.length) {
      S.over = inCheck(B, S.turn) ? { winner: mover, reason: `Checkmate. ${COLORNAME[mover]} wins.` } : { winner: null, reason: "Stalemate. It's a draw." };
      log(S.over.reason, "fight");
    } else if (B.flat().filter(Boolean).every(p => p.t === "K")) {
      S.over = { winner: null, reason: "Only kings remain. It's a draw." };
      log(S.over.reason, "fight");
    }
    if (S.over && S.over.winner) san += "#"; else if (inCheck(B, S.turn)) san += "+";
  }
  S.moves.push(san);
  render();
  maybeCpuTurn();
}

// Standard chess notation for a move, written before it is played
function sanOf(m) {
  const B = S.board, a = B[m.fr][m.fc];
  if (m.castle) return m.tc > m.fc ? "O-O" : "O-O-O";
  let s = "";
  if (a.t === "P") { if (m.cap) s = FILES[m.fc]; }
  else {
    s = a.t;
    const twins = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = B[r][c];
      if (p && p !== a && p.c === a.c && p.t === a.t && legalFrom(S, r, c).some(x => x.tr === m.tr && x.tc === m.tc)) twins.push([r, c]);
    }
    if (twins.length) s += !twins.some(t => t[1] === m.fc) ? FILES[m.fc] : !twins.some(t => t[0] === m.fr) ? String(8 - m.fr) : sqName(m.fr, m.fc);
  }
  if (m.cap) s += "x";
  s += sqName(m.tr, m.tc);
  if (m.promo) s += "=" + ("QRBN".includes(m.promoTo) ? m.promoTo : "Q");
  return s;
}

/* ---------- Clock ---------- */
const fmtClock = t => { const s = Math.ceil(Math.max(0, t)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
let clockLast = performance.now();
function flagFall(color, fromPeer) {
  if (S.over) return;
  S.clock[color] = 0; selected = null; targets = [];
  S.over = { winner: opp(color), reason: `${COLORNAME[color]} ran out of time.` };
  log(S.over.reason, "fight");
  if (NET.on && !fromPeer) netCtl({ t: "flag" });
  render();
}
setInterval(() => {
  const now = performance.now(), dt = Math.min(5, (now - clockLast) / 1000); clockLast = now;
  if (!S || S.over || !S.started || fight || clashing) return;
  S.clock[S.turn] = Math.max(0, S.clock[S.turn] - dt);
  // online, each device calls time on its own clock only, so a slow link never flags the other player
  if (S.clock[S.turn] <= 0 && !(NET.on && S.turn !== CONFIG.human)) flagFall(S.turn);
  else drawClocks();
}, 250);
function drawClocks() {
  for (const c of ["w", "b"]) {
    const el = $(c === CONFIG.human ? "clkBot" : "clkTop"); if (!el) continue;
    el.textContent = fmtClock(S.clock[c]);
    el.classList.toggle("run", !S.over && S.started && S.turn === c && !fight && !clashing);
    el.classList.toggle("low", S.clock[c] < 60);
  }
}
const VALUE_ORDER = "QRBNP";
function drawBars() {
  const human = CONFIG.human, other = opp(human);
  const mine = () => { try { const p = me(); return p ? p.name : "You"; } catch (e) { return "You"; } };
  const who = c => c === human ? mine() : NET.on ? NET.peerName : "CPU";
  for (const [c, id] of [[other, "Top"], [human, "Bot"]]) {
    $("pn" + id).textContent = who(c); $("pc" + id).className = "chip " + c;
    // the enemy pieces this player has taken, biggest first
    const got = S.taken[opp(c)].slice().sort((x, y) => VALUE_ORDER.indexOf(x) - VALUE_ORDER.indexOf(y));
    $("pt" + id).innerHTML = got.map(t => `<span class="${opp(c)}">${GLYPH[t]}${VS}</span>`).join("");
    $("pt" + id).setAttribute("aria-label", got.length ? "Captured: " + got.map(t => STATS[t].name).join(", ") : "No captures yet");
  }
  drawClocks();
  const ol = $("moveList"); let html = "";
  for (let i = 0; i < S.moves.length; i += 2) html += `<li><b>${i / 2 + 1}.</b><span>${S.moves[i]}</span><span>${S.moves[i + 1] || ""}</span></li>`;
  if (ol.dataset.n !== String(S.moves.length)) { ol.innerHTML = html || '<li class="hint">No moves yet.</li>'; ol.dataset.n = String(S.moves.length); ol.scrollTop = ol.scrollHeight; }
}

function healSide(color) {
  const k = findKing(S.board, color); if (!k || CONFIG.healPct <= 0) return;
  for (const [dr, dc] of KG) {
    const r = k[0] + dr, c = k[1] + dc; if (!inB(r, c)) continue;
    const p = S.board[r][c];
    if (p && p.c === color && p.t !== "K" && p.hp < STATS[p.t].hp) {
      const before = p.hp; p.hp = Math.min(STATS[p.t].hp, p.hp + Math.ceil(STATS[p.t].hp * CONFIG.healPct));
      S.healed.push({ id: p.id, amt: p.hp - before });
      log(`${COLORNAME[color]} ${STATS[p.t].name} on ${sqName(r, c)} healed ${p.hp - before} beside the king.`, "heal");
    }
  }
}

/* ---------- Board UI ---------- */
const $ = id => document.getElementById(id);
const boardEl = $("board");
let selected = null, targets = [], clashing = false, B3 = null, gameGen = 0, lastDuelEnd = -1e9;
const squares = [];
for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "sq " + ((r + c) % 2 ? "d" : "l");
  b.id = "sq-" + sqName(r, c);
  b.setAttribute("aria-label", sqName(r, c));
  b.addEventListener("click", () => onSquare(r, c));
  b.addEventListener("mouseenter", () => { const p = S.board[r][c]; if (p) showStats(p); });
  boardEl.appendChild(b); squares.push(b);
}

function onSquare(r, c) {
  if (S.over || fight || clashing || isCpuTurn()) return;
  S.healed = [];
  const t = targets.find(m => m.tr === r && m.tc === c);
  if (selected && t) {
    const go = () => { if (riskyCapture(t)) askRisk(t); else attemptMove(t); };
    if (t.promo) askPromo(t, go); else go();
    return;
  }
  const p = S.board[r][c];
  if (p) showStats(p);
  if (p && p.c === S.turn) {
    if (selected && selected[0] === r && selected[1] === c) { selected = null; targets = []; }
    else { selected = [r, c]; targets = legalFrom(S, r, c); }
  } else { selected = null; targets = []; }
  render();
}

// A capture is risky when you are in check: a beaten attacker falls back to its square, the check still stands, and that loses the game.
function riskyCapture(m) {
  if (!m.cap) return false;
  const a = S.board[m.fr][m.fc]; if (!a || a.t === "K" || freeCapture(S.board, m)) return false;
  return inCheck(S.board, a.c);
}
let promoMove = null, promoThen = null;
function askPromo(m, then) { promoMove = m; promoThen = then; $("promoModal").hidden = false; $("promoModal").querySelector("button").focus(); }
for (const b of document.querySelectorAll("#promoModal [data-p]")) b.addEventListener("click", () => {
  const m = promoMove, then = promoThen; promoMove = promoThen = null; $("promoModal").hidden = true;
  if (m && !S.over && !fight && !clashing) { m.promoTo = b.dataset.p; then(); }
});
$("promoNo").addEventListener("click", () => { $("promoModal").hidden = true; promoMove = promoThen = null; });
let riskMove = null;
function askRisk(m) {
  riskMove = m;
  const a = S.board[m.fr][m.fc], d = S.board[m.cap.r][m.cap.c];
  $("riskText").innerHTML = "You're in check. "
    + `If your ${STATS[a.t].name} loses this duel against the ${STATS[d.t].name} (${d.hp} HP), your king is still in check and <b>you lose the game</b>. Win it and you're safe.`;
  $("riskModal").hidden = false; $("riskYes").focus();
}
$("riskNo").addEventListener("click", () => { $("riskModal").hidden = true; riskMove = null; });
$("riskYes").addEventListener("click", () => { $("riskModal").hidden = true; const m = riskMove; riskMove = null; if (m) attemptMove(m); });
window.addEventListener("keydown", e => { if (e.key === "Escape" && !$("riskModal").hidden) { $("riskModal").hidden = true; riskMove = null; } });

let checkDismissed = null; // the position (last move) whose check warning was dismissed
$("checkX").addEventListener("click", () => { checkDismissed = S.last; $("checkBanner").hidden = true; });
const hpClass = f => (f > 0.6 ? "" : f > 0.3 ? "mid" : "low");
function render() {
  const B = S.board;
  const checkSq = !S.over && inCheck(B, S.turn) ? findKing(B, S.turn) : null;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const el = squares[r * 8 + c], p = B[r][c];
    const tgt = targets.find(m => m.tr === r && m.tc === c);
    el.className = "sq " + ((r + c) % 2 ? "d" : "l");
    if (S.last && ((S.last.fr === r && S.last.fc === c) || (S.last.tr === r && S.last.tc === c))) el.classList.add("last");
    if (selected && selected[0] === r && selected[1] === c) el.classList.add("sel");
    if (checkSq && checkSq[0] === r && checkSq[1] === c) el.classList.add("check");
    let html = "";
    if (tgt) {
      if (tgt.cap) { el.classList.add("cap"); if (B[tgt.fr][tgt.fc].t === "K" || freeCapture(B, tgt)) el.classList.add("kingcap"); html += '<span class="ring"></span>'; }
      else html += '<span class="dot"></span>';
    }
    if (p) {
      const h = S.healed.find(x => x.id === p.id);
      html += `<span class="pc ${p.c}${h ? " healed" : ""}"><span class="glyph">${GLYPH[p.t]}${VS}</span>`;
      if (p.t !== "K") { const f = p.hp / STATS[p.t].hp; html += `<span class="hpbar"><i class="${hpClass(f)}" style="width:${Math.max(4, f * 100)}%"></i></span>`; }
      html += "</span>";
      if (h) html += `<span class="plus">+${h.amt}</span>`;
      el.setAttribute("aria-label", `${sqName(r, c)}, ${COLORNAME[p.c]} ${STATS[p.t].name}${p.t !== "K" ? `, ${p.hp} HP` : ""}`);
    } else el.setAttribute("aria-label", sqName(r, c));
    el.innerHTML = html;
  }
  $("turnChip").className = "chip " + S.turn;
  $("turnText").textContent = S.over ? "Game over" : COLORNAME[S.turn] + (S.turn === CONFIG.human ? " (you)" : NET.on ? ` (${NET.peerName})` : " (CPU)");
  const note = $("statusNote");
  note.className = "status-note";
  if (S.over) { note.textContent = S.over.reason; note.classList.add("win"); }
  else if (isCpuTurn()) note.textContent = NET.on ? `Waiting for ${NET.peerName} to move.` : checkSq ? "CPU is in check and thinking." : "CPU is thinking.";
  else if (checkSq && !selected) { note.textContent = "You're in check! Get your king out of danger. Losing a duel while still in check loses the game."; note.classList.add("alert"); }
  else if (selected) {
    const duels = targets.filter(m => m.cap && S.board[m.fr][m.fc].t !== "K" && !freeCapture(B, m)), free = targets.filter(m => m.cap).length - duels.length;
    const risky = targets.filter(m => riskyCapture(m)).length;
    const odds = duels.map(m => { const k = backupFor(B, m); return `${sqName(m.tr, m.tc)}: backup ${k.a} v ${k.d}`; }).join(", ");
    note.textContent = (duels.length ? `Red rings are duels (${odds}). ` : "") + (free ? "Gold rings are taken with no fight. " : "") + (risky ? "Flashing rings are risky: lose that duel and you lose the game." : "") || "Pick a square to move to.";
    if (risky) note.classList.add("alert");
  } else note.textContent = "Tap a piece, then a square. Attacking an enemy starts a duel.";
  $("log").innerHTML = S.log.map(l => `<li class="${l.cls}">${l.text}</li>`).join("");
  const meInCheck = !!checkSq && S.turn === CONFIG.human;
  $("checkBanner").hidden = !meInCheck || checkDismissed === S.last;
  if (S.over && !S.recorded) recordGame();
  if (S.over && !S.overShown) { S.overShown = true; showGameOver(); }
  boardEl.parentElement.classList.toggle("incheck", meInCheck);
  drawBars();
  syncBoard3D();
}

const SLOT_LABEL = { P: "Punch", K: "Kick", fP: "Fwd + Punch", bP: "Back + Punch", dP: "Down + Punch", uP: "Up + Punch", fK: "Fwd + Kick", bK: "Back + Kick", dK: "Down + Kick", aP: "Air Punch", aK: "Air Kick" };
function moveList(t) {
  const ms = MOVESET[t], out = [];
  const tags = m => [m.proj ? "ranged" : m.lvl, m.launch ? "launcher" : "", m.kd ? "knockdown" : "", m.track ? "beats sidestep" : ""].filter(Boolean).join(", ");
  const walk = (id, label) => { const m = ms[id]; out.push(`<dt>${label}</dt><dd>${m.name}<i>${tags(m)}</i></dd>`); if (m.next) for (const b in m.next) walk(m.next[b], `${label}, ${b === "P" ? "Punch" : "Kick"}`); };
  for (const slot in SLOT_LABEL) if (ms[slot]) walk(slot, SLOT_LABEL[slot]);
  return out.join("");
}
function showStats(p) {
  const s = STATS[p.t];
  $("statName").textContent = `${COLORNAME[p.c]} ${s.name}`;
  $("statHp").textContent = p.t === "K" ? "No HP" : `${p.hp} / ${s.hp} HP`;
  const ul = $("statMoves"), dl = $("statList");
  if (p.t === "K") { dl.innerHTML = ""; ul.innerHTML = `<li>Never fights. Captures instantly.</li><li>Pieces touching it heal ${Math.round(CONFIG.healPct * 100)}% each turn.</li>`; return; }
  ul.innerHTML = `<li><b>${s.style}</b> · Power ${s.pow.toFixed(2)}× · Speed ${s.spd}</li><li><b>Special</b> ${s.spName}</li><li><b>Throw</b> ${s.throwName} · <b>Rage art</b> ${s.rageName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</li>` + s.notes.map(n => `<li>${n}</li>`).join("");
  dl.innerHTML = moveList(p.t);
}

/* ---------- Setup controls ---------- */
$("level").addEventListener("change", e => { CONFIG.level = +e.target.value; });
$("side").addEventListener("change", e => { if (fight || clashing) { e.target.value = CONFIG.human; return; } CONFIG.human = e.target.value; newGame(); });
$("newGame").addEventListener("click", () => newGame());
function newGame() {
  if (fight || clashing) return; // never swap the board out from under a duel hand-off
  gameGen++;
  S = newState(); selected = null; targets = [];
  nextId = 1;
  log(`New game. You play ${COLORNAME[CONFIG.human]}.`);
  render(); showStats(S.board[7][1]); maybeCpuTurn();
}

