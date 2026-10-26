'use strict';
// 모든 튜토리얼 레슨: 힌트 수가 합법이고, 그 수로 목표를 실제로 달성하는지 확인. Run: node tests/lessons-regression.cjs
const assert = require('node:assert/strict');
const LESSONS = require('../js/lessons.js');
const Chess = require('../js/engines/chess-engine.js');
const J = require('../js/engines/janggi-engine.js');
const Go = require('../js/engines/go-engine.js');
const Sudoku = require('../js/engines/sudoku-engine.js');
const TYPE = { K: J.K, A: J.A, E: J.E, H: J.H, R: J.R, C: J.C, P: J.P };
LESSONS.janggi.forEach((L, i) => {
  const b = new Int8Array(90);
  L.setup.forEach(([sq, t, s]) => { b[sq] = J.mkp(TYPE[t], s); });
  const m = L.hint[0] | (L.hint[1] << 7);
  assert.ok(J.legalMoves(b, J.CHO).includes(m), `janggi lesson ${i + 1} hint must be legal`);
  const cap = b[L.hint[1]]; J.makeMove(b, m);
  const g = L.goal; let ok;
  if (g.type === 'capture') ok = L.hint[1] === g.sq && !!cap;
  else if (g.type === 'reach') ok = L.hint[0] === g.from && L.hint[1] === g.sq;
  else if (g.type === 'escape') ok = !J.inCheck(b, J.CHO);
  else if (g.type === 'mate') ok = J.inCheck(b, J.HAN) && J.legalMoves(b, J.HAN).length === 0;
  assert.ok(ok, `janggi lesson ${i + 1} (${L.title}) hint must satisfy its goal`);
});
LESSONS.chess.forEach((L, i) => {
  const pos = new Chess.Pos().fromFEN(L.fen);
  const m = pos.legalMoves().find(x => (x & 127) === L.hint[0] && ((x >> 7) & 127) === L.hint[1]);
  assert.ok(m, `chess lesson ${i + 1} hint must be legal`);
  const cap = pos.b[L.hint[1]], flag = m >> 17; pos.make(m);
  const g = L.goal; let ok;
  if (g.type === 'capture') ok = L.hint[1] === g.sq && !!cap;
  else if (g.type === 'escape') ok = !pos.inCheck(Chess.WHITE);
  else if (g.type === 'mate') ok = pos.inCheck(pos.side) && pos.legalMoves().length === 0;
  else if (g.type === 'castle') ok = !!(flag & 2);
  assert.ok(ok, `chess lesson ${i + 1} (${L.title}) hint must satisfy its goal`);
});
LESSONS.go.forEach((L, i) => {
  const b = new Go.Board(9);
  L.board.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') { b.toPlay = ch === 'X' ? 1 : 2; b.play(b.pt(r, c)); } }));
  b.toPlay = 1; b.ko = 0; b.cap[1] = b.cap[2] = 0;
  const p = b.pt(L.hint[0][0], L.hint[0][1]);
  assert.ok(b.legal(p), `go lesson ${i + 1} hint must be legal`);
  b.play(p);
  const g = L.goal;
  const ok = g.type === 'capture' ? b.cap[1] >= g.n : g.pts.some(([r, c]) => b.pt(r, c) === p);
  assert.ok(ok, `go lesson ${i + 1} (${L.title}) hint must satisfy its goal`);
});
LESSONS.sudoku.forEach((L, i) => {
  if (L.gen) return;
  const sol = L.sol.split('').map(Number), n = L.n, geo = Sudoku.geo(n);
  assert.equal(sol.length, n * n, `sudoku lesson ${i + 1} size`);
  geo.units.forEach(u => assert.equal(new Set(u.map(k => sol[k])).size, n, `sudoku lesson ${i + 1} solution must be valid`));
  const p = sol.slice(); L.blanks.forEach(k => { p[k] = 0; });
  assert.equal(Sudoku.countSolutions(p, n, 2), 1, `sudoku lesson ${i + 1} must have a unique answer`);
});
console.log(`PASS: ${LESSONS.janggi.length} janggi, ${LESSONS.chess.length} chess, ${LESSONS.go.length} go lessons are solvable by their hint`);
console.log('PASS: sudoku lessons have valid, unique solutions');