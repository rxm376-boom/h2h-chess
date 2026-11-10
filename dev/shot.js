// usage: node shot.js <html> <out-prefix> <scenario-js-file>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [html, out, scen, w, h] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +(w||1280), height: +(h||720) }, deviceScaleFactor: 1, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH });
  const T = path.join(__dirname, 'node_modules/three');
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ path: T + '/build/three.min.js', contentType: 'text/javascript' });
    const m = u.match(/three@0\.128\.0\/(examples\/.*)$/); if (m) return r.fulfill({ path: T + '/' + m[1], contentType: 'text/javascript' });
    if (u.startsWith('file:') ) return r.continue();
    if (u.includes('fonts.g')) return r.continue();
    return r.abort();
  });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text()); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('file://' + path.resolve(html));
  await p.waitForTimeout(1200);
  const shot = async (name) => { await p.screenshot({ path: `${out}-${name}.png` }); console.log('shot', name); };
  await require(path.resolve(scen))(p, shot);
  await b.close();
})();
