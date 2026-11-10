const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const T = path.join(__dirname, 'node_modules/three');
  const mk = async (vp, mobile) => { const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1, hasTouch: !!mobile });
    await p.route('**/*', r => { const u = r.request().url();
      if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
      const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
      if (u.startsWith('file:')) return r.continue(); return r.abort(); });
    p.on('pageerror', e => console.log('[pageerror]', e.message));
    await p.goto('file://' + path.resolve(__dirname, 'out/index.html')); await p.waitForTimeout(1200); return p; };
  const p = await mk({ width: 1200, height: 900 });
  // custom position
  const setup = `(() => { const h = window.__h2h, S = h.state, B = S.board; let id = 100;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) B[r][c] = null;
    const put = (r, c, t, col) => B[r][c] = { t, c: col, hp: h.STATS[t].hp, moved: true, id: id++ };
    put(7, 4, 'K', 'w'); put(0, 4, 'K', 'b');
    put(5, 2, 'N', 'w'); put(3, 3, 'P', 'b');            // Nc3 x d5 pawn, undefended
    put(4, 6, 'B', 'w'); put(3, 7, 'P', 'b'); put(2, 6, 'P', 'b'); // Bg4 x h5, defended by g6 pawn
    put(7, 7, 'R', 'w');  put(1, 0, 'P', 'w'); put(6, 1, 'P', 'b');
    S.turn = 'w'; h.render(); })()`;
  await p.evaluate(setup);
  console.log('free d5', await p.evaluate(() => { const h = window.__h2h, B = h.state.board; return [h.freeCapture(B, { fr: 5, fc: 2, tr: 3, tc: 3, cap: { r: 3, c: 3 } }), h.freeCapture(B, { fr: 4, fc: 6, tr: 3, tc: 7, cap: { r: 3, c: 7 } }), JSON.stringify(h.backupFor(B, { fr: 4, fc: 6, tr: 3, tc: 7, cap: { r: 3, c: 7 } }))]; }));
  await p.evaluate(() => { const h = window.__h2h; h.CONFIG.level = 0; h.onSquare(5, 2); });
  console.log('note:', await p.textContent('#statusNote'));
  await p.evaluate(() => window.__h2h.onSquare(3, 3)); await p.waitForTimeout(300);
  console.log('after free capture: fight', await p.evaluate(() => !!window.__h2h.fight), 'moves', await p.evaluate(() => window.__h2h.state.moves.join(' ')), 'taken', await p.evaluate(() => JSON.stringify(window.__h2h.state.taken)));
  // let cpu move (black) - wait
  await p.waitForTimeout(2500);
  let st = await p.evaluate(() => ({ turn: window.__h2h.state.turn, fight: !!window.__h2h.fight, moves: window.__h2h.state.moves.join(' '), clock: window.__h2h.state.clock }));
  console.log(JSON.stringify(st));
  if (st.fight) { await p.evaluate(() => { const F = window.__h2h.fight; F.result = { attackerWon: false, attackerHp: 0, defenderHp: 20 }; window.__h2h.endFight(F); }); await p.waitForTimeout(2500); }
  await p.evaluate(setup);
  // duel: Bxh5, force a loss
  await p.evaluate(() => { const h = window.__h2h; h.onSquare(4, 6); });
  console.log('note:', await p.textContent('#statusNote'));
  await p.evaluate(() => window.__h2h.onSquare(3, 7));
  for (let i = 0; i < 60 && !(await p.evaluate(() => !!window.__h2h.fight)); i++) await p.waitForTimeout(500);
  console.log('fight', await p.evaluate(() => { const F = window.__h2h.fight; return F && { a: F.att.t, bk: [F.att.backup, F.def.backup], meter: [F.att.meter, F.def.meter], boost: [F.att.boost, F.def.boost] }; }));
  await p.screenshot({ path: 'out/t_vs.png' });
  await p.evaluate(() => { const F = window.__h2h.fight; F.result = { attackerWon: false, attackerHp: 0, defenderHp: 20 }; window.__h2h.endFight(F); });
  await p.waitForTimeout(3000);
  console.log('after fail', await p.evaluate(() => { const S = window.__h2h.state, B = S.board; return { bishop: B[4][6] && B[4][6].t + B[4][6].hp, pawn: B[3][7] && B[3][7].hp, moves: S.moves.join(' '), turn: S.turn, over: S.over }; }));
  // promotion
  await p.waitForTimeout(2500);
  if (await p.evaluate(() => !!window.__h2h.fight)) { await p.evaluate(() => { const F = window.__h2h.fight; F.result = { attackerWon: false, attackerHp: 0, defenderHp: 20 }; window.__h2h.endFight(F); }); await p.waitForTimeout(3000); }
  await p.evaluate(setup);
  await p.evaluate(() => { const h = window.__h2h; h.onSquare(1, 0); h.onSquare(0, 0); });
  console.log('promo modal', await p.evaluate(() => !document.getElementById('promoModal').hidden));
  await p.screenshot({ path: 'out/t_promo.png' });
  await p.click('#promoModal [data-p="N"]'); await p.waitForTimeout(400);
  console.log('promoted', await p.evaluate(() => { const S = window.__h2h.state; return [S.board[0][0] && S.board[0][0].t, S.moves.join(' ')]; }));
  await p.waitForTimeout(3000);
  if (await p.evaluate(() => !!window.__h2h.fight)) { await p.evaluate(() => { const F = window.__h2h.fight; F.result = { attackerWon: true, attackerHp: 20, defenderHp: 0 }; window.__h2h.endFight(F); }); await p.waitForTimeout(3000); }
  await p.screenshot({ path: 'out/t_board.png', fullPage: false });
  console.log('clocks', await p.textContent('#clkTop'), await p.textContent('#clkBot'), 'moves', await p.evaluate(() => window.__h2h.state.moves.join(' ')));
  // flag
  await p.evaluate(() => { const S = window.__h2h.state; S.clock[S.turn] = 0.3; }); await p.waitForTimeout(1200);
  console.log('over', await p.evaluate(() => JSON.stringify(window.__h2h.state.over)));
  // phone
  const q = await mk({ width: 390, height: 844 }, true);
  await q.evaluate(setup); await q.evaluate(() => { const S = window.__h2h.state; S.taken.b.push('P', 'P', 'N', 'Q'); S.taken.w.push('B', 'P'); S.moves.push('e4', 'e5', 'Nf3', 'Nc6', 'Bxc6✗'); window.__h2h.render(); });
  await q.waitForTimeout(800); await q.screenshot({ path: 'out/t_phone.png' });
  await b.close();
})();
