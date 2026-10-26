'use strict';
// 규칙 엔진 심화 회귀 테스트. Run: node tests/rules-regression.cjs
const assert = require('node:assert/strict');
const Chess = require('../js/engines/chess-engine.js');
const J = require('../js/engines/janggi-engine.js');
const Go = require('../js/engines/go-engine.js');
function perft(p, d) { if (!d) return 1; let n = 0; for (const m of p.legalMoves()) { p.make(m); n += perft(p, d - 1); p.unmake(); } return n; }
[
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 4, 43238],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3, 9467],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379]
].forEach(([fen, d, want]) => assert.equal(perft(new Chess.Pos().fromFEN(fen), d), want, `perft ${fen}`));
let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
function setup() {
  const b = new Int8Array(90), mk = J.mkp, back = [J.R, J.H, J.E, J.A, 0, J.A, J.E, J.H, J.R];
  for (let c = 0; c < 9; c++) if (back[c]) { b[c] = mk(back[c], 1); b[81 + c] = mk(back[c], 0); }
  b[13] = mk(J.K, 1); b[76] = mk(J.K, 0); b[19] = b[25] = mk(J.C, 1); b[64] = b[70] = mk(J.C, 0);
  [0, 2, 4, 6, 8].forEach(c => { b[27 + c] = mk(J.P, 1); b[54 + c] = mk(J.P, 0); });
  return b;
}
let checks = 0;
for (let g = 0; g < 40; g++) {
  const b = setup(); let s = 0;
  for (let ply = 0; ply < 60; ply++) {
    const ms = J.genMoves(b, s, false); if (!ms.length) break;
    for (const by of [0, 1]) {
      const reach = new Set(J.genMoves(b, by, false).map(m => m >> 7));
      for (let sq = 0; sq < 90; sq++) { if (b[sq] && J.pside(b[sq]) === by) continue; assert.equal(J.attacked(b, sq, by), reach.has(sq), `janggi attacked mismatch sq ${sq}`); checks++; }
    }
    const m = ms[rnd(ms.length)]; if ((b[m >> 7] & 7) === J.K) break; J.makeMove(b, m); s ^= 1;
  }
}
const cb = new Int8Array(90);
cb[76] = J.mkp(J.K, 0); cb[13] = J.mkp(J.K, 1); cb[64] = J.mkp(J.C, 0); cb[46] = J.mkp(J.P, 0); cb[28] = J.mkp(J.C, 1);
assert.ok(!J.legalMoves(cb, 0).some(m => (m & 127) === 64 && (m >> 7) === 28), 'cannon must not capture cannon');
cb[46] = J.mkp(J.C, 1); cb[28] = J.mkp(J.H, 1);
assert.ok(!J.legalMoves(cb, 0).some(m => (m & 127) === 64 && (m >> 7) < 46 && (m >> 7) % 9 === 1), 'cannon must not jump over cannon');
const bk = new Int8Array(90); bk[4] = J.mkp(J.K, 1); bk[85] = J.mkp(J.K, 0);
assert.ok(J.bikjang(bk), 'facing kings on an open file is bikjang');
bk[40] = J.mkp(J.P, 0); assert.ok(!J.bikjang(bk), 'a piece between kings blocks bikjang');
const b1 = new Go.Board(9); b1.toPlay = 1; b1.play(b1.pt(0, 1)); b1.toPlay = 1; b1.play(b1.pt(1, 0)); b1.toPlay = 2;
assert.ok(!b1.legal(b1.pt(0, 0)), 'suicide must be illegal');
const k = new Go.Board(9), put = (c, r, cc) => { k.toPlay = c; k.play(k.pt(r, cc)); };
put(1, 1, 2); put(1, 2, 1); put(1, 3, 2); put(2, 1, 3); put(2, 2, 4); put(2, 3, 3); put(2, 2, 2);
k.toPlay = 1; assert.equal(k.play(k.pt(2, 3)), 1, 'ko capture takes one stone');
assert.ok(!k.legal(k.pt(2, 2)), 'immediate ko recapture must be illegal');
console.log('PASS: chess perft on 4 standard tricky positions');
console.log(`PASS: janggi attack detection matches move generation (${checks} checks), cannon & bikjang rules`);
console.log('PASS: go suicide, ko, capture rules');