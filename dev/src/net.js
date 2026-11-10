/* =====================================================================
   Practice mode and online play.

   Online: two players share a room code. A free Supabase Realtime channel
   carries the handshake; after that the game talks over a direct WebRTC
   data channel when one can be opened, and keeps using the Supabase channel
   when it cannot. Chess moves are sent as moves. Duels run in lockstep:
   both devices step the same fixed 60 Hz simulation from the same inputs,
   a few frames behind the buttons, so both see the same fight. The host
   posts a checksum twice a second and re-sends the whole duel state if the
   two ever disagree, and the host's result is the one that counts.
   ===================================================================== */

/* ---------- practice ---------- */
$("prGo").addEventListener("click", () => {
  if (fight || clashing || NET.on) return;
  const me = CONFIG.human, other = opp(me), ai = $("prAi").value;
  const mk = (t, c) => ({ t, c, hp: STATS[t].hp, moved: true, id: -1 });
  auInit();
  startFight(mk($("prMe").value, me), mk($("prOpp").value, other), () => { render(); }, { practice: true, seconds: 99, ai: ai === "dummy" ? null : +ai, stage: +$("prStage").value });
});

/* ---------- online ---------- */
const NET = { on: false, host: false, code: "", id: Math.random().toString(36).slice(2, 10), peer: null, peerName: "Rival", peerRating: 1200, sb: null, ch: null, pc: null, dc: null, via: "",
  D: 3, out: new Map(), seen: new Set(), seq: 1, duelNo: 0, duel: null, res: {}, queue: [], lastRx: 0, timer: null, again: { me: false, them: false }, applying: false, helloT: null, ice: [] };
