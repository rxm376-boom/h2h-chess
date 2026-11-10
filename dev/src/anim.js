/* =====================================================================
   Animation: poses are authored as hand / foot targets plus hip, lean and
   chest-turn values (arena pixels, relative to the point on the floor under
   the fighter; x = toward the opponent, y = up, z = toward the camera).
   "l" limbs are the lead side (far from the camera), "r" the rear side.
   The rig solves arms and legs with two-bone IK every frame.
   ===================================================================== */
const DIM = {
  P: { sw: 7.6, hw: 4.0, spine: 18.5, neck: 7.6, ua: 10.5, fa: 10.0, th: 15.0, sh: 15.0 },
  N: { sw: 7.2, hw: 3.8, spine: 18.5, neck: 7.8, ua: 10.5, fa: 10.5, th: 15.6, sh: 15.6 },
  B: { sw: 6.8, hw: 3.6, spine: 19.5, neck: 7.6, ua: 10.5, fa: 10.5, th: 15.0, sh: 15.0 },
  R: { sw: 10.2, hw: 5.0, spine: 19.5, neck: 7.4, ua: 11.0, fa: 10.5, th: 14.3, sh: 14.3 },
  Q: { sw: 6.8, hw: 3.8, spine: 18.5, neck: 7.6, ua: 10.5, fa: 10.5, th: 15.9, sh: 15.9 },
};
const STANCE = {
  P: { hip: [0, 30.3, 0], lean: .18, open: .8,  popen: .5,  roll: 0, hp: .1,  hy: 0, lh: [16, 46, -5], rh: [8, 45, 6],  lf: [10, 0, -4], rf: [-9, 0, 5],   lfp: 0, rfp: 0 },
  N: { hip: [0, 31, 0],   lean: .1,  open: .7,  popen: .45, roll: 0, hp: .05, hy: 0, lh: [15, 41, -5], rh: [6, 43, 6],  lf: [8, 0, -3],  rf: [-8, 0, 4],   lfp: 0, rfp: 0 },
  B: { hip: [0, 31, 0],   lean: .06, open: .6,  popen: .4,  roll: 0, hp: .02, hy: 0, lh: [15, 37, -3], rh: [-1, 31, 6], lf: [8, 0, -3],  rf: [-8, 0, 4],   lfp: 0, rfp: 0 },
  R: { hip: [0, 29.4, 0], lean: .12, open: .65, popen: .45, roll: 0, hp: .1,  hy: 0, lh: [15, 39, -8], rh: [7, 37, 10], lf: [11, 0, -5], rf: [-11, 0, 6], lfp: 0, rfp: 0 },
  Q: { hip: [0, 31.5, 0], lean: .03, open: .8,  popen: .5,  roll: 0, hp: 0,   hy: 0, lh: [12, 38, -5], rh: [5, 44, 7],  lf: [7, 0, -3],  rf: [-7, 0, 4],   lfp: 0, rfp: 0 },
};
const PK3 = ["hip", "lh", "rh", "lf", "rf"], PK1 = ["lean", "open", "popen", "roll", "hp", "hy", "lfp", "rfp"];
function poseOver(S, o) { // full pose = stance with the given fields replaced
  const p = {};
  for (const k of PK3) p[k] = (o && o[k]) || S[k];
  for (const k of PK1) p[k] = o && o[k] != null ? o[k] : S[k];
  p.rz = (o && o.rz) || 0; p.ry = (o && o.ry) || 0; p.sd = (o && o.sd) || null; p.dx = (o && o.dx) || 0; p.dy = (o && o.dy) || 0; p.hide = !!(o && o.hide);
  return p;
}
function poseMix(a, b, k) {
  const p = {};
  for (const key of PK3) { const x = a[key], y = b[key]; p[key] = [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]; }
  for (const key of PK1) p[key] = a[key] + (b[key] - a[key]) * k;
  p.rz = a.rz + (b.rz - a.rz) * k; p.ry = a.ry + (b.ry - a.ry) * k; p.dx = a.dx + (b.dx - a.dx) * k; p.dy = a.dy + (b.dy - a.dy) * k;
  p.sd = k < 0.5 ? a.sd : b.sd; p.hide = k < 0.5 ? a.hide : b.hide;
  return p;
}
const eOut = k => 1 - (1 - k) * (1 - k), eIn = k => k * k, eIO = k => k * k * (3 - 2 * k), sat = k => Math.max(0, Math.min(1, k));
const TAU = Math.PI * 2;

