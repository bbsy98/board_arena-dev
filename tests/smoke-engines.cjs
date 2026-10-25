'use strict';
// Deterministic-ish pure-engine smoke/regression tests. Run: node tests/smoke-engines.cjs
const assert = require('node:assert/strict');
const Chess = require('../js/engines/chess-engine.js');
const Janggi = require('../js/engines/janggi-engine.js');
const Go = require('../js/engines/go-engine.js');
const Sudoku = require('../js/engines/sudoku-engine.js');

function perft(pos, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const move of pos.legalMoves()) {
    pos.make(move);
    n += perft(pos, depth - 1);
    pos.unmake();
  }
  return n;
}

// Chess: opening move count and canonical perft regression checks.
const chess = new Chess.Pos();
chess.fromFEN(Chess.START);
assert.equal(chess.legalMoves().length, 20, 'initial chess position should have 20 legal moves');
assert.equal(perft(chess, 2), 400, 'chess start-position perft depth 2');
assert.equal(perft(chess, 3), 8902, 'chess start-position perft depth 3');
const chessResult = Chess.think(chess, { maxDepth: 2 });
assert.ok(chessResult && chessResult.move, 'chess search should return a move');
assert.ok(chess.legalMoves().includes(chessResult.move), 'chess search must return a legal move');
assert.ok(chessResult.depth >= 1, 'chess search should complete at least depth 1');
const castlePos = new Chess.Pos().fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
const castleSans = castlePos.legalMoves().map(m => Chess.san(castlePos, m));
assert.ok(castleSans.includes('O-O') && castleSans.includes('O-O-O'), 'castling moves should be legal when unobstructed');
const epPos = new Chess.Pos().fromFEN('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
assert.ok(epPos.legalMoves().some(m => Chess.san(epPos, m).startsWith('exd6')), 'en passant should be generated');
const promoPos = new Chess.Pos().fromFEN('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
assert.ok(promoPos.legalMoves().some(m => /a8=Q/.test(Chess.san(promoPos, m))), 'promotion moves should be generated');

// Janggi: legal move generation and a bounded search on a minimal valid board.
const jb = new Int8Array(90);
jb[4] = Janggi.mkp(Janggi.K, Janggi.HAN);
jb[85] = Janggi.mkp(Janggi.K, Janggi.CHO);
jb[40] = Janggi.mkp(Janggi.P, Janggi.HAN);
jb[49] = Janggi.mkp(Janggi.P, Janggi.CHO);
jb[0] = Janggi.mkp(Janggi.R, Janggi.HAN);
jb[89] = Janggi.mkp(Janggi.R, Janggi.CHO);
assert.ok(Janggi.legalMoves(jb, Janggi.CHO).length > 0, 'Janggi should generate legal moves for Cho');
assert.ok(Janggi.legalMoves(jb, Janggi.HAN).length > 0, 'Janggi should generate legal moves for Han');
const jr = Janggi.think(jb, Janggi.CHO, { maxDepth: 1, time: 100 });
assert.ok(jr && jr.move, 'Janggi search should return a move');
assert.ok(Janggi.legalMoves(jb, Janggi.CHO).includes(jr.move), 'Janggi search must return a legal move');

// Go: basic legality, pass, clone isolation, and search response shape.
const goBoard = new Go.Board(9);
const center = goBoard.pt(4, 4);
assert.equal(goBoard.legal(center), true, 'empty center should be legal');
goBoard.play(center);
assert.equal(goBoard.col[center], 1, 'first Go move should place a black stone');
assert.equal(goBoard.toPlay, 2, 'Go turn should alternate');
const clone = goBoard.clone();
clone.play(0);
assert.equal(goBoard.moveNum, 1, 'mutating clone must not mutate original board');
const goResult = Go.search(goBoard, { time: 100, simulations: 100 });
assert.ok(goResult && Array.isArray(goResult.children), 'Go search should return child candidates');
assert.ok(Number.isFinite(goResult.nodes), 'Go search should report node usage');

// Sudoku: generated puzzle shape, valid complete solution, clues preserved, unique solution.
const puzzle = Sudoku.generate(1);
assert.ok(puzzle && Array.isArray(puzzle.puzzle) && Array.isArray(puzzle.solution), 'Sudoku generator should return puzzle and solution');
assert.equal(puzzle.puzzle.length, puzzle.solution.length, 'Sudoku puzzle and solution sizes should match');
const n = puzzle.n, geo = Sudoku.geo(n);
assert.ok(n > 0 && puzzle.solution.length === n * n, 'Sudoku solution size should match board dimensions');
for (const unit of geo.units) {
  const vals = unit.map(i => puzzle.solution[i]).sort((a, b) => a - b);
  assert.deepEqual(vals, Array.from({ length: n }, (_, i) => i + 1), 'each Sudoku row/column/box must contain every digit exactly once');
}
for (let i = 0; i < puzzle.puzzle.length; i++) if (puzzle.puzzle[i]) assert.equal(puzzle.puzzle[i], puzzle.solution[i], 'Sudoku clue must match solution');
assert.equal(Sudoku.countSolutions(puzzle.puzzle, n, 2), 1, 'generated Sudoku puzzle should have a unique solution');

console.log('PASS: chess perft depth 2/3, search legality, castling, en passant, promotion');
console.log('PASS: Janggi legal-move generation and search legality');
console.log('PASS: Go legality, clone isolation, and search smoke test');
console.log('PASS: Sudoku solution validity, clue consistency, and uniqueness');
