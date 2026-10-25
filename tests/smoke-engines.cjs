'use strict';
// Node smoke tests for the pure game engines. Run: node tests/smoke-engines.cjs
const assert = require('node:assert/strict');
const Chess = require('../js/engines/chess-engine.js');
const Go = require('../js/engines/go-engine.js');
const Sudoku = require('../js/engines/sudoku-engine.js');

const chess = new Chess.Pos();
chess.fromFEN(Chess.START);
assert.equal(chess.legalMoves().length, 20, 'initial chess position should have 20 legal moves');
const chessResult = Chess.think(chess, { maxDepth: 2 });
assert.ok(chessResult && chessResult.move, 'chess search should return a move');
assert.ok(chessResult.depth >= 1, 'chess search should complete at least depth 1');

const goBoard = new Go.Board(9);
const goResult = Go.search(goBoard, { time: 100, simulations: 100 });
assert.ok(goResult && Array.isArray(goResult.children), 'Go search should return child candidates');
assert.ok(Number.isFinite(goResult.nodes), 'Go search should report node usage');

const puzzle = Sudoku.generate(1);
assert.ok(puzzle && Array.isArray(puzzle.puzzle) && Array.isArray(puzzle.solution), 'Sudoku generator should return puzzle and solution');
assert.equal(puzzle.puzzle.length, puzzle.solution.length, 'Sudoku puzzle and solution sizes should match');
assert.ok(puzzle.puzzle.length > 0, 'Sudoku puzzle should not be empty');

console.log('PASS: chess opening legal-move/search smoke test');
console.log('PASS: Go search smoke test');
console.log('PASS: Sudoku generation smoke test');
console.log('NOTE: Janggi rules and browser/UI flows require separate scenario tests.');