/* Strike templates: S = stance, R = reach of the move, H = strike height. Each gives a wind-up and a hit pose. */
const AN = {
  jab: (S, R, H) => ({ wind: { lh: [S.lh[0] - 4, H - 1, S.lh[2]], open: S.open - .15, hip: [-1, S.hip[1], 0] },
    hit: { lh: [R - 4, H, -2.5], open: S.open + .5, popen: S.popen + .15, hip: [3, S.hip[1] - .5, 0], lean: S.lean + .08, lf: [S.lf[0] + 2, 0, S.lf[2]], rh: [S.rh[0] + 1, S.rh[1] + 1, S.rh[2]] } }),
  cross: (S, R, H) => ({ wind: { rh: [S.rh[0] - 5, S.rh[1], S.rh[2] + 2], open: S.open + .25 },
    hit: { rh: [R - 4, H, 2], lh: [9, 45, -6], open: -.5, popen: -.1, hip: [5, S.hip[1] - .5, 0], lean: S.lean + .14, rf: [S.rf[0] + 2, 0, S.rf[2]], rfp: .6 } }),
  body: (S, R, H) => ({ wind: { rh: [2, H - 4, 9], open: S.open + .3, hip: [0, S.hip[1] - 2, 0] },
    hit: { rh: [R - 4, H, 2], lh: [9, 44, -6], open: -.45, popen: -.1, hip: [5, S.hip[1] - 3, 0], lean: S.lean + .3, rfp: .6 } }),
  hook: (S, R, H) => ({ wind: { rh: [-2, H + 4, 12], open: S.open + .35, hip: [0, S.hip[1] - 1.5, 0] },
    hit: { rh: [R - 5, H, 1], lh: [9, 45, -6], open: -.6, popen: -.2, hip: [5, S.hip[1] - 2, 0], lean: S.lean + .22, rfp: .7 } }),
  overhand: (S, R, H) => ({ wind: { rh: [-5, 60, 7], open: S.open + .3, lean: -.05 },
    hit: { rh: [R - 4, H, 2], lh: [8, 42, -6], open: -.5, lean: .42, hip: [5, S.hip[1] - 2, 0], rfp: .6 } }),
  lunge: (S, R, H) => ({ wind: { hip: [-4, S.hip[1] - 2.5, 0], lh: [6, H + 2, -6], open: S.open - .2, lean: S.lean + .1 },
    hit: { hip: [9, S.hip[1] - 2.5, 0], lh: [R - 4, H, -2], open: S.open + .55, lean: S.lean + .25, lf: [17, 0, S.lf[2]], rf: [-13, 0, S.rf[2]], rfp: .5 } }),
  bash: (S, R, H) => ({ wind: { hip: [-3, S.hip[1] - 2, 0], lh: [10, 44, -3], lean: S.lean + .1 },
    hit: { hip: [10, S.hip[1] - 3, 0], lh: [R - 9, 43, -1], rh: [R - 15, 36, 5], open: S.open + .5, lean: .45, lf: [17, 0, -4], rf: [-12, 0, 5], rfp: .5, hp: .2 } }),
  heavy: (S, R, H) => ({ wind: { rh: [-13, H - 2, 11], open: S.open + .55, popen: S.popen + .3, lean: -.02, hip: [-3, S.hip[1], 0] },
    hit: { rh: [R - 4, H, 0], lh: [6, 42, -7], open: -.75, popen: -.25, lean: .3, hip: [6, S.hip[1] - 1, 0], rfp: .7, rf: [S.rf[0] + 3, 0, S.rf[2]] } }),
  smash: (S, R, H) => ({ wind: { lh: [2, 68, -3], rh: [0, 68, 4], lean: -.22, hip: [-1, S.hip[1] + 1, 0], hp: -.2 },
    hit: { lh: [R - 5, H, -2.5], rh: [R - 7, H - 1, 3], lean: .55, hip: [4, S.hip[1] - 4, 0], hp: .3 } }),
  lowjab: (S, R, H) => ({ wind: { hip: [0, 21, 0], lh: [8, 20, -4], lean: .4, rh: [8, 34, 6] },
    hit: { hip: [2, 20, 0], lh: [R - 4, H, -2.5], lean: .5, open: S.open + .45, rh: [9, 33, 6] } }),
  hammer: (S, R, H) => ({ wind: { lh: [9, 60, -6], open: S.open - .1, lean: 0 },
    hit: { lh: [R - 4, H, -3], open: S.open + .45, lean: .35, hip: [3, S.hip[1] - 1.5, 0] } }),
  upper: (S, R, H) => ({ wind: { hip: [0, 22, 0], rh: [8, 22, 7], lean: .35, open: S.open + .2 },
    hit: { rh: [15, 64, 3], lh: [6, 40, -8], hip: [4, 31.5, 0], lean: -.12, open: -.5, rfp: .8 } }),
  wreck: (S, R, H) => ({ wind: { rh: [-17, 42, 11], open: 1.55, popen: 1.0, hip: [-6, 26.5, 0], lean: 0 },
    hit: { rh: [R - 4, H, 0], lh: [4, 40, -9], open: -.85, popen: -.3, hip: [8, 26.5, 0], lean: .38, rfp: .7, lf: [14, 0, -5] } }),
  lariat: (S, R, H) => ({ spin: "y", wind: { lh: [10, H, -10], rh: [-6, H, 10], hip: [0, S.hip[1] - 1, 0] },
    hit: { lh: [R - 5, H, -4], rh: [-14, H - 2, 8], open: S.open + .2, lean: .1 } }),
  backfist: (S, R, H) => ({ wind: { lh: [5, H, 7], open: S.open - .45 },
    hit: { lh: [R - 4, H, -4], open: S.open + .6, hip: [3, S.hip[1], 0] } }),
  flick: (S, R, H) => ({ wind: { rh: [2, H + 6, 8], open: S.open + .2 },
    hit: { rh: [R - 12, H, 2], open: -.3, lean: .15, hip: [3, S.hip[1], 0] } }),
  thrust: (S, R, H) => ({ wind: { rh: [-6, H, 8], open: 1.2, hip: [-3, S.hip[1] - 1, 0] },
    hit: { rh: [R - 12, H, 1], lh: [-2, 38, -8], open: -.7, hip: [8, S.hip[1] - 2, 0], lean: .3, lf: [15, 0, -3], rf: [-12, 0, 4], rfp: .5 } }),
  slash: (S, R, H) => ({ wind: { rh: [-8, 66, 6], lean: -.15, open: 1.2 },
    hit: { rh: [R - 11, H - 8, -2], lh: [-4, 40, -8], lean: .4, open: -.8, hip: [5, S.hip[1] - 2, 0], rfp: .5 } }),
  kick: (S, R, H) => ({ wind: { rf: [5, 22, 3], hip: [0, S.hip[1] + .5, 0], lean: -.05, lf: [2, 0, -2] },
    hit: { rf: [R - 6, H - 1, 1], hip: [6, S.hip[1] + .5, 0], lean: -.32, lf: [2, 0, -2], lh: [10, 42, -7], rh: [-3, 38, 9], open: S.open + .1, popen: -.1, rfp: -.2 } }),
  round: (S, R, H) => ({ wind: { rf: [0, 24, 13], popen: 1.1, hip: [1, S.hip[1] + .5, 0], lean: -.1, lf: [2, 0, -2] },
    hit: { rf: [R - 6, H, -1], popen: -.7, open: .1, lean: -.4, hip: [6, S.hip[1] + .5, 0], lf: [2, 0, -2], lh: [4, 44, -9], rh: [-8, 36, 8], roll: -.1 } }),
  crescent: (S, R, H) => ({ wind: { rf: [8, 26, -10], popen: -.3, lean: -.1, lf: [2, 0, -2] },
    hit: { rf: [R - 7, H, 1], lean: -.35, hip: [6, S.hip[1] + 1, 0], lf: [2, 0, -2], lh: [6, 40, -8], rh: [-6, 40, 9], popen: .2 } }),
  sidekick: (S, R, H) => ({ wind: { rf: [-1, 22, 2], hip: [-3, S.hip[1], 0], popen: -1.1, open: -.6, lean: -.25, lf: [0, 0, -2] },
    hit: { rf: [R - 6, H, 0], hip: [4, S.hip[1], 0], popen: -1.3, open: -.8, lean: -.75, lf: [0, 0, -2], lh: [2, 40, -6], rh: [-8, 44, 6], hp: .5 } }),
  launch: (S, R, H) => ({ wind: { lf: [5, 8, -3], hip: [-1, S.hip[1] - 2, 0], rf: [-4, 0, 4], lean: .1 },
    hit: { lf: [R - 9, H + 10, -2], hip: [3, S.hip[1] + 1, 0], rf: [-3, 0, 4], lean: -.38, lh: [2, 36, -8], rh: [-6, 40, 8] } }),
  knee: (S, R, H) => ({ wind: { hip: [0, S.hip[1] - 2, 0], rf: [-6, 6, 4], lh: [14, 50, -4], rh: [12, 50, 4] },
    hit: { hip: [8, S.hip[1] + 3, 0], rf: [13, 23, 2], lf: [3, 0, -3], lfp: .9, lh: [14, 36, -4], rh: [12, 35, 4], lean: .12 } }),
  flip: (S, R, H) => ({ spin: "flip", wind: { hip: [0, 24, 0], lean: .3, lh: [6, 30, -6], rh: [4, 30, 6] },
    hit: { hip: [0, S.hip[1], 0], lf: [3, 1, -3], rf: [7, 14, 3], lean: -.1, lh: [-4, 40, -8], rh: [-6, 40, 8] } }),
  spin: (S, R, H) => ({ spin: "y", wind: { rf: [-2, 22, 6], lean: -.1, lf: [1, 0, -2] },
    hit: { rf: [R - 6, H, 0], lean: -.42, popen: -.9, open: -.3, hip: [5, S.hip[1] + .5, 0], lf: [1, 0, -2], lh: [4, 42, -8], rh: [-8, 38, 8] } }),
  sweep: (S, R, H) => ({ wind: { hip: [-1, 17, 0], rf: [2, 3, 15], lf: [3, 0, -4], lean: .25, lh: [10, 10, -9], rh: [2, 26, 8] },
    hit: { hip: [-2, 15, 0], rf: [R - 6, 1.5, 0], lf: [2, 0, -4], lean: .1, lh: [8, 5, -10], rh: [-4, 24, 9], popen: -.6, rfp: -.3 } }),
  slide: (S, R, H) => ({ wind: { hip: [-2, 20, 0], lean: -.2 },
    hit: { hip: [0, 11, 0], lean: -.85, lf: [R - 7, 2, -2], rf: [15, 7, 4], lh: [-9, 9, -8], rh: [-11, 7, 8], hp: .6, lfp: -.4 } }),
  lowkick: (S, R, H) => ({ wind: { rf: [-2, 12, 5], lean: -.05, lf: [2, 0, -2] },
    hit: { rf: [R - 6, 3, 1], lean: -.2, hip: [3, S.hip[1] - 1, 0], lf: [2, 0, -2], popen: -.2 } }),
  bigboot: (S, R, H) => ({ wind: { rf: [4, 26, 4], lean: -.1, hip: [-2, S.hip[1], 0], lf: [1, 0, -3] },
    hit: { rf: [R - 7, H, 1], hip: [6, S.hip[1] + 1, 0], lean: -.45, lf: [1, 0, -3], lh: [6, 44, -11], rh: [-6, 40, 12] } }),
  axe: (S, R, H) => ({ wind: { rf: [16, 62, 0], lean: -.3, hip: [2, S.hip[1] + 1, 0], lf: [1, 0, -2] },
    hit: { rf: [R - 6, H - 8, 0], lean: .1, hip: [5, S.hip[1] - 1, 0], lf: [1, 0, -2] } }),
  sthrust: (S, R, H) => ({ wind: { lh: [10, 36, -3], rh: [-6, 34, 5], hip: [-3, S.hip[1] - 1, 0] },
    hit: { lh: [R - 23, H, -2], rh: [R - 39, H - 1, 4], hip: [7, S.hip[1] - 2, 0], lean: .28, lf: [15, 0, -3], rf: [-12, 0, 4], rfp: .5, open: S.open + .4 } }),
  sthrust2: (S, R, H) => ({ wind: { lh: [12, 40, -3], rh: [-4, 40, 5], hip: [2, S.hip[1] - 1, 0] },
    hit: { lh: [R - 23, H + 1, -2], rh: [R - 39, H + 3, 4], hip: [9, S.hip[1] - 3, 0], lean: .36, lf: [16, 0, -3], rf: [-13, 0, 4], rfp: .5, open: S.open + .45 } }),
  staffsmash: (S, R, H) => ({ wind: { lh: [4, 62, -3], rh: [-6, 50, 4], lean: -.2 },
    hit: { lh: [R - 24, H - 2, -2], rh: [R - 38, H + 6, 4], lean: .45, hip: [5, S.hip[1] - 3, 0] } }),
  stafflow: (S, R, H) => ({ wind: { hip: [0, 24, 0], lh: [10, 24, -3], rh: [-4, 30, 5] },
    hit: { hip: [3, 22, 0], lh: [R - 24, 16, -2], rh: [R - 38, 24, 4], lean: .45 } }),
  stafflift: (S, R, H) => ({ wind: { hip: [0, 25, 0], lh: [14, 14, -3], rh: [0, 22, 5], lean: .35 },
    hit: { lh: [R - 22, 36, -2], rh: [R - 36, 22, 4], hip: [4, 31.5, 0], lean: -.1 } }),
  staffsweep: (S, R, H) => ({ wind: { hip: [-1, 18, 0], lh: [6, 10, 8], rh: [-6, 18, 10], lean: .3 },
    hit: { hip: [0, 16, 0], lh: [R - 24, 5, -2], rh: [R - 40, 9, 3], lean: .35 } }),
  whirl: (S, R, H) => ({ spin: "y", wind: { lh: [14, H, -4], rh: [0, H, 6] },
    hit: { lh: [R - 26, H, -2], rh: [R - 40, H + 1, 4], lean: .15, hip: [3, S.hip[1] - 1, 0] } }),
  retreat: (S, R, H) => ({ wind: { rf: [4, 22, 3], hip: [-2, S.hip[1], 0], lean: -.1, lf: [0, 0, -2] },
    hit: { rf: [R - 8, H, 1], hip: [0, S.hip[1], 0], lean: -.45, lf: [-2, 0, -2], lh: [4, 40, -4], rh: [-8, 34, 5] } }),
  cast: (S, R, H) => ({ wind: { lh: [4, 34, -3], rh: [-4, 28, 5], hip: [-1, S.hip[1] - 1, 0] },
    hit: { lh: [4, 40, -2], rh: [-4, 32, 5], lean: -.06, open: S.open + .2 } }),
  airCast: (S, R, H) => ({ wind: { lh: [2, 40, -3], rh: [-4, 44, 5] },
    hit: { lh: [6, 34, -2], rh: [-2, 42, 5], lean: .25, lf: [2, 12, -3], rf: [-6, 14, 4] } }),
  airP: (S, R, H) => ({ wind: { lh: [4, 52, -4], lf: [0, 12, -3], rf: [-6, 14, 4] },
    hit: { lh: [R - 5, H, -2], rh: [4, 40, 6], lean: .5, lf: [-4, 12, -3], rf: [-10, 16, 4] } }),
  airK: (S, R, H) => ({ wind: { rf: [2, 16, 3], lf: [2, 14, -3] },
    hit: { rf: [R - 7, H - 2, 0], lf: [4, 18, -3], lean: -.3, lh: [4, 44, -8], rh: [-8, 40, 8] } }),
};
const MOVE_POSE = {};
for (const t in MOVESET) {
  MOVE_POSE[t] = {};
  for (const k in MOVESET[t]) {
    const m = MOVESET[t][k], S = STANCE[t], a = (AN[m.anim] || AN[m.arch] || AN.jab)(S, m.reach || 30, m.h || 40);
    MOVE_POSE[t][k] = { wind: poseOver(S, a.wind), hit: poseOver(S, a.hit), spin: a.spin || null };
  }
}

