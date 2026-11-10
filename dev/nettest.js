// two browsers play each other through the local test channel: node nettest.js "[&rtc=0]" [perturb]
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const extra = process.argv[2] || '', perturb = process.argv[3] === 'perturb';
(async () => {
  const srv = http.createServer((q, s) => { const f = path.join(__dirname, 'out', q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'content-type': 'text/html' }); s.end(d); } }); }).listen(8123);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  const T = path.join(__dirname, 'node_modules/three');
  const mk = async name => {
    const p = await ctx.newPage();
    await p.route('**/*', r => { const u = r.request().url();
      if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
      const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
      if (u.startsWith('http://localhost')) return r.continue(); return r.abort(); });
    p.on('pageerror', e => console.log(name, '[pageerror]', e.message));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) console.log(name, '[err]', m.text()); });
    await p.goto('http://localhost:8123/index.html?net=local' + extra); await p.waitForTimeout(1500); return p;
  };
  const H = await mk('host'), G = await mk('guest');
  const st = p => p.evaluate(() => { const h = window.__h2h, S = h.state, N = h.NET, F = h.fight; let bh = S.turn; for (const row of S.board) for (const q of row) bh += q ? q.c + q.t + q.hp : '.';
    return { on: N.on, me: h.CONFIG.human, via: N.via, D: N.D, turn: S.turn, bh, over: S.over && S.over.reason, fight: !!F, phase: F && F.phase, frame: N.duel && N.duel.frame, hp: F && [F.f.w.hp, F.f.b.hp].map(x => Math.round(x)), t: F && Math.round(F.t), status: document.getElementById('netStatus').textContent, wait: !document.getElementById('netWait').hidden, out: N.out.size }; });
  const both = async tag => { const a = await st(H), c = await st(G); console.log(tag, '\n  H', JSON.stringify(a), '\n  G', JSON.stringify(c)); return [a, c]; };
  const until = async (f, n = 120, ms = 500) => { for (let i = 0; i < n; i++) { const [a, c] = [await st(H), await st(G)]; if (f(a, c)) return true; await H.waitForTimeout(ms); } return false; };
  await H.click('#netCreate'); await H.waitForTimeout(800);
  const code = await H.evaluate(() => document.getElementById('netCode').textContent); console.log('code', code);
  await G.click('#netJoin'); await G.fill('#dlgInput', code.toLowerCase()); await G.click('#dlgYes');
  console.log('connected', await until((a, c) => a.on && c.on, 40));
  await H.waitForTimeout(2500);
  let [a, c] = await both('start');
  const W = a.me === 'w' ? H : G, Bk = a.me === 'w' ? G : H;
  const mv = async (p, fr, fc, tr, tc) => { await p.evaluate(([fr, fc, tr, tc]) => { const h = window.__h2h; h.onSquare(fr, fc); h.onSquare(tr, tc); }, [fr, fc, tr, tc]); await p.waitForTimeout(300);
    if (await p.evaluate(() => !document.getElementById('dlg').hidden)) await p.click('#dlgYes'); };
  await mv(W, 6, 4, 4, 4); console.log('synced1', await until((a, c) => a.bh === c.bh && a.turn === 'b', 20));
  await mv(Bk, 1, 3, 3, 3); console.log('synced2', await until((a, c) => a.bh === c.bh && a.turn === 'w', 20));
  await mv(W, 4, 4, 3, 3);
  console.log('both in duel', await until((a, c) => a.fight && c.fight, 60)); await H.waitForTimeout(1500);
  await W.keyboard.press('KeyF');
  console.log('fighting', await until((a, c) => a.phase === 'fight' && c.phase === 'fight', 80));
  await both('fight start');
  const keys = ['KeyF', 'KeyG', 'KeyH', 'KeyE', 'KeyR', 'KeyW'];
  let done = false, i = 0, mism = 0;
  while (!done && i < 400) {
    for (const p of [H, G]) { const k = keys[(Math.random() * 3) | 0], d = p === W ? 'KeyD' : 'KeyA'; if (Math.random() < 0.7) { await p.keyboard.down(d); await p.waitForTimeout(80); } await p.keyboard.press(k, { delay: 40 }); if (Math.random() < 0.3) await p.keyboard.up(d); }
    if (perturb && i === 6) { await G.evaluate(() => { const F = window.__h2h.fight; F.f.w.hp -= 7; F.f.b.x += 20; }); console.log('perturbed guest'); }
    const [x, y] = [await st(H), await st(G)]; if (i % 6 === 0) console.log('t' + i, x.frame, y.frame, x.hp, y.hp, x.wait, y.wait); done = !(x.phase === 'fight' && y.phase === 'fight'); i++;
  }
  await both('duel ending');
  console.log('back on board', await until((a, c) => !a.fight && !c.fight, 120));
  await H.waitForTimeout(1500);
  [a, c] = await both('after duel'); console.log('BOARDS MATCH', a.bh === c.bh, 'turn', a.turn, c.turn);
  // a couple more quiet moves each way
  await mv(Bk, 1, 0, 2, 0); await until((a, c) => a.bh === c.bh && a.turn === 'w', 20);
  await mv(W, 6, 0, 5, 0); await until((a, c) => a.bh === c.bh && a.turn === 'b', 20);
  [a, c] = await both('more moves'); console.log('BOARDS MATCH 2', a.bh === c.bh);
  // rematch
  for (const p of [H, G]) await p.evaluate(() => { const h = window.__h2h; h.state.over = { winner: 'w', reason: 'test' }; h.render(); });
  await H.waitForTimeout(500);
  console.log('gameOver shown', await H.evaluate(() => !document.getElementById('gameOver').hidden));
  await H.evaluate(() => document.getElementById('goNew').click()); await H.waitForTimeout(1500); await both('host asked rematch');
  await G.evaluate(() => document.getElementById('goNew').click()); await H.waitForTimeout(2500);
  const [a2, c2] = await both('rematch'); console.log('COLOURS SWAPPED', a2.me !== a.me && c2.me !== c.me && a2.me !== c2.me, 'fresh', a2.bh === c2.bh && !a2.over);
  // leave
  await G.click('#netLeave'); await H.waitForTimeout(2500); await both('guest left');
  await H.screenshot({ path: 'out/net-host.png' }); await G.screenshot({ path: 'out/net-guest.png' });
  await b.close(); srv.close();
})();
