/* =====================================================================
   3D chess board (Three.js). Marble tiles in a lacquered, gold-inlaid frame,
   Staunton pieces, HP bars, animated moves, a clash before each duel and a
   shatter when a piece is lost. The button grid stays underneath for
   keyboard and screen-reader play; the 2D board is the fallback.
   ===================================================================== */
function initBoard3D() {
  if (B3) return B3.ok;
  B3 = { ok: false };
  if (!window.THREE) return false;
  try {
    const T = THREE;
    const frame = boardEl.parentElement;
    const cvs = document.createElement("canvas"); cvs.id = "board3d"; cvs.setAttribute("aria-hidden", "true");
    frame.insertBefore(cvs, boardEl);
    const renderer = new T.WebGLRenderer({ canvas: cvs, antialias: true, alpha: false });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    const scene = new T.Scene();
    scene.background = canvasTex(512, 512, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h * 0.42, 10, w / 2, h / 2, w * 0.75);
      gr.addColorStop(0, "#2a2050"); gr.addColorStop(0.55, "#120d26"); gr.addColorStop(1, "#06040d");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
    try {
      const pm = new T.PMREMGenerator(renderer), es = new T.Scene();
      es.add(new T.Mesh(new T.BoxGeometry(40, 20, 40), new T.MeshBasicMaterial({ color: 0x1a1430, side: T.BackSide })));
      const panel = (c, x, y, z, w, h) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
      panel(0xfff0d0, -6, 9, 8, 12, 6); panel(0x7f9cff, 12, 4, -6, 8, 8); panel(0xffb050, -12, 2, -8, 6, 3); panel(0xffffff, 0, 9.5, 0, 14, 6);
      scene.environment = pm.fromScene(es, 0.04).texture; pm.dispose();
    } catch (e) { /* reflections are optional */ }
    scene.add(new T.HemisphereLight(0xc8c0f0, 0x1a1428, 0.35));
    const key = new T.SpotLight(0xfff0dc, 1.6, 40, 0.55, 0.6, 1.2); key.position.set(-4, 14, 6); key.target.position.set(0, 0, 0);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.camera.near = 4; key.shadow.camera.far = 30;
    scene.add(key, key.target);
    const rim = new T.DirectionalLight(0xe8b04a, 0.7); rim.position.set(8, 5, -8); scene.add(rim);
    const cool = new T.DirectionalLight(0x7f8cff, 0.45); cool.position.set(-8, 4, -6); scene.add(cool);
    const fxLight = new T.PointLight(0xffd8a0, 0, 6, 2); scene.add(fxLight);

    // frame, inlay, plinth
    const lacq = new T.MeshPhysicalMaterial({ color: 0x120c1c, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.45 });
    const gold = new T.MeshStandardMaterial({ color: 0xe6b450, metalness: 1, roughness: 0.22 });
    const box = (w, h, d, mat, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
    box(10.4, 0.5, 10.4, lacq, 0, -0.27, 0);
    box(11, 0.35, 11, lacq, 0, -0.62, 0);
    for (const [w, d, x, z] of [[8.3, 0.08, 0, 4.13], [8.3, 0.08, 0, -4.13], [0.08, 8.3, 4.13, 0], [0.08, 8.3, -4.13, 0]]) box(w, 0.04, d, gold, x, 0.0, z);
    for (const [w, d, x, z] of [[10.45, 0.06, 0, 5.2], [10.45, 0.06, 0, -5.2], [0.06, 10.45, 5.2, 0], [0.06, 10.45, -5.2, 0]]) box(w, 0.06, d, gold, x, -0.03, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const g = new T.Mesh(new T.SphereGeometry(0.16, 16, 10), gold); g.position.set(sx * 4.66, 0.02, sz * 4.66); scene.add(g); }
    const coordPlane = new T.Mesh(new T.PlaneGeometry(10.4, 10.4), new T.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    coordPlane.rotation.x = -Math.PI / 2; coordPlane.position.y = -0.015; scene.add(coordPlane);

    // tiles
    const tileL = new T.MeshPhysicalMaterial({ color: 0xa8b4c4, map: marble("#b4bfcc", "#7c8a9e", 31), roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2 });
    const tileD = new T.MeshPhysicalMaterial({ color: 0xb0a0c8, map: marble("#5a4c7c", "#8a7ab0", 37), roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    tileL.map.repeat.set(0.5, 0.5); tileD.map.repeat.set(0.5, 0.5);
    const tileGeo = new T.BoxGeometry(0.985, 0.14, 0.985);
    const tiles = [], hl = [], dots = [], rings = [];
    const dotGeo = new T.CylinderGeometry(0.13, 0.13, 0.03, 24), ringGeo = new T.TorusGeometry(0.4, 0.045, 8, 40), hlGeo = new T.PlaneGeometry(0.985, 0.985);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const { x, z } = sqPos(r, c);
      const t = new T.Mesh(tileGeo, (r + c) % 2 ? tileD : tileL);
      t.position.set(x, -0.07, z); t.receiveShadow = true; t.userData.sq = [r, c];
      scene.add(t); tiles.push(t);
      const h = new T.Mesh(hlGeo, new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
      h.rotation.x = -Math.PI / 2; h.position.set(x, 0.004, z); h.visible = false; scene.add(h); hl.push(h);
      const d = new T.Mesh(dotGeo, new T.MeshStandardMaterial({ color: 0x1a1430, emissive: 0xe8b04a, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }));
      d.position.set(x, 0.02, z); d.visible = false; scene.add(d); dots.push(d);
      const g = new T.Mesh(ringGeo, new T.MeshStandardMaterial({ color: 0x220000, emissive: 0xff4a2a, emissiveIntensity: 1.4 }));
      g.rotation.x = -Math.PI / 2; g.position.set(x, 0.03, z); g.visible = false; scene.add(g); rings.push(g);
    }

    // piece materials and geometries
    const pmats = {
      w: new T.MeshPhysicalMaterial({ color: 0xfff8ea, map: marble("#fffaf0", "#c8b898", 41), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.15, emissive: 0x2a2418 }),
      b: new T.MeshPhysicalMaterial({ color: 0x1a1420, map: marble("#18121e", "#3a2c40", 43), roughness: 0.16, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
    };
    const felt = new T.MeshStandardMaterial({ color: 0x2a5a3a, roughness: 1 });
    const outline = { w: new T.MeshBasicMaterial({ color: 0x120c1c, side: T.BackSide }), b: new T.MeshBasicMaterial({ color: 0xf0c060, side: T.BackSide }) };
    const teamGlow = { w: new T.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.75, depthWrite: false, blending: T.AdditiveBlending }),
                       b: new T.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending }) };
    const geos = buildPieceGeos();
    const glow = makeParticles(500, true);
    scene.add(glow.pts);
    Object.assign(B3, { ok: true, T, renderer, scene, camera, cvs, tiles, hl, dots, rings, pmats, gold, felt, geos, outline, teamGlow, coordPlane, fxLight, glow,
      pieces: new Map(), anims: [], frags: [], state: null, orient: null, hover: null, focus: null, shake: 0, last: performance.now(), clash: null });

    // input: tap or click a square, hover shows stats
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    const pick = e => {
      const rc = cvs.getBoundingClientRect();
      ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const objs = [...tiles]; for (const p of B3.pieces.values()) objs.push(p.hit);
      const h = ray.intersectObjects(objs, false)[0];
      return h ? h.object.userData.sq || null : null;
    };
    let down = null;
    cvs.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY }; });
    cvs.addEventListener("pointerup", e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { down = null; return; }
      down = null; const sq = pick(e); if (sq) onSquare(sq[0], sq[1]);
    });
    cvs.addEventListener("pointermove", e => {
      if (e.pointerType === "touch") return;
      const sq = pick(e); const key = sq ? sq.join() : null;
      if (key !== (B3.hover && B3.hover.join())) { B3.hover = sq; cvs.style.cursor = sq ? "pointer" : ""; if (sq) { const p = S.board[sq[0]][sq[1]]; if (p) showStats(p); } paintMarks(); }
    });
    cvs.addEventListener("pointerleave", () => { B3.hover = null; paintMarks(); });
    boardEl.addEventListener("focusin", e => { const b = e.target.closest(".sq"); if (!b) return; const i = squares.indexOf(b); B3.focus = [(i / 8) | 0, i % 8]; paintMarks(); });
    boardEl.addEventListener("focusout", () => { B3.focus = null; paintMarks(); });
    new ResizeObserver(() => sizeBoard3D()).observe(cvs);
    document.body.classList.add("board3d");
    sizeBoard3D();
    requestAnimationFrame(boardLoop);
    return true;
  } catch (e) { console.warn("3D board unavailable, using 2D", e); B3.ok = false; document.body.classList.remove("board3d"); const c = $("board3d"); if (c) c.remove(); return false; }
}
function sqPos(r, c) { return { x: c - 3.5, z: r - 3.5 }; }
function sizeBoard3D() {
  const rc = B3.cvs.getBoundingClientRect(); if (!rc.width) return;
  B3.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  B3.renderer.setSize(rc.width, rc.height, false);
  B3.camera.aspect = rc.width / rc.height; B3.camera.updateProjectionMatrix();
  const ps = rc.height * Math.min(2, window.devicePixelRatio || 1) / (2 * Math.tan(B3.camera.fov * Math.PI / 360));
  B3.glow.mat.uniforms.uScale.value = ps;
  B3.dirty = true;
}
function buildPieceGeos() {
  const T = THREE, base = [[0, 0], [0.37, 0], [0.38, 0.05], [0.34, 0.09], [0.36, 0.12], [0.3, 0.16], [0.25, 0.2]];
  const L = (pts, segs) => { const g = lathe(base.concat(pts), segs || 32); g.computeVertexNormals(); return g; };
  const geos = {
    P: [L([[0.16, 0.32], [0.13, 0.42], [0.23, 0.45], [0.23, 0.48], [0.12, 0.5], [0.16, 0.56], [0.19, 0.64], [0.17, 0.72], [0.1, 0.78], [0, 0.8]])],
    R: [L([[0.24, 0.3], [0.2, 0.62], [0.27, 0.66], [0.29, 0.7], [0.29, 0.86], [0.2, 0.86], [0.2, 0.8], [0, 0.8]], 8)],
    B: [L([[0.15, 0.4], [0.11, 0.62], [0.22, 0.65], [0.22, 0.68], [0.12, 0.7], [0.17, 0.78], [0.19, 0.88], [0.14, 0.98], [0.06, 1.05], [0.07, 1.08], [0.05, 1.11], [0, 1.12]])],
    Q: [L([[0.17, 0.4], [0.12, 0.74], [0.24, 0.77], [0.24, 0.8], [0.14, 0.83], [0.17, 0.92], [0.25, 1.05], [0.2, 1.07], [0.14, 1.06], [0.08, 1.1], [0, 1.12]])],
    K: [L([[0.18, 0.42], [0.13, 0.8], [0.25, 0.83], [0.25, 0.86], [0.15, 0.89], [0.18, 1.0], [0.24, 1.12], [0.16, 1.15], [0, 1.15]])],
    N: [L([[0.26, 0.26], [0.24, 0.3], [0, 0.3]])],
  };
  // knight head: extruded horse profile
  const s = new T.Shape(), pts = [[-0.6,-0.9],[-0.72,0.2],[-0.5,0.85],[-0.2,1.15],[-0.05,1.5],[0.12,1.0],[0.6,0.78],[1.25,0.28],[1.42,-0.05],[1.25,-0.32],[0.62,-0.25],[0.32,-0.55],[0.22,-0.9]];
  s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath();
  const head = new T.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.1, bevelSegments: 3, curveSegments: 6 });
  head.translate(-0.2, 0.9, -0.3); head.scale(0.32, 0.32, 0.38); head.translate(0, 0.02, 0);
  geos.N.push(head);
  return geos;
}
function pieceHeight(t) { return { P: 0.8, R: 0.86, B: 1.12, Q: 1.12, K: 1.36, N: 0.95 }[t]; }
function buildPiece3D(p) {
  const T = THREE, g = new T.Group(), mat = B3.pmats[p.c];
  for (const geo of B3.geos[p.t]) { const m = new T.Mesh(geo, mat); m.castShadow = true; g.add(m); }
  const ol = B3.outline[p.c];
  for (const geo of B3.geos[p.t]) { const o = new T.Mesh(geo, ol); o.scale.set(1.07, 1.03, 1.07); o.position.y = -0.01; g.add(o); }
  const halo = new T.Mesh(new T.RingGeometry(0.33, 0.44, 40), B3.teamGlow[p.c]); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.006; g.add(halo);
  const band = new T.Mesh(new T.TorusGeometry(0.3, 0.025, 8, 32), B3.gold); band.rotation.x = Math.PI / 2; band.position.y = 0.155; g.add(band);
  const felt = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.01, 24), B3.felt); felt.position.y = 0.004; g.add(felt);
  if (p.t === "R") for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, m = new T.Mesh(new T.BoxGeometry(0.12, 0.1, 0.1), mat); m.position.set(Math.cos(a) * 0.245, 0.91, Math.sin(a) * 0.245); m.rotation.y = -a; m.castShadow = true; g.add(m);
  }
  if (p.t === "B") { const sl = new T.Mesh(new T.BoxGeometry(0.03, 0.16, 0.42), new T.MeshStandardMaterial({ color: 0x07050e })); sl.position.set(0.06, 0.93, 0); sl.rotation.z = -0.6; g.add(sl); }
  if (p.t === "Q") for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, m = new T.Mesh(new T.SphereGeometry(0.035, 10, 8), B3.gold); m.position.set(Math.cos(a) * 0.22, 1.08, Math.sin(a) * 0.22); g.add(m); }
  if (p.t === "Q" || p.t === "K") { const c = new T.Mesh(new T.TorusGeometry(0.2, 0.022, 6, 28), B3.gold); c.rotation.x = Math.PI / 2; c.position.y = p.t === "Q" ? 1.04 : 1.1; g.add(c); }
  if (p.t === "Q") { const t = new T.Mesh(new T.SphereGeometry(0.06, 14, 10), B3.gold); t.position.y = 1.15; g.add(t); }
  if (p.t === "K") { const a = new T.Mesh(new T.BoxGeometry(0.06, 0.24, 0.06), B3.gold), b = new T.Mesh(new T.BoxGeometry(0.18, 0.06, 0.06), B3.gold); a.position.y = 1.26; b.position.y = 1.28; a.castShadow = b.castShadow = true; g.add(a, b); }
  if (p.t === "N") for (const i of [1, 3]) g.children[i].rotation.y = (p.c === "w" ? 1 : -1) * (Math.PI / 2 - 0.75); // angled so the horse profile reads from the player's seat
  // invisible pick cylinder, HP bar
  const hit = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.7, 10), new T.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.35; g.add(hit);
  let bar = null;
  if (p.t !== "K") {
    bar = new T.Group(); bar.position.y = pieceHeight(p.t) + 0.2;
    const bg = new T.Mesh(new T.PlaneGeometry(0.62, 0.09), new T.MeshBasicMaterial({ color: 0x0b0818, transparent: true, opacity: 0.85, depthWrite: false }));
    const fgGeo = new T.PlaneGeometry(0.56, 0.05); fgGeo.translate(0.28, 0, 0);
    const fg = new T.Mesh(fgGeo, new T.MeshBasicMaterial({ color: 0x5fd39a })); fg.position.set(-0.28, 0, 0.001);
    bar.add(bg, fg); bar.userData.fg = fg; bar.renderOrder = 5; bg.renderOrder = 5; fg.renderOrder = 6; g.add(bar);
  }
  B3.scene.add(g);
  return { g, hit, bar, t: p.t, c: p.c, hpShown: -1, lift: 0 };
}
function setHit(rec, r, c) { rec.hit.userData.sq = [r, c]; }
function updateBar(rec, p) {
  if (!rec.bar) return;
  const f = Math.max(0, p.hp / STATS[p.t].hp);
  if (f === rec.hpShown) return;
  rec.hpShown = f; rec.bar.visible = f < 1;
  const fg = rec.bar.userData.fg; fg.scale.x = Math.max(0.03, f);
  fg.material.color.set(f > 0.6 ? 0x5fd39a : f > 0.3 ? 0xe8b04a : 0xe2574c);
}
function setCoordLabels() {
  const human = CONFIG.human;
  if (B3.orient === human) return;
  B3.orient = human;
  const tex = canvasTex(1024, 1024, (g, w) => {
    g.clearRect(0, 0, w, w);
    g.fillStyle = "#e8c26a"; g.font = "bold 34px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
    const px = v => (v / 10.4 + 0.5) * w, flip = human === "b";
    const put = (txt, x, z) => { g.save(); g.translate(px(x), px(z)); if (flip) g.rotate(Math.PI); g.fillText(txt, 0, 0); g.restore(); };
    for (let c = 0; c < 8; c++) { const { x } = sqPos(0, c); put(FILES[c], x, flip ? -4.62 : 4.62); }
    for (let r = 0; r < 8; r++) { const { z } = sqPos(r, 0); put(String(8 - r), flip ? 4.62 : -4.62, z); }
  });
  B3.coordPlane.material.map = tex; B3.coordPlane.material.needsUpdate = true;
  const side = human === "b" ? -1 : 1;
  B3.side = side; B3.focus = B3.focus || { k: 0, to: 0, x: 0, z: 0 };
  placeBoardCam(0, 0);
  B3.dirty = true;
}
// The board camera can push in on one square (k: 0 = whole board, 1 = tight on the square) for duel transitions
function placeBoardCam(sx, sy) {
  const f = B3.focus, side = B3.side, k = f.k * f.k * (3 - 2 * f.k), L = (a, b) => a + (b - a) * k;
  B3.camera.position.set(L(0, f.x + 1.6 * side) + sx, L(13.2, 2.9) + sy, L(10.8 * side, f.z + 5.4 * side));
  B3.camera.lookAt(L(0, f.x), L(-0.3, 0.55), L(0.45 * side, f.z));
}
function boardFocus(sq, to, snap) {
  if (!B3 || !B3.ok || !B3.focus) return;
  if (sq) { const p = sqPos(sq.r, sq.c); B3.focus.x = p.x; B3.focus.z = p.z; }
  B3.focus.to = to; if (snap) B3.focus.k = to; B3.dirty = true;
}
function paintMarks() {
  if (!B3 || !B3.ok || !S) return;
  const B = S.board, checkSq = !S.over && inCheck(B, S.turn) ? findKing(B, S.turn) : null;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const i = r * 8 + c, h = B3.hl[i], tgt = targets.find(m => m.tr === r && m.tc === c);
    let col = null, op = 0;
    if (S.last && ((S.last.fr === r && S.last.fc === c) || (S.last.tr === r && S.last.tc === c))) { col = 0xe8b04a; op = 0.22; }
    if (B3.hover && B3.hover[0] === r && B3.hover[1] === c) { col = 0xffffff; op = 0.18; }
    if (B3.focus && B3.focus[0] === r && B3.focus[1] === c) { col = 0x9fd3ff; op = 0.45; }
    if (selected && selected[0] === r && selected[1] === c) { col = 0xe8b04a; op = 0.55; }
    if (checkSq && checkSq[0] === r && checkSq[1] === c) { col = 0xff3a2a; op = 0.7; }
    h.visible = !!col; if (col) { h.material.color.setHex(col); h.material.opacity = op; }
    B3.dots[i].visible = !!tgt && !tgt.cap;
    const ring = B3.rings[i]; ring.visible = !!tgt && !!tgt.cap;
    if (ring.visible) ring.material.emissive.setHex(B[tgt.fr][tgt.fc].t === "K" ? 0xe8b04a : 0xff4a2a);
    ring.userData.risky = ring.visible && riskyCapture(tgt);
  }
  B3.check = checkSq;
  B3.dirty = true;
}
// Bring the 3D pieces in line with the game state, animating what moved
function syncBoard3D() {
  if (!B3 || !B3.ok) return;
  setCoordLabels();
  const fresh = B3.state !== S;
  if (fresh) { for (const rec of B3.pieces.values()) B3.scene.remove(rec.g); B3.pieces.clear(); B3.anims = []; B3.state = S; }
  const seen = new Set();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = S.board[r][c]; if (!p) continue;
    seen.add(p.id);
    let rec = B3.pieces.get(p.id);
    if (rec && rec.t !== p.t) { // promotion
      const old = rec; B3.scene.remove(old.g); rec = buildPiece3D(p); rec.g.position.copy(old.g.position); B3.pieces.set(p.id, rec);
      sparkle(rec.g.position, 0xffe9a8, 40);
    }
    const { x, z } = sqPos(r, c);
    if (!rec) {
      rec = buildPiece3D(p); rec.g.position.set(x, 0, z); B3.pieces.set(p.id, rec);
      if (p.t === "N") rec.g.children[1].rotation.y = p.c === "w" ? (c < 4 ? 0.5 : Math.PI - 0.5) : (c < 4 ? -0.5 : Math.PI + 0.5);
    }
    else if (Math.abs(rec.g.position.x - x) > 0.01 || Math.abs(rec.g.position.z - z) > 0.01) {
      B3.anims = B3.anims.filter(a => a.rec !== rec);
      const from = rec.g.position.clone(), d = Math.hypot(x - from.x, z - from.z);
      B3.anims.push({ rec, from, to: new THREE.Vector3(x, 0, z), t: 0, dur: 0.28 + Math.min(0.3, d * 0.05), arc: p.t === "N" ? 0.9 : 0.12 + d * 0.02 });
    }
    setHit(rec, r, c); updateBar(rec, p);
    const h = S.healed.find(e => e.id === p.id);
    if (h && !rec.healedAt) { rec.healedAt = performance.now(); sparkle(new THREE.Vector3(x, 0.3, z), 0x5fd39a, 26, true); }
    if (!h) rec.healedAt = 0;
  }
  for (const [id, rec] of B3.pieces) if (!seen.has(id)) { shatterPiece(rec); B3.pieces.delete(id); }
  paintMarks();
}
function sparkle(pos, col, n, rise) {
  const c = "#" + new THREE.Color(col).getHexString();
  burst(B3.glow, pos.x, pos.y + 0.4, pos.z, n, { spd: rise ? [0.3, 1.2] : [1, 4], life: [0.5, 1.1], size: [0.06, 0.14], col: [c, "#ffffff"], drag: 2, grav: rise ? 1.5 : -2, flatZ: 1, jit: 0.5 });
  B3.dirty = true;
}
function shatterPiece(rec) {
  const T = THREE, pos = rec.g.position.clone(), mat = B3.pmats[rec.c];
  B3.scene.remove(rec.g);
  for (let i = 0; i < 26; i++) {
    const m = new T.Mesh(G3.shards ? G3.shards[i % 3] : new T.TetrahedronGeometry(1), mat); m.castShadow = true;
    const sc = 0.04 + Math.random() * 0.07; m.scale.setScalar(sc);
    m.position.set(pos.x + (Math.random() - 0.5) * 0.4, 0.1 + Math.random() * pieceHeight(rec.t), pos.z + (Math.random() - 0.5) * 0.4);
    B3.scene.add(m);
    const a = Math.random() * 6.28, sp = 1 + Math.random() * 2.5;
    B3.frags.push({ m, vx: Math.cos(a) * sp, vy: 2 + Math.random() * 3, vz: Math.sin(a) * sp, ax: Math.random() * 10, az: Math.random() * 10, r: sc, life: 0 });
  }
  burst(B3.glow, pos.x, 0.5, pos.z, 40, { spd: [1, 4], life: [0.3, 0.8], size: [0.06, 0.16], col: rec.c === "w" ? ["#bfe8ff", "#ffffff"] : ["#ffc24a", "#ffffff"], drag: 2.5, grav: -3, flatZ: 1 });
  B3.fxLight.position.set(pos.x, 1, pos.z); B3.fxLight.color.set(rec.c === "w" ? 0xbfe8ff : 0xffc24a); B3.fxLight.intensity = 3;
}
// Attacker lunges at the defender, sparks fly, then the duel opens
function clash3D(m, then) {
  if (!B3 || !B3.ok || document.hidden) { then(); return; }
  const a = S.board[m.fr][m.fc], rec = a && B3.pieces.get(a.id);
  if (!rec) { then(); return; }
  const to = sqPos(m.cap.r, m.cap.c), from = rec.g.position.clone();
  const dest = new THREE.Vector3(from.x + (to.x - from.x) * 0.62, 0, from.z + (to.z - from.z) * 0.62);
  B3.anims.push({ rec, from, to: dest, t: 0, dur: 0.32, arc: a.t === "N" ? 0.8 : 0.35, done: () => {
    const p = new THREE.Vector3((dest.x + to.x) / 2, 0.55, (dest.z + to.z) / 2);
    burst(B3.glow, p.x, p.y, p.z, 60, { spd: [2, 6], life: [0.25, 0.6], size: [0.06, 0.18], col: ["#ffe9a8", "#ffffff", "#ff8a4a"], drag: 3, grav: -4, flatZ: 1 });
    B3.fxLight.position.set(p.x, 1.2, p.z); B3.fxLight.color.set(0xffd8a0); B3.fxLight.intensity = 4; B3.shake = 0.25;
    duelSfx("clang"); setTimeout(then, 420);
  } });
}
function boardLoop(now) {
  requestAnimationFrame(boardLoop);
  if (!B3.ok || fight || document.hidden) { B3.last = now; return; }
  const dt = Math.min(0.05, (now - B3.last) / 1000); B3.last = now;
  let active = B3.anims.length || B3.frags.length || B3.glow.list.length || B3.fxLight.intensity > 0.02 || B3.shake > 0 || selected || B3.check || B3.focus.k !== B3.focus.to;
  if (!active && !B3.dirty) return;
  B3.dirty = false;
  for (const a of B3.anims) {
    a.t += dt; const k = Math.min(1, a.t / a.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    a.rec.g.position.lerpVectors(a.from, a.to, e); a.rec.g.position.y = Math.sin(Math.PI * k) * a.arc;
    if (k >= 1) { a.rec.g.position.y = 0; a.fin = true; if (a.done) a.done(); }
  }
  B3.anims = B3.anims.filter(a => !a.fin);
  // selected piece floats; HP bars face the camera
  for (const [id, rec] of B3.pieces) {
    const sel = selected && rec.hit.userData.sq && rec.hit.userData.sq[0] === selected[0] && rec.hit.userData.sq[1] === selected[1];
    rec.lift += ((sel ? 0.16 + Math.sin(now / 260) * 0.04 : 0) - rec.lift) * Math.min(1, dt * 12);
    if (!B3.anims.some(a => a.rec === rec)) rec.g.position.y = rec.lift;
    if (rec.bar) rec.bar.quaternion.copy(B3.camera.quaternion);
  }
  for (const r of B3.rings) if (r.visible) {
    if (r.userData.risky) { const k = Math.sin(now / 110) > 0; r.scale.setScalar(k ? 1.12 : 0.95); r.material.emissive.setHex(k ? 0xffffff : 0xff2a10); r.material.emissiveIntensity = 2; }
    else r.scale.setScalar(1 + Math.sin(now / 220) * 0.05);
  }
  if (B3.check) { const h = B3.hl[B3.check[0] * 8 + B3.check[1]]; h.material.opacity = 0.45 + Math.sin(now / 180) * 0.25; }
  for (const f of B3.frags) {
    f.life += dt; f.vy -= 14 * dt; f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
    f.m.rotation.x += f.ax * dt; f.m.rotation.z += f.az * dt;
    if (f.m.position.y < f.r) { f.m.position.y = f.r; f.vy *= -0.3; f.vx *= 0.5; f.vz *= 0.5; f.ax *= 0.5; f.az *= 0.5; }
    if (f.life > 1.6) f.m.scale.multiplyScalar(0.9);
  }
  B3.frags = B3.frags.filter(f => { if (f.life > 2.2) { B3.scene.remove(f.m); return false; } return true; });
  stepParticles(B3.glow, dt);
  B3.fxLight.intensity *= Math.exp(-dt * 6);
  const fo = B3.focus;
  if (fo.k !== fo.to) { const d = fo.to - fo.k, stp = dt * (d > 0 ? 2.6 : 1.5); fo.k = Math.abs(d) <= stp ? fo.to : fo.k + Math.sign(d) * stp; }
  B3.shake = Math.max(0, B3.shake - dt);
  const sh = B3.shake * 0.25;
  placeBoardCam((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  B3.renderer.render(B3.scene, B3.camera);
}


/* ---------- Player account: quick sign-in, Elo rating, record ---------- */
// Saved to the viewer's own private space on their Claude account when the page runs on claude.ai,
// otherwise in this browser. Several player names can live under one account; one is active.
const CPU_ELO = [1000, 1300, 1600];
const blankStats = name => ({ name, rating: 1200, peak: 1200, wins: 0, losses: 0, draws: 0, streak: 0, best: 0, duelW: 0, duelL: 0, games: 0 });
const ACCT = { store: { active: null, profiles: {} }, ref: null, mode: "local", saving: false, again: false, ready: false, lastDelta: null };
const pkey = n => n.trim().toLowerCase();
const me = () => ACCT.store.active ? ACCT.store.profiles[ACCT.store.active] : null;
function loadLocal() { try { const v = JSON.parse(localStorage.getItem("h2h.accounts") || "null"); if (v && v.profiles) return v; } catch (e) {} return { active: null, profiles: {} }; }
function saveLocal() { try { localStorage.setItem("h2h.accounts", JSON.stringify(ACCT.store)); } catch (e) {} }
async function connectCloud() {
  if (!window.claude || !window.claude.use) return null;
  const timeout = new Promise(r => setTimeout(() => r(null), 10000));
  const go = (async () => {
    const [u, db] = await Promise.all([claude.use("user"), claude.use("db")]);
    if (!u || !db) return null;
    const id = await u.id(); if (!id) return null;
    const ref = db.collection("data/users/" + id).doc("h2h");
    const snap = await ref.get();
    return { ref, data: snap.exists ? snap.data() : null };
  })().catch(() => null);
  return Promise.race([go, timeout]);
}
async function initAccount() {
  ACCT.store = loadLocal(); renderAccount();
  const c = await connectCloud();
  if (c) {
    ACCT.ref = c.ref; ACCT.mode = "cloud";
    if (c.data && c.data.profiles) ACCT.store = { active: c.data.active || null, profiles: c.data.profiles };
    else if (Object.keys(ACCT.store.profiles).length) persist(); // carry this device's profiles up to the account
  }
  ACCT.ready = true; renderAccount();
}
async function persist() {
  saveLocal();
  if (ACCT.mode !== "cloud" || !ACCT.ref) return;
  if (ACCT.saving) { ACCT.again = true; return; }
  ACCT.saving = true;
  try { await ACCT.ref.set(JSON.parse(JSON.stringify(ACCT.store))); }
  catch (e) { ACCT.mode = "local"; console.warn("account sync failed, keeping stats on this device", e); }
  ACCT.saving = false;
  if (ACCT.again) { ACCT.again = false; persist(); }
  renderAccount();
}
function rankName(r) { return r >= 1800 ? "Grandmaster" : r >= 1600 ? "Master" : r >= 1450 ? "Expert" : r >= 1300 ? "Challenger" : r >= 1150 ? "Contender" : "Rookie"; }
function renderAccount() {
  const p = me();
  $("acctOut").hidden = !!p; $("acctIn").hidden = !p;
  if (!p) return;
  $("acctName").textContent = p.name;
  $("acctRating").textContent = p.rating;
  $("acctRank").textContent = `${rankName(p.rating)} · peak ${p.peak} · ${p.games} game${p.games === 1 ? "" : "s"}`;
  $("stW").textContent = p.wins; $("stL").textContent = p.losses; $("stD").textContent = p.draws;
  const st = $("stS"); st.textContent = p.streak > 0 ? `W${p.streak}` : p.streak < 0 ? `L${-p.streak}` : "0";
  st.className = p.streak > 1 ? "hot" : p.streak < -1 ? "cold" : "";
  $("stB").textContent = p.best; $("stDu").textContent = `${p.duelW} / ${p.duelW + p.duelL}`;
  const d = $("acctDelta");
  if (ACCT.lastDelta != null) { d.hidden = false; d.textContent = `Last game ${ACCT.lastDelta >= 0 ? "+" : ""}${ACCT.lastDelta} rating`; d.className = "acct-delta " + (ACCT.lastDelta >= 0 ? "up" : "down"); } else d.hidden = true;
  $("acctWhere").textContent = ACCT.mode === "cloud" ? "Saved to your account." : ACCT.ready ? "Saved in this browser." : "";
}
function recordDuel(won) { const p = me(); if (!p) return; won ? p.duelW++ : p.duelL++; persist(); renderAccount(); }
function recordGame() {
  if (!S.over || S.recorded) return;
  S.recorded = true;
  const p = me(); if (!p) return;
  const human = CONFIG.human, opp = NET.peerName && S.online ? NET.peerRating : CPU_ELO[CONFIG.level] || 1300;
  const score = S.over.winner == null ? 0.5 : S.over.winner === human ? 1 : 0;
  const expected = 1 / (1 + Math.pow(10, (opp - p.rating) / 400));
  const K = p.games < 10 ? 40 : 24;
  const delta = Math.round(K * (score - expected));
  p.rating = Math.max(100, p.rating + delta); p.peak = Math.max(p.peak, p.rating); p.games++;
  if (score === 1) { p.wins++; p.streak = p.streak > 0 ? p.streak + 1 : 1; p.best = Math.max(p.best, p.streak); }
  else if (score === 0) { p.losses++; p.streak = p.streak < 0 ? p.streak - 1 : -1; }
  else { p.draws++; p.streak = 0; }
  ACCT.lastDelta = delta;
  log(`${p.name}: ${score === 1 ? "win" : score === 0 ? "loss" : "draw"} vs ${S.online ? S.online : ["Easy", "Normal", "Hard"][CONFIG.level] + " CPU"}, rating ${delta >= 0 ? "+" : ""}${delta} to ${p.rating}.`, score === 1 ? "heal" : "fight");
  persist(); renderAccount();
}
// small dialog helper: text prompt or confirm
function dialog({ title, text, input, ok, warn }) {
  return new Promise(resolve => {
    const box = $("dlgForm"), inp = $("dlgInput");
    $("dlgTitle").textContent = title; $("dlgText").textContent = text; $("dlgYes").textContent = ok || "OK";
    box.classList.toggle("warn", !!warn); $("dlgYes").className = "btn" + (warn ? " danger" : "");
    inp.hidden = !input; inp.value = input && input.value || "";
    $("dlg").hidden = false; (input ? inp : $("dlgYes")).focus();
    const done = v => { $("dlg").hidden = true; box.onsubmit = null; $("dlgNo").onclick = null; resolve(v); };
    box.onsubmit = e => { e.preventDefault(); if (input) { const v = inp.value.trim(); if (!v) { inp.focus(); return; } done(v); } else done(true); };
    $("dlgNo").onclick = () => done(null);
  });
}
window.addEventListener("keydown", e => { if (e.key === "Escape" && !$("dlg").hidden) $("dlgNo").click(); });
$("signIn").addEventListener("click", async () => {
  const names = Object.values(ACCT.store.profiles).map(p => p.name);
  const name = await dialog({ title: "Quick sign in", text: names.length ? `Enter your player name. Saved players: ${names.join(", ")}.` : "Pick a player name. Your rating and record are saved under it.", input: { value: names[0] || "" }, ok: "Sign in" });
  if (!name) return;
  const k = pkey(name).slice(0, 20);
  if (!ACCT.store.profiles[k]) ACCT.store.profiles[k] = blankStats(name.slice(0, 20));
  ACCT.store.active = k; ACCT.lastDelta = null;
  persist(); renderAccount();
});
$("signOut").addEventListener("click", () => { ACCT.store.active = null; ACCT.lastDelta = null; persist(); renderAccount(); });
$("resetStats").addEventListener("click", async () => {
  const p = me(); if (!p) return;
  const ok = await dialog({ title: "Reset your stats?", text: `This sets ${p.name}'s rating back to 1200 and clears wins, losses, streaks and duel record. It can't be undone.`, ok: "Reset", warn: true });
  if (!ok) return;
  ACCT.store.profiles[ACCT.store.active] = blankStats(p.name); ACCT.lastDelta = null;
  persist(); renderAccount();
});

function showGameOver() {
  const o = S.over, human = CONFIG.human, t = $("goTitle");
  const kind = o.winner == null ? "draw" : o.winner === human ? "win" : "lose";
  t.textContent = kind === "win" ? "VICTORY" : kind === "lose" ? "DEFEAT" : "DRAW";
  t.className = "goTitle " + kind;
  $("goReason").textContent = o.reason;
  const d = $("goDelta"), p = me();
  if (p && ACCT.lastDelta != null) { d.hidden = false; d.textContent = `Rating ${ACCT.lastDelta >= 0 ? "+" : ""}${ACCT.lastDelta}  →  ${p.rating}`; d.className = "goDelta " + (ACCT.lastDelta >= 0 ? "up" : "down"); }
  else if (!p) { d.hidden = false; d.textContent = "Sign in to track your rating."; d.className = "goDelta"; }
  else d.hidden = true;
  setTimeout(() => { $("gameOver").hidden = false; $("goNew").focus(); }, 500);
}
$("goNew").addEventListener("click", () => { $("gameOver").hidden = true; newGame(); });
$("goView").addEventListener("click", () => { $("gameOver").hidden = true; });
window.addEventListener("keydown", e => { if (e.key === "Escape" && !$("gameOver").hidden) $("gameOver").hidden = true; });

/* ---------- Test hook ---------- */
window.__h2h = { NET, get state() { return S; }, get fight() { return fight; }, get B3() { return B3; }, ACCT, render, CONFIG, STATS, onSquare, chooseCpuMove, newGame, startFight, R3, MOVESET, sim: { makeDuel, simStep, startMove, startSpecial, startThrow, startRage, tryStep, tryDash, blankInput } };

/* ---------- Boot ---------- */
function start(data) {
  try { initBoard3D(); } catch (e) { console.warn(e); }
  initAccount();
  if (data && data.S) { S = data.S; nextId = data.nextId || 1000; Object.assign(CONFIG, data.CONFIG || {}, { fightSeconds: 30, healPct: 0.15 }); }
  $("side").value = CONFIG.human; $("level").value = String(CONFIG.level);
  if (data && data.S) { render(); showStats(S.board[7][1]); maybeCpuTurn(); } else newGame();
}
try { document.fonts && document.fonts.load('700 20px "Teko"'); } catch (e) {}
window.claude?.hot?.snapshot?.(() => (fight ? null : { S, nextId, CONFIG: { ...CONFIG } }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
</script>
