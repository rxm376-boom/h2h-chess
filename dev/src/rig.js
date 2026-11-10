/* =====================================================================
   3D fighters (Three.js): armored chess-piece warriors built from shaped
   primitives, posed every frame with two-bone IK from the animation poses.
   ===================================================================== */
const R3 = { ok: false, tried: false };
const wx = x => (x - AR.W / 2) / 10;
const G3 = {};
function lathe(pts, segs, p0, pl) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs || 20, p0 || 0, pl == null ? Math.PI * 2 : pl); }

/* ---------- procedural textures ---------- */
function canvasTex(w, h, paint, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function rng(seed) { let x = seed; return () => (x = (x * 16807) % 2147483647) / 2147483647; }
function marble(base, vein, seed) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.025 * r()})`; g.fillRect(r() * w, r() * h, 6 + r() * 20, 6 + r() * 20); }
    g.strokeStyle = vein; g.lineCap = "round";
    for (let v = 0; v < 9; v++) {
      let x = r() * w, y = r() * h, a = r() * 6.28;
      g.lineWidth = 0.4 + r() * 1.6; g.globalAlpha = 0.25 + r() * 0.5; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 40; k++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * 7; y += Math.sin(a) * 7; g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}
function bricks(base, mortar, glow) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(glow ? 7 : 3);
    g.fillStyle = glow ? "#000" : mortar; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
      const x = col * 64 + (row % 2) * 32 + 3, y = row * 32 + 3;
      if (glow) { g.fillStyle = "#000"; }
      else { const l = 0.85 + r() * 0.3; g.fillStyle = base; g.globalAlpha = 1; g.fillRect(x, y, 58, 26); g.fillStyle = `rgba(${l > 1 ? "255,255,255" : "0,0,0"},${Math.abs(l - 1) * 0.6})`; }
      g.fillRect(x, y, 58, 26);
      if (!glow) for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(0,0,0,${0.08 * r()})`; g.fillRect(x + r() * 50, y + r() * 20, 3 + r() * 8, 2 + r() * 5); }
    }
    if (glow) { g.globalCompositeOperation = "destination-over"; g.fillStyle = mortar; g.fillRect(0, 0, w, h); }
  }, !glow);
}

/* ---------- materials, cached per side ---------- */
function mats3D(color) {
  R3.mats = R3.mats || {};
  if (R3.mats[color]) return R3.mats[color];
  const T = THREE, w = color === "w";
  const M = {
    body: new T.MeshPhysicalMaterial(w
      ? { color: 0xe6dcc6, map: marble("#f4ecd9", "#9a8a6c", 11), roughness: 0.36, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.3, envMapIntensity: 0.7 }
      : { color: 0x39305c, map: marble("#342b54", "#8a74c4", 23), roughness: 0.3, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.16, envMapIntensity: 1 }),
    shade: null,
    armor: new T.MeshStandardMaterial(w
      ? { color: 0xd8dde6, metalness: 0.9, roughness: 0.36, envMapIntensity: 1.15 }
      : { color: 0x565074, metalness: 0.88, roughness: 0.38, envMapIntensity: 1.2 }),
    trim: new T.MeshStandardMaterial({ color: w ? 0xf0c060 : 0xe0a048, metalness: 1, roughness: 0.2, envMapIntensity: 1.4 }),
    cloth: new T.MeshStandardMaterial({ color: w ? 0xa3202f : 0x5a2687, roughness: 0.78, metalness: 0, side: T.DoubleSide }),
    clothIn: new T.MeshStandardMaterial({ color: w ? 0x5e1018 : 0x2c1244, roughness: 0.85, side: T.DoubleSide }),
    robe: new T.MeshStandardMaterial({ color: w ? 0xf2ead8 : 0x221c36, roughness: 0.7, metalness: 0, side: T.DoubleSide }),
    leather: new T.MeshStandardMaterial({ color: w ? 0x4a2f1b : 0x1c1420, roughness: 0.7 }),
    dark: new T.MeshStandardMaterial({ color: 0x07050e, roughness: 0.6 }),
    eye: new T.MeshStandardMaterial({ color: 0x000000, emissive: w ? 0x6fd0ff : 0xffa52a, emissiveIntensity: 3.2 }),
    gem: new T.MeshStandardMaterial({ color: 0x220000, emissive: w ? 0xff3355 : 0x44ff99, emissiveIntensity: 2.4, roughness: 0.1, metalness: 0.2 }),
    glow: new T.MeshStandardMaterial({ color: 0x000000, emissive: w ? 0xbfe8ff : 0xffc24a, emissiveIntensity: 3 }),
    stone: new T.MeshStandardMaterial(w
      ? { color: 0xe9e0cc, map: bricks("#e6dcc4", "#9c8f74"), roughness: 0.85, metalness: 0 }
      : { color: 0x40394f, map: bricks("#3d364c", "#120e1a"), roughness: 0.7, metalness: 0.15, emissive: 0xff5a1a, emissiveIntensity: 1.3, emissiveMap: bricks("#000", "#ff7a2a", true) }),
    hair: new T.MeshStandardMaterial({ color: w ? 0xe8c77a : 0x1a1024, roughness: 0.45, metalness: w ? 0.3 : 0.2, side: T.DoubleSide }),
  };
  M.stone.map.repeat.set(0.5, 0.5); if (M.stone.emissiveMap) M.stone.emissiveMap.repeat.set(0.5, 0.5);
  M.shade = M.body.clone(); M.shade.color.multiplyScalar(w ? 0.84 : 0.72);
  return (R3.mats[color] = M);
}

