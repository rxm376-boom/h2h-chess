/* =====================================================================
   Duel runtime: input, sound, HUD, the round flow (entrances -> fight ->
   KO -> victory pose) and the transitions to and from the chess board.
   ===================================================================== */
const layer = $("fightLayer"), hud = $("hud"), screenEl = $("screen");
const cv = $("arena"), ctx = cv.getContext("2d");
let fight = null;
// who sits on the other side: the chess CPU, an online rival, or a practice partner
const whoIs = c => c === CONFIG.human ? "YOU" : NET.on ? "RIVAL" : fight && fight.practice && !fight.f[c].ai ? "DUMMY" : "CPU";

/* ---------- input: keyboard + touch, merged ---------- */
const keys = new Set(), pressed = new Set();
const KEYMAP = {
  l: ["KeyA", "ArrowLeft"], r: ["KeyD", "ArrowRight"], u: ["KeyW", "ArrowUp"], d: ["KeyS", "ArrowDown"],
  p: ["KeyF", "KeyJ"], k: ["KeyG", "KeyK"], s: ["KeyH", "KeyL"], x: ["KeyE", "Space", "ShiftLeft", "ShiftRight"], t: ["KeyR", "KeyU"],
};
const touch = { held: { l: 0, r: 0, u: 0, d: 0 }, pressed: new Set() };
window.addEventListener("keydown", e => {
  if (!fight) return;
  if (!e.repeat) pressed.add(e.code);
  keys.add(e.code);
  if (/^(Arrow|Space|Shift|Key[WASDFGHJKLERU]|Enter)/.test(e.code)) e.preventDefault();
});
window.addEventListener("keyup", e => keys.delete(e.code));
window.addEventListener("blur", () => { keys.clear(); touch.held = { l: 0, r: 0, u: 0, d: 0 }; });
function readInput() {
  const held = a => KEYMAP[a].some(k => keys.has(k)) || !!touch.held[a];
  const hit = a => KEYMAP[a].some(k => pressed.has(k)) || touch.pressed.has(a);
  return { l: held("l"), r: held("r"), u: held("u"), d: held("d"), p: hit("p"), k: hit("k"), s: hit("s"), x: hit("x"), t: hit("t") || (hit("p") && hit("k")), uP: hit("u"), lP: hit("l"), rP: hit("r") };
}
const anyPress = () => pressed.size > 0 || touch.pressed.size > 0;
const isTouch = (() => { try { return matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0; } catch (e) { return false; } })();
if (isTouch) layer.classList.add("touchmode");
window.addEventListener("touchstart", () => layer.classList.add("touchmode"), { once: true, passive: true });
(function setupTouch() {
  const stick = $("stick"), knob = $("knob");
  let sid = null;
  const setStick = (dx, dy, R) => {
    const len = Math.hypot(dx, dy), k = len > R ? R / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const nx = dx / R, ny = dy / R, prev = { ...touch.held };
    touch.held = { l: nx < -0.35 ? 1 : 0, r: nx > 0.35 ? 1 : 0, u: ny < -0.5 ? 1 : 0, d: ny > 0.5 ? 1 : 0 };
    for (const a of ["l", "r", "u"]) if (touch.held[a] && !prev[a]) touch.pressed.add(a);
  };
  const move = e => {
    if (e.pointerId !== sid) return;
    const rc = stick.getBoundingClientRect();
    setStick(e.clientX - (rc.left + rc.width / 2), e.clientY - (rc.top + rc.height / 2), rc.width * 0.38);
    e.preventDefault();
  };
  stick.addEventListener("pointerdown", e => { sid = e.pointerId; try { stick.setPointerCapture(sid); } catch (_) {} move(e); });
  stick.addEventListener("pointermove", move);
  const end = e => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ""; touch.held = { l: 0, r: 0, u: 0, d: 0 }; };
  stick.addEventListener("pointerup", end); stick.addEventListener("pointercancel", end);
  for (const b of document.querySelectorAll(".pad button")) {
    const a = b.dataset.b;
    b.addEventListener("pointerdown", e => { e.preventDefault(); touch.pressed.add(a); b.classList.add("on"); });
    const off = () => b.classList.remove("on");
    b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("pointerleave", off);
  }
  layer.addEventListener("contextmenu", e => e.preventDefault());
  screenEl.addEventListener("pointerdown", e => { if (fight && !e.target.closest("button")) touch.pressed.add("tap"); });
})();