function idlePose(f, time) {
  const S = STANCE[f.t], br = Math.sin(time * 2.4 + (f.color === "w" ? 0 : 1.7));
  if (f.t === "N") { // light on the feet
    const b = Math.abs(Math.sin(time * 5.2)) * 1.3;
    return poseOver(S, { hip: [Math.sin(time * 2.6) * .8, S.hip[1] + b, 0], lh: [S.lh[0], S.lh[1] + b * .8, S.lh[2]], rh: [S.rh[0], S.rh[1] + b * .6, S.rh[2]], lfp: b * .25, rfp: b * .3 });
  }
  const amp = f.t === "R" ? .45 : .6;
  return poseOver(S, { hip: [0, S.hip[1] + br * amp, 0], lean: S.lean + br * .012, lh: [S.lh[0], S.lh[1] + br * .7, S.lh[2]], rh: [S.rh[0], S.rh[1] + br * .5 + .2, S.rh[2]] });
}
function walkPose(f, time) {
  const S = STANCE[f.t], ph = f.walkT * (f.t === "R" ? 7.5 : 10.5), A = f.t === "R" ? 5 : 6, s = Math.sin(ph), c = Math.cos(ph);
  return poseOver(S, { hip: [0, S.hip[1] - .5 + Math.abs(c) * 1.1, 0],
    lf: [S.lf[0] - A * c, Math.max(0, s) * 4.5, S.lf[2]], rf: [S.rf[0] + A * c, Math.max(0, -s) * 4.5, S.rf[2]],
    lh: [S.lh[0] + c * 1.2, S.lh[1] + Math.abs(s) * .6, S.lh[2]], rh: [S.rh[0] - c * 1.2, S.rh[1] + Math.abs(s) * .6, S.rh[2]], roll: c * .03 });
}
const LYING = { hip: [0, 5.5, 0], lf: [3, -22, -5], rf: [2, -23, 6], lh: [3, 30, -12], rh: [2, 27, 12], lean: 0, hp: -.15, rz: -Math.PI / 2, open: .15, popen: .15 };
function hitPose(f, S) {
  const a = Math.exp(-f.stT * 9), k = f.hitKind;
  if (k === "high") return { lean: -.34 - .28 * a, hip: [-2 - 3 * a, S.hip[1], 0], hp: -.35 - .4 * a, lh: [6, 41, -9], rh: [-4, 39, 10], lf: [S.lf[0] - 3, 0, S.lf[2]] };
  if (k === "low") return { hip: [-2, S.hip[1] - 5 - 2 * a, 0], lf: [2, 5 + 4 * a, -4], lean: .28, lh: [12, 32, -8], rh: [4, 34, 9], hp: .2 };
  if (k === "splat") return { lean: -.2, hip: [-3, S.hip[1] - 1 - 2 * (1 - a), 0], lh: [-7, 54 - 14 * (1 - a), -11], rh: [-7, 52 - 14 * (1 - a), 11], hp: -.3 + .5 * (1 - a), open: .2, popen: .2 };
  if (k === "gut") return { lean: .5 + .2 * a, hip: [-5 - 3 * a, S.hip[1] - 3.5, 0], lh: [7, 29, -4], rh: [5, 28, 5], hp: .45, lf: [S.lf[0] - 2, 0, S.lf[2]] };
  return { lean: .28 + .2 * a, hip: [-3 - 3 * a, S.hip[1] - 2, 0], lh: [9, 33, -6], rh: [3, 34, 7], hp: .25 };
}
// strikes used by each piece's rage art, landing on the five damage ticks
const RAGE_SEQ = {
  P: ["P", "P2", "P3", "P", "bP"], N: ["K", "P2", "P2K", "P", "bK"], B: ["fP", "fP2", "KK", "fP", "bP"], R: ["P", "P2", "P", "K", "bP"], Q: ["P", "P2", "P3", "P3K", "bP"],
};
// each piece ends its rage art on its own finisher: [template, reach, height]
const RAGE_FIN = {};
for (const [t, a, R, H] of [["P", "upper", 40, 60], ["N", "flip", 40, 40], ["B", "staffsmash", 56, 26], ["R", "smash", 44, 16], ["Q", "thrust", 52, 44]]) {
  const S = STANCE[t], x = AN[a](S, R, H); RAGE_FIN[t] = { wind: poseOver(S, x.wind), hit: poseOver(S, x.hit) };
}
function ragePose(f, c) {
  const S = STANCE[f.t], seq = RAGE_SEQ[f.t], T = c.ticks, t = c.t;
  let i = 0; while (i < T.length - 1 && t > T[i] + 0.1) i++;
  const last = i === T.length - 1, wEnd = last ? 0.72 : 0.5;
  const prev = i === 0 ? 0 : T[i - 1] + 0.1, mp = last ? RAGE_FIN[f.t] : MOVE_POSE[f.t][seq[i]], k = sat((t - prev) / (T[i] - prev));
  const before = i === 0 ? poseOver(S) : MOVE_POSE[f.t][seq[i - 1]].hit;
  if (t > T[i]) { const p = poseMix(mp.hit, poseOver(S), sat((t - T[i]) / 0.3) * 0.25); if (last && f.t === "P") p.dy = 12 * Math.max(0, 1 - (t - T[i]) * 6); return p; }
  const p = k < wEnd ? poseMix(before, mp.wind, eOut(k / wEnd)) : poseMix(mp.wind, mp.hit, eIn((k - wEnd) / (1 - wEnd)));
  if (last && k < wEnd) { p.hip = [p.hip[0] - 4 * eOut(k / wEnd), p.hip[1] - 3 * eOut(k / wEnd), 0]; }
  if (last && k >= wEnd) { const u = (k - wEnd) / (1 - wEnd);
    if (f.t === "N") { p.rz = -TAU * eIO(u); p.dy = 16 * Math.sin(Math.PI * u); }
    else if (f.t === "P") p.dy = 12 * eIn(u);
    else if (f.t === "R" || f.t === "B") p.dy = 9 * Math.sin(Math.PI * u); }
  return p;
}
const INTRO_DUR = { P: 1.5, N: 1.5, B: 1.5, R: 1.75, Q: 1.55 };
// entrances: t in seconds; fx(name) fires one-shot effects
function introPose(f, t, fx) {
  const S = STANCE[f.t], st = idlePose(f, t), D = INTRO_DUR[f.t];
  const settle = (p, from) => t >= from ? poseMix(p, st, eIO(sat((t - from) / (D - from)))) : p;
  if (t < 0) return poseOver(S, { hide: true });
  if (f.t === "P") {
    const k = sat(t / 0.85), w = walkPose({ t: "P", walkT: t * 1.7 }, t); w.dx = -86 * (1 - eOut(k));
    if (t < 0.85) return w;
    const bang = poseOver(S, { rh: [15, 45, -1], lh: [15, 46, -4], open: .3, lean: .26, hip: [1, S.hip[1] - 1, 0] });
    if (t < 1.05) { return poseMix(poseOver(S, { rh: [-6, 48, 10], open: 1.1 }), bang, eIn(sat((t - .9) / .15))); }
    if (t < 1.12) { fx("clang"); return bang; }
    return settle(bang, 1.12);
  }
  if (f.t === "N") {
    const tuck = poseOver(S, { hip: [0, S.hip[1], 0], lf: [6, 14, -3], rf: [-2, 12, 4], lh: [8, 34, -6], rh: [2, 34, 7], lean: .4 });
    if (t < 0.55) { const k = t / 0.55; tuck.dy = 150 * (1 - k * k); tuck.dx = -40 * (1 - k); tuck.rz = TAU * 1.0 * (1 - k); return tuck; }
    const crouch = poseOver(S, { hip: [0, 17, 0], lean: .45, lh: [12, 12, -8], rh: [-4, 30, 8], hp: .3 });
    if (t < 0.62) { fx("land"); return crouch; }
    if (t < 0.85) return crouch;
    const kick = MOVE_POSE.N.K;
    if (t < 1.0) return poseMix(crouch, kick.wind, eOut((t - .85) / .15));
    if (t < 1.08) { fx("whoosh"); return poseMix(kick.wind, kick.hit, eIn((t - 1.0) / .08)); }
    if (t < 1.2) return kick.hit;
    return settle(kick.hit, 1.2);
  }
  if (f.t === "B") {
    if (t < 0.25) return poseOver(S, { hide: true });
    const float = poseOver(S, { lh: [5, 50, -11], rh: [3, 38, 9], sd: [0.05, 1, 0], lf: [3, 4, -3], rf: [-1, 1, 4], lfp: .7, rfp: .7, lean: -.04, hp: -.15, open: 1.0 });
    if (t < 0.32) fx("blink");
    if (t < 1.0) { float.dy = 16 * (1 - eIO(sat((t - .25) / .75))); return float; }
    const plant = poseOver(S, { lh: [8, 44, -9], rh: [5, 34, 8], sd: [0.05, 1, 0], open: .9 });
    if (t < 1.1) { fx("plant"); return poseMix(float, plant, eOut((t - 1.0) / .1)); }
    return settle(plant, 1.15);
  }
  if (f.t === "R") {
    const ball = poseOver(S, { hip: [0, 22, 0], lean: .5, lh: [12, 22, -9], rh: [8, 20, 10], lf: [8, 4, -5], rf: [-6, 3, 6] });
    if (t < 0.5) { const k = t / 0.5; ball.dy = 190 * (1 - k * k); return ball; }
    const kneel = poseOver(S, { hip: [0, 16, 0], lean: .55, lh: [14, 20, -9], rh: [12, 3, 8], hp: .5 });
    if (t < 0.58) { fx("slam"); return kneel; }
    if (t < 1.0) return kneel;
    const up = poseOver(S, { lh: [10, 44, -12], rh: [8, 44, 13], lean: 0, open: .9 });
    const pound = poseOver(S, { lh: [12, 40, -1.5], rh: [12, 40, 2.5], lean: .1, open: .2 });
    if (t < 1.25) return poseMix(kneel, up, eIO((t - 1.0) / .25));
    if (t < 1.36) return poseMix(up, pound, eIn((t - 1.25) / .11));
    if (t < 1.42) { fx("clang"); return pound; }
    return settle(pound, 1.42);
  }
  // Queen
  const desc = poseOver(S, { lf: [5, 14, -3], rf: [-1, 2, 4], rfp: .8, rh: [2, 64, 6], lh: [2, 34, -11], lean: -.06, hp: -.1, open: 1.1 });
  if (t < 0.9) { desc.dy = 62 * (1 - eOut(t / 0.9)); return desc; }
  const point = poseOver(S, { rh: [19, 47, 2], lh: [-5, 34, -8], open: -.35, lean: .08, hip: [2, S.hip[1], 0] });
  if (t < 0.97) fx("soft");
  if (t < 1.15) return poseMix(desc, point, eIO((t - .9) / .25));
  if (t < 1.22) fx("whoosh");
  return settle(point, 1.3);
}
function winPose(f, t) {
  const S = STANCE[f.t], st = idlePose(f, t), k = eIO(sat(t / 0.45)), b = Math.sin(t * 3) * .5;
  let p;
  if (f.t === "P") p = poseOver(S, { rh: [3, 69 + b, 5], lh: [9, 40, -9], lean: -.06, open: 1.15, hp: -.15, hip: [0, S.hip[1] + 1 + Math.abs(Math.sin(t * 6)) * 1.2, 0] });
  else if (f.t === "N") p = poseOver(S, { lh: [9, 51, -10], rh: [-3, 53, 10], lf: [10, 17 + b, -2], hip: [0, 32.5, 0], rf: [-1, 0, 3], lean: -.05, open: 1.0 });
  else if (f.t === "B") p = poseOver(S, { lh: [9, 60 + b, -7], rh: [3, 36, 8], sd: [0.04, 1, 0], open: 1.1, lean: -.03, hp: -.1 });
  else if (f.t === "R") { const pd = Math.max(0, Math.sin(t * 5)) ; p = poseOver(S, { lh: [7, 62 - pd * 3, -13], rh: [4, 62 - pd * 3, 14], lean: -.1, open: 1.2, hp: -.2, hip: [0, S.hip[1] + 1, 0] }); }
  else p = poseOver(S, { rh: [5, 71 + b, 6], lh: [3, 33, -9], lean: -.08, open: 1.2, hp: -.12, hip: [0, S.hip[1] + .5, 0] });
  return poseMix(st, p, k);
}