const NET_DT = 1 / 60, NET_LOCAL = /[?&]net=local/.test(location.search), NET_NORTC = /[?&]rtc=0/.test(location.search);
const netName = () => { const p = me(); return p ? p.name : "Guest"; };
function netStatus(text, code) {
  $("netIdle").hidden = !!text; $("netBusy").hidden = !text; $("netStatus").textContent = text || "";
  $("netCode").hidden = !code; if (code) $("netCode").textContent = code;
  for (const id of ["side", "level", "newGame", "prGo"]) $(id).disabled = NET.on;
  $("matchLabel").textContent = NET.on ? "Online match" : "Match vs CPU";
}
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("could not load " + src)); document.head.appendChild(s); }); }
async function netChannel(code, onmsg) {
  if (NET_LOCAL) { const bc = new BroadcastChannel("h2h-room-" + code); bc.onmessage = e => onmsg(e.data); return { send: o => bc.postMessage(o), close: () => bc.close() }; }
  const cfg = window.H2H_SUPABASE;
  if (!cfg || !cfg.url || !cfg.anonKey) throw new Error("Online play only works on the live site.");
  if (!NET.sb) {
    if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.89.0/dist/umd/supabase.min.js");
    NET.sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "h2h-realtime" }, realtime: { params: { eventsPerSecond: 40 } } });
  }
  const ch = NET.sb.channel("h2h-room-" + code, { config: { broadcast: { self: false, ack: false } } });
  ch.on("broadcast", { event: "m" }, m => onmsg(m.payload));
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error("The game server did not answer.")), 12000);
    ch.subscribe(st => { if (st === "SUBSCRIBED") { clearTimeout(to); res(); } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") { clearTimeout(to); rej(new Error("Could not reach the game server.")); } });
  });
  return { send: o => { try { ch.send({ type: "broadcast", event: "m", payload: o }); } catch (e) {} }, close: () => { try { NET.sb.removeChannel(ch); } catch (e) {} } };
}
// everything goes over the direct link when it is open, otherwise through the room channel
function netRaw(o) { o.from = NET.id; if (NET.dc && NET.dc.readyState === "open") { try { NET.dc.send(JSON.stringify(o)); return; } catch (e) {} } if (NET.ch) NET.ch.send(o); }
// control messages are numbered, acknowledged and re-sent until they arrive
function netCtl(o) { o.id = NET.seq++; NET.out.set(o.id, o); netRaw(o); }
function netTick() {
  if (!NET.ch) return;
  for (const o of NET.out.values()) netRaw(o);
  if (NET.on) {
    netRaw({ t: "ping" });
    if (performance.now() - NET.lastRx > 15000) netOver("Connection lost.", null);
  }
}
function netOnMsg(o) {
  if (!o || o.from === NET.id) return;
  if (NET.peer && o.from !== NET.peer) { if (o.t === "hello" && NET.host) NET.ch.send({ t: "full", to: o.from, from: NET.id }); return; }
  NET.lastRx = performance.now();
  if (o.t === "ack") { NET.out.delete(o.id); return; }
  if (o.t === "i") { netDuelInput(o); return; }
  if (o.t === "h") { netDuelHash(o); return; }
  if (o.t === "ping") return;
  if (o.t === "sig") { rtcSignal(o); return; }
  if (o.t === "full") { if (o.to === NET.id && !NET.on) netFail("That room already has two players."); return; }
  if (o.t === "hello") { // a guest knocks: the host answers, picks the colours and opens the direct link
    if (!NET.host) return;
    if (!NET.peer) { NET.peer = o.from; NET.peerName = String(o.name || "Rival").slice(0, 20); NET.peerRating = +o.rating || 1200; NET.hostColor = Math.random() < 0.5 ? "w" : "b"; rtcStart(true); }
    NET.ch.send({ t: "welcome", from: NET.id, to: o.from, name: netName(), rating: (me() || {}).rating || 1200, hostColor: NET.hostColor });
    if (!NET.on) netBegin(NET.hostColor);
    return;
  }
  if (o.t === "welcome") {
    if (NET.host || o.to !== NET.id || NET.on) return;
    clearInterval(NET.helloT); NET.peer = o.from; NET.peerName = String(o.name || "Rival").slice(0, 20); NET.peerRating = +o.rating || 1200;
    rtcStart(false); netBegin(o.hostColor === "w" ? "b" : "w");
    return;
  }
  if (o.id != null) { netRaw({ t: "ack", id: o.id }); const k = o.from + ":" + o.id; if (NET.seen.has(k)) return; NET.seen.add(k); }
  if (o.t === "mv") { NET.queue.push(o); netPump(); }
  else if (o.t === "res") NET.res[o.d] = o.r;
  else if (o.t === "skip") { if (fight && fight.phase === "intro") fight.skip = 2; }
  else if (o.t === "rq") { const N = NET.duel; if (NET.host && N && N.no === o.d && fight && !fight.result) netCtl({ t: "st", d: N.no, f: N.frame, s: dumpDuel(fight) }); }
  else if (o.t === "st") netDuelLoad(o);
  else if (o.t === "sq") { if (NET.host) netCtl({ t: "S", s: JSON.stringify(S), n: nextId }); }
  else if (o.t === "S") { if (!NET.host && !fight && !clashing) { S = JSON.parse(o.s); nextId = o.n; selected = null; targets = []; NET.queue = []; render(); } }
  else if (o.t === "bye") netOver(`${NET.peerName} left the match.`, CONFIG.human);
  else if (o.t === "again") { NET.again.them = true; if (!NET.again.me) { netStatus(`${NET.peerName} wants a rematch. Press Play again to accept.`); log(`${NET.peerName} wants a rematch.`); } netAgain(); }
  else if (o.t === "new") { if (!NET.host) netNewGame(o.hostColor === "w" ? "b" : "w"); }
}
function netFail(msg) { netClose(); netStatus(""); dialog({ title: "Online play", text: msg, ok: "OK" }); }
function netClose() {
  clearInterval(NET.timer); clearInterval(NET.helloT);
  try { if (NET.dc) NET.dc.close(); } catch (e) {} try { if (NET.pc) NET.pc.close(); } catch (e) {}
  if (NET.ch) NET.ch.close();
  Object.assign(NET, { on: false, host: false, peer: null, ch: null, pc: null, dc: null, via: "", duel: null, queue: [], res: {}, ice: [], again: { me: false, them: false } });
  NET.out.clear(); NET.seen.clear();
}
async function netOpen(code, host) {
  if (fight || clashing) return;
  netClose(); NET.host = host; NET.code = code;
  netStatus("Connecting…", host ? code : null);
  try { NET.ch = await netChannel(code, netOnMsg); } catch (e) { netFail(e.message || "Could not connect."); return; }
  NET.lastRx = performance.now(); NET.timer = setInterval(netTick, 1000);
  if (host) netStatus("Waiting for your friend to join with this code.", code);
  else {
    netStatus("Looking for room " + code + "…");
    const hello = () => NET.ch && NET.ch.send({ t: "hello", from: NET.id, name: netName(), rating: (me() || {}).rating || 1200 });
    hello(); let n = 0; NET.helloT = setInterval(() => { if (NET.on) { clearInterval(NET.helloT); return; } if (++n > 20) { netFail("No room with that code answered. Check the code and that your friend is still waiting."); return; } hello(); }, 1000);
  }
}
$("netCreate").addEventListener("click", () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ"; let c = ""; for (let i = 0; i < 4; i++) c += A[(Math.random() * A.length) | 0]; netOpen(c, true); });
$("netJoin").addEventListener("click", async () => {
  const v = await dialog({ title: "Join a room", text: "Type the four-letter code your friend sees.", input: { value: "" }, ok: "Join" });
  if (v) netOpen(v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4), false);
});
$("netLeave").addEventListener("click", () => {
  if (fight || clashing) return;
  const was = NET.on; if (was) netCtl({ t: "bye" });
  setTimeout(() => { netClose(); netStatus(""); if (was) newGame(); }, was ? 250 : 0);
});
window.addEventListener("pagehide", () => { if (NET.on) netRaw({ t: "bye", id: NET.seq++ }); });

