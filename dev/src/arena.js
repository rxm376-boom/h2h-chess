/* ---------- scene lifecycle ---------- */
function stageExtras() {
  const T = THREE, scene = R3.scene;
  const colMat = new T.MeshStandardMaterial({ color: 0x2a2244, roughness: 0.35, metalness: 0.3, map: marble("#3a3058", "#8a7ab0", 51) });
  const gold = new T.MeshStandardMaterial({ color: 0xd9a63e, metalness: 1, roughness: 0.25 });
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const x = i * 11 + (i > 0 ? -3 : 3);
    const col = new T.Mesh(lathe([[1.5, 0], [1.5, 0.5], [1.15, 0.9], [1.0, 1.4], [0.92, 15], [1.2, 15.5], [1.5, 16], [1.5, 17]], 18), colMat); col.position.set(x, 0, -10.5); col.castShadow = true; scene.add(col);
    for (const y of [1.1, 15.2]) { const r = new T.Mesh(new T.TorusGeometry(1.08, 0.1, 8, 24), gold); r.rotation.x = Math.PI / 2; r.position.set(x, y, -10.5); scene.add(r); }
  }
  const inlay = new T.Mesh(new T.RingGeometry(13.2, 13.5, 96), new T.MeshStandardMaterial({ color: 0xd9a63e, metalness: 1, roughness: 0.3, transparent: true, opacity: 0.85 }));
  inlay.rotation.x = -Math.PI / 2; inlay.position.set(0, 0.012, 0); scene.add(inlay);
  const inlay2 = new T.Mesh(new T.RingGeometry(6.0, 6.12, 72), inlay.material); inlay2.rotation.x = -Math.PI / 2; inlay2.position.set(0, 0.012, 0); scene.add(inlay2);
  // soft blob shadows keep fighters grounded even where the shadow map is coarse
  R3.blobs = [];
  const blobTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, "rgba(0,0,0,.7)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false);
  for (let i = 0; i < 2; i++) { const b = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); b.rotation.x = -Math.PI / 2; b.position.y = 0.02; b.renderOrder = 1; scene.add(b); R3.blobs.push(b); }
  // dark veil used when the camera isolates a fighter
  R3.winMats = []; scene.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material.emissive.getHex() === 0x5a4cc0 && !R3.winMats.includes(o.material)) R3.winMats.push(o.material); });
}
function setStage(light) { // a duel on a light square is fought in the gold-lit hall, on a dark square in the violet one
  if (!R3.ok) return;
  for (const m of R3.winMats) { m.emissive.setHex(light ? 0xc89a46 : 0x5a4cc0); m.emissiveIntensity = light ? 0.5 : 0.55; }
  R3.scene.background.setHex(light ? 0x120c14 : 0x0a0716); R3.scene.fog.color.setHex(light ? 0x120c14 : 0x0a0716);
}
function setup3D(F) {
  teardown3D();
  if (!R3.blobs) stageExtras();
  setStage(F.lightSq);
  R3.models = [buildModel(F.f.w), buildModel(F.f.b)];
  for (const m of R3.models) m.introAt = m.f.isAtt ? F.intro.tA : F.intro.tD;
  R3.cam = { x: 0, y: 4.5, z: 24, lx: 0, ly: 3.5 }; R3.shot = null; R3.shake = 0; R3.punch = 0;
  R3.last = performance.now(); R3.time = 0; R3.tileT = 0;
  R3.post = { dark: 0, tint: 0, desat: 0 };
}
function teardown3D() {
  if (!R3.renderer) return;
  const kill = o => { R3.scene.remove(o); o.traverse(c => { if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose(); }); };
  for (const m of R3.models) kill(m.root);
  R3.models = [];
  for (const [, mesh] of R3.proj) { kill(mesh); mesh.traverse(c => { if (c.isMesh) c.material.dispose(); }); }
  R3.proj.clear();
  for (const fr of R3.frags) R3.scene.remove(fr.m);
  for (const ti of R3.tiles) R3.scene.remove(ti.m);
  for (const r of R3.rings) { R3.scene.remove(r.m); r.m.material.dispose(); }
  R3.frags = []; R3.tiles = []; R3.rings = [];
  R3.glow.list.length = 0; R3.smoke.list.length = 0;
}
function toScreen(x, h) { // arena point -> fraction of the screen
  const v = new THREE.Vector3(wx(x), h / 10, 0).project(R3.camera);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
}