// throws: grab hold -> set up -> finish, one per piece
const THROW_POSE = {
  P: { hold: { lh: [17, 45, -4], rh: [16, 42, 5], lean: .12, open: .2 },                                   // Shield Toss: pull in, bash away with the shield
       up: { lh: [8, 46, -3], rh: [4, 40, 7], lean: -.2, open: -.3, hip: [-3, 28.5, 0] },
       fin: { lh: [28, 45, -2], rh: [6, 40, 8], lean: .42, hip: [8, 28.5, 0], open: .9, rfp: .6, lf: [16, 0, -4] } },
  N: { hold: { lh: [17, 45, -4], rh: [16, 42, 5], lean: .12, open: .2 },                                   // Rodeo Vault: hop and drive both feet through
       up: { lh: [14, 50, -5], rh: [12, 48, 6], lf: [10, 24, -3], rf: [8, 22, 3], lean: -.1, hip: [0, 33, 0] },
       fin: { lh: [-4, 42, -9], rh: [-8, 40, 9], lf: [25, 35, -2], rf: [23, 32, 3], lean: -.7, hip: [3, 34, 0], hp: .5 } },
  B: { hold: { lh: [22, 34, -3], rh: [8, 32, 5], lean: .15, open: .3 },                                    // Crook Hook: hook the ankles, yank
       up: { lh: [25, 9, -2], rh: [11, 17, 4], lean: .45, hip: [3, 26, 0] },
       fin: { lh: [5, 42, -3], rh: [-9, 31, 5], lean: -.22, hip: [-4, 30.5, 0], open: .9 } },
  R: { hold: { lh: [17, 45, -4], rh: [16, 42, 5], lean: .12, open: .2 },                                   // Tower Slam: press overhead, slam
       up: { lh: [10, 66, -6], rh: [8, 66, 7], lean: -.12, open: .2, hip: [0, 29, 0] },
       fin: { lh: [20, 14, -5], rh: [18, 12, 6], lean: .7, hip: [4, 23, 0], open: .2 } },
  Q: { hold: { rh: [17, 46, 3], lh: [2, 36, -8], lean: .08, open: -.3 },                                   // Royal Decree: lift with one hand, dismiss
       up: { rh: [14, 66, 3], lh: [-3, 33, -9], lean: -.1, open: -.4, hip: [0, 32, 0] },
       fin: { rh: [21, 18, 2], lh: [-5, 36, -9], lean: .3, open: -.7, hip: [3, 30.5, 0] } },
};