function netBegin(myColor) {
  NET.on = true; NET.lastRx = performance.now(); $("gameOver").hidden = true;
  netNewGame(myColor);
}
function netNewGame(myColor) {
  NET.duelNo = 0; NET.queue = []; NET.res = {}; NET.again = { me: false, them: false }; $("gameOver").hidden = true;
  CONFIG.human = myColor; $("side").value = myColor;
  gameGen++; nextId = 1; S = newState(); S.online = NET.peerName; selected = null; targets = [];
  log(`Online match against ${NET.peerName}. You play ${COLORNAME[myColor]}.`);
  netShow(); render(); showStats(S.board[myColor === "w" ? 7 : 0][1]);
}
function netShow() { if (NET.on) netStatus(`Playing ${NET.peerName}. You are ${COLORNAME[CONFIG.human]}.` + (NET.via === "p2p" ? " Direct link." : NET.via === "relay" ? " Relayed link." : "")); }
function netOver(reason, winner) {
  if (!NET.on) return;
  const finish = () => {
    if (fight || clashing) { setTimeout(finish, 300); return; }
    if (!S.over) { S.over = { winner, reason: reason + (winner === CONFIG.human ? " You win." : "") }; log(S.over.reason, "fight"); }
    netClose(); netStatus(""); render();
  };
  if (fight && !fight.result && !fight.ending) { fight.result = { attackerWon: fight.att.color === CONFIG.human, attackerHp: fight.att.hp, defenderHp: fight.def.hp, timeout: true }; endFight(fight); }
  finish();
}
// rematch: both press Play again, the host swaps the colours
function netAgain() {
  if (!NET.on || !NET.again.me || !NET.again.them || !NET.host) return;
  NET.hostColor = NET.hostColor === "w" ? "b" : "w";
  netCtl({ t: "new", hostColor: NET.hostColor }); netNewGame(NET.hostColor);
}
$("goNew").addEventListener("click", e => {
  if (!NET.on) return;
  e.stopImmediatePropagation(); $("gameOver").hidden = true;
  NET.again.me = true; netCtl({ t: "again" }); netStatus(NET.again.them ? "Starting the rematch…" : `Waiting for ${NET.peerName} to accept the rematch.`); netAgain();
}, true);
// a local move goes out before it is played; the rival's moves are played here as they arrive
function netSendMove(m) { if (NET.on && !NET.applying) netCtl({ t: "mv", fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc, h: boardHash() }); }
function boardHash() { let h = S.turn; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = S.board[r][c]; h += p ? p.c + p.t + p.hp : "."; } return h; }
function netPump() {
  if (!NET.on || !NET.queue.length) return;
  if (fight || clashing || S.over) { setTimeout(netPump, 250); return; }
  if (S.turn === CONFIG.human) return;
  const o = NET.queue.shift();
  const m = o.h === boardHash() ? legalFrom(S, o.fr, o.fc).find(x => x.tr === o.tr && x.tc === o.tc) : null;
  if (!m) { if (NET.host) netCtl({ t: "S", s: JSON.stringify(S), n: nextId }); else netCtl({ t: "sq" }); return; } // boards disagree: the host's board wins
  selected = [m.fr, m.fc]; targets = [m]; render();
  const g = gameGen;
  setTimeout(() => { if (g !== gameGen || !NET.on || fight || clashing) return; NET.applying = true; attemptMove(m); NET.applying = false; }, 300);
}

