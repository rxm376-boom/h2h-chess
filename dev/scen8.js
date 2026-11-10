// hand-off robustness (audit M9) + full flow to KO and back
module.exports = async (p, shot) => {
  const setup = () => p.evaluate(() => { const h = window.__h2h, S = h.state; S.board[5][2] = S.board[7][1]; S.board[7][1] = null; S.board[3][3] = S.board[1][3]; S.board[1][3] = null; h.render(); });
  const st = () => p.evaluate(() => { const h = window.__h2h, S = h.state; return JSON.stringify({ fight: !!h.fight, phase: h.fight && h.fight.phase, turn: S.turn, n: S.board.flat().filter(Boolean).length, vs: !document.getElementById('vsCard').hidden, log: S.log[0] && S.log[0].text }); });
  await setup(); await p.mouse.click(5, 5);
  await p.evaluate(() => { const h = window.__h2h; h.onSquare(5, 2); h.onSquare(3, 3); });
  await p.waitForTimeout(100); await p.evaluate(() => document.getElementById('newGame').click()); // new game during the clash lunge: must be ignored
  console.log('after newgame-during-clash', await st());
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); const s = JSON.parse(await st()); if (s.fight && s.phase === 'intro') break; }
  await p.evaluate(() => document.getElementById('newGame').click());
  console.log('in fight', await st()); await shot('intro');
  await p.evaluate(() => { window.__h2h.fight.skip = true; });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); const s = JSON.parse(await st()); if (s.phase === 'fight') break; }
  await p.waitForTimeout(800); await shot('fight');
  await p.evaluate(() => { const F = window.__h2h.fight; F.f.b.hp = 0; });
  for (let i = 0; i < 120; i++) { await p.waitForTimeout(500); const s = JSON.parse(await st()); if (s.phase === 'outro') { await p.waitForTimeout(2500); await shot('ko'); break; } }
  for (let i = 0; i < 80; i++) { await p.waitForTimeout(500); const s = JSON.parse(await st()); if (!s.fight) break; if (i % 6 === 5) await p.keyboard.press('KeyF'); }
  await p.waitForTimeout(1500); console.log('after duel', await st()); await shot('board');
  // new game while idle works, and the CPU does not replay a stale move
  await p.evaluate(() => document.getElementById('newGame').click()); await p.waitForTimeout(1500); console.log('new game', await st());
};
