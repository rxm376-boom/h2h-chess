function stepDebris(dt) {
  for (const fr of R3.frags) {
    fr.life += dt; if (fr.life > 4) continue;
    fr.vy -= 22 * dt; fr.m.position.x += fr.vx * dt; fr.m.position.y += fr.vy * dt; fr.m.position.z += fr.vz * dt;
    fr.m.rotation.x += fr.ax * dt; fr.m.rotation.z += fr.az * dt;
    if (fr.m.position.y < fr.r) { fr.m.position.y = fr.r; fr.vy *= -0.35; fr.vx *= 0.6; fr.vz *= 0.6; fr.ax *= 0.6; fr.az *= 0.6; }
    if (fr.max < 99 && fr.life > fr.max) fr.m.scale.multiplyScalar(0.9);
  }
  R3.frags = R3.frags.filter(fr => { if (fr.max < 99 && fr.life > fr.max + 0.5) { R3.scene.remove(fr.m); return false; } return true; });
  for (const ti of R3.tiles) {
    ti.t += dt; if (ti.t < 0) continue;
    ti.vy -= 26 * dt; ti.y += ti.vy * dt; ti.m.position.y = ti.y; ti.m.rotation.x += ti.rx * dt; ti.m.rotation.z += ti.rz * dt;
  }
  R3.tiles = R3.tiles.filter(ti => { if (ti.t > 0.2 && ti.y < -0.4) { R3.scene.remove(ti.m); return false; } return true; });
  for (const r of R3.rings) {
    r.t += dt; const k = Math.min(1, r.t / r.dur), e = 1 - Math.pow(1 - k, 2);
    r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e); r.m.material.opacity = (1 - k) * 0.9;
    if (!r.flat) r.m.quaternion.copy(R3.camera.quaternion);
  }
  R3.rings = R3.rings.filter(r => { if (r.t >= r.dur) { R3.scene.remove(r.m); r.m.material.dispose(); return false; } return true; });
  R3.fxLight.intensity *= Math.exp(-dt * 9);
}