/* ---------- sound: everything is synthesized, nothing to download ---------- */
const AU = { ctx: null, out: null, noise: null, muted: false };
try { AU.muted = localStorage.getItem("h2h.mute") === "1"; } catch (e) {}
function auInit() {
  if (AU.ctx) { if (AU.ctx.state === "suspended") AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = AU.ctx = new C(); AU.out = c.createGain(); AU.out.gain.value = AU.muted ? 0 : 0.55;
    const comp = c.createDynamicsCompressor(); AU.out.connect(comp); comp.connect(c.destination);
    const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = b;
  } catch (e) { AU.ctx = null; }
}
window.addEventListener("pointerdown", auInit, { passive: true }); window.addEventListener("keydown", auInit);
function setMuted(m) {
  AU.muted = m; try { localStorage.setItem("h2h.mute", m ? "1" : "0"); } catch (e) {}
  if (AU.out) AU.out.gain.value = m ? 0 : 0.55;
  for (const b of document.querySelectorAll(".sndToggle")) { b.classList.toggle("off", m); b.setAttribute("aria-pressed", String(!m)); b.title = m ? "Sound off" : "Sound on"; }
}
function tone(type, f0, f1, dur, vol, delay) {
  const c = AU.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AU.out); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(dur, vol, f0, f1, q, type, delay) {
  const c = AU.ctx, t = c.currentTime + (delay || 0), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AU.noise; s.loop = true; fl.type = type || "bandpass"; fl.Q.value = q || 1;
  fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(AU.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
function duelSfx(name, v) {
  if (!AU.ctx || AU.muted) return;
  try {
    v = v || 1;
    switch (name) {
      case "hit": hiss(0.09, 0.5 * v, 2200, 700, 0.8); tone("sine", 190, 70, 0.1, 0.6 * v); break;
      case "heavy": hiss(0.2, 0.7 * v, 1500, 220, 0.7, "lowpass"); tone("sine", 150, 38, 0.24, 0.9 * v); tone("square", 90, 45, 0.08, 0.18 * v); break;
      case "counter": hiss(0.22, 0.7, 2600, 300, 0.7); tone("sine", 160, 36, 0.26, 0.9); tone("sawtooth", 880, 220, 0.16, 0.12); break;
      case "block": tone("square", 760, 520, 0.07, 0.12 * v); tone("triangle", 1180, 900, 0.09, 0.14 * v); hiss(0.06, 0.25 * v, 3200, 1800, 2, "highpass"); break;
      case "whoosh": hiss(0.13, 0.13 * v, 500, 1900, 1.4); break;
      case "bigwhoosh": hiss(0.22, 0.2 * v, 300, 1500, 1.2); break;
      case "jump": hiss(0.1, 0.08, 400, 1200, 1.5); break;
      case "land": tone("sine", 110, 50, 0.09, 0.35 * v); hiss(0.08, 0.1, 600, 200, 1, "lowpass"); break;
      case "slam": tone("sine", 95, 28, 0.42, 1.0); hiss(0.4, 0.55, 900, 90, 0.6, "lowpass"); break;
      case "clang": tone("triangle", 1320, 1240, 0.3, 0.16); tone("square", 1980, 1900, 0.18, 0.05); hiss(0.05, 0.3, 4000, 2500, 2, "highpass"); break;
      case "bolt": tone("triangle", 1400, 480, 0.16, 0.2); tone("sine", 2100, 900, 0.1, 0.08); break;
      case "beam": tone("sawtooth", 300, 1500, 0.22, 0.12); tone("sine", 1800, 700, 0.3, 0.16); hiss(0.25, 0.2, 1200, 4000, 1.2); break;
      case "blink": tone("sine", 500, 2200, 0.16, 0.16); tone("sine", 2400, 900, 0.22, 0.1, 0.1); break;
      case "special": tone("sawtooth", 180, 760, 0.3, 0.12); tone("sine", 360, 1520, 0.32, 0.14); hiss(0.3, 0.14, 600, 3600, 1.5); break;
      case "rage": tone("sawtooth", 55, 110, 0.75, 0.3); tone("sawtooth", 82, 165, 0.75, 0.2); hiss(0.75, 0.3, 200, 2800, 0.8); break;
      case "ragemode": tone("sawtooth", 70, 140, 0.4, 0.2); hiss(0.4, 0.15, 300, 1500, 0.8); break;
      case "launch": tone("sine", 240, 900, 0.18, 0.2); break;
      case "throw": hiss(0.1, 0.25, 900, 300, 1, "lowpass"); tone("sine", 140, 90, 0.08, 0.3); break;
      case "shatter": for (let i = 0; i < 7; i++) tone("triangle", 1500 + Math.random() * 2600, 900 + Math.random() * 800, 0.18 + Math.random() * 0.25, 0.06, i * 0.035); hiss(0.5, 0.35, 5000, 1200, 0.8, "highpass"); break;
      case "ko": tone("sine", 100, 24, 0.9, 1.0); hiss(0.8, 0.6, 1400, 60, 0.6, "lowpass"); tone("sawtooth", 440, 110, 0.5, 0.1); break;
      case "ready": tone("sawtooth", 196, 196, 0.22, 0.1); tone("sawtooth", 294, 294, 0.3, 0.1, 0.02); hiss(0.3, 0.05, 2000, 2000, 1); break;
      case "fight": tone("sawtooth", 294, 294, 0.5, 0.12); tone("sawtooth", 392, 392, 0.5, 0.12); tone("sawtooth", 587, 587, 0.5, 0.1); tone("sine", 120, 40, 0.3, 0.7); hiss(0.25, 0.3, 3000, 600, 0.7); break;
      case "win": [392, 494, 587, 784].forEach((f, i) => { tone("sawtooth", f, f, 0.34, 0.09, i * 0.11); tone("triangle", f * 2, f * 2, 0.34, 0.06, i * 0.11); }); break;
      case "vs": tone("sine", 80, 30, 0.5, 0.9); hiss(0.35, 0.4, 2500, 200, 0.6, "lowpass"); tone("sawtooth", 220, 220, 0.4, 0.08, 0.02); tone("sawtooth", 330, 330, 0.4, 0.08, 0.02); break;
      case "swish": hiss(0.3, 0.2, 300, 2400, 1); break;
      case "soft": tone("sine", 660, 990, 0.25, 0.08); break;
      case "sp": tone("sine", 880, 1320, 0.12, 0.08); tone("sine", 1320, 1760, 0.14, 0.07, 0.08); break;
      case "move": tone("sine", 320, 180, 0.06, 0.25); hiss(0.04, 0.12, 1800, 700, 1.2); break;
      case "tick": tone("square", 1000, 1000, 0.04, 0.05); break;
    }
  } catch (e) {}
}

/* ---------- music: a short synthesized battle loop (drums, bass, plucked arpeggio), scheduled a little ahead of the clock ---------- */
const MU = { on: false, step: 0, next: 0, timer: null, gain: null };
const MU_ROOT = [73.42, 73.42, 58.27, 65.41], MU_ARP = [[2, 3.56, 4, 6], [2, 3.56, 4, 5.34], [2, 3, 4, 6], [2, 3, 4.5, 6]];
function muNote(type, f, t, dur, vol, cut) {
  const c = AU.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
  o.type = type; o.frequency.setValueAtTime(f, t); fl.type = "lowpass"; fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.3), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(MU.gain); o.start(t); o.stop(t + dur + 0.02);
}
function muNoise(t, dur, vol, freq, type) {
  const c = AU.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AU.noise; fl.type = type; fl.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(MU.gain); s.start(t, Math.random() * 0.5, dur + 0.02);
}
function musicTick() {
  const c = AU.ctx; if (!MU.on || !c) return;
  if (MU.next < c.currentTime - 0.3) MU.next = c.currentTime + 0.05; // tab was asleep
  while (MU.next < c.currentTime + 0.2) {
    const i = MU.step++, t = MU.next, s16 = i % 16, bar = (i >> 4) % 4, root = MU_ROOT[bar];
    MU.next += 60 / 150 / 4;
    if (AU.muted) continue;
    if (s16 % 4 === 0 || (bar === 3 && s16 === 14)) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(MU.gain); o.start(t); o.stop(t + 0.18); }
    if (s16 === 4 || s16 === 12) muNoise(t, 0.11, 0.16, 1900, "bandpass");
    if (s16 % 2 === 0) muNoise(t, 0.03, s16 % 4 === 2 ? 0.07 : 0.03, 7500, "highpass");
    if ([0, 3, 6, 8, 11, 14].includes(s16)) muNote("sawtooth", root * (s16 === 6 || s16 === 14 ? 2 : 1), t, 0.17, 0.2, 900);
    if (s16 % 2 === 0) muNote("triangle", root * MU_ARP[bar][(s16 / 2) % 4] * (s16 >= 8 ? 2 : 1), t, 0.14, 0.05, 3200);
  }
}
function musicStart() {
  auInit(); const c = AU.ctx; if (!c || MU.on) return;
  if (!MU.gain) { MU.gain = c.createGain(); MU.gain.connect(AU.out); }
  MU.on = true; MU.step = 0; MU.next = c.currentTime + 0.06;
  MU.gain.gain.cancelScheduledValues(c.currentTime); MU.gain.gain.setValueAtTime(0.42, c.currentTime);
  MU.timer = setInterval(musicTick, 50); musicTick();
}
function musicStop(fade) {
  if (!MU.on) return; MU.on = false; clearInterval(MU.timer);
  const c = AU.ctx; MU.gain.gain.cancelScheduledValues(c.currentTime); MU.gain.gain.setValueAtTime(MU.gain.gain.value, c.currentTime); MU.gain.gain.linearRampToValueAtTime(0.0001, c.currentTime + (fade || 0.3));
}

