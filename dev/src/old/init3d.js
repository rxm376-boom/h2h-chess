/* ---------- init ---------- */
function init3D() {
  if (R3.tried) return R3.ok;
  R3.tried = true;
  if (!window.THREE) return false;
  try {
    const T = THREE;
    R3.lite = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches); // phones: no MSAA target, lower pixel ratio
    R3.calm = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    const renderer = new T.WebGLRenderer({ canvas: $("arena3d"), antialias: true, powerPreference: "high-performance" });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.88;
    renderer.physicallyCorrectLights = false;
    const scene = new T.Scene();
    scene.background = new T.Color(0x0a0716); scene.fog = new T.Fog(0x0a0716, 34, 72);
    const camera = new T.PerspectiveCamera(30, 16 / 9, 1.5, 160);
    camera.position.set(0, 4, 22);
    Object.assign(R3, { T, renderer, scene, camera });

    // Environment map for reflections on gold, steel and lacquer
    try {
      const pm = new T.PMREMGenerator(renderer), es = new T.Scene();
      es.add(new T.Mesh(new T.BoxGeometry(60, 30, 60), new T.MeshBasicMaterial({ color: 0x1a1430, side: T.BackSide })));
      const panel = (c, x, y, z, w, h, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; es.add(m); return m; };
      panel(0xfff0d0, -12, 10, 20, 18, 8, Math.PI);        // warm key softbox
      panel(0x7f9cff, 18, 6, -10, 10, 14, -Math.PI / 2);    // cool rim
      panel(0xffb050, -20, 3, -14, 8, 4, Math.PI / 2);      // brazier glow
      panel(0xffffff, 0, 14.9, 0, 30, 6, 0).rotation.set(Math.PI / 2, 0, 0);
      const rt = pm.fromScene(es, 0.04);
      scene.environment = rt.texture;
      pm.dispose();
    } catch (e) { console.warn("env map skipped", e); }

    const hemi = new T.HemisphereLight(0xb8b0e0, 0x1a1428, 0.25); scene.add(hemi);
    const key = new T.DirectionalLight(0xfff0d8, 1.25); key.position.set(-8, 16, 14); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -22, right: 22, top: 14, bottom: -6, near: 1, far: 60 }); key.shadow.bias = -0.0006;
    scene.add(key);
    const rim = new T.DirectionalLight(0xe8b04a, 1.1); rim.position.set(10, 8, -12); scene.add(rim);
    const rim2 = new T.DirectionalLight(0x6f8cff, 0.7); rim2.position.set(-12, 6, -10); scene.add(rim2);
    const fill = new T.PointLight(0x7a6ac8, 0.6, 45); fill.position.set(0, 7, 12); scene.add(fill);
    const fxLight = new T.PointLight(0xffd8a0, 0, 16, 2); fxLight.position.set(0, 3, 2); scene.add(fxLight);
    R3.lights = { hemi, key, rim, rim2, fill };

    // Marble checker floor
    const floorTex = canvasTex(512, 512, (g) => {
      const r = rng(5);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const light = (i + j) % 2 === 0;
        g.fillStyle = light ? "#b09a74" : "#2c2442"; g.fillRect(i * 128, j * 128, 128, 128);
        g.strokeStyle = light ? "rgba(120,100,70,.45)" : "rgba(140,120,200,.35)";
        for (let v = 0; v < 3; v++) { let x = i * 128 + r() * 128, y = j * 128 + r() * 128, a = r() * 6.28; g.lineWidth = 0.5 + r(); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 18; k++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * 7; y += Math.sin(a) * 7; g.lineTo(x, y); } g.stroke(); }
        g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(i * 128, j * 128, 128, 2); g.fillRect(i * 128, j * 128, 2, 128);
      }
    });
    floorTex.repeat.set(11, 4);
    const floor = new T.Mesh(new T.PlaneGeometry(88, 32), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.3, metalness: 0.1, envMapIntensity: 0.35 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(1, 0, -4); floor.receiveShadow = true; scene.add(floor); R3.floor = floor;
    const edge = new T.Mesh(new T.BoxGeometry(88, 0.3, 0.4), new T.MeshStandardMaterial({ color: 0xd9a63e, metalness: 1, roughness: 0.25 }));
    edge.position.set(0, 0.15, -20); scene.add(edge);

    const hall0 = scene.children.length;
    // Hall: back wall, glowing windows with light shafts, banners, giant pieces
    const wall = new T.Mesh(new T.PlaneGeometry(140, 50), new T.MeshStandardMaterial({ color: 0x1b1534, roughness: 0.95, map: bricks("#221b3e", "#120d24") }));
    wall.material.map.repeat.set(14, 5); wall.position.set(0, 20, -20); scene.add(wall); R3.wall = wall; R3.banMats = null;
    const winMat = new T.MeshStandardMaterial({ color: 0x000000, emissive: 0x5a4cc0, emissiveIntensity: 0.55 }), barMat = new T.MeshBasicMaterial({ color: 0x120d24 });
    const shaftMat = new T.MeshBasicMaterial({ color: 0x7a6ae0, transparent: true, opacity: 0.022, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    const banMat = new T.MeshStandardMaterial({ color: 0x7a1424, roughness: 0.8, side: T.DoubleSide }), banMat2 = new T.MeshStandardMaterial({ color: 0x2a1450, roughness: 0.8, side: T.DoubleSide });
    const gold = new T.MeshStandardMaterial({ color: 0xd9a63e, metalness: 1, roughness: 0.25 });
    R3.banners = [];
    for (let i = -5; i <= 5; i++) {
      const x = i * 9;
      const r = new T.Mesh(new T.PlaneGeometry(4.2, 10), winMat); r.position.set(x, 10, -19.9); scene.add(r);
      const top = new T.Mesh(new T.CircleGeometry(2.1, 24, 0, Math.PI), winMat); top.position.set(x, 15, -19.9); scene.add(top);
      const bar = new T.Mesh(new T.PlaneGeometry(0.25, 13), barMat); bar.position.set(x, 11, -19.85); scene.add(bar);
      const bar2 = new T.Mesh(new T.PlaneGeometry(4.2, 0.25), barMat); bar2.position.set(x, 10.5, -19.85); scene.add(bar2);
      if (Math.abs(i) % 2 === 1) {
        const shaft = new T.Mesh(new T.CylinderGeometry(2.2, 5, 26, 16, 1, true), shaftMat);
        shaft.position.set(x + 3, 8, -15); shaft.rotation.set(0.55, 0, 0.25); scene.add(shaft);
      }
      const bx = x + 4.5;
      const geo = new T.PlaneGeometry(2.2, 8, 1, 6); geo.translate(0, -4, 0);
      const ban = new T.Mesh(geo, i % 2 ? banMat : banMat2); ban.position.set(bx, 17, -19.5); scene.add(ban);
      const rod = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 2.8, 8), gold); rod.rotation.z = Math.PI / 2; rod.position.set(bx, 17, -19.4); scene.add(rod);
      R3.banners.push(ban);
    }
    const bgMat = new T.MeshStandardMaterial({ color: 0x0f0b1e, roughness: 0.25, metalness: 0.5 });
    [["R", -30], ["K", -15], ["Q", 15], ["B", 30]].forEach(([k, x]) => {
      const m = new T.Mesh(lathe(PIECE_PROFILES[k], 28), bgMat); m.position.set(x, 0, -18); m.scale.setScalar(1.8); scene.add(m);
      if (k === "R") for (let a = 0; a < 4; a++) { const c = new T.Mesh(new T.BoxGeometry(0.6, 0.7, 0.6), bgMat); c.scale.setScalar(0.86); c.position.set(x + Math.cos(a * Math.PI / 2) * 1.6, 9.95, -18 + Math.sin(a * Math.PI / 2) * 1.6); scene.add(c); }
      if (k === "K") { const c1 = new T.Mesh(new T.BoxGeometry(0.35, 1.6, 0.35), bgMat); c1.scale.setScalar(0.86); c1.position.set(x, 12.4, -18); scene.add(c1); const c2 = new T.Mesh(new T.BoxGeometry(1.1, 0.35, 0.35), bgMat); c2.scale.setScalar(0.86); c2.position.set(x, 12.6, -18); scene.add(c2); }
    });
    R3.hallObjs = scene.children.slice(hall0); R3.banMats = [banMat, banMat2]; R3.bgMat = bgMat;
    // Braziers at the arena edges
    R3.braziers = [];
    for (const x of [wx(WALL_L) - 0.6, wx(WALL_R) + 0.6]) {
      const stand = new T.Mesh(new T.CylinderGeometry(0.15, 0.35, 4.2, 12), gold); stand.position.set(x, 2.1, -1.2); stand.castShadow = true; scene.add(stand);
      const bowl = new T.Mesh(lathe([[0, 0], [0.5, 0.05], [0.95, 0.5], [1.05, 0.75], [0.9, 0.75], [0.4, 0.3], [0, 0.3]], 20), gold); bowl.position.set(x, 4.2, -1.2); scene.add(bowl);
      const coal = new T.Mesh(new T.CircleGeometry(0.85, 20), new T.MeshStandardMaterial({ color: 0, emissive: 0xff6a1a, emissiveIntensity: 2.5 })); coal.rotation.x = -Math.PI / 2; coal.position.set(x, 4.85, -1.2); scene.add(coal);
      const L = new T.PointLight(0xff8a3a, 1.1, 18, 2); L.position.set(x, 5.8, -1.2); scene.add(L);
      R3.braziers.push({ x, y: 4.9, z: -1.2, L });
    }

    G3.cyl = new T.CylinderGeometry(1, 1, 1, 12);
    G3.sph = new T.SphereGeometry(1, 18, 14);
    G3.box = new T.BoxGeometry(1, 1, 1);
    G3.shards = [new T.TetrahedronGeometry(1), new T.OctahedronGeometry(1), new T.BoxGeometry(1, 0.6, 0.8)];
    G3.ring = new T.RingGeometry(0.8, 1, 48);
    for (const k in G3) for (const g of [].concat(G3[k])) g.userData.shared = true;

    // Particles: an additive glow layer and a soft smoke layer
    R3.glow = makeParticles(1400, true); R3.smoke = makeParticles(500, false);
    scene.add(R3.glow.pts); scene.add(R3.smoke.pts);
    const flashes = [];
    for (let i = 0; i < 8; i++) { const m = new T.Mesh(G3.sph, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); m.visible = false; scene.add(m); flashes.push(m); }

    // Post: bloom + grade (vignette, freeze-frame darkening, rage tint, KO desaturation)
    let composer = null, bloom = null, grade = null;
    if (T.EffectComposer && T.RenderPass && T.ShaderPass && T.UnrealBloomPass && T.CopyShader && T.LuminosityHighPassShader) {
      try {
        // multisampled target keeps edges smooth through the post-processing chain (WebGL2)
        let rt; if (renderer.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget && !R3.lite) { rt = new T.WebGLMultisampleRenderTarget(256, 256, { format: T.RGBAFormat, encoding: T.LinearEncoding }); rt.samples = 4; }
        composer = new T.EffectComposer(renderer, rt);
        composer.addPass(new T.RenderPass(scene, camera));
        bloom = new T.UnrealBloomPass(new T.Vector2(512, 256), 0.5, 0.35, 0.9);
        composer.addPass(bloom);
        grade = new T.ShaderPass({
          uniforms: { tDiffuse: { value: null }, uDark: { value: 0 }, uTint: { value: 0 }, uDesat: { value: 0 }, uTime: { value: 0 } },
          vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `uniform sampler2D tDiffuse; uniform float uDark, uTint, uDesat, uTime; varying vec2 vUv;
            void main(){
              vec4 c = texture2D(tDiffuse, vUv);
              vec2 d = vUv - 0.5; float v = dot(d, d);
              float g = dot(c.rgb, vec3(0.299, 0.587, 0.114));
              c.rgb = mix(c.rgb, vec3(g), uDesat);
              c.rgb = mix(c.rgb, c.rgb * vec3(1.35, 0.55, 0.45) + vec3(0.04, 0.0, 0.0), uTint);
              c.rgb *= 1.0 - clamp(v * (1.1 + uDark * 4.0), 0.0, 1.0) * (0.55 + 0.4 * uDark);
              c.rgb *= 1.0 - uDark * 0.35;
              gl_FragColor = LinearTosRGB(c);
            }`,
        });
        composer.addPass(grade);
      } catch (e) { console.warn("post-processing skipped", e); composer = null; }
    }
    Object.assign(R3, { ok: true, flashes, fxLight, composer, bloom, grade, models: [], proj: new Map(), cam: { x: 0, y: 4, z: 22, lx: 0, ly: 3.5 },
      frags: [], tiles: [], rings: [], last: performance.now(), post: { dark: 0, tint: 0, desat: 0 } });
    window.addEventListener("resize", () => { if (fight) resize3D(); });
    // a phone can drop the GL context mid-duel: fall back to the flat renderer until it comes back
    const cvs = renderer.domElement;
    cvs.addEventListener("webglcontextlost", e => { e.preventDefault(); R3.ok = false; R3.lost = true; layer.classList.remove("three"); });
    cvs.addEventListener("webglcontextrestored", () => { if (!R3.lost) return; R3.lost = false; R3.ok = true; R3.last = performance.now(); if (fight) { layer.classList.add("three"); resize3D(); if (!R3.models.length || R3.models[0].f !== fight.f.w) setup3D(fight); } });
    return true;
  } catch (e) { console.warn("3D unavailable, using pixel renderer", e); R3.ok = false; return false; }
}
function resize3D() {
  const r = $("screen").getBoundingClientRect();
  if (!r.width) return;
  const pr = Math.min((layer.classList.contains("touchmode") ? 1.5 : 2) * (R3.qScale || 1), window.devicePixelRatio || 1);
  R3.renderer.setPixelRatio(pr);
  R3.renderer.setSize(r.width, r.height, false);
  R3.camera.aspect = r.width / r.height; R3.camera.updateProjectionMatrix();
  if (R3.composer) { R3.composer.setPixelRatio(pr); R3.composer.setSize(r.width, r.height); }
  const ps = r.height * pr / (2 * Math.tan(R3.camera.fov * Math.PI / 360));
  R3.glow.mat.uniforms.uScale.value = ps; R3.smoke.mat.uniforms.uScale.value = ps;
}

