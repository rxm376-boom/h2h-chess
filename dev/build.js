// Assembles the single-file game. usage: node build.js [out.html]
const fs = require("fs"), R = f => fs.readFileSync(__dirname + "/src/" + f, "utf8");
const profiles = `const PIECE_PROFILES = {
  K: [[0,0],[1.6,0],[1.6,0.4],[1.2,0.7],[1.1,1.0],[0.75,1.4],[0.5,4.4],[0.95,4.8],[0.6,5.1],[0.9,6.0],[0.5,6.2],[0,6.3]],
  Q: [[0,0],[1.6,0],[1.6,0.4],[1.2,0.7],[1.1,1.0],[0.75,1.4],[0.45,4.2],[0.9,4.6],[0.6,4.9],[1.1,6.0],[0.5,6.1],[0.35,6.5],[0,6.6]],
  R: [[0,0],[1.6,0],[1.6,0.4],[1.2,0.7],[1.1,1.0],[0.9,1.2],[0.8,4.0],[1.1,4.3],[1.1,5.2],[0,5.2]],
  B: [[0,0],[1.6,0],[1.6,0.4],[1.2,0.7],[1.1,1.0],[0.7,1.4],[0.45,3.8],[0.8,4.1],[0.6,4.4],[0.8,5.2],[0.4,6.0],[0.2,6.3],[0,6.4]],
};\n`;
let proj = R("old/proj.js"); const a = proj.indexOf("function toScreen("), b = proj.indexOf("const TEAM");
if (a >= 0) proj = proj.slice(0, a) + proj.slice(b);
const init = R("old/init3d.js").replace("wx(WALL_L)", "wx(AR.L)").replace("wx(WALL_R)", "wx(AR.R)");
const js = [R("sim.js"), R("old/chess.js"), profiles, R("rig.js"), init, proj, R("old/debris.js"), R("anim.js"), R("arena.js"), R("game.js"), R("old/board.js")].join("\n");
const out = R("old/head.html") + "\n" + R("old/body.html") + "\n" + R("old/scripts.html") + "\n" + js;
fs.writeFileSync(process.argv[2] || __dirname + "/out/h2h-chess.html", out);
fs.writeFileSync(__dirname + "/out/all.js", "(() => {\n" + R("old/scripts.html").split("<script>\n(() => {")[1] + js.replace(/\}\)\(\);\s*<\/script>\s*$/, "})();"));
fs.writeFileSync(__dirname + "/out/index.html", '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + out);
console.log("built", out.length);