/* ---------- model ---------- */
// a limb segment: lathe along +y from the joint, profile = [[t along the bone 0..1, radius]]
function tube(profile, len, segs) { return lathe(profile.map(([t, r]) => [Math.max(0.001, r), t * len]), segs || 14); }
function bootGeo(len, h, w) {
  const s = new THREE.Shape();
  s.moveTo(-len * 0.3, 0); s.lineTo(len * 0.62, 0); s.quadraticCurveTo(len * 0.74, 0, len * 0.72, h * 0.4); s.quadraticCurveTo(len * 0.6, h * 0.75, len * 0.18, h * 1.05);
  s.lineTo(len * 0.05, h * 1.9); s.lineTo(-len * 0.3, h * 1.9); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.45, bevelSegments: 2, curveSegments: 5 });
  g.translate(0, -h * 1.15, -w / 2);
  return g;
}
function clothSeg(len, sp0, sp1, w, dir, wEnd) {
  const g = new THREE.BoxGeometry(1, 1, 1), a = g.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), y = a.getY(i), z = a.getZ(i), spread = y > 0 ? sp0 : sp1;
    a.setXYZ(i, (x + 0.5) * spread * dir, (y - 0.5) * len, z * (y > 0 ? w : (wEnd || w)));
  }
  g.computeVertexNormals();
  return g;
}
function makeChain(parent, n, segLen, sp0, sp1, w, mat, hemMat, x, y, z, dir, w1) {
  const list = [];
  let p = parent;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    if (i === 0) g.position.set(x, y, z); else g.position.set(0, -segLen, 0);
    const wi = w + ((w1 || w) - w) * (i / n), wj = w + ((w1 || w) - w) * ((i + 1) / n);
    const m = new THREE.Mesh(clothSeg(segLen * 1.04, sp0 + (sp1 - sp0) * (i / n), sp0 + (sp1 - sp0) * ((i + 1) / n), wi, dir, wj), mat); m.castShadow = true; g.add(m);
    if (i === n - 1 && hemMat) { const hem = new THREE.Mesh(G3.box, hemMat); hem.position.set(dir * sp1 / 2, -segLen, 0); hem.scale.set(sp1 + 0.4, 0.7, (w1 || w) + 0.2); g.add(hem); }
    p.add(g); list.push(g); p = g;
  }
  return list;
}
function buildModel(f) {
  const T = THREE, t = f.t, D = DIM[t], M = mats3D(f.color);
  const root = new T.Group(), piv = new T.Group(), body = new T.Group(); root.add(piv); piv.add(body);
  const mdl = { root, piv, body, f, t, D, M, chains: [], extra: {}, seg: {}, view: poseOver(STANCE[t]), fxT: {} };
  const mesh = (geo, mat, parent, x, y, z, sx, sy, sz) => {
    const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.scale.set(sx ?? 1, sy ?? sx ?? 1, sz ?? sx ?? 1);
    m.castShadow = true; (parent || body).add(m); return m;
  };
  const grp = parent => { const g = new T.Group(); (parent || body).add(g); return g; };
  const ring = (r, th, mat, parent, y, segs) => { const m = mesh(new T.TorusGeometry(r, th, 6, segs || 20), mat, parent, 0, y, 0); m.rotation.x = Math.PI / 2; return m; };
  const ar = { P: 2.9, N: 2.5, B: 2.3, R: 3.4, Q: 2.25 }[t], lr = { P: 3.9, N: 3.5, B: 3.2, R: 4.9, Q: 3.3 }[t];
  const stone = t === "R";
  const S = mdl.seg;

  for (const s of ["l", "r"]) {
    const near = s === "r", skin = stone ? M.stone : near ? M.body : M.shade, zs = near ? 1 : -1;
    // ---- arm ----
    const ua = S[s + "ua"] = grp(), fa = S[s + "fa"] = grp();
    mesh(G3.sph, skin, ua, 0, 0, 0, ar * 1.22);
    mesh(tube([[0, ar * 1.05], [0.22, ar * 1.15], [0.6, ar * 0.95], [1, ar * 0.8]], D.ua), skin, ua);
    mesh(G3.sph, skin, fa, 0, 0, 0, ar * 0.9);
    mesh(tube([[0, ar * 0.8], [0.25, ar * 1.0], [0.6, ar * 0.82], [1, ar * 0.66]], D.fa), skin, fa);
    const gaunt = t === "B" ? M.trim : M.armor, fist = stone ? 1.3 : t === "P" ? 1.3 : 1.18;
    if (t !== "B") {
      mesh(tube([[0, ar * 0.92], [0.12, ar * 1.32], [0.9, ar * 1.08], [1, ar * 0.8]], D.fa * 0.62), gaunt, fa, 0, D.fa * 0.36, 0);
      ring(ar * 1.3, ar * 0.13, M.trim, fa, D.fa * 0.44, 16);
    } else {
      mesh(lathe([[ar * 1.05, D.fa * 0.02], [ar * 1.3, D.fa * 0.4], [ar * 1.75, D.fa * 0.86], [ar * 1.62, D.fa * 0.9], [ar * 1.1, D.fa * 0.5]], 18), M.robe, fa);
      ring(ar * 1.7, ar * 0.14, M.trim, fa, D.fa * 0.87, 20);
      mesh(tube([[0, ar * 1.3], [0.6, ar * 1.5], [1, ar * 1.25]], D.ua * 0.9), M.robe, ua, 0, D.ua * 0.05, 0);
    }
    mesh(G3.sph, t === "B" ? skin : gaunt, fa, 0, D.fa + ar * 0.75, 0, ar * fist * 0.95, ar * fist, ar * fist * 0.88);
    if (t !== "B") mesh(G3.box, M.trim, fa, ar * 0.55, D.fa + ar * 1.0, 0, ar * 0.9, ar * 1.0, ar * 1.9);
    // pauldrons
    if (t === "R") {
      mesh(G3.box, M.stone, ua, 0, -ar * 0.2, 0, ar * 3.1, ar * 2.0, ar * 3.1);
      for (let i = 0; i < 4; i++) mesh(G3.box, M.stone, ua, (i < 2 ? -1 : 1) * ar * 1.05, -ar * 1.55, (i % 2 ? -1 : 1) * ar * 1.05, ar * 0.9, ar * 0.9, ar * 0.9);
      mesh(G3.box, M.trim, ua, 0, ar * 0.9, 0, ar * 3.25, ar * 0.3, ar * 3.25);
    } else if (t === "P" || t === "N" || t === "Q") {
      const pr = ar * (t === "P" ? 1.7 : t === "N" ? 1.85 : 1.6), cap = new T.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
      const pa = mesh(cap, t === "Q" ? M.trim : M.armor, ua, 0, ar * 0.25, 0, pr, pr * 0.95, pr); pa.rotation.z = Math.PI;
      ring(pr * 0.97, ar * 0.13, M.trim, ua, ar * -0.2, 20);
      if (t === "N") { const p2 = mesh(cap, M.armor, ua, 0, ar * 1.5, 0, pr * 0.86, pr * 0.7, pr * 0.86); p2.rotation.z = Math.PI; ring(pr * 0.83, ar * 0.1, M.trim, ua, ar * 1.15, 18); }
      if (t === "Q") { const sp = mesh(new T.ConeGeometry(ar * 0.5, ar * 2.2, 8), M.trim, ua, 0, -ar * 1.3, zs * ar * 0.9); sp.rotation.x = zs * -0.5; sp.rotation.z = Math.PI; }
    }
    // ---- leg ----
    const th = S[s + "th"] = grp(), sh = S[s + "sh"] = grp(), ft = S[s + "ft"] = grp();
    mesh(G3.sph, skin, th, 0, 0, 0, lr * 1.12);
    mesh(tube([[0, lr * 1.1], [0.25, lr * 1.16], [0.7, lr * 0.92], [1, lr * 0.76]], D.th), skin, th);
    mesh(G3.sph, M.armor, sh, lr * 0.3, 0, 0, lr * 0.82, lr * 0.95, lr * 0.84); // knee cop
    mesh(G3.box, M.trim, sh, lr * 1.0, 0, 0, lr * 0.4, lr * 0.9, lr * 0.9);
    mesh(tube([[0, lr * 0.78], [0.3, lr * 0.96], [0.7, lr * 0.72], [1, lr * 0.62]], D.sh), skin, sh);
    if (t !== "B") {
      mesh(tube([[0, lr * 0.9], [0.15, lr * 1.12], [0.85, lr * 0.86], [1, lr * 0.8]], D.sh * 0.72), M.armor, sh, 0, D.sh * 0.27, 0);
      ring(lr * 1.1, lr * 0.11, M.trim, sh, D.sh * 0.33, 16);
      mesh(G3.box, M.armor, th, lr * 0.82, D.th * 0.45, 0, lr * 0.5, D.th * 0.62, lr * 1.5); // cuisse plate
    }
    const bl = stone ? 10.5 : 9, boot = mesh(bootGeo(bl, stone ? 3.4 : 2.9, lr * (stone ? 1.75 : 1.5)), t === "B" ? M.leather : M.armor, ft);
    mesh(G3.box, M.trim, ft, bl * 0.62, -1.9, 0, 1.2, 1.6, lr * (stone ? 1.8 : 1.55));
    if (t === "N") mesh(G3.box, M.dark, ft, bl * 0.2, -3.1, 0, bl * 1.02, 0.9, lr * 1.6); // hoof-black soles
    mdl.extra.boot = boot;
  }

  // ---- torso: pelvis and chest groups. Local +x = front, +y = up the spine, +z = toward the rear-side shoulder ----
  const pel = mdl.pelvis = grp(), ch = mdl.chest = grp(), top = D.spine - 6;
  const wR = { P: 5.6, N: 4.9, B: 4.6, R: 7.4, Q: 4.2 }[t], hR = { P: 6.0, N: 5.3, B: 5.0, R: 7.6, Q: 5.2 }[t], cR = D.sw * (stone ? 0.98 : 0.94), nR = stone ? 3.4 : 2.3;
  const skin = stone ? M.stone : M.body, segs = stone ? 8 : 22;
  mesh(lathe([[0.01, -5.6], [hR * 0.72, -5], [hR, -2.2], [hR * 0.96, 1], [wR, 4.4], [wR * 0.98, 7.5], [0.01, 7.6]], segs), skin, pel, 0, 0, 0, 0.8, 1, 1);
  mesh(lathe([[0.01, -0.6], [wR, -0.4], [wR * 1.04, 3], [cR, top * 0.6], [cR * 1.02, top * 0.83], [cR * 0.82, top * 0.98], [nR, top + 1.4], [nR, top + 3.8], [0.01, top + 3.9]], segs), skin, ch, 0, 0, 0, stone ? 0.74 : 0.66, 1, 1);
  if (t !== "B") { // breastplate + backplate edge
    const plate = mesh(lathe([[wR * 1.02, 2.6], [cR * 1.03, top * 0.58], [cR * 1.07, top * 0.84], [cR * 0.84, top * 1.0], [cR * 0.5, top * 1.06]], stone ? 8 : 20, Math.PI * 0.1, Math.PI * 0.8), stone ? M.stone : t === "Q" ? M.trim : M.armor, ch, 0, 0, 0, stone ? 0.82 : 0.74, 1, 1.02);
    plate.material = plate.material;
    mesh(G3.box, M.trim, ch, cR * (stone ? 0.83 : 0.74), top * 0.62, 0, 0.5, top * 0.5, 1.1);
    mesh(G3.sph, M.gem, ch, cR * (stone ? 0.84 : 0.75), top * 0.7, 0, 0.9, 1.3, 1.3);
  }
  const belt = mesh(new T.TorusGeometry(1, 0.16, 8, stone ? 8 : 24), M.leather, pel, 0, 3.4, 0, wR * 0.86, wR * 1.06, 6); belt.rotation.x = Math.PI / 2;
  mesh(G3.box, M.trim, pel, wR * 0.84, 3.4, 0, 1, 2.6, 3.2);
  mesh(G3.sph, M.gem, pel, wR * 0.9, 3.4, 0, 0.5, 0.9, 0.9);
  const gor = mesh(new T.TorusGeometry(nR * 1.35, 0.7, 8, 20), M.trim, ch, 0, top + 1.2, 0); gor.rotation.x = Math.PI / 2;

  if (t === "P") {
    mesh(lathe([[wR * 0.95, 3], [hR * 1.12, 0], [hR * 1.3, -4.5], [hR * 1.34, -5], [0.01, -5]], 20), M.cloth, pel, 0, 0, 0, 0.84, 1, 1);
    ring(hR * 1.3, 0.35, M.trim, pel, -4.8, 24).scale.set(1, 0.84 / 1 * 1.19, 1);
    const sh = grp(S.lfa); sh.position.set(0, D.fa * 0.55, -ar * 1.5); sh.rotation.set(Math.PI / 2, 0, 0);
    mesh(new T.CylinderGeometry(8.6, 8.6, 1.3, 28), M.body, sh);
    const rim = mesh(new T.TorusGeometry(8.6, 0.7, 8, 32), M.trim, sh); rim.rotation.x = Math.PI / 2;
    mesh(new T.ConeGeometry(2.3, 3, 16), M.trim, sh, 0, -1.8, 0).rotation.x = Math.PI;
    mesh(G3.box, M.trim, sh, 0, -0.75, 0, 14, 0.3, 1.3); mesh(G3.box, M.trim, sh, 0, -0.75, 0, 1.3, 0.3, 14);
  } else if (t === "N") {
    for (const z of [-1, 0, 1]) { const ts = mesh(G3.box, M.armor, pel, hR * 0.7 - Math.abs(z) * 1.6, -2.4, z * hR * 0.62, 0.7, 5.6, hR * 0.56); ts.rotation.z = 0.14; mesh(G3.box, M.trim, ts, 0, -0.5, 0, 1.15, 0.08, 1.02); }
    mdl.chains.push({ list: makeChain(ch, 5, 4.4, 3.2, 1.5, 0.5, M.cloth, M.trim, -cR * 0.55, top + 0.6, 1.5, -1), base: -1.15, k: 1.6 });
    mdl.chains.push({ list: makeChain(pel, 5, 3.6, 1.4, 0.5, 2.2, M.hair, null, -hR * 0.75, 1.5, 0, -1, 0.8), base: -0.7, k: 1.8 });
  } else if (t === "B") {
    mdl.chains.push({ list: makeChain(pel, 5, 4.9, 0.5, 0.5, wR * 1.5, M.robe, M.trim, wR * 0.74, 3.4, 0, 1, hR * 2.1), base: 0.07, k: 0.7 });
    mdl.chains.push({ list: makeChain(pel, 5, 4.9, 0.5, 0.5, wR * 1.5, M.robe, M.trim, -wR * 0.8, 3.4, 0, -1, hR * 2.2), base: -0.07, k: 0.9 });
    mesh(lathe([[wR * 1.0, 3.6], [hR * 1.22, 0], [hR * 1.4, -5], [0.01, -5]], 20), M.robe, pel, 0, 0, 0, 0.84, 1, 1);
    for (const z of [-1.2, 1.2]) { const st = mesh(G3.box, M.cloth, ch, cR * 0.6, top * 0.42, z, 0.5, top * 1.1, 1.5); st.rotation.z = 0.06; mesh(G3.box, M.trim, st, 0, -0.47, 0, 1.2, 0.06, 1.15); }
    mesh(lathe([[nR * 1.3, top + 2.4], [cR * 1.02, top * 0.92], [cR * 1.12, top * 0.7], [cR * 1.0, top * 0.66]], 20), M.cloth, ch, 0, 0, 0, 0.72, 1, 1); // mantle
    const staff = mdl.extra.staff = grp();
    mesh(new T.CylinderGeometry(0.62, 0.62, 46, 10), M.trim, staff, 0, 15, 0);
    mesh(G3.sph, M.trim, staff, 0, -8, 0, 1.0);
    const crook = mesh(new T.TorusGeometry(3.1, 0.6, 8, 24, Math.PI * 1.35), M.trim, staff, 3.1, 38.2, 0); crook.rotation.z = -0.3;
    mdl.extra.orb = mesh(G3.sph, M.glow, staff, 3.2, 38.6, 0, 1.7);
  } else if (t === "R") {
    mdl.chains.push({ list: makeChain(pel, 3, 4.2, 0.9, 1.0, wR * 1.1, M.cloth, M.trim, hR * 0.8, 2.6, 0, 1), base: 0.05, k: 0.5 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; mesh(G3.box, M.stone, ch, Math.cos(a) * nR * 1.9 * 0.74, top + 2.4, Math.sin(a) * nR * 1.9, 1.6, 2.2, 1.6); }
  } else if (t === "Q") {
    mdl.chains.push({ list: makeChain(ch, 9, 3.5, 0.5, 0.6, 8, M.cloth, M.trim, -cR * 0.62, top + 0.6, 0, -1, 15), base: -0.13, k: 0.7 });
    mdl.chains.push({ list: makeChain(pel, 4, 4.6, 0.6, 1.6, 4.5, M.cloth, M.trim, -hR * 0.5, 2.4, hR * 0.85, -1, 6.5), base: -0.16, k: 1.1 });
    mdl.chains.push({ list: makeChain(pel, 4, 4.6, 0.6, 1.6, 4.5, M.cloth, M.trim, -hR * 0.5, 2.4, -hR * 0.85, -1, 6.5), base: -0.16, k: 1.1 });
    mesh(lathe([[wR * 0.98, 3.6], [hR * 1.18, 0.5], [hR * 1.36, -3.6], [0.01, -3.6]], 20, Math.PI * 0.62, Math.PI * 1.76), M.trim, pel, 0, 0, 0, 0.84, 1, 1);
    const sc = mdl.extra.scepter = grp(S.rfa); sc.position.set(0, D.fa + ar * 0.8, 0);
    mesh(lathe([[0.01, -5.2], [1.0, -4.6], [0.6, -3.6], [0.72, 2], [0.62, 12], [1.25, 13], [1.5, 14.2], [0.01, 14.4]], 12), M.trim, sc);
    mesh(G3.sph, M.gem, sc, 0, 16.6, 0, 2.3);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, pr = mesh(new T.ConeGeometry(0.62, 4.2, 6), M.trim, sc, Math.cos(a) * 2.0, 16.4, Math.sin(a) * 2.0); pr.rotation.set(Math.sin(a) * 0.42, 0, -Math.cos(a) * 0.42); }
    ring(1.9, 0.38, M.trim, sc, 14.4, 16); ring(0.95, 0.3, M.trim, sc, 4, 12);
    mdl.extra.tipGem = sc.children[1];
  }

  mdl.head = buildHead(t, M, mdl); mdl.head.scale.setScalar(6.5); body.add(mdl.head);
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  R3.scene.add(root);
  return mdl;
}
function buildHead(t, M, mdl) {
  const T = THREE, h = new T.Group();
  const add = (geo, mat, x, y, z, sx, sy, sz, parent) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.scale.set(sx ?? 1, sy ?? sx ?? 1, sz ?? sx ?? 1); m.castShadow = true; (parent || h).add(m); return m; };
  const eyes = (x, y, z, r, sx) => { add(G3.sph, M.eye, x, y, z, r * (sx || 1), r, r); add(G3.sph, M.eye, x, y, -z, r * (sx || 1), r, r); };
  if (t === "P") {
    add(G3.sph, M.body, 0, -0.05, 0, 0.76);
    add(new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), M.armor, 0, 0.05, 0, 0.86, 0.8, 0.86);
    add(new T.CylinderGeometry(1.2, 1.26, 0.08, 32), M.armor, 0, 0.05, 0);
    add(new T.TorusGeometry(1.23, 0.05, 6, 32), M.trim, 0, 0.05, 0).rotation.x = Math.PI / 2;
    add(G3.box, M.trim, 0, 0.5, 0, 1.1, 0.1, 0.12);
    add(G3.sph, M.trim, 0, 0.88, 0, 0.12);
    add(G3.box, M.dark, 0.62, -0.14, 0, 0.3, 0.2, 0.8);
    eyes(0.7, -0.14, 0.24, 0.1, 0.7);
    add(new T.TorusGeometry(0.6, 0.15, 10, 24), M.trim, 0, -0.68, 0).rotation.x = Math.PI / 2;
    add(G3.box, M.armor, 0.55, -0.5, 0, 0.3, 0.34, 0.7); // chin guard
  } else if (t === "N") {
    const s = new T.Shape();
    const pts = [[-0.6, -0.9], [-0.72, 0.2], [-0.5, 0.85], [-0.2, 1.15], [-0.05, 1.5], [0.12, 1.0], [0.6, 0.78], [1.25, 0.28], [1.42, -0.05], [1.25, -0.32], [0.62, -0.25], [0.32, -0.55], [0.22, -0.9]];
    s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath();
    const geo = new T.ExtrudeGeometry(s, { depth: 0.72, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.12, bevelSegments: 4, curveSegments: 6 });
    geo.translate(0, 0, -0.36);
    add(geo, M.body, 0, -0.05, 0);
    add(G3.box, M.armor, 0.85, 0.32, 0, 0.95, 0.18, 0.9).rotation.z = -0.45;
    add(G3.box, M.trim, 0.85, 0.42, 0, 0.95, 0.04, 0.94).rotation.z = -0.45;
    add(G3.box, M.leather, 0.85, -0.1, 0, 0.08, 0.6, 1.02);
    add(G3.sph, M.trim, 0.85, -0.1, 0.52, 0.08); add(G3.sph, M.trim, 0.85, -0.1, -0.52, 0.08);
    eyes(0.45, 0.5, 0.47, 0.11, 1.4);
    add(G3.sph, M.dark, 1.32, -0.05, 0.22, 0.06); add(G3.sph, M.dark, 1.32, -0.05, -0.22, 0.06);
    for (const z of [-0.3, 0.3]) { const ear = add(new T.ConeGeometry(0.14, 0.42, 8), M.body, -0.08, 1.5, z); ear.rotation.x = z; }
    mdl.mane = [];
    for (let i = 0; i < 7; i++) {
      const g = new T.Group(); g.position.set(-0.6 + i * 0.03, 1.15 - i * 0.3, 0); h.add(g);
      const fin = add(G3.box, i % 2 ? M.cloth : M.clothIn, -0.22, 0, 0, 0.56, 0.32, 0.18, g); fin.rotation.z = 0.4;
      mdl.mane.push(g);
    }
  } else if (t === "B") {
    add(G3.sph, M.body, 0, -0.15, 0, 0.6);
    add(lathe([[0.01, 0.1], [0.6, 0.15], [0.64, 0.6], [0.47, 1.2], [0.2, 1.65], [0.01, 1.82]], 24), M.robe);
    add(new T.TorusGeometry(0.62, 0.07, 8, 24), M.trim, 0, 0.18, 0).rotation.x = Math.PI / 2;
    add(G3.box, M.dark, 0.2, 1.05, 0, 0.07, 0.8, 1.4).rotation.z = -0.6;
    add(G3.box, M.trim, 0.58, 0.8, 0, 0.06, 1.1, 0.12).rotation.z = -0.2;
    add(G3.sph, M.gem, 0.6, 0.72, 0, 0.12, 0.16, 0.12);
    add(G3.sph, M.trim, 0, 1.9, 0, 0.15);
    add(G3.box, M.dark, 0.5, -0.12, 0, 0.3, 0.16, 0.7);
    eyes(0.56, -0.12, 0.2, 0.08, 1.3);
    add(lathe([[0.62, 0.2], [0.72, -0.5], [0.5, -0.85]], 16, Math.PI * 1.0, Math.PI), M.robe); // hood drape at the back
    const halo = new T.Group(); halo.position.set(-0.55, 0.65, 0); halo.rotation.y = Math.PI / 2; h.add(halo); mdl.halo = halo;
    add(new T.TorusGeometry(1.15, 0.04, 6, 48), M.glow, 0, 0, 0, 1, 1, 1, halo);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(G3.sph, M.glow, Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0, 0.09, 0.09, 0.09, halo); }
  } else if (t === "R") {
    add(new T.CylinderGeometry(0.84, 0.8, 1.5, 8), M.stone, 0, 0.05, 0);
    for (let a = 0; a < 8; a++) add(G3.box, M.stone, Math.cos(a * Math.PI / 4 + Math.PI / 8) * 0.7, 1.0, Math.sin(a * Math.PI / 4 + Math.PI / 8) * 0.7, 0.32, 0.4, 0.32);
    add(new T.CylinderGeometry(0.88, 0.88, 0.12, 8), M.trim, 0, -0.68, 0);
    add(new T.CylinderGeometry(0.87, 0.87, 0.08, 8), M.trim, 0, 0.76, 0);
    add(G3.box, M.dark, 0.76, 0.12, 0, 0.14, 0.26, 1.1);
    add(G3.box, M.eye, 0.82, 0.12, 0, 0.04, 0.09, 0.95);
    add(G3.box, M.armor, 0.82, -0.25, 0, 0.1, 0.5, 0.18);
  } else if (t === "Q") {
    add(G3.sph, M.body, 0, 0, 0, 0.64);
    add(lathe([[0.01, 0.45], [0.66, 0.12], [0.72, -0.4], [0.6, -1.2], [0.34, -1.75], [0.01, -1.8]], 18, Math.PI * 0.95, Math.PI * 1.1), M.hair, -0.1, 0, 0, 0.95, 1, 1);
    add(new T.SphereGeometry(0.68, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), M.hair, -0.03, 0.02, 0);
    add(new T.CylinderGeometry(0.62, 0.54, 0.34, 20, 1, true), M.trim, 0, 0.6, 0);
    for (let a = 0; a < 9; a++) {
      const an = a / 9 * Math.PI * 2;
      const sp = add(new T.ConeGeometry(0.1, 0.46, 6), M.trim, Math.cos(an) * 0.62, 0.96, Math.sin(an) * 0.62);
      add(G3.sph, a % 3 === 0 ? M.gem : M.glow, Math.cos(an) * 0.64, 1.22, Math.sin(an) * 0.64, 0.07);
      sp.rotation.set(Math.sin(an) * 0.2, 0, -Math.cos(an) * 0.2);
    }
    add(G3.sph, M.gem, 0.62, 0.58, 0, 0.12, 0.14, 0.1);
    add(G3.box, M.dark, 0.5, 0.04, 0, 0.3, 0.13, 0.62);
    eyes(0.58, 0.04, 0.2, 0.075, 1.3);
    add(G3.sph, M.trim, 0.05, -0.45, 0.62, 0.07); add(G3.sph, M.trim, 0.05, -0.45, -0.62, 0.07);
  }
  return h;
}

