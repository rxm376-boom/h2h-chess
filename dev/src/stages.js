/* =====================================================================
   Arenas. The Grand Hall is built in init3D; the Moonlit Courtyard and the
   Throne Vault are extra set dressing that is swapped in with their own
   floor, light rig and sky. The stage follows the square being fought over.
   ===================================================================== */
const STAGE_NAMES = ["Grand Hall", "Moonlit Courtyard", "Throne Vault"];
// home ranks are fought in the throne vault, the wings in the courtyard, the centre in the hall
function stageFor(r, c) { return r <= 1 || r >= 6 ? 2 : (c <= 1 || c >= 6 ? 1 : 0); }
function checkerTex(light, dark, veinL, veinD, seed) {
  const t = canvasTex(512, 512, (g) => {
    const r = rng(seed);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const li = (i + j) % 2 === 0;
      g.fillStyle = li ? light : dark; g.fillRect(i * 128, j * 128, 128, 128);
      g.strokeStyle = li ? veinL : veinD;
      for (let v = 0; v < 3; v++) { let x = i * 128 + r() * 128, y = j * 128 + r() * 128, a = r() * 6.28; g.lineWidth = 0.5 + r(); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 18; k++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * 7; y += Math.sin(a) * 7; g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = "rgba(0,0,0,.4)"; g.fillRect(i * 128, j * 128, 128, 2); g.fillRect(i * 128, j * 128, 2, 128);
    }
  });
  t.repeat.set(11, 4);
  return t;
}
function buildStages() {
  const T = THREE, scene = R3.scene;
  const add = (g, geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  R3.floorTex = [R3.floor.material.map, checkerTex("#737d8c", "#27303f", "rgba(60,70,90,.5)", "rgba(150,170,210,.3)", 9), checkerTex("#a8875a", "#3a1218", "rgba(110,80,40,.5)", "rgba(220,120,90,.3)", 13)];

  // --- Moonlit Courtyard: open sky, a moon, battlements and two towers ---
  const court = new T.Group();
  const sky = canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#050816"); gr.addColorStop(0.55, "#101c40"); gr.addColorStop(0.85, "#27406a"); gr.addColorStop(1, "#3a5a78");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(77);
    for (let i = 0; i < 260; i++) { const y = r() * h * 0.8, a = 0.3 + r() * 0.7; g.fillStyle = `rgba(230,236,255,${a})`; const s = r() < 0.08 ? 2.2 : 1.1; g.fillRect(r() * w, y, s, s); }
    const mx = w * 0.6, my = h * 0.5, halo = g.createRadialGradient(mx, my, 20, mx, my, 190); halo.addColorStop(0, "rgba(200,220,255,.5)"); halo.addColorStop(1, "rgba(200,220,255,0)");
    g.fillStyle = halo; g.fillRect(mx - 200, my - 200, 400, 400);
    g.fillStyle = "#eef3ff"; g.beginPath(); g.arc(mx, my, 44, 0, 6.3); g.fill();
    g.fillStyle = "rgba(170,185,215,.55)"; for (const [dx, dy, rr] of [[-12, -8, 9], [14, 6, 12], [-4, 18, 6], [18, -18, 5]]) { g.beginPath(); g.arc(mx + dx, my + dy, rr, 0, 6.3); g.fill(); }
    g.fillStyle = "rgba(20,30,60,.55)"; for (let i = 0; i < 9; i++) { const x = r() * w, y = h * (0.56 + r() * 0.2), ww = 120 + r() * 220; g.beginPath(); g.ellipse(x, y, ww, 9 + r() * 10, 0, 0, 6.3); g.fill(); }
  });
  add(court, new T.PlaneGeometry(190, 44), new T.MeshBasicMaterial({ map: sky, fog: false }), 0, 14, -44);
  const stone = new T.MeshStandardMaterial({ color: 0x4a5670, roughness: 0.95, map: bricks("#55607a", "#2a3246") }); stone.map.repeat.set(16, 1);
  const stoneD = new T.MeshStandardMaterial({ color: 0x2c3448, roughness: 0.95 });
  add(court, new T.BoxGeometry(150, 4.6, 2), stone, 0, 2.3, -21);
  for (let i = -18; i <= 18; i++) add(court, new T.BoxGeometry(2.2, 1.2, 2), stoneD, i * 4.1, 5.2, -21);
  for (const x of [-27, 27]) {
    add(court, new T.CylinderGeometry(4, 4.6, 12, 20), stoneD, x, 6, -24);
    add(court, new T.CylinderGeometry(4.8, 4, 1.2, 20), stoneD, x, 12.4, -24);
    for (let a = 0; a < 10; a++) add(court, new T.BoxGeometry(1.2, 1.3, 1.2), stoneD, x + Math.cos(a / 10 * 6.283) * 4.2, 13.5, -24 + Math.sin(a / 10 * 6.283) * 4.2);
    add(court, new T.PlaneGeometry(1.1, 2.6), new T.MeshBasicMaterial({ color: 0xffc46a }), x, 8.6, -19.7);
    const flag = add(court, new T.PlaneGeometry(3.4, 2), new T.MeshStandardMaterial({ color: x < 0 ? 0x7a1424 : 0x2a3c8a, roughness: 0.8, side: T.DoubleSide }), x + 1.8, 16.6, -24);
    add(court, new T.CylinderGeometry(0.1, 0.1, 5, 6), stoneD, x, 15.4, -24); flag.userData.flag = 1;
  }
  add(court, new T.BoxGeometry(9, 7.6, 1.2), stoneD, 0, 3.8, -20.2);                                   // gatehouse with a lit arch
  add(court, new T.PlaneGeometry(5.5, 6.5), new T.MeshBasicMaterial({ color: 0x06080f }), 0, 2.2, -19.55).scale.set(0.75, 0.68, 1);
  add(court, new T.CircleGeometry(2.06, 20, 0, Math.PI), new T.MeshBasicMaterial({ color: 0x06080f }), 0, 4.4, -19.55);
  const hedge = new T.MeshStandardMaterial({ color: 0x0f2219, roughness: 1 });
  for (const x of [-40, -34, -14, 14, 34, 40]) { add(court, new T.ConeGeometry(1.3, 6.4, 10), hedge, x, 3.2, -18.6); }
  mergeStatic(court); court.visible = false; scene.add(court);

  // --- Throne Vault: crimson and gold, a throne on a dais, hanging chandeliers ---
  const vault = new T.Group();
  const gold = new T.MeshStandardMaterial({ color: 0xd9a63e, metalness: 1, roughness: 0.25 });
  const velvet = new T.MeshStandardMaterial({ color: 0x3c0810, roughness: 1 });
  const dark = new T.MeshStandardMaterial({ color: 0x1c0d12, roughness: 0.5, metalness: 0.3 });
  for (let i = 0; i < 3; i++) add(vault, new T.BoxGeometry(22 - i * 4, 0.7, 7 - i * 1.6), dark, 0, 0.35 + i * 0.7, -16.5 - i * 0.6).receiveShadow = true;
  add(vault, new T.BoxGeometry(5.2, 13, 1), dark, 0, 8.6, -18.6);                                    // throne back
  add(vault, new T.BoxGeometry(4.2, 10.5, 0.4), velvet, 0, 8.2, -18.0);
  add(vault, new T.BoxGeometry(5.2, 1.4, 4), dark, 0, 3.4, -16.9);                                   // seat
  add(vault, new T.BoxGeometry(4.4, 0.5, 3.4), velvet, 0, 4.3, -16.8);
  for (const sx of [-1, 1]) { add(vault, new T.BoxGeometry(0.9, 3.4, 4), dark, sx * 2.6, 4.9, -16.9); add(vault, new T.SphereGeometry(0.6, 14, 10), gold, sx * 2.6, 6.9, -15.1); add(vault, new T.ConeGeometry(0.5, 2.6, 8), gold, sx * 2.3, 16.3, -18.6); }
  add(vault, new T.ConeGeometry(0.7, 3.6, 8), gold, 0, 16.9, -18.6);
  add(vault, new T.TorusGeometry(1.3, 0.16, 8, 28), gold, 0, 12.4, -17.75);                          // crown crest
  const carpet = add(vault, new T.PlaneGeometry(9, 26), new T.MeshStandardMaterial({ color: 0x3a0a12, roughness: 1 }), 0, 0.03, -5); carpet.rotation.x = -Math.PI / 2; carpet.receiveShadow = true;
  for (const sx of [-1, 1]) { const tr = add(vault, new T.PlaneGeometry(0.5, 26), gold, sx * 4.2, 0.035, -5); tr.rotation.x = -Math.PI / 2; }
  R3.chand = [];
  for (const x of [-20, 20]) {
    const c = new T.Group(); c.position.set(x, 15.5, -12);
    add(c, new T.CylinderGeometry(0.06, 0.06, 12, 6), dark, 0, 6, 0);
    const ring = add(c, new T.TorusGeometry(2.6, 0.14, 8, 32), gold, 0, 0, 0); ring.rotation.x = Math.PI / 2;
    const ring2 = add(c, new T.TorusGeometry(1.5, 0.1, 8, 24), gold, 0, 1.1, 0); ring2.rotation.x = Math.PI / 2;
    const flame = new T.MeshBasicMaterial({ color: 0xffc070 });
    for (let a = 0; a < 8; a++) add(c, new T.SphereGeometry(0.2, 8, 6), flame, Math.cos(a / 8 * 6.283) * 2.6, 0.35, Math.sin(a / 8 * 6.283) * 2.6);
    const L = new T.PointLight(0xffa050, 0.9, 30, 2); L.position.set(0, -0.5, 0); c.add(L);
    vault.add(c); R3.chand.push(c);
  }
  mergeStatic(vault); vault.visible = false; scene.add(vault);
  R3.sets = [null, court, vault];
}
function applyStage(i, light) {
  if (!R3.ok) return;
  if (!R3.sets) buildStages();
  const hall = i === 0, court = i === 1, vault = i === 2, L = R3.lights;
  for (const o of R3.hallObjs) o.visible = hall || (vault && o.material !== R3.bgMat);
  for (const o of R3.colObjs || []) o.visible = !court;
  R3.sets[1].visible = court; R3.sets[2].visible = vault;
  R3.floor.material.map = R3.floorTex[i]; R3.floor.material.needsUpdate = true;
  const win = hall ? (light ? 0xc89a46 : 0x5a4cc0) : 0xd8742a;
  for (const m of R3.winMats) { m.emissive.setHex(win); m.emissiveIntensity = vault ? 0.75 : light ? 0.5 : 0.55; }
  R3.wall.material.color.setHex(vault ? 0x3a1420 : 0x1b1534);
  R3.banMats[0].color.setHex(0x7a1424); R3.banMats[1].color.setHex(vault ? 0x8a6a1c : 0x2a1450);
  const bg = court ? 0x0c1630 : vault ? 0x140608 : light ? 0x120c14 : 0x0a0716;
  R3.scene.background.setHex(bg); R3.scene.fog.color.setHex(bg); R3.scene.fog.near = court ? 44 : 34; R3.scene.fog.far = court ? 110 : 72;
  L.hemi.color.setHex(court ? 0x9fb4e8 : vault ? 0xe0b0a0 : 0xb8b0e0); L.hemi.intensity = court ? 0.42 : 0.25;
  L.key.color.setHex(court ? 0xcfdcff : vault ? 0xffdcb0 : 0xfff0d8); L.key.intensity = court ? 1.05 : 1.25;
  L.rim.color.setHex(court ? 0x8fb0ff : vault ? 0xff8a3a : 0xe8b04a); L.rim2.color.setHex(court ? 0x4fd0c0 : vault ? 0xc03a4a : 0x6f8cff);
  L.fill.color.setHex(court ? 0x4a6ac8 : vault ? 0xa84a3a : 0x7a6ac8);
}