/* ---------- HUD ---------- */
const H = { side: {}, dmg: [], dmgI: 0, annT: null };
for (const c of ["w", "b"]) {
  const el = $(c === "w" ? "hudW" : "hudB"), q = s => el.querySelector(s);
  H.side[c] = { el, hp: q(".hp"), fill: q(".fill"), lag: q(".lag"), gly: q(".gly"), nm: q(".nm"), role: q(".role"), num: q(".num"), sp: q(".sp"), segs: [...el.querySelectorAll(".sp i")], tag: q(".tag"), combo: $(c === "w" ? "comboW" : "comboB"), call: $(c === "w" ? "callW" : "callB") };
}
for (let i = 0; i < 10; i++) { const s = document.createElement("span"); $("dmgs").appendChild(s); H.dmg.push(s); }
function hudSize() { const r = screenEl.getBoundingClientRect(); if (r.width) hud.style.setProperty("--u", (r.width / 100) + "px"); }
window.addEventListener("resize", () => { if (fight) hudSize(); });
// the cabinet can change size without a window resize (first touch switches to the touch layout, rotation, address bar)
if (window.ResizeObserver) new ResizeObserver(() => { if (fight) { hudSize(); if (R3.ok) resize3D(); } }).observe(screenEl);
function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function announce(text, cls, sub) {
  const a = $("ann"), s = $("annSub");
  a.textContent = text; a.className = "ann " + (cls || ""); restart(a, "go");
  s.textContent = sub || ""; s.className = "annSub" + (cls === "fight" || cls === "ready" ? " tip" : ""); if (sub) restart(s, "go");
}
function hudCall(f, text, tone) { const el = H.side[f.color].call; el.textContent = text; el.className = `callo ${f.color} ${tone || ""}`; restart(el, "go"); }
function hudSetup(F) {
  hudSize();
  for (const c of ["w", "b"]) {
    const f = F.f[c], s = H.side[c];
    s.gly.textContent = GLYPH[f.t] + VS; s.nm.textContent = `${COLORNAME[c]} ${f.s.name}`;
    s.role.textContent = (F.practice ? "" : (f.isAtt ? "ATTACKER" : "DEFENDER") + " · ") + whoIs(c); s.role.className = "role " + (f.isAtt ? "att" : "def");
    s.lag.style.transition = "none"; s.lag.style.width = s.fill.style.width = (f.hp / f.max * 100) + "%"; void s.lag.offsetWidth; s.lag.style.transition = "";
    s.combo.className = "combo " + c; s.call.className = "callo " + c; s.tag.textContent = "";
    f.hudHp = -1;
  }
  $("ann").className = "ann"; $("annSub").className = "annSub"; $("plate").className = "plate"; $("mvName").className = "mvname";
  hud.className = "hud intro";
  $("skipBtn").hidden = false;
  const me = F.f[CONFIG.human];
  for (const b of document.querySelectorAll(".pad .b-x")) b.textContent = me && me.s.dash ? "DASH" : "DODGE";
}
function hudFrame(F) {
  for (const c of ["w", "b"]) {
    const f = F.f[c], s = H.side[c];
    if (f.hudHp !== f.hp) { f.hudHp = f.hp; const pc = Math.max(0, f.hp / f.max * 100); s.fill.style.width = s.lag.style.width = pc + "%"; s.num.textContent = `${Math.ceil(f.hp)} / ${f.max}`; s.hp.classList.toggle("low", f.hp / f.max < 0.3); }
    const m = f.meter;
    if (f.hudM !== m) { f.hudM = m; s.segs.forEach((el, i) => { const k = clamp((m - i * SP_COST) / SP_COST, 0, 1); el.firstElementChild.style.width = (k * 100) + "%"; el.classList.toggle("full", k >= 1); }); s.sp.classList.toggle("ready", m >= SP_COST); }
    const ra = f.rage && !f.rageUsed, tag = ra ? (f.ai ? "RAGE ART READY" : (layer.classList.contains("touchmode") ? "RAGE: DOWN + SPECIAL" : "RAGE ART: DOWN + SPECIAL")) : f.hp <= 0 ? "" : lastStandOn(f) ? "LAST STAND" : f.rage ? "RAGE" : "";
    if (f.hudTag !== tag) { f.hudTag = tag; s.tag.textContent = tag; s.tag.classList.toggle("blink", ra); }
  }
  const left = Math.max(0, F.seconds - F.t), sec = String(Math.ceil(left)).padStart(2, "0");
  if (H.clock !== sec) { H.clock = sec; $("hudClock").textContent = sec; $("clock").classList.toggle("low", left <= 5 && F.phase === "fight"); if (left <= 5 && left > 0 && F.phase === "fight") duelSfx("tick"); }
  const cine = !!F.cine || (F.phase === "intro" && F.phaseT < F.intro.tWide) || (F.phase === "outro" && F.outroT >= F.outro.tWin);
  hud.classList.toggle("cine", cine);
  layer.classList.toggle("nofight", F.phase !== "fight" || !!F.cine);
  const me = F.f[CONFIG.human], sb = document.querySelector(".pad .b-s");
  if (sb && me) sb.classList.toggle("empty", !spReady(me) && !(me.rage && !me.rageUsed));
}
function dmgNumber(e) {
  if (!R3.ok) return;
  const p = toScreen(e.x, e.h + 6), el = H.dmg[H.dmgI++ % H.dmg.length];
  el.textContent = e.dmg; el.style.left = (p.x * 100) + "%"; el.style.top = (p.y * 100) + "%";
  el.className = e.counter ? "c" : e.heavy ? "h" : ""; restart(el, "go");
}
function hudEvent(F, e) {
  switch (e.type) {
    case "call": hudCall(e.f, e.text, e.tone); if (e.tone === "sp") duelSfx("sp"); else if (e.tone === "rage") duelSfx("ragemode"); break;
    case "hit": {
      dmgNumber(e); duelSfx(e.counter ? "counter" : e.heavy ? "heavy" : "hit");
      if (e.combo >= 2) { const el = H.side[e.by.color].combo; el.innerHTML = `<b>${e.combo}</b> HITS<small>${e.comboDmg} DAMAGE</small>`; restart(el, "go"); }
      if (e.heavy) { const fl = $("hudFlash"); fl.style.setProperty("--a", e.last ? 0.7 : e.counter ? 0.3 : 0.16); restart(fl, "go"); }
      break; }
    case "block": duelSfx("block", e.heavy ? 1.4 : 1); break;
    case "chip": { const s = H.side[e.f.color]; restart(s.hp, "chip"); break; }
    case "deflect": duelSfx("block", 0.8); hudCall(e.f, "DEFLECT", "sp"); break;
    case "swing": if (e.m.proj) break; duelSfx(e.m.dmg >= 12 || e.m.arch === "throw" ? "bigwhoosh" : "whoosh", e.m.arch === "jab" ? 0.6 : 1); break;
    case "muzzle": duelSfx(e.small ? "bolt" : "beam"); break;
    case "jump": duelSfx("jump"); break;
    case "land": duelSfx("land", 0.7); break;
    case "slamdown": duelSfx("land", 1.6); break;
    case "splat": if (!e.soft) { duelSfx("slam"); hudCall(e.f.color === "w" ? F.f.b : F.f.w, "WALL SPLAT", "launch"); } break;
    case "slam": case "crater": duelSfx("slam"); break;
    case "launch": duelSfx("launch"); break;
    case "grab": duelSfx("throw"); break;
    case "dash": case "step": duelSfx("whoosh", 1.2); break;
    case "blink": duelSfx("blink"); break;
    case "boom": duelSfx("ko"); break;
    case "shatter": duelSfx("shatter"); break;
    case "cine": { duelSfx(e.rage ? "rage" : "special"); const mn = $("mvName"); mn.textContent = F.cine ? F.cine.label : ""; mn.className = `mvname ${e.f.color} ${e.rage ? "rage" : ""}`; restart(mn, "go"); break; }
    case "rageart": { const mn = $("mvName"); mn.textContent = F.cine.label; mn.className = `mvname ${e.f.color} rage hold`; restart(mn, "go"); break; }
    case "ko": musicStop(0.5); announce(e.timeout ? "TIME UP" : "K.O.", e.timeout ? "time" : "ko"); duelSfx(e.timeout ? "fight" : "ko"); $("mvName").className = "mvname"; break;
  }
}