/* The pose a fighter should be in right now, from its simulation state */
function fighterPose(f, F, time) {
  const S = STANCE[f.t], st = f.state, t = f.stT;
  if (F.cine && F.cine.kind === "rage") {
    if (F.cine.f === f) return ragePose(f, F.cine);
    if (F.cine.o === f) { const c = F.cine, i = Math.max(0, c.i - 1), since = c.i ? c.t - c.ticks[i] : 1, a = Math.exp(-since * 8); const hi = i % 2 === 0;
      return poseOver(S, hi ? { lean: -.3 - .3 * a, hip: [-2 - 3 * a, S.hip[1] - 1, 0], hp: -.3 - .4 * a, lh: [5, 42, -10], rh: [-5, 38, 11] } : { lean: .4 + .25 * a, hip: [-4 - 3 * a, S.hip[1] - 3, 0], lh: [7, 29, -4], rh: [5, 28, 5], hp: .4 }); }
  }
  if (st === "ko" || st === "down") return poseOver(S, Object.assign({}, LYING, st === "down" ? {} : { lh: [1, 34, -13], rh: [-1, 30, 13] }));
  if (st === "fall") { const rot = f.juggle > 1 ? 1 : eIO(sat(t / 0.3)), up = sat(-f.vy / 260), dn = sat(f.vy / 260), w = Math.sin(t * 11), tum = f.ko ? Math.min(1.6, t * 2.4) : dn * .35;
    // rising: chest up, limbs trailing below; falling: back arched, legs kicked up, arms flung wide
    return poseOver(S, { rz: (-0.95 - tum - dn * .3) * rot - 0.001, hip: [0, 22, 0], lean: -.1 - dn * .35 + up * .25, hp: -.3 - dn * .3,
      lh: [-2 - up * 6, 46 - up * 14 + dn * 8 + w * 2, -11 - dn * 3], rh: [-4 - up * 6, 42 - up * 14 + dn * 10 - w * 2, 11 + dn * 3],
      lf: [9 + dn * 8, 4 - up * 5 + dn * 9 + w * 2, -5], rf: [5 + dn * 4, 1 - up * 5 + dn * 5 - w * 2, 6], lfp: .5, rfp: .5 }); }
  if (st === "getup") { const k = eIO(sat(1 - f.st / 0.3)); return poseMix(poseOver(S, LYING), poseOver(S, { hip: [0, 20, 0], lean: .45, lh: [10, 10, -8], rh: [6, 28, 7] }), k); }
  if (st === "win") return winPose(f, t);
  if (st === "lose") return poseMix(idlePose(f, time), poseOver(S, { hip: [-2, 15, 0], lf: [8, 0, -4], rf: [-10, 0, 5], rfp: .9, lh: [9, 5, -7], rh: [4, 22, 8], lean: .62, hp: .65 }), eIO(sat(t / 0.5)));
  if (st === "hit") return poseOver(S, hitPose(f, S));
  if (st === "block") { const a = Math.exp(-t * 12);
    if (f.blockLow) return poseOver(S, { hip: [-1 - 2 * a, 20, 0], lh: [13, 22, -3], rh: [11, 31, 4], lean: .38, hp: .25 });
    if (f.t === "B") return poseOver(S, { lh: [13, 54, -2], rh: [11, 26, 4], hip: [-2 - 2 * a, S.hip[1] - 1, 0], lean: -.04 });
    if (f.t === "R") return poseOver(S, { lh: [13, 46, 2], rh: [12, 42, -1], hip: [-1 - 2 * a, S.hip[1] - 1, 0], lean: .1, open: .3, hp: .2 });
    return poseOver(S, { lh: [13, 49, -3], rh: [11, 46, 4], hip: [-2 - 2 * a, S.hip[1] - 1, 0], lean: -.03, hp: .2, open: S.open - .2 }); }
  if (st === "dash") {
    const fwd = f.dash && f.dash.dir === f.face;
    if (f.t === "R") return poseOver(S, { hip: [6, 25, 0], lean: .6, lh: [18, 40, -3], rh: [14, 34, 6], lf: [15, 2, -5], rf: [-14, 5, 6], hp: .3 });
    return fwd ? poseOver(S, { hip: [5, 27, 0], lean: .5, lf: [15, 3, -3], rf: [-15, 9, 4], lh: [-6, 36, -9], rh: [-10, 40, 9], rfp: .8 })
      : poseOver(S, { hip: [-4, 28, 0], lean: -.18, lf: [9, 3, -3], rf: [-13, 5, 4], lfp: .5 });
  }
  if (st === "step") return poseOver(S, { hip: [0, S.hip[1] - 4, 0], lean: S.lean + .15, open: S.open + (f.step && f.step.dir > 0 ? -.5 : .5), popen: S.popen + (f.step && f.step.dir > 0 ? -.4 : .4), lf: [S.lf[0] - 2, 2, S.lf[2]] });
  if (st === "throw") {
    if (!f.grab) return poseOver(S, { lh: [23, 44, -4], rh: [21, 42, 5], lean: .3, hip: [5, S.hip[1] - 1, 0], open: .2 });
    const g = f.grab.t, T = THROW_POSE[f.t], hold = poseOver(S, T.hold), up = poseOver(S, T.up), fin = poseOver(S, T.fin);
    let p;
    if (g < 0.2) p = hold;
    else if (g < 0.46) p = poseMix(hold, up, eIO((g - .2) / .26));
    else p = poseMix(up, fin, eIn(sat((g - .46) / .14)));
    if (f.t === "N") p.dy = 15 * Math.sin(Math.PI * sat((g - .26) / .4)); // vault
    return p;
  }
  if (st === "thrown") {
    const th = f.thrower, g = th && th.grab ? th.grab.t : 0, kind = th ? th.t : "P";
    const p = poseOver(S, { lean: -.25, hip: [-1, S.hip[1] - 1, 0], lh: [8, 50, -10], rh: [2, 48, 11], hp: -.3, lf: [6, 0, -4], rf: [-5, 0, 5] });
    const k = eIO(sat((g - .2) / .26)), d = eIn(sat((g - .46) / .14));
    if (kind === "R") { p.dy = 34 * k * (1 - d); p.rz = -1.3 * k; p.dx = -10 * k * (1 - d); }               // pressed overhead, slammed
    else if (kind === "Q") { p.dy = 26 * k * (1 - d); p.rz = -.12 * k - 1.2 * d; p.lf = [3, -6, -3]; p.rf = [-2, -5, 4]; p.lfp = p.rfp = .8 * k; } // levitated, dropped
    else if (kind === "B") { p.rz = -.2 * k - 1.1 * d; p.dy = 9 * d; p.lf = [6 + 8 * d, 4 * k, -4]; p.dx = 5 * k; }   // legs hooked from under
    else if (kind === "N") { p.rz = -.25 * k - .5 * d; p.dx = -3 * k; p.lean = -.25 - .3 * d; }                     // kicked off the chest
    else { p.rz = -.35 * k; p.dx = -4 * k; }
    return p;
  }
  if (st === "special" && f.sp) {
    const k = f.sp.kind, mt = f.mt;
    if (k === "rush" || k === "rage") { const a = MOVE_POSE[f.t][f.t === "B" ? "fP" : "fP"] || MOVE_POSE[f.t].P; return mt < 0.07 ? a.wind : poseOver(S, Object.assign({}, { hip: [9, S.hip[1] - 4, 0], lean: .55, lf: [16, 2, -4], rf: [-15, 6, 5], rfp: .8, hp: .3 }, f.t === "B" ? { lh: [30, 36, -2], rh: [14, 35, 4] } : { lh: [20, 42, -2], rh: [-8, 34, 8] })); }
    if (k === "leap") return f.sp.phase === "dive" ? poseOver(S, { rf: [20, 3, 0], lf: [6, 18, -3], lean: -.45, lh: [2, 44, -9], rh: [-8, 42, 9], hp: .4 })
      : poseOver(S, { hip: [0, S.hip[1], 0], lf: [6, 14, -3], rf: [-2, 12, 4], lh: [8, 34, -6], rh: [2, 34, 7], lean: .4, rz: -TAU * eIO(sat(mt / 0.38)) });
    if (k === "quake") { const up = poseOver(S, { lh: [4, 66, -8], rh: [2, 66, 9], lean: -.2, hip: [0, S.hip[1] + 1, 0], hp: -.2 }), dn = poseOver(S, { lh: [17, 5, -6], rh: [15, 4, 7], lean: .75, hip: [3, 17, 0], hp: .5 });
      return mt < 0.18 ? poseMix(poseOver(S), up, eOut(mt / .18)) : mt < 0.26 ? poseMix(up, dn, eIn((mt - .18) / .08)) : poseMix(dn, poseOver(S), eIO(sat((mt - .42) / .18))); }
    if (k === "beam") { const a = poseOver(S, { rh: [-6, 48, 9], open: 1.2, hip: [-2, S.hip[1], 0] }), b = poseOver(S, { rh: [13, 46, 2], lh: [-6, 36, -8], open: -.6, lean: .12, hip: [3, S.hip[1], 0] });
      return mt < 0.16 ? poseMix(a, b, eIn(sat((mt - .08) / .08))) : poseMix(b, poseOver(S), eIO(sat((mt - .3) / .12))); }
  }
  if (f.move && MOVE_POSE[f.t][f.move]) {
    const m = f.ms[f.move], mp = MOVE_POSE[f.t][f.move], mt = f.mt, base = st === "jump" ? jumpPose(f, S) : poseOver(S);
    let p;
    if (m.air) p = mt < m.su ? poseMix(base, mp.wind, eOut(mt / m.su)) : poseMix(mp.wind, mp.hit, eIn(sat((mt - m.su) / 0.05)));
    else {
      const tw = m.su * 0.5;
      if (mt < tw) p = poseMix(base, mp.wind, eOut(mt / tw));
      else if (mt < m.su) p = poseMix(mp.wind, mp.hit, eIn((mt - tw) / (m.su - tw)));
      else if (mt < m.su + m.ac) p = mp.hit;
      else p = poseMix(mp.hit, base, eIO(sat((mt - m.su - m.ac) / m.rc)));
      if (mp.spin === "y") p.ry = mt < tw ? Math.PI * .9 * eIn(mt / tw) : mt < m.su ? Math.PI * .9 + (TAU - Math.PI * .9) * ((mt - tw) / (m.su - tw)) : 0;
      else if (mp.spin === "flip") { const e = m.su + m.ac + 0.24; p.rz = mt < m.su ? -1.75 * (mt / m.su) : mt < e ? -1.75 - (TAU - 1.75) * ((mt - m.su) / (e - m.su)) : 0; if (mt >= m.su + m.ac && mt < e) { p.lf = [5, 12, -3]; p.rf = [3, 12, 4]; } }
    }
    return p;
  }
  if (st === "crouch") return poseOver(S, { hip: [0, 19.5, 0], lean: .32, lh: [14, 32, -4], rh: [8, 33, 6], hp: .1 });
  if (st === "jump") return jumpPose(f, S);
  if (st === "land" && f.finT != null && F.t - f.finT < 0.5) return poseMix(RAGE_FIN[f.t].hit, poseOver(S), eIO(sat((t - 0.22) / 0.2))); // hold the finisher, each piece its own
  if (st === "land") return poseOver(S, { hip: [0, S.hip[1] - 6, 0], lean: S.lean + .2, lh: [14, 34, -7], rh: [6, 34, 8] });
  if (st === "walk") return walkPose(f, time);
  const idle = idlePose(f, time);
  if (f.t === "B") { const o = F.att === f ? F.def : F.att; if (Math.abs(o.x - f.x) < 50) { idle.sd = [0.22, 1, 0]; idle.lh = [11, 45, -3]; idle.rh = [5, 29, 6]; } } // staff held upright at close range so it does not skewer the opponent
  return idle;
}
function jumpPose(f, S) {
  const up = f.vy < -40, p = poseOver(S, up ? { lf: [7, 12, -3], rf: [-3, 9, 4], lh: [10, 48, -8], rh: [0, 48, 9], lean: S.lean + .1, lfp: .6, rfp: .6 }
    : { lf: [6, 5, -3], rf: [-5, 3, 4], lh: [8, 44, -11], rh: [-2, 44, 12], lean: S.lean, lfp: .4, rfp: .4 });
  if (f.t === "N" && f.airJ < f.s.airJumps && f.stT < 0.36) p.rz = TAU * eIO(f.stT / 0.36); // somersault on the double jump
  return p;
}
