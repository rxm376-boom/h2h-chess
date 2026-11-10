# H2H Chess sources

The game page (`../index.html`) is built from these files. Do not edit the built page by hand.

- `src/sim.js` duel rules, move lists and the CPU fighter (no DOM, runs in Node for balance tests)
- `src/anim.js` poses, `src/rig.js` fighter models, `src/arena.js` stage, camera and effects
- `src/game.js` input, sound, HUD, round flow and the board/duel transitions; `src/duel.css` duel styles (also inlined in `src/old/head.html`)
- `src/old/` chess rules, board, account UI and page markup

Build: `node build.js` writes `out/h2h-chess.html`. The site page is that file with the doctype, viewport, `config.js` and `cloud.js` lines in front.

Balance tests: `node harness.js 300 0,1,2` prints CPU-vs-CPU win rates per piece pairing and CPU level. `node t/strat.js spam 40` checks that no single move beats the CPU.