/* ---------- round flow ---------- */
function startFight(att, def, onDone, opts) {
  keys.clear(); pressed.clear(); touch.pressed.clear(); touch.held = { l: 0, r: 0, u: 0, d: 0 };
  const lv = c => (c === CONFIG.human || NET.on ? null : opts && opts.ai !== undefined ? opts.ai : CONFIG.level);
  const F = makeDuel(att, def, { w: lv("w"), b: lv("b") }, opts && opts.seconds || CONFIG.fightSeconds);
  F.practice = !!(opts && opts.practice); F.stage = opts && opts.stage || 0; F.me = CONFIG.human;
  if (NET.on) netDuelBegin(F);
  const tA = 0.1, tD = tA + INTRO_DUR[att.t] * 0.8, tWide = tD + INTRO_DUR[def.t] * 0.86;
  Object.assign(F, { phase: "intro", phaseT: 0, outroT: 0, onDone, last: performance.now(), slow: 0, hold: !!(opts && opts.hold), lightSq: !!(opts && opts.lightSq),
    intro: { tA, tD, tWide, tReady: tWide + 0.05, tFight: tWide + 0.55, end: tWide + 0.85, said: {} }, outro: null });
  fight = F; H.clock = null;
  for (const c of ["w", "b"]) {
    const f = F.f[c], C = c.toUpperCase();
    $("kc" + C).textContent = `${COLORNAME[c]} ${f.s.name}${" (" + whoIs(c).toLowerCase() + ")"}`;
    $("kc" + C + "k").textContent = `${f.s.style}. Special: ${f.s.spName.toLowerCase()}.`;
  }
  document.body.classList.add("dueling");
  layer.hidden = false;
  if (init3D()) { layer.classList.add("three"); resize3D(); setup3D(F); } else layer.classList.remove("three");
  hudSetup(F);
  $("exitBtn").hidden = !F.practice; $("movesBtn").hidden = !F.practice; $("pMoves").hidden = true;
  if (F.practice) $("pMovesList").innerHTML = moveList(F.f[F.me].t);
  requestAnimationFrame(loop);
  return F;
}
function loop(now) {
  const F = fight; if (!F) return;
  const rdt = Math.min(0.05, Math.max(0, (now - F.last) / 1000)); F.last = now;
  stepDuel(F, rdt);
  if (fight === F) { for (const e of F.events) hudEvent(F, e); hudFrame(F); drawDuel(F); F.events.length = 0; requestAnimationFrame(loop); }
  pressed.clear(); touch.pressed.clear();
}
function showPlate(f) {
  const p = $("plate");
  p.innerHTML = `<small>${fight && fight.practice ? "PRACTICE" : f.isAtt ? "ATTACKER" : "DEFENDER"} · ${whoIs(f.color)}</small><b>${COLORNAME[f.color]} ${f.s.name}</b><span>${f.s.style} · ${Math.ceil(f.hp)} HP</span>`;
  p.className = `plate ${f.color} ${f.face > 0 ? "lft" : "rgt"}`; restart(p, "go");
}
// one line reminding you what your piece does, shown under FIGHT!
const TIP = { P: "Dodge in, body blows · hits harder below 25% health", N: "Double jump · air kicks knock bolts away", B: "Punch fires a bolt upward · forward + punch for the staff", R: "No jump · the dash hits · up + punch stops jump-ins", Q: "All-rounder · Special fires a bolt, duck it" };
function stepDuel(F, rdt) {
  if (F.hold) return;
  if (F.phase === "intro") {
    const I = F.intro, was = F.phaseT;
    F.phaseT += rdt;
    if (F.phaseT > 0.35 && F.phaseT < I.tWide && (anyPress() || F.skip)) { if (F.net && F.skip !== 2) netCtl({ t: "skip" }); F.phaseT = I.tWide; } // online, skipping the entrances skips them for both
    const at = (t, key, fn) => { if (F.phaseT >= t && !I.said[key]) { I.said[key] = 1; fn(); } };
    if (F.phaseT < I.tWide) { at(I.tA, "pa", () => showPlate(F.att)); at(I.tD, "pd", () => showPlate(F.def)); }
    at(I.tWide, "w", () => { $("plate").className = "plate"; hud.classList.remove("intro"); $("skipBtn").hidden = true; });
    at(I.tReady, "r", () => { { const me = F.f[CONFIG.human]; announce("READY?", "ready", me && !me.ai ? (me.s.dash ? "Dash closes or opens the gap" : "Dodge slips past straight attacks") + " · Grab beats a blocker" : ""); } duelSfx("ready"); });
    at(I.tFight, "f", () => { const me = F.f[CONFIG.human]; announce("FIGHT!", "fight", me && !me.ai ? TIP[me.t] : ""); duelSfx("fight"); musicStart(); });
    if (F.phaseT >= I.end) { F.phase = "fight"; F.phaseT = 0; for (const f of [F.att, F.def]) f.stT = 0; }
    return;
  }
  if (F.phase === "outro") {
    const O = F.outro; F.outroT += rdt;
    const dt = rdt * (F.slow > 0 ? 0.3 : 1); F.slow -= rdt;
    for (const f of [F.att, F.def]) { f.stT += dt; f.flash = Math.max(0, f.flash - dt); physics(F, f, dt);
      if (f.y <= 0 && f.won && f.state !== "win") { f.state = "win"; f.stT = 0; f.vx = 0; }                       // a winner who was airborne poses once it lands
      else if (f.y <= 0 && !f.won && F.result.timeout && !["lose", "down", "thrown", "fall"].includes(f.state)) { f.state = "lose"; f.stT = 0; f.vx = 0; } }
    updateProj(F, dt);
    if (F.outroT >= O.tWin && !O.said) {
      O.said = true; const r = F.result, w = r.attackerWon ? F.att : F.def;
      announce(`${COLORNAME[w.color]} ${w.s.name} wins`, "win " + w.color, r.perfect ? "PERFECT" : r.timeout ? `${Math.round(F.att.hp / F.att.max * 100)}% vs ${Math.round(F.def.hp / F.def.max * 100)}% health` : r.attackerWon ? `Takes the square with ${Math.ceil(w.hp)} HP` : `Holds the square with ${Math.ceil(w.hp)} HP`);
      duelSfx("win");
    }
    if (F.outroT >= O.end || (F.outroT > O.tWin + 0.5 && anyPress())) endFight(F);
    return;
  }
  if (F.net) netDuelStep(F, rdt);
  else {
    const inp = readInput(), n = Math.max(1, Math.ceil(rdt * 60 - 0.01)), mine = F.f[F.me], none = blankInput();
    for (let i = 0; i < n && !F.result; i++) {
      const first = i === 0;
      simStep(F, rdt / n, f => f !== mine ? none : first ? inp : { l: inp.l, r: inp.r, u: inp.u, d: inp.d, p: 0, k: 0, s: 0, x: 0, t: 0, uP: 0, lP: 0, rP: 0 });
    }
    if (F.practice) practiceTick(F);
  }
  if (F.result) { F.phase = "outro"; F.outroT = 0; F.slow = F.result.timeout ? 0.5 : 1.3; F.outro = { tWin: F.result.timeout ? 1.0 : 1.7, end: (F.result.timeout ? 1.0 : 1.7) + 2.3, said: false }; }
}
// Practice: a partner that stands still gets its health back once you stop hitting it, and your special meter stays topped up
function practiceTick(F) {
  const me = F.f[F.me], o = F.f[F.me === "w" ? "b" : "w"];
  for (const e of F.events) if (e.type === "hit" && e.f === o) F.pHit = F.t;
  if (!o.ai && !F.result) { if (F.t - (F.pHit || 0) > 1.6 && o.hp < o.max) o.hp = Math.min(o.max, o.hp + o.max * 0.02); if (o.hp < 2) o.hp = 2; }
  if (!o.ai && me.meter < 50) me.meter = Math.min(100, me.meter + 0.4);
}
function endFight(F) {
  if (F.ending) return; F.ending = true;
  wipe(() => {
    const r = F.result; musicStop(0.1); teardown3D(); fight = null; layer.hidden = true; document.body.classList.remove("dueling"); keys.clear();
    if (F.net) netDuelDone(F, r, F.onDone); else F.onDone(r);
  });
}
$("skipBtn").addEventListener("click", () => { if (fight) fight.skip = true; });
$("exitBtn").addEventListener("click", () => { const F = fight; if (F && F.practice && !F.ending) { if (!F.result) F.result = { attackerWon: true, attackerHp: F.att.hp, defenderHp: F.def.hp, practice: true }; endFight(F); } });
$("movesBtn").addEventListener("click", () => { $("pMoves").hidden = !$("pMoves").hidden; });
for (const b of document.querySelectorAll(".sndToggle")) b.addEventListener("click", () => { auInit(); setMuted(!AU.muted); });
setMuted(AU.muted);