/* ---------- posing ---------- */
const V = n => Array.from({ length: n }, () => new THREE.Vector3());
const _v = window.THREE ? V(24) : [], _m4 = window.THREE ? new THREE.Matrix4() : null;
function setBasis(g, pos, X, Y) { // X is made perpendicular to Y
  const x = _v[20].copy(X).addScaledVector(Y, -X.dot(Y)); if (x.lengthSq() < 1e-6) x.set(0, 0, 1).addScaledVector(Y, -Y.z); x.normalize();
  const z = _v[21].crossVectors(x, Y);
  _m4.makeBasis(x, Y, z); g.quaternion.setFromRotationMatrix(_m4); g.position.copy(pos);
}
function setBone(g, a, b, zHint) {
  const y = _v[22].subVectors(b, a).normalize(), x = _v[20].crossVectors(y, zHint);
  if (x.lengthSq() < 1e-5) x.set(1, 0, 0); x.normalize();
  const z = _v[21].crossVectors(x, y);
  _m4.makeBasis(x, y, z); g.quaternion.setFromRotationMatrix(_m4); g.position.copy(a);
}
function ik2(S, Tg, a, b, pole, mid, end) {
  const d3 = _v[23].subVectors(Tg, S); let d = d3.length();
  const mx = (a + b) * 0.998, mn = Math.abs(a - b) + 0.5;
  if (d > mx) { d3.multiplyScalar(mx / d); d = mx; } else if (d < mn) { if (d < 1e-4) d3.set(0, -1, 0); d3.multiplyScalar(mn / Math.max(d, 1e-4)); d = mn; }
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  const n = d3.clone().normalize(), p = _v[19].copy(pole).addScaledVector(n, -pole.dot(n));
  if (p.lengthSq() < 1e-6) p.set(0, 0, 1); p.normalize();
  mid.copy(S).addScaledVector(n, x).addScaledVector(p, h);
  end.copy(S).add(d3);
}
const ZN = window.THREE ? new THREE.Vector3(0, 0, 1) : null, ZF = window.THREE ? new THREE.Vector3(0, 0, -1) : null;
function poseRig(mdl, P, time, dt) {
  const D = mdl.D, f = mdl.f, S = mdl.seg, [hip, yp, ys, xc, xp, cs, zc, zp, sj, el, wr, hj, kn, an, tg, pole, hd, hx, toe, up] = _v;
  hip.set(P.hip[0], P.hip[1], P.hip[2]);
  yp.set(Math.sin(P.lean * 0.45), Math.cos(P.lean * 0.45), Math.sin(P.roll * 0.5)).normalize();
  ys.set(Math.sin(P.lean), Math.cos(P.lean), Math.sin(P.roll)).normalize();
  xp.set(Math.cos(P.popen), 0, Math.sin(P.popen)); xc.set(Math.cos(P.open), 0, Math.sin(P.open));
  setBasis(mdl.pelvis, hip, xp, yp); zp.crossVectors(_v[20], yp);
  cs.copy(hip).addScaledVector(yp, 6);
  setBasis(mdl.chest, cs, xc, ys); zc.crossVectors(_v[20], ys);
  cs.addScaledVector(ys, D.spine - 6); // shoulder line centre
  // head
  const ah = P.open * 0.3 + P.hy, hpk = P.hp;
  hd.set(Math.sin(P.lean * 0.7 + hpk * 0.5), Math.cos(P.lean * 0.7 + hpk * 0.5), Math.sin(P.roll)).normalize();
  hx.set(Math.cos(ah) * Math.cos(hpk), -Math.sin(hpk), Math.sin(ah) * Math.cos(hpk));
  tg.copy(cs).addScaledVector(hd, D.neck);
  setBasis(mdl.head, tg, hx, hd);
  // arms
  for (const s of ["l", "r"]) {
    const sg = s === "r" ? 1 : -1, H = P[s + "h"];
    sj.copy(cs).addScaledVector(zc, sg * D.sw).addScaledVector(ys, -1.2);
    tg.set(H[0], H[1], H[2]);
    pole.set(-0.3, -1, sg * 0.5);
    ik2(sj, tg, D.ua, D.fa, pole, el, wr);
    setBone(S[s + "ua"], sj, el, ZN); setBone(S[s + "fa"], el, wr, ZN);
    if (s === "l") mdl.lw = (mdl.lw || new THREE.Vector3()).copy(wr); else mdl.rw = (mdl.rw || new THREE.Vector3()).copy(wr);
  }
  // legs
  for (const s of ["l", "r"]) {
    const sg = s === "r" ? 1 : -1, Ft = P[s + "f"], pitch = P[s + "fp"];
    hj.copy(hip).addScaledVector(zp, sg * D.hw).addScaledVector(yp, -1.5);
    tg.set(Ft[0], Ft[1] + 4 + Math.max(0, pitch) * 3, Ft[2]);
    pole.set(1, 0.15, sg * 0.32);
    ik2(hj, tg, D.th, D.sh, pole, kn, an);
    setBone(S[s + "th"], hj, kn, ZF); setBone(S[s + "sh"], kn, an, ZF);
    const lifted = sat((an.y - 5.5) / 13) * 0.85, yaw = s === "r" ? 0.8 : 0.12;
    toe.set(Math.cos(yaw), -pitch * 0.8, Math.sin(yaw)).normalize();
    up.subVectors(an, kn).normalize(); // shin direction
    toe.lerp(up, lifted).normalize();
    up.set(0, 1, 0).lerp(pole.set(1, 0, 0).applyQuaternion(S[s + "sh"].quaternion), lifted);
    const g = S[s + "ft"]; setBasis(g, an, toe, up.addScaledVector(toe, -up.dot(toe)).normalize());
  }
  // whole-body rotation about the hips (flips, spins, lying down)
  mdl.piv.position.copy(hip); mdl.body.position.copy(hip).multiplyScalar(-1);
  mdl.piv.rotation.set(0, P.ry, -P.rz);
  mdl.root.position.set(wx(f.x + f.face * P.dx), (f.y + P.dy) / 10, f.z / 10);
  mdl.root.scale.set(f.face * 0.1, 0.1, 0.1);
  mdl.root.visible = !P.hide && !mdl.gone;
  // weapon
  if (mdl.extra.staff) {
    const dir = P.sd ? up.set(P.sd[0], P.sd[1], P.sd[2]).normalize() : up.subVectors(mdl.lw, mdl.rw).normalize();
    setBone(mdl.extra.staff, mdl.rw, tg.copy(mdl.rw).add(dir), ZN);
    mdl.extra.orb.scale.setScalar(1.7 * (1 + Math.sin(time * 6) * 0.12));
  }
  // cloth sways with motion
  const speed = Math.max(-1, Math.min(1, f.vx * f.face / 300)), lift = Math.max(-1, Math.min(1, f.vy / 300));
  for (const ch of mdl.chains) {
    ch.list.forEach((g, i) => {
      const target = (i === 0 ? ch.base + P.lean * (ch.base < 0 ? 0.6 : -0.6) : 0) - (speed * 0.5 + lift * 0.3) * ch.k / ch.list.length * (i + 1) + Math.sin(time * 4 + i * 0.9) * 0.05 * ch.k;
      g.userData.a = (g.userData.a ?? target) + (target - (g.userData.a ?? target)) * Math.min(1, dt * 10);
      g.rotation.z = g.userData.a;
    });
  }
  if (mdl.mane) mdl.mane.forEach((g, i) => { g.rotation.z = Math.sin(time * 9 - i * 0.7) * 0.18 - speed * 0.4; });
  if (mdl.halo) mdl.halo.rotation.z = time * 1.4;
  const em = f.flash > 0 ? 0x77706a : lastStandOn(f) ? (Math.sin(time * 14) > 0 ? 0x551111 : 0x220000) : f.rage ? (Math.sin(time * 8) > 0 ? 0x3a0800 : 0x1a0400) : 0x000000;
  for (const k of ["body", "shade", "armor", "robe", "cloth", "clothIn", "leather", "trim"]) if (mdl.M[k] && mdl.M[k].emissive) mdl.M[k].emissive.setHex(em);
  if (mdl.t === "R") { if (f.color === "b") mdl.M.stone.emissiveIntensity = 1.3 + (f.rage ? 1.5 : 0) + (f.flash > 0 ? 2 : 0); else mdl.M.stone.emissive.setHex(em); }
}
// world position (scene units) of a point given in a fighter's local pixel frame
function bodyPos(f, h) { return { x: wx(f.x), y: (f.y + h) / 10 }; }