/* ---------- particles ---------- */
function makeParticles(max, additive) {
  const T = THREE, g = new T.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
  g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("pcol", new T.BufferAttribute(col, 3));
  g.setAttribute("psize", new T.BufferAttribute(size, 1)); g.setAttribute("palpha", new T.BufferAttribute(alpha, 1));
  const mat = new T.ShaderMaterial({
    uniforms: { uScale: { value: 400 }, uBoost: { value: additive ? 2.2 : 1 } },
    vertexShader: `attribute vec3 pcol; attribute float psize; attribute float palpha; varying vec3 vC; varying float vA; uniform float uScale;
      void main(){ vC = pcol; vA = palpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; uniform float uBoost;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
        float a = ${additive ? "pow(1.0 - r * 2.0, 1.6)" : "smoothstep(0.5, 0.1, r) * 0.8"};
        gl_FragColor = vec4(vC * uBoost, a * vA); }`,
    transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
  });
  const pts = new T.Points(g, mat); pts.frustumCulled = false;
  return { pts, mat, g, max, list: [] };
}
const _c = window.THREE ? new THREE.Color() : null;
function emit(sys, o) {
  if (sys.list.length >= sys.max) sys.list.shift();
  _c.set(o.col || "#ffffff");
  const c2 = o.col2 ? new THREE.Color(o.col2) : null;
  sys.list.push({ x: o.x, y: o.y, z: o.z || 0, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: 0, max: o.life || 0.5,
    s0: o.size || 0.2, s1: o.size1 != null ? o.size1 : (o.size || 0.2) * 0.3, r: _c.r, g: _c.g, b: _c.b, c2,
    drag: o.drag != null ? o.drag : 3, grav: o.grav || 0, a0: o.alpha != null ? o.alpha : 1 });
}
function burst(sys, x, y, z, n, o) {
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = o.spd[0] + Math.random() * (o.spd[1] - o.spd[0]);
    let dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph), dz = Math.sin(ph) * Math.sin(th) * (o.flatZ != null ? o.flatZ : 0.6);
    if (o.up) dy = Math.abs(dy) * o.up;
    if (o.dir) dx = Math.abs(dx) * o.dir;
    emit(sys, { x: x + (Math.random() - 0.5) * (o.jit || 0), y: y + (Math.random() - 0.5) * (o.jit || 0), z, vx: dx * sp, vy: dy * sp, vz: dz * sp,
      life: o.life[0] + Math.random() * (o.life[1] - o.life[0]), size: o.size[0] + Math.random() * (o.size[1] - o.size[0]), size1: o.size1,
      col: Array.isArray(o.col) ? o.col[(Math.random() * o.col.length) | 0] : o.col, col2: o.col2, drag: o.drag, grav: o.grav, alpha: o.alpha });
  }
}
function stepParticles(sys, dt) {
  const L = sys.list, pos = sys.g.attributes.position.array, col = sys.g.attributes.pcol.array, sz = sys.g.attributes.psize.array, al = sys.g.attributes.palpha.array;
  let n = 0;
  for (let i = 0; i < L.length; i++) {
    const p = L[i]; p.life += dt;
    if (p.life >= p.max) continue;
    const k = p.life / p.max, dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vy = p.vy * dr + p.grav * dt; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0.02 && p.grav < 0) { p.y = 0.02; p.vy *= -0.3; }
    L[n] = p;
    pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
    const fade = (1 - k) * p.a0;
    if (p.c2) { col[n * 3] = p.r + (p.c2.r - p.r) * k; col[n * 3 + 1] = p.g + (p.c2.g - p.g) * k; col[n * 3 + 2] = p.b + (p.c2.b - p.b) * k; }
    else { col[n * 3] = p.r; col[n * 3 + 1] = p.g; col[n * 3 + 2] = p.b; }
    sz[n] = p.s0 + (p.s1 - p.s0) * k; al[n] = fade;
    n++;
  }
  L.length = n;
  for (const a of ["position", "pcol", "psize", "palpha"]) sys.g.attributes[a].needsUpdate = true;
  sys.g.setDrawRange(0, n);
}