/* ---------- transitions between the board and the arena ---------- */
function wipe(mid, after) { // shutters close, mid() runs hidden, shutters open
  const w = $("wipe"); w.hidden = false; w.className = "wipe"; void w.offsetWidth; w.classList.add("close"); duelSfx("swish");
  setTimeout(() => { mid(); requestAnimationFrame(() => { w.classList.add("open"); setTimeout(() => { w.hidden = true; w.className = "wipe"; if (after) after(); }, 420); }); }, 300);
}
function vsCard(att, def, behind, done) {
  const c = $("vsCard"), fill = (side, p, isAtt) => {
    const el = c.querySelector(".vsHalf." + side), s = STATS[p.t];
    el.querySelector(".vsGlyph").textContent = GLYPH[p.t] + VS;
    el.querySelector("small").textContent = (isAtt ? "ATTACKER" : "DEFENDER") + (p.c === CONFIG.human ? " · YOU" : NET.on ? " · RIVAL" : " · CPU");
    el.querySelector("b").textContent = `${COLORNAME[p.c]} ${s.name}`;
    el.querySelector("i").style.width = (p.hp / s.hp * 100) + "%";
    el.querySelector("span").textContent = `${p.hp} / ${s.hp} HP · ${s.style}`;
  };
  fill("w", att.c === "w" ? att : def, att.c === "w"); fill("b", att.c === "b" ? att : def, att.c === "b");
  c.hidden = false; c.className = "vs"; void c.offsetWidth; c.classList.add("in"); duelSfx("vs");
  let over = false, t2 = null;
  const out = () => { if (over) return; over = true; clearTimeout(t2); c.classList.add("out"); duelSfx("swish"); done(); setTimeout(() => { c.hidden = true; c.className = "vs"; }, 420); c.removeEventListener("pointerdown", skip); };
  const skip = () => { if (c.classList.contains("ready")) out(); };
  c.addEventListener("pointerdown", skip);
  const key = e => { if (over) { window.removeEventListener("keydown", key); return; } if (/^(Space|Enter|Key[FGHJKL])$/.test(e.code)) { e.preventDefault(); skip(); } };
  window.addEventListener("keydown", key);
  setTimeout(() => { behind(); c.classList.add("ready"); t2 = setTimeout(out, 1150); }, 420);
}