/* ---------- direct link (WebRTC) ---------- */
function rtcSig(d) { if (NET.ch) NET.ch.send({ t: "sig", from: NET.id, d }); }
async function rtcStart(offerer) {
  if (NET_NORTC || !window.RTCPeerConnection) { NET.via = "relay"; NET.D = 9; return; }
  try {
    const pc = NET.pc = new RTCPeerConnection({ iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] });
    pc.onicecandidate = e => { if (e.candidate) rtcSig({ ice: e.candidate.toJSON() }); };
    const setup = dc => {
      dc.onopen = () => { NET.dc = dc; NET.via = "p2p"; NET.D = 3; netShow(); };
      dc.onmessage = e => { try { netOnMsg(JSON.parse(e.data)); } catch (_) {} };
      dc.onclose = () => { if (NET.dc === dc) { NET.dc = null; NET.via = "relay"; NET.D = 9; netShow(); } };
    };
    pc.ondatachannel = e => setup(e.channel);
    if (offerer) { setup(pc.createDataChannel("game", { ordered: true })); await pc.setLocalDescription(await pc.createOffer()); rtcSig({ sdp: pc.localDescription.toJSON() }); }
    setTimeout(() => { if (NET.pc === pc && !NET.dc) { NET.via = "relay"; NET.D = 9; netShow(); } }, 9000); // no direct route: stay on the relay
  } catch (e) { NET.via = "relay"; NET.D = 9; }
}
async function rtcSignal(o) {
  const pc = NET.pc, d = o.d; if (!pc || !d) return;
  try {
    if (d.sdp) {
      await pc.setRemoteDescription(d.sdp);
      if (d.sdp.type === "offer") { await pc.setLocalDescription(await pc.createAnswer()); rtcSig({ sdp: pc.localDescription.toJSON() }); }
      for (const c of NET.ice.splice(0)) await pc.addIceCandidate(c);
    } else if (d.ice) { if (pc.remoteDescription) await pc.addIceCandidate(d.ice); else NET.ice.push(d.ice); }
  } catch (e) { /* the relay keeps the match going */ }
}