/* ---------- effects ---------- */
function shatter(mdl) {
  const T = THREE, f = mdl.f, root = mdl.root, meshes = [];
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o.isMesh) meshes.push(o); });
  const c = { x: wx(f.x), y: 0.6 }, v = new T.Vector3();
  for (let i = 0; i < 80; i++) {
    const src = meshes[(Math.random() * meshes.length) | 0];
    src.getWorldPosition(v);
    const m = new T.Mesh(G3.shards[i % 3], src.material); m.castShadow = true;
    const sc = 0.1 + Math.random() * 0.24; m.scale.setScalar(sc);
    m.position.copy(v).add(new T.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
    R3.scene.add(m);
    const dx = m.position.x - c.x, dy = m.position.y - c.y + 0.6;
    R3.frags.push({ m, vx: dx * 4 + (Math.random() - 0.5) * 6, vy: 5 + dy * 3 + Math.random() * 6, vz: (Math.random() - 0.5) * 7, ax: (Math.random() - 0.5) * 14, az: (Math.random() - 0.5) * 14, r: sc, life: 0, max: 99 });
  }
  mdl.gone = true; root.visible = false;
  const tc = TEAM[f.color];
  burst(R3.glow, c.x, c.y, 0.3, 90, { spd: [3, 14], life: [0.4, 1.1], size: [0.15, 0.4], col: [tc.hi, "#ffffff", tc.mid], drag: 2.5, grav: -6 });
  burst(R3.smoke, c.x, 0.5, 0, 30, { spd: [1, 4], life: [0.8, 1.6], size: [0.8, 1.6], size1: 2.6, col: "#5a5070", drag: 2, grav: 0.6, alpha: 0.6 });
  ring3(c.x, 0.05, 0, tc.mid, 0.4, 7, 0.7, true);
  lightPulse(c.x, 1.5, tc.hi, 6);
}
const dustAt = (x, n, big) => burst(R3.smoke, x, 0.15, 0, n, { spd: [1.5, big ? 6 : 4], life: [0.5, big ? 1.1 : 0.9], size: [0.4, big ? 1.0 : 0.8], size1: big ? 1.8 : 1.4, col: "#8a7fa0", drag: 3, grav: 0.4, up: 0.4, flatZ: 1, alpha: 0.55 });
function handleEvent(F, e) {
  const G = R3.glow, Sm = R3.smoke;
  const x = e.x != null ? wx(e.x) : e.f ? wx(e.f.x) : 0, y = e.h != null ? e.h / 10 : 3;
  switch (e.type) {
    case "block":
      burst(G, x, y, 0.6, e.heavy ? 22 : 14, { spd: [3, 8], life: [0.15, 0.3], size: [0.08, 0.16], col: ["#9fd3ff", "#ffffff"], drag: 6 });
      ring3(x, y, 0.6, 0x7fbfff, 0.1, e.heavy ? 1.4 : 0.9, 0.18); lightPulse(x, y, "#9fd3ff", 1.6);
      if (e.heavy) R3.shake = Math.max(R3.shake, 0.1);
      break;
    case "hit": {
      const c = e.counter, tc = TEAM[e.by.color];
      burst(G, x, y, 0.6, c ? 36 : e.heavy ? 28 : 18, { spd: [4, c || e.heavy ? 16 : 11], life: [0.15, 0.42], size: [0.08, 0.22], col: c ? ["#ff5a3c", "#ffb070", "#ffffff"] : ["#ffe9a8", "#ffffff", tc.mid], drag: 5, grav: -8 });
      burst(G, x, y, 0.6, 3, { spd: [0, 0.4], life: [0.08, 0.14], size: [e.heavy ? 1.4 : 0.9, e.heavy ? 1.9 : 1.3], size1: 1.9, col: "#ffffff" });
      lightPulse(x, y, c ? "#ff7050" : "#ffd8a0", c ? 4.5 : e.heavy ? 3.6 : 2.4);
      if (e.heavy) { ring3(x, y, 0.6, c ? 0xff5a3c : 0xffe0a0, 0.2, e.last ? 4.5 : 2.0, 0.28); R3.shake = Math.max(R3.shake, e.last ? 0.45 : 0.2); R3.punch = Math.max(R3.punch, e.last ? 2.2 : 1.1); }
      else R3.punch = Math.max(R3.punch, 0.35);
      if (e.last && e.rageTick) { const t = e.by.t, gx = wx(e.f.x);
        if (t === "R") { for (let i = -2; i <= 2; i++) floorTile(gx + i * 1.1, (Math.random() - 0.5) * 2, Math.abs(i) * 0.04); rocks(gx, 14, R3.tileMatD || mats3D("b").armor, 7); dustAt(gx, 24, true); ring3(gx, 0.05, 0, 0xffb050, 0.3, 6, 0.5, true); }
        else if (t === "Q") { burst(G, x, y, 0.4, 60, { spd: [6, 20], life: [0.2, 0.6], size: [0.1, 0.3], col: [tc.hi, "#ffffff", tc.mid], drag: 4, dir: e.by.face }); ring3(x, y, 0.4, e.by.color === "w" ? 0x6fc8ff : 0xffa040, 0.2, 4.5, 0.4); }
        else if (t === "B") { for (let i = 0; i < 26; i++) emit(G, { x: gx + (Math.random() - 0.5) * 1.6, y: 9 + Math.random() * 3, z: (Math.random() - 0.5), vx: (Math.random() - 0.5) * 2, vy: -22 - Math.random() * 10, life: 0.4, size: 0.2, col: i % 2 ? "#b48cff" : tc.hi, drag: 0 }); ring3(gx, 0.05, 0, 0xb48cff, 0.3, 5, 0.5, true); lightPulse(gx, 3, "#b48cff", 8); }
        else { dustAt(gx, 16, true); ring3(gx, 0.05, 0, 0xffe9a8, 0.3, 4.5, 0.45, true); } }
      break; }
    case "chip": burst(G, x, y, 0.6, 6, { spd: [2, 6], life: [0.12, 0.25], size: [0.06, 0.12], col: ["#ffb070", "#ffffff"], drag: 6 }); break;
    case "deflect": { const p = bodyPos(e.f, 30); ring3(p.x, p.y, 0.5, 0xdff4ff, 0.2, 1.6, 0.2); break; }
    case "armor": { const p = bodyPos(e.f, 34); ring3(p.x, p.y, 0.6, 0xbfd0ff, 0.5, 2.2, 0.22); break; }
    case "land": dustAt(x, 6); break;
    case "jump": if (e.air) { const p = bodyPos(e.f, 0); ring3(p.x, p.y, 0, 0x9fd3ff, 0.3, 1.8, 0.25, true); } else dustAt(x, 4); break;
    case "dash": case "step": dustAt(x, 5); break;
    case "slamdown": dustAt(x, 12, true); R3.shake = Math.max(R3.shake, 0.14); ring3(x, 0.05, 0, 0xcfc0ff, 0.3, 2.6, 0.3, true); break;
    case "splat":
      burst(G, x, y, 0, e.soft ? 14 : 30, { spd: [3, 10], life: [0.2, 0.5], size: [0.1, 0.24], col: ["#ffffff", "#ffe9a8"], drag: 4, dir: x < 0 ? 1 : -1 });
      if (!e.soft) { R3.shake = Math.max(R3.shake, 0.3); ring3(x, y, 0, 0xffe9a8, 0.3, 3.4, 0.35); rocks(x, 8, R3.tileMatD || mats3D("b").armor, 5); }
      break;
    case "launch": {
      const p = bodyPos(e.f, 0);
      for (let i = 0; i < 18; i++) emit(G, { x: p.x + (Math.random() - 0.5) * 1.2, y: 0.3, z: (Math.random() - 0.5), vy: 10 + Math.random() * 8, life: 0.35, size: 0.1, col: "#ffe9a8", drag: 2 });
      ring3(p.x, 0.05, 0, 0xffe9a8, 0.3, 2.8, 0.35, true);
      break; }
    case "cine": {
      const f = e.f, p = bodyPos(f, 32), tc = TEAM[f.color];
      for (let i = 0; i < (e.rage ? 80 : 40); i++) {
        const a = Math.random() * 6.28, r = 2.5 + Math.random() * 2.5, sx = p.x + Math.cos(a) * r, sy = p.y + Math.sin(a) * r * 0.8;
        emit(G, { x: sx, y: sy, z: (Math.random() - 0.5) * 2, vx: (p.x - sx) * 3.2, vy: (p.y - sy) * 3.2, life: 0.32, size: 0.14, size1: 0.05, col: e.rage ? "#ff5a3c" : tc.hi, drag: 0 });
      }
      ring3(p.x, p.y, 0.4, e.rage ? 0xff3a1a : (f.color === "w" ? 0x6fc8ff : 0xffa040), 3, 0.2, 0.32);
      lightPulse(p.x, p.y, e.rage ? "#ff3a1a" : tc.mid, e.rage ? 7 : 4);
      break; }
    case "rageart": { const p = bodyPos(e.o, 32); ring3(p.x, p.y, 0.4, 0xff3a1a, 0.3, 5, 0.4); R3.shake = 0.3; break; }
    case "blink": {
      const p = { x: wx(e.x), y: (e.y + 30) / 10 }, tc = TEAM[e.f.color];
      for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, r = 1.4 + Math.random(), sx = p.x + Math.cos(a) * r, sy = p.y + Math.sin(a) * r * 1.4; emit(G, { x: sx, y: sy, z: 0.2, vx: (p.x - sx) * 5, vy: (p.y - sy) * 5, life: 0.22, size: 0.12, col: tc.hi, drag: 0 }); }
      ring3(p.x, p.y, 0.3, 0xb48cff, 1.6, 0.1, 0.25);
      break; }
    case "blinkIn": {
      const p = bodyPos(e.f, 30), tc = TEAM[e.f.color];
      burst(G, p.x, p.y, 0.3, 30, { spd: [3, 9], life: [0.2, 0.45], size: [0.1, 0.22], col: [tc.hi, "#b48cff", "#ffffff"], drag: 4 });
      ring3(p.x, p.y, 0.3, 0xb48cff, 0.2, 2.2, 0.3); lightPulse(p.x, p.y, "#b48cff", 3);
      break; }
    case "crater":
      ring3(x, 0.05, 0, 0xffe9a8, 0.3, 4.5, 0.45, true); dustAt(x, 22, true);
      rocks(x, 12, R3.tileMatD || mats3D(e.f.color).armor, 6); R3.shake = Math.max(R3.shake, 0.22);
      break;
    case "slam":
      ring3(x, 0.05, 0, 0xffb050, 0.3, e.quake ? 4.2 : 3.2, 0.4, true); dustAt(x, 18, true); R3.shake = Math.max(R3.shake, e.quake ? 0.3 : 0.24);
      for (let i = -1; i <= 1; i++) floorTile(x + i * 1.2, (Math.random() - 0.5) * 1.5, Math.abs(i) * 0.05);
      break;
    case "muzzle": {
      const tc = TEAM[e.f.color], n = e.small ? 14 : 40;
      burst(G, x, y, 0.4, n, { spd: [4, e.small ? 8 : 14], life: [0.15, 0.4], size: [0.1, 0.25], col: [tc.hi, "#ffffff", tc.mid], drag: 5, dir: e.f.face });
      if (!e.small) burst(G, x, y, 0.4, 2, { spd: [0, 0.2], life: [0.12, 0.18], size: [1.6, 2], size1: 2.4, col: "#ffffff" });
      ring3(x, y, 0.4, e.f.color === "w" ? 0x6fc8ff : 0xffa040, 0.2, e.small ? 1.0 : 1.8, 0.25); lightPulse(x, y, tc.mid, e.small ? 2.5 : 6);
      break; }
    case "fizz": burst(G, x, y, 0, 12, { spd: [2, 6], life: [0.15, 0.3], size: [0.08, 0.18], col: ["#9fd3ff", "#ffffff"], drag: 5 }); break;
    case "boom":
      burst(G, x, y, 0.6, 110, { spd: [5, 22], life: [0.3, 0.9], size: [0.12, 0.4], col: ["#ff5a3c", "#ffb070", "#ffffff", "#ffe9a8"], drag: 3, grav: -6 });
      burst(Sm, x, y, 0, 20, { spd: [2, 6], life: [0.7, 1.3], size: [0.8, 1.4], size1: 2.4, col: "#3a2230", drag: 2, alpha: 0.6 });
      ring3(x, y, 0.6, 0xff5a3c, 0.3, 6, 0.45); ring3(x, 0.05, 0, 0xffb050, 0.3, 6, 0.6, true);
      lightPulse(x, y, "#ff5a3c", 9); R3.shake = Math.max(R3.shake, 0.4);
      break;
    case "rage": {
      const p = bodyPos(e.f, 32);
      burst(G, p.x, p.y, 0.3, 50, { spd: [3, 9], life: [0.4, 0.8], size: [0.12, 0.3], col: ["#ff5a3c", "#ff9a3c"], drag: 3, grav: 4 });
      ring3(p.x, p.y, 0.3, 0xff3a1a, 0.3, 3, 0.4);
      break; }
    case "ko": {
      const p = bodyPos(e.f, 32);
      if (!e.timeout) { burst(G, p.x, p.y, 0.5, 70, { spd: [5, 18], life: [0.3, 0.8], size: [0.12, 0.35], col: ["#ffffff", "#ffe9a8"], drag: 3 }); ring3(p.x, p.y, 0.5, 0xffffff, 0.3, 3, 0.4); lightPulse(p.x, p.y, "#ffffff", 8); R3.shake = 0.35; R3.punch = 2.5; }
      break; }
    case "shatter": { const mdl = R3.models.find(m => m.f === e.f); if (mdl && !mdl.gone) shatter(mdl); break; }
  }
}
function introFx(F, mdl, name) {
  if (mdl.fxT[name]) return; mdl.fxT[name] = 1;
  const f = mdl.f, x = wx(f.x), G = R3.glow, tc = TEAM[f.color];
  if (name === "clang") { const p = new THREE.Vector3(); mdl.seg.lfa.getWorldPosition(p); burst(G, p.x + f.face * 0.6, p.y + 0.6, 0.6, 26, { spd: [3, 10], life: [0.15, 0.4], size: [0.08, 0.2], col: ["#ffe9a8", "#ffffff"], drag: 5, grav: -8 }); lightPulse(p.x, p.y, "#ffd8a0", 3); R3.shake = Math.max(R3.shake, 0.08); }
  else if (name === "land") { dustAt(x, 14, true); ring3(x, 0.05, 0, 0xcfc0ff, 0.3, 3, 0.3, true); R3.shake = Math.max(R3.shake, 0.12); }
  else if (name === "slam") { dustAt(x, 26, true); ring3(x, 0.05, 0, 0xffb050, 0.3, 5.5, 0.5, true); R3.shake = 0.45; for (let i = -2; i <= 2; i++) floorTile(x + i * 1.1, (Math.random() - 0.5) * 2, Math.abs(i) * 0.04); rocks(x, 14, R3.tileMatD || mats3D(f.color).armor, 7); lightPulse(x, 1, "#ffb050", 5); }
  else if (name === "blink") { burst(G, x, 4, 0.3, 46, { spd: [3, 10], life: [0.25, 0.6], size: [0.1, 0.24], col: [tc.hi, "#b48cff", "#ffffff"], drag: 4 }); ring3(x, 4, 0.3, 0xb48cff, 0.2, 3.2, 0.4); lightPulse(x, 4, "#b48cff", 5); }
  else if (name === "plant") { ring3(x + f.face * 0.5, 0.05, 0, f.color === "w" ? 0x6fc8ff : 0xffa040, 0.2, 2.6, 0.4, true); dustAt(x, 5); }
  else if (name === "soft") { ring3(x, 0.05, 0, f.color === "w" ? 0x6fc8ff : 0xffa040, 0.3, 3.4, 0.5, true); burst(G, x, 0.4, 0, 24, { spd: [1, 4], life: [0.4, 0.9], size: [0.08, 0.18], col: [tc.hi, "#ffffff"], drag: 2, grav: 2, up: 1 }); }
  duelSfx(name === "whoosh" ? "whoosh" : name === "clang" ? "clang" : name === "slam" ? "slam" : name === "blink" ? "blink" : name === "land" ? "land" : "soft");
}
function continuousFx(F, dt) {
  const G = R3.glow, Sm = R3.smoke;
  for (const mdl of R3.models) {
    const f = mdl.f; if (!mdl.root.visible) continue;
    const tc = TEAM[f.color], c = bodyPos(f, 32), feet = wx(f.x);
    if (f.rage && f.hp > 0 && F.phase === "fight") for (let i = 0; i < 2; i++) emit(G, { x: c.x + (Math.random() - 0.5) * 1.8, y: f.y / 10 + Math.random() * 5.5, z: (Math.random() - 0.5) * 1.2, vy: 2 + Math.random() * 3, vx: (Math.random() - 0.5), life: 0.45, size: 0.3, size1: 0.05, col: "#ffb040", col2: "#ff2a10", drag: 1, alpha: 0.8 });
    const rushing = f.state === "special" && f.sp && (f.sp.kind === "rush" || f.sp.kind === "rage");
    if (f.state === "dash" || rushing) {
      for (let i = 0; i < 4; i++) emit(G, { x: c.x - f.face * Math.random() * 0.6, y: c.y + (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 1.2, vx: -f.face * (8 + Math.random() * 6), life: 0.18, size: 0.09, col: f.sp && f.sp.kind === "rage" ? "#ff7a4a" : tc.hi, drag: 6, alpha: 0.7 });
      if (f.y <= 0 && Math.random() < 0.6) emit(Sm, { x: feet, y: 0.2, z: (Math.random() - 0.5) * 0.8, vx: -f.face * 2, vy: 0.8, life: 0.6, size: 0.5, size1: 1.2, col: "#8a7fa0", alpha: 0.5 });
    }
    // trails on the striking limb while a move is active
    const m = f.state === "attack" && f.move ? f.ms[f.move] : f.state === "jump" && f.move ? f.ms[f.move] : null;
    if (m && !m.proj && f.mt >= m.su * 0.6 && f.mt < m.su + (m.air ? 0.3 : m.ac) + 0.04 && F.hitstop <= 0) {
      const tip = { x: wx(f.x + f.face * m.reach * Math.min(1, f.mt / m.su)), y: (f.y + m.h) / 10 };
      for (let i = 0; i < 3; i++) emit(G, { x: tip.x - f.face * Math.random() * 0.8, y: tip.y + (Math.random() - 0.5) * 0.5, z: 0.4 + (Math.random() - 0.5) * 0.5, vx: -f.face * 2, life: 0.16, size: m.dmg >= 12 ? 0.3 : 0.2, size1: 0.03, col: m.launch ? "#ffe9a8" : tc.hi, drag: 3, alpha: 0.55 });
    }
    if (f.state === "special" && f.sp && f.sp.kind === "leap") {
      const a = performance.now() / 60;
      for (let i = 0; i < 3; i++) { const an = a + i * 2.1; emit(G, { x: c.x + Math.cos(an) * 1.1, y: c.y + (Math.random() - 0.5) * 2, z: Math.sin(an) * 1.1, vx: -Math.sin(an) * 3, vz: Math.cos(an) * 3, vy: f.sp.phase === "rise" ? -3 : 3, life: 0.3, size: 0.1, col: "#dff4ff", drag: 1, alpha: 0.7 }); }
    }
    if (f.state === "special" && f.sp && f.sp.kind === "beam" && f.mt < 0.16) emit(G, { x: wx(f.x + f.face * 20) + (Math.random() - 0.5), y: 4.6 + (Math.random() - 0.5), z: 0.3, life: 0.15, size: 0.12, col: tc.hi });
    if (f.state === "special" && f.sp && f.sp.kind === "quake" && f.mt < 0.26) for (let i = 0; i < 2; i++) emit(G, { x: c.x + (Math.random() - 0.5) * 2, y: 0.2, z: (Math.random() - 0.5), vy: 2 + Math.random() * 3, life: 0.4, size: 0.12, col: "#ffb050", alpha: 0.8 });
    if (mdl.extra.orb && Math.random() < 0.35) { const p = new THREE.Vector3(); mdl.extra.orb.getWorldPosition(p); emit(G, { x: p.x, y: p.y, z: p.z, vy: 0.8, vx: (Math.random() - 0.5) * 0.4, life: 0.5, size: 0.1, col: tc.hi, alpha: 0.7 }); }
    if (mdl.extra.tipGem && Math.random() < 0.2) { const p = new THREE.Vector3(); mdl.extra.tipGem.getWorldPosition(p); emit(G, { x: p.x, y: p.y, z: p.z, vy: 0.6, life: 0.4, size: 0.08, col: tc.hi, alpha: 0.6 }); }
  }
  R3.tileT += dt;
  for (const p of F.proj) {
    const tc = TEAM[p.owner.color], x = wx(p.x), y = p.h / 10;
    if (p.kind === "wave") {
      if (R3.tileT > 0.06) floorTile(x + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 2, 0);
      emit(Sm, { x, y: 0.2, z: (Math.random() - 0.5), vy: 1, vx: -Math.sign(p.vx) * 1, life: 0.6, size: 0.5, size1: 1.2, col: "#8a7fa0", alpha: 0.5 });
      emit(G, { x, y: 0.3 + Math.random(), z: (Math.random() - 0.5), vy: 3, life: 0.3, size: 0.12, col: "#ffb050" });
    } else for (let i = 0; i < (p.kind === "beam" ? 4 : 2); i++) emit(G, { x: x - Math.sign(p.vx) * Math.random() * (p.kind === "beam" ? 2.6 : 0.6), y: y + (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), life: 0.3, size: p.kind === "beam" ? 0.22 : 0.14, col: tc.mid, drag: 2 });
  }
  if (R3.tileT > 0.06) R3.tileT = 0;
  for (const b of R3.braziers) {
    if (Math.random() < 0.8) emit(G, { x: b.x + (Math.random() - 0.5) * 0.9, y: b.y, z: b.z + (Math.random() - 0.5) * 0.9, vy: 2 + Math.random() * 1.5, vx: (Math.random() - 0.5) * 0.3, life: 0.6, size: 0.42, size1: 0.06, col: "#ffc060", col2: "#ff3a10", drag: 0.5, alpha: 0.85 });
    b.L.intensity = 1 + Math.sin(performance.now() / 70 + b.x) * 0.15 + Math.random() * 0.15;
  }
  if (Math.random() < 0.15) emit(Sm, { x: (Math.random() - 0.5) * 30, y: 1 + Math.random() * 10, z: -4 - Math.random() * 6, vx: 0.2, vy: 0.1, life: 4, size: 0.08, col: "#cfc0ff", drag: 0, alpha: 0.6 });
}

/* ---------- camera: a director that cuts between shots ---------- */
function directCamera(F, rdt, time) {
  const a = F.f.w, b = F.f.b, ax = wx(a.x), bx = wx(b.x), mid = (ax + bx) / 2, sep = Math.abs(ax - bx);
  const wide = Math.max(1, 1.62 / R3.camera.aspect);
  const top = R3.models.reduce((v, m) => Math.max(v, m.f.y + (m.view ? Math.max(0, m.view.dy) : 0)), 0); // highest fighter: lift and pull back so jumps stay in frame
  const s = { shot: "fight", lx: mid, ly: 3.3 + top / 17, dist: (clamp(12.5 + sep * 0.66, 16, 27) + top * 0.17 + Math.max(0, top - 80) * 0.14) * wide, yaw: -mid / 17 * 0.1 + Math.sin(time * 0.31) * 0.02, pitch: 0.035, k: 0.12 };
  const solo = (f, d, yaw, pitch, ly) => { const m = R3.models.find(mm => mm.f === f), dy = m ? m.view.dy : 0, dx = m ? m.view.dx * f.face : 0; s.lx = wx(f.x + dx) + f.face * 0.4; s.ly = (ly || 3.7) + (f.y + dy * 0.8) / 10; s.dist = d * Math.max(1, wide * 0.8); s.yaw = yaw; s.pitch = pitch; };
  if (F.phase === "intro") {
    const I = F.intro, t = F.phaseT;
    if (t < I.tD) { const u = sat((t - I.tA) / (I.tD - I.tA)); s.shot = "introA"; solo(F.att, 15.6 - u * 2.2, F.att.face * (0.62 - u * 0.14), -0.03); s.k = 0.2; }
    else if (t < I.tWide) { const u = sat((t - I.tD) / (I.tWide - I.tD)); s.shot = "introD"; solo(F.def, 15.6 - u * 2.2, F.def.face * (0.62 - u * 0.14), -0.03); s.k = 0.2; }
    else { const u = sat((t - I.tWide) / (I.end - I.tWide)); s.shot = "introW"; s.dist += 5 * (1 - eOut(u)); s.yaw += 0.22 * (1 - eOut(u)); s.k = 0.3; }
  } else if (F.cine && F.cine.kind === "rage") {
    const c = F.cine, i = c.i, at = c.f, d = at.face;
    s.shot = "rage" + Math.min(i, 4); s.lx = (wx(at.x) + wx(c.o.x)) / 2; s.ly = 3.7; s.k = 0.2;
    const shots = [[12.5, 0.55, -0.02], [11.5, -0.5, 0.02], [12.5, 0.35, 0.1], [11, -0.3, -0.04], [15, 0.7, -0.05], [17, 0.2, 0.0]];
    const sh = shots[Math.min(i, 5)]; s.dist = sh[0] * Math.max(1, wide * 0.8); s.yaw = sh[1] * d + (c.t - (i ? c.ticks[i - 1] : 0)) * 0.25 * d; s.pitch = sh[2];
  } else if (F.cine) {
    const c = F.cine; s.shot = "sp"; solo(c.f, c.rage ? 12.5 : 15, (c.f.face > 0 ? 0.45 : -0.45) + (c.rage ? c.t * 0.5 * c.f.face : 0), c.rage ? -0.03 : 0.02, 3.5); s.k = c.rage ? 0.3 : 0.24;
  } else if (F.phase === "outro") {
    const r = F.result, w = r.attackerWon ? F.att : F.def, l = r.attackerWon ? F.def : F.att, t = F.outroT;
    if (t < F.outro.tWin) { s.shot = "ko"; s.lx = wx(l.x) * 0.8 + wx(w.x) * 0.2; s.ly = Math.max(2.4, (l.y + 20) / 10); s.dist = (17.5 - Math.min(2.5, t * 1.6)) * wide; s.yaw = (0.12 + t * 0.14) * (l.face > 0 ? -1 : 1); s.k = 0.2; }
    else { const u = t - F.outro.tWin; s.shot = "win"; solo(w, 14.6 - Math.min(1.5, u * 0.8), w.face * (0.5 - Math.min(0.2, u * 0.1)), -0.05, 3.6); s.k = 0.2; }
  }
  const tx = s.lx + Math.sin(s.yaw) * s.dist, tz = Math.cos(s.yaw) * s.dist, ty = Math.max(0.6, s.ly + 0.1 + s.dist * s.pitch), C = R3.cam;
  if (R3.shot !== s.shot && !(s.shot === "fight" && (R3.shot === "introW" || R3.shot === "sp")) && s.shot !== "sp") { C.x = tx; C.y = ty; C.z = tz; C.lx = s.lx; C.ly = s.ly; }
  R3.shot = s.shot;
  const k = 1 - Math.pow(1 - s.k, rdt * 60), kl = 1 - Math.pow(1 - Math.max(s.k, 0.15), rdt * 60);
  C.x += (tx - C.x) * k; C.y += (ty - C.y) * k; C.z += (tz - C.z) * k; C.lx += (s.lx - C.lx) * kl; C.ly += (s.ly - C.ly) * kl;
  R3.shake = Math.max(0, R3.shake - rdt); R3.punch *= Math.exp(-rdt * 7);
  const sh = R3.shake > 0 ? Math.min(0.6, R3.shake * 1.6) * (R3.calm ? 0.2 : 1) : 0, pz = 1 - Math.min(0.12, R3.punch * 0.035);
  R3.camera.position.set(C.lx + (C.x - C.lx) * pz + (Math.random() - 0.5) * sh, C.y + (Math.random() - 0.5) * sh, C.z * pz);
  R3.camera.lookAt(C.lx, C.ly, 0);
  if (R3.dbgCam) { R3.camera.position.set(...R3.dbgCam.p); R3.camera.lookAt(...R3.dbgCam.l); }
}

/* ---------- frame ---------- */
function draw3D(F) {
  const now = performance.now(), rdt = Math.min(0.05, (now - R3.last) / 1000); R3.last = now;
  const frozen = F.cine && F.cine.kind === "freeze";
  const fdt = rdt * (frozen ? 0.5 : F.phase === "outro" && F.slow > 0 ? 0.3 : 1);
  R3.time += fdt; const time = R3.time;
  // quality step-down: if the fight runs under ~38 fps for a while, drop resolution first, then bloom and shadows
  if (F.phase === "fight" && !F.cine && !navigator.webdriver) { const Q = R3.q || (R3.q = { n: 0, acc: 0, lvl: 0 }); const gap = now - (Q.prev || now); Q.prev = now; if (gap < 250) { Q.n++; Q.acc += gap; } else { Q.n = 0; Q.acc = 0; }
    if (Q.n >= 80) { if (Q.acc / Q.n > 26 && Q.lvl < 2) { Q.lvl++; if (Q.lvl === 1) { R3.qScale = 0.67; resize3D(); } else { if (R3.bloom) R3.bloom.enabled = false; R3.renderer.shadowMap.enabled = false; R3.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); } } Q.n = 0; Q.acc = 0; } }
  else if (R3.q) R3.q.prev = 0;
  for (const e of F.events) handleEvent(F, e);
  for (const m of R3.models) {
    const f = m.f;
    let P, k;
    if (F.phase === "intro") { P = introPose(f, F.phaseT - m.introAt, n => introFx(F, m, n)); k = 1; }
    else {
      P = fighterPose(f, F, time);
      const fast = f.state === "attack" || f.state === "special" || f.state === "hit" || f.state === "dash" || f.state === "throw" || f.state === "thrown" || !!f.move || (F.cine && F.cine.kind === "rage");
      k = 1 - Math.exp(-(fast ? 40 : 15) * fdt);
    }
    // body rotation and offsets blend too (shortest way round), so a launch tips over instead of snapping flat
    const slowRot = f.state === "fall" || f.state === "down" || f.state === "ko" || f.state === "lose";
    const kb = F.phase === "intro" || P.hide || m.view.hide ? 1 : 1 - Math.exp(-(slowRot ? 13 : 46) * fdt);
    const ang = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return Math.abs(d) < 1e-4 ? b : a + d * kb; };
    const o = m.view, Vw = poseMix(o, P, k); Vw.rz = ang(o.rz, P.rz); Vw.ry = ang(o.ry, P.ry); Vw.dx = o.dx + (P.dx - o.dx) * kb; Vw.dy = o.dy + (P.dy - o.dy) * kb; Vw.sd = P.sd; Vw.hide = P.hide; m.view = Vw;
    poseRig(m, Vw, time, fdt);
  }
  R3.models.forEach((m, i) => { const b = R3.blobs[i], f = m.f, k = Math.max(0.25, 1 - (f.y + m.view.dy) / 110); b.visible = m.root.visible; b.position.x = wx(f.x + f.face * m.view.dx); b.position.z = f.z / 10; b.scale.set(3.6 * k, 2.4 * k, 1); b.material.opacity = 0.75 * k; });
  const live = new Set();
  for (const p of F.proj) {
    live.add(p);
    let m = R3.proj.get(p); if (!m) { m = projMesh(p); R3.proj.set(p, m); }
    m.position.set(wx(p.x), p.kind === "wave" ? 0 : p.h / 10, 0);
    if (p.kind === "wave") m.scale.y = 0.85 + Math.abs(Math.sin(time * 22)) * 0.3;
    else if (p.kind === "bolt") { m.rotation.z = Math.atan2(p.vh, p.vx); m.rotation.x = time * 10; }
    else if (m.userData.ring) { const k = (time * 3) % 1; m.userData.ring.position.x = -Math.sign(p.vx) * k * 2; m.userData.ring.scale.setScalar(1 + k); }
  }
  for (const [p, m] of R3.proj) if (!live.has(p)) {
    m.traverse(c => { if (c.isMesh) { if (!c.geometry.userData.shared && c.geometry !== G3.sph) c.geometry.dispose(); c.material.dispose(); } });
    burst(R3.glow, m.position.x, m.position.y, 0, 14, { spd: [2, 6], life: [0.15, 0.3], size: [0.1, 0.2], col: TEAM[p.owner.color].hi, drag: 4 });
    R3.scene.remove(m); R3.proj.delete(p);
  }
  continuousFx(F, fdt);
  stepParticles(R3.glow, fdt); stepParticles(R3.smoke, fdt); stepDebris(fdt);
  for (const [i, b] of R3.banners.entries()) b.rotation.y = Math.sin(now / 900 + i) * 0.08;
  directCamera(F, rdt, time);

  const P = R3.post, ease = (cur, tgt, r) => cur + (tgt - cur) * Math.min(1, rdt * r);
  const rageCine = F.cine && F.cine.kind === "rage";
  P.dark = ease(P.dark, F.cine ? (F.cine.rage ? (rageCine ? 0.55 : 1) : 0.7) : F.phase === "intro" && F.phaseT < F.intro.tWide ? 0.35 : 0, 14);
  P.tint = ease(P.tint, (F.cine && F.cine.rage) ? (rageCine ? 0.3 : 0.55) : 0, 10);
  P.desat = ease(P.desat, F.phase === "outro" && F.slow > 0 ? 0.5 : 0, 6);
  if (R3.composer) {
    const u = R3.grade.uniforms; u.uDark.value = P.dark; u.uTint.value = P.tint; u.uDesat.value = P.desat; u.uTime.value = now / 1000;
    R3.bloom.strength = 0.5 + P.dark * 0.35;
    R3.composer.render(rdt);
  } else R3.renderer.render(R3.scene, R3.camera);
}