/* ---------- drawing ---------- */
function drawDuel(F) {
  if (R3.ok) { draw3D(F); return; }
  // plain 2D fallback when WebGL is unavailable
  const W = 384, Hh = 216, GY = 190;
  ctx.fillStyle = "#1a1430"; ctx.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? "#3a2f55" : "#b09a74"; ctx.fillRect(i * 32, GY, 32, Hh - GY); }
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  for (const f of [F.f.w, F.f.b]) {
    const lying = f.state === "down" || f.state === "ko", lean = f.state === "fall" ? -1.2 : lying ? -1.57 : f.state === "hit" ? -0.3 : f.state === "attack" ? 0.25 : 0;
    ctx.save(); ctx.translate(f.x, GY - f.y - (lying ? 6 : 0)); ctx.rotate(-lean * f.face);
    ctx.font = "54px " + getComputedStyle(document.documentElement).getPropertyValue("--font-glyph");
    ctx.fillStyle = f.flash > 0 ? "#ff8a7a" : f.color === "w" ? "#fbf5e6" : "#6a59a8"; ctx.strokeStyle = "#0b0818"; ctx.lineWidth = 2;
    const sy = f.state === "crouch" || (f.state === "block" && f.blockLow) ? 0.65 : 1; ctx.scale(1, sy);
    ctx.strokeText(GLYPH[f.t] + VS, 0, 0); ctx.fillText(GLYPH[f.t] + VS, 0, 0); ctx.restore();
    const m = f.move && f.ms[f.move];
    if (m && !m.proj && f.mt >= m.su && (m.air || f.mt < m.su + m.ac)) { ctx.strokeStyle = "#ffe9a8"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(f.x + f.face * 8, GY - f.y - (m.h0 ?? m.h)); ctx.lineTo(f.x + f.face * m.reach, GY - f.y - m.h); ctx.stroke(); }
    if (f.state === "block") { ctx.strokeStyle = "#9fd3ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x + f.face * 10, GY - 30, 18, -1.2 * f.face, 1.2 * f.face, f.face < 0); ctx.stroke(); }
  }
  for (const p of F.proj) { ctx.fillStyle = p.owner.color === "w" ? "#bfe8ff" : "#ffc24a"; ctx.beginPath(); ctx.arc(p.x, GY - p.h, p.kind === "wave" ? 7 : 4, 0, 7); ctx.fill(); }
}