/* ---------- lockstep duel ---------- */
const NET_KEYS = ["l", "r", "u", "d", "p", "k", "s", "x", "t", "uP", "lP", "rP"];
const packInp = i => NET_KEYS.reduce((b, k, n) => b | (i[k] ? 1 << n : 0), 0);
function unpackInp(b) { const o = {}; for (let n = 0; n < NET_KEYS.length; n++) o[NET_KEYS[n]] = (b >> n) & 1; return o; }
function netDuelBegin(F) {
  const z = () => [0, 0, 0, 0, 0, 0, 0, 0]; // both sides start with the same eight empty frames, whatever their link
  F.net = true;
  NET.duel = { no: ++NET.duelNo, F, frame: 0, mine: z(), theirs: z(), acked: 0, pend: 0, acc: 0, stall: 0, loops: 0, hashes: new Map(), theirHash: new Map(), rqAt: 0 };
}
function netDuelSend(N) { netRaw({ t: "i", d: N.no, a: N.theirs.length, f: N.acked, v: N.mine.slice(N.acked) }); }
function netDuelInput(o) {
  const N = NET.duel; if (!N || o.d !== N.no) return;
  for (let j = 0; j < o.v.length; j++) if (o.f + j === N.theirs.length) N.theirs.push(o.v[j]);
  if (o.a > N.acked) N.acked = Math.min(o.a, N.mine.length);
}
const duelHash = F => { const a = F.f.w, b = F.f.b; return [Math.round(a.x * 8), Math.round(a.y), Math.round(a.hp * 4), a.state, Math.round(b.x * 8), Math.round(b.y), Math.round(b.hp * 4), b.state, F.proj.length].join("|"); };
function netDuelHash(o) {
  const N = NET.duel; if (!N || o.d !== N.no || NET.host) return;
  N.theirHash.set(o.f, o.h); netDuelCheck(N, o.f);
}
function netDuelCheck(N, f) {
  const a = N.hashes.get(f), b = N.theirHash.get(f);
  if (a == null || b == null) return;
  N.hashes.delete(f); N.theirHash.delete(f);
  if (a !== b && performance.now() - N.rqAt > 1500) { N.rqAt = performance.now(); netCtl({ t: "rq", d: N.no }); }
}
function netDuelStep(F, rdt) {
  const N = NET.duel, me = F.me; if (!N || N.F !== F) return;
  N.acc = Math.min(N.acc + rdt, 0.2);
  // read the buttons for the frames about to be reached, D ahead of the one being simulated; a press waits in N.pend until a frame can carry it
  const inp = readInput(), held = packInp({ l: inp.l, r: inp.r, u: inp.u, d: inp.d }); let sent = false;
  N.pend |= packInp(inp) & ~15;
  const want = N.frame + NET.D + Math.max(1, Math.floor(N.acc / NET_DT));
  while (N.mine.length < want && N.mine.length < N.theirs.length + 40) { N.mine.push(held | N.pend); N.pend = 0; sent = true; }
  let ran = 0;
  while (N.acc >= NET_DT && !F.result && N.frame < N.theirs.length && N.frame < N.mine.length) {
    const a = unpackInp(N.mine[N.frame]), b = unpackInp(N.theirs[N.frame]);
    simStep(F, NET_DT, f => (f.color === me ? a : b));
    N.frame++; N.acc -= NET_DT; ran++;
    if (N.frame % 30 === 0) { const h = duelHash(F); if (NET.host) netRaw({ t: "h", d: N.no, f: N.frame, h }); else { N.hashes.set(N.frame, h); netDuelCheck(N, N.frame); } }
  }
  N.stall = ran || F.result ? 0 : N.stall + rdt;
  if (!ran) N.acc = Math.min(N.acc, NET_DT * 2);
  $("netWait").hidden = N.stall < 1;
  if (N.stall > 14) { netOver("Connection lost.", null); return; }
  N.loops++;
  if (NET.via === "p2p" ? sent || N.loops % 6 === 0 : N.loops % 3 === 0) netDuelSend(N); // the relay is rate limited, so it gets batches
}
// the host's result decides the duel on both devices
function netDuelDone(F, r, cb) {
  const N = NET.duel; $("netWait").hidden = true;
  if (!NET.on || !N || N.F !== F) { cb(r); return; }
  const no = N.no; NET.duel = null;
  if (NET.host) { netCtl({ t: "res", d: no, r: { attackerWon: r.attackerWon, attackerHp: r.attackerHp, defenderHp: r.defenderHp, timeout: !!r.timeout } }); cb(r); return; }
  let n = 0; const wait = () => { if (NET.res[no] || ++n > 40 || !NET.on) cb(NET.res[no] || r); else setTimeout(wait, 100); };
  wait();
}
function dumpDuel(F) {
  const w = F.f.w, b = F.f.b, skip = new Set([w.s, b.s, w.ms, b.ms, w.p, b.p]);
  return JSON.stringify({ t: F.t, flip: F.flip, hitstop: F.hitstop, cine: F.cine, proj: F.proj, fw: [w], fb: [b] }, function (k, v) {
    if (v && typeof v === "object") { if (skip.has(v)) return undefined; if ((v === w || v === b) && !Array.isArray(this)) return { $f: v.color }; }
    return v;
  });
}
function netDuelLoad(o) {
  const N = NET.duel, F = fight; if (!N || !F || o.d !== N.no || NET.host || F.result) return;
  const d = JSON.parse(o.s, (k, v) => (v && v.$f ? F.f[v.$f] : v));
  for (const c of ["w", "b"]) { const f = F.f[c], keep = { s: f.s, ms: f.ms, p: f.p, ai: null }, src = d["f" + c][0]; for (const k in f) delete f[k]; Object.assign(f, src, keep); }
  F.t = d.t; F.flip = d.flip; F.hitstop = d.hitstop; F.cine = d.cine; F.proj = d.proj; F.events.length = 0;
  N.frame = o.f; N.acc = 0; N.hashes.clear(); N.theirHash.clear();
  while (N.mine.length <= N.frame + NET.D) N.mine.push(0);
}
