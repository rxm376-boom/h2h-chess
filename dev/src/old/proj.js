// bolt, beam and shockwave meshes share their materials and shapes for the whole session: nothing is compiled or freed mid-fight
function projMats(color) {
  const T = THREE, C = R3.projM || (R3.projM = {}); if (C[color]) return C[color];
  const w = color === "w", coreC = w ? 0xeaf6ff : 0xffd27a, haloC = w ? 0x6fc8ff : 0xff8a2a;
  return (C[color] = {
    core: new T.MeshStandardMaterial({ color: 0, emissive: coreC, emissiveIntensity: 3 }),
    halo: new T.MeshBasicMaterial({ color: haloC, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending }),
    wave: new T.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.8, emissive: 0xff6a1a, emissiveIntensity: 0.55, flatShading: true }),
  });
}
function projGeo(key, make) { const C = R3.projG || (R3.projG = {}); if (!C[key]) { C[key] = make(); C[key].userData.shared = true; } return C[key]; }
function projMesh(p) {
  const T = THREE, g = new T.Group(), PM = projMats(p.owner.color), core = PM.core, halo = PM.halo;
  if (p.kind === "wave") {
    // a ridge of stone spikes erupting from the floor
    const wm = PM.wave;
    for (const [x, z, hgt, r, tilt] of [[0, 0, 2.6, 0.7, 0.25], [-0.9, 0.5, 1.7, 0.5, 0.1], [-0.8, -0.6, 1.9, 0.55, 0.15], [-1.7, 0.1, 1.1, 0.42, 0], [0.5, 0.9, 1.2, 0.4, 0.3], [0.4, -1.0, 1.3, 0.4, 0.3]]) {
      const c = new T.Mesh(projGeo("cone" + r + "_" + hgt, () => new T.ConeGeometry(r, hgt, 5)), wm); c.position.set(x * Math.sign(p.vx), hgt / 2 - 0.1, z); c.rotation.z = -tilt * Math.sign(p.vx); c.castShadow = true; g.add(c);
    }
    const h = new T.Mesh(G3.sph, halo); h.scale.set(1.2, 0.5, 1.2); h.position.y = 0.2; g.add(h);
  } else if (p.kind === "beam") {
    const c = new T.Mesh(G3.sph, core); c.scale.set(1.6, 0.22, 0.22); g.add(c);
    const h = new T.Mesh(G3.sph, halo); h.scale.set(2.0, 0.55, 0.55); g.add(h);
    const tip = new T.Mesh(G3.sph, core); tip.scale.setScalar(0.42); tip.position.x = Math.sign(p.vx) * 1.4; g.add(tip);
    const ring = new T.Mesh(projGeo("torus", () => new T.TorusGeometry(0.5, 0.05, 6, 24)), core); ring.rotation.y = Math.PI / 2; g.add(ring); g.userData.ring = ring;
  } else {
    const c = new T.Mesh(projGeo("octa", () => new T.OctahedronGeometry(0.3)), core); c.scale.set(1.8, 0.7, 0.7); g.add(c);
    const h = new T.Mesh(G3.sph, halo); h.scale.set(0.8, 0.38, 0.38); g.add(h);
  }
  R3.scene.add(g);
  return g;
}
function toScreen(x, y) {
  const v = new THREE.Vector3(wx(x), wy(y), 0).project(R3.camera);
  return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
}

/* ---------- effects ---------- */
const TEAM = { w: { hi: "#bfe8ff", mid: "#6fc8ff", deep: "#2a7cff" }, b: { hi: "#ffe2a0", mid: "#ffa040", deep: "#ff5a1a" } };
// shock rings are recycled: a new material per ring meant a shader build (and a stall) on hits in some arenas
function ringMat(col) { return new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); }
function ring3(x, y, z, col, r0, r1, dur, flat) {
  const pool = R3.ringPool || (R3.ringPool = []), m = pool.pop() || new THREE.Mesh(G3.ring, ringMat(col));
  m.material.color.set(col); m.material.opacity = 1; m.scale.setScalar(1); m.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
  m.position.set(x, y, z);
  R3.scene.add(m); R3.rings.push({ m, t: 0, dur, r0, r1, flat });
}
function ringFree(r) { R3.scene.remove(r.m); (R3.ringPool || (R3.ringPool = [])).push(r.m); }
function tileMats() { return R3.tileM || (R3.tileM = { L: new THREE.MeshStandardMaterial({ color: 0xd6c49c, roughness: 0.3 }), D: new THREE.MeshStandardMaterial({ color: 0x3a2f55, roughness: 0.3 }) }); }
function lightPulse(x, y, col, power) { const L = R3.fxLight; L.position.set(x, y, 2); L.color.set(col); L.intensity = Math.max(L.intensity, power); }
function rocks(x, n, mat, spd) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(G3.shards[i % 3], mat); m.castShadow = true;
    const sc = 0.08 + Math.random() * 0.16; m.scale.setScalar(sc);
    m.position.set(x + (Math.random() - 0.5) * 0.8, 0.1, (Math.random() - 0.5) * 1.2); R3.scene.add(m);
    R3.frags.push({ m, vx: (Math.random() - 0.5) * spd, vy: 3 + Math.random() * spd, vz: (Math.random() - 0.5) * spd * 0.6, ax: Math.random() * 8, az: Math.random() * 8, r: sc, life: 0, max: 1.6 });
  }
}
function floorTile(x, z, delay) {
  const light = ((Math.floor(x / 2.73) + Math.floor(z / 2.73)) % 2 + 2) % 2 === 0;
  const m = new THREE.Mesh(G3.box, light ? R3.tileMatL || (R3.tileMatL = tileMats().L) : R3.tileMatD || (R3.tileMatD = tileMats().D));
  m.scale.set(1.1, 0.3, 1.1); m.position.set(x, -0.2, z); m.castShadow = true; R3.scene.add(m);
  R3.tiles.push({ m, t: -delay, vy: 7 + Math.random() * 3, y: -0.2, rx: (Math.random() - 0.5) * 3, rz: (Math.random() - 0.5) * 3 });
}
