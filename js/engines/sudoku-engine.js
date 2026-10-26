// ======================= 스도쿠 엔진: 생성 · 유일해 검사 · 사람식 논리 풀이(난이도 판정/힌트) =======================
var SudokuEngine = (function () {
  'use strict';
  var SHAPES = { 4: [2, 2], 6: [2, 3], 9: [3, 3] };
  var TECH = { 1: '한 칸 한 숫자', 2: '숨은 숫자', 3: '상자-줄 제거', 4: '짝 후보', 5: '세 쌍 후보', 6: 'X-윙' };
  var cache = {};
  function geo(n) {
    if (cache[n]) return cache[n];
    var br = SHAPES[n][0], bc = SHAPES[n][1], units = [], rows = [], cols = [], boxes = [], i, r, c;
    for (r = 0; r < n; r++) { var u = []; for (c = 0; c < n; c++) u.push(r * n + c); rows.push(u); }
    for (c = 0; c < n; c++) { var u2 = []; for (r = 0; r < n; r++) u2.push(r * n + c); cols.push(u2); }
    for (var b = 0; b < n; b++) {
      var u3 = [], r0 = Math.floor(b / (n / bc)) * br, c0 = (b % (n / bc)) * bc;
      for (r = 0; r < br; r++) for (c = 0; c < bc; c++) u3.push((r0 + r) * n + c0 + c);
      boxes.push(u3);
    }
    units = rows.concat(cols, boxes);
    var peers = [], cellUnits = [];
    for (i = 0; i < n * n; i++) {
      var set = {}, cu = [];
      units.forEach(function (u, ui) { if (u.indexOf(i) >= 0) { cu.push(ui); u.forEach(function (x) { if (x !== i) set[x] = 1; }); } });
      peers.push(Object.keys(set).map(Number)); cellUnits.push(cu);
    }
    var boxOf = []; for (i = 0; i < n * n; i++) boxOf[i] = Math.floor(Math.floor(i / n) / br) * (n / bc) + Math.floor((i % n) / bc);
    return (cache[n] = { n: n, br: br, bc: bc, rows: rows, cols: cols, boxes: boxes, units: units, peers: peers, cellUnits: cellUnits, boxOf: boxOf, full: (1 << (n + 1)) - 2 });
  }
  function bits(m) { var o = []; for (var d = 1; m; d++) { m >>= 1; if (m & 1) o.push(d); } return o; }
  function popc(m) { var c = 0; while (m) { m &= m - 1; c++; } return c; }
  function low(m) { var d = 0; while (!(m & (1 << d))) d++; return d; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function countSolutions(grid, n, limit, out) {
    var G = geo(n), g = grid.slice(), cnt = 0;
    function cand(i) { var m = G.full; var p = G.peers[i]; for (var k = 0; k < p.length; k++) if (g[p[k]]) m &= ~(1 << g[p[k]]); return m; }
    (function rec() {
      if (cnt >= limit) return;
      var bi = -1, bm = 0, bc = 99;
      for (var i = 0; i < n * n; i++) if (!g[i]) { var m = cand(i), c = popc(m); if (c < bc) { bc = c; bi = i; bm = m; if (c <= 1) break; } }
      if (bi < 0) { cnt++; if (out && !out.length) for (var q = 0; q < n * n; q++) out.push(g[q]); return; }
      if (!bc) return;
      var ds = bits(bm); if (out && !out.length) shuffle(ds);
      for (var k = 0; k < ds.length; k++) { g[bi] = ds[k]; rec(); if (cnt >= limit) break; }
      g[bi] = 0;
    })();
    return cnt;
  }
  function randomSolution(n) { var out = []; countSolutions(new Array(n * n).fill(0), n, 1, out); return out; }

  function initCands(grid, n) {
    var G = geo(n), c = new Array(n * n);
    for (var i = 0; i < n * n; i++) {
      if (grid[i]) { c[i] = 0; continue; }
      var m = G.full; G.peers[i].forEach(function (p) { if (grid[p]) m &= ~(1 << grid[p]); }); c[i] = m;
    }
    return c;
  }
  function place(grid, cands, n, i, d) { grid[i] = d; cands[i] = 0; geo(n).peers[i].forEach(function (p) { cands[p] &= ~(1 << d); }); }
  function unitName(G, ui) { var n = G.n; return ui < n ? (ui + 1) + '번째 가로줄' : ui < 2 * n ? (ui - n + 1) + '번째 세로줄' : (ui - 2 * n + 1) + '번째 상자'; }

  function findStep(grid, cands, n, maxTech) {
    var G = geo(n), i, d, u, k;
    for (i = 0; i < n * n; i++) if (!grid[i] && popc(cands[i]) === 1) return { tech: 1, cell: i, val: low(cands[i]) };
    if (maxTech < 2) return null;
    for (u = 0; u < G.units.length; u++) {
      for (d = 1; d <= n; d++) {
        var pos = -1, c2 = 0, U = G.units[u], present = false;
        for (k = 0; k < n; k++) { var x = U[k]; if (grid[x] === d) { present = true; break; } if (cands[x] & (1 << d)) { c2++; pos = x; } }
        if (!present && c2 === 1) return { tech: 2, cell: pos, val: d, unit: u };
      }
    }
    if (maxTech < 3) return null;
    for (var b = 0; b < n; b++) {
      var BX = G.boxes[b];
      for (d = 1; d <= n; d++) {
        var cells = BX.filter(function (x) { return cands[x] & (1 << d); });
        if (cells.length < 2) continue;
        var r0 = Math.floor(cells[0] / n), c0 = cells[0] % n;
        var sameR = cells.every(function (x) { return Math.floor(x / n) === r0; }), sameC = cells.every(function (x) { return x % n === c0; });
        var line = sameR ? G.rows[r0] : sameC ? G.cols[c0] : null;
        if (line) {
          var el = line.filter(function (x) { return G.boxOf[x] !== b && (cands[x] & (1 << d)); });
          if (el.length) return { tech: 3, elim: el.map(function (x) { return [x, 1 << d]; }), desc: (b + 1) + '번째 상자에서 ' + d + '은(는) ' + (sameR ? (r0 + 1) + '번째 가로줄' : (c0 + 1) + '번째 세로줄') + '에만 올 수 있어요. 그래서 그 줄의 다른 상자에서는 ' + d + '을(를) 지울 수 있어요.', unitCells: cells };
        }
      }
    }
    for (var li = 0; li < 2 * n; li++) {
      var LN = G.units[li];
      for (d = 1; d <= n; d++) {
        var cl = LN.filter(function (x) { return cands[x] & (1 << d); });
        if (cl.length < 2) continue;
        var bx = G.boxOf[cl[0]];
        if (cl.every(function (x) { return G.boxOf[x] === bx; })) {
          var el2 = G.boxes[bx].filter(function (x) { return LN.indexOf(x) < 0 && (cands[x] & (1 << d)); });
          if (el2.length) return { tech: 3, elim: el2.map(function (x) { return [x, 1 << d]; }), desc: unitName(G, li) + '에서 ' + d + '은(는) ' + (bx + 1) + '번째 상자 안에만 올 수 있어요. 그래서 그 상자의 다른 칸에서는 ' + d + '을(를) 지울 수 있어요.', unitCells: cl };
        }
      }
    }
    if (maxTech < 4) return null;
    for (u = 0; u < G.units.length; u++) {
      var U2 = G.units[u].filter(function (x) { return !grid[x]; });
      for (var a = 0; a < U2.length; a++) {
        if (popc(cands[U2[a]]) !== 2) continue;
        for (var b2 = a + 1; b2 < U2.length; b2++) {
          if (cands[U2[b2]] !== cands[U2[a]]) continue;
          var mk = cands[U2[a]], el3 = U2.filter(function (x) { return x !== U2[a] && x !== U2[b2] && (cands[x] & mk); });
          if (el3.length) return { tech: 4, elim: el3.map(function (x) { return [x, mk]; }), desc: unitName(G, u) + '의 두 칸에는 ' + bits(mk).join('·') + '만 들어갈 수 있어요(짝 후보). 그러니 같은 줄의 다른 칸에서 ' + bits(mk).join('·') + '을(를) 지울 수 있어요.', unitCells: [U2[a], U2[b2]] };
        }
      }
      for (var d1 = 1; d1 <= n; d1++) for (var d2 = d1 + 1; d2 <= n; d2++) {
        var p1 = U2.filter(function (x) { return cands[x] & (1 << d1); }), p2 = U2.filter(function (x) { return cands[x] & (1 << d2); });
        if (p1.length === 2 && p2.length === 2 && p1[0] === p2[0] && p1[1] === p2[1]) {
          var keep = (1 << d1) | (1 << d2), el4 = p1.filter(function (x) { return cands[x] & ~keep; });
          if (el4.length) return { tech: 4, elim: el4.map(function (x) { return [x, cands[x] & ~keep]; }), desc: unitName(G, u) + '에서 ' + d1 + '·' + d2 + '은(는) 두 칸에만 올 수 있어요(숨은 짝). 그 두 칸의 다른 후보는 지울 수 있어요.', unitCells: p1 };
        }
      }
    }
    if (maxTech < 5) return null;
    for (u = 0; u < G.units.length; u++) {
      var U3 = G.units[u].filter(function (x) { return !grid[x] && popc(cands[x]) <= 3; });
      for (var a3 = 0; a3 < U3.length; a3++) for (var b3 = a3 + 1; b3 < U3.length; b3++) for (var c3 = b3 + 1; c3 < U3.length; c3++) {
        var mk3 = cands[U3[a3]] | cands[U3[b3]] | cands[U3[c3]];
        if (popc(mk3) !== 3) continue;
        var tri = [U3[a3], U3[b3], U3[c3]];
        var el5 = G.units[u].filter(function (x) { return !grid[x] && tri.indexOf(x) < 0 && (cands[x] & mk3); });
        if (el5.length) return { tech: 5, elim: el5.map(function (x) { return [x, mk3]; }), desc: unitName(G, u) + '의 세 칸에는 ' + bits(mk3).join('·') + '만 들어가요(세 쌍). 다른 칸에서 이 숫자들을 지울 수 있어요.', unitCells: tri };
      }
    }
    if (maxTech < 6) return null;
    for (var mode = 0; mode < 2; mode++) {
      var lines = mode === 0 ? G.rows : G.cols, other = mode === 0 ? G.cols : G.rows;
      for (d = 1; d <= n; d++) {
        var pairs = [];
        for (var l = 0; l < n; l++) {
          var ps = lines[l].filter(function (x) { return cands[x] & (1 << d); });
          if (ps.length === 2) pairs.push([l, ps.map(function (x) { return mode === 0 ? x % n : Math.floor(x / n); })]);
        }
        for (var p = 0; p < pairs.length; p++) for (var q = p + 1; q < pairs.length; q++) {
          if (pairs[p][1][0] !== pairs[q][1][0] || pairs[p][1][1] !== pairs[q][1][1]) continue;
          var l1 = pairs[p][0], l2 = pairs[q][0], el6 = [];
          pairs[p][1].forEach(function (o) {
            other[o].forEach(function (x) {
              var lx = mode === 0 ? Math.floor(x / n) : x % n;
              if (lx !== l1 && lx !== l2 && (cands[x] & (1 << d))) el6.push([x, 1 << d]);
            });
          });
          if (el6.length) return { tech: 6, elim: el6, desc: '숫자 ' + d + '이(가) ' + (mode === 0 ? '두 가로줄' : '두 세로줄') + '에서 똑같은 두 자리에만 올 수 있어요(X-윙). 그 자리의 ' + (mode === 0 ? '세로줄' : '가로줄') + ' 나머지 칸에서 ' + d + '을(를) 지울 수 있어요.', unitCells: [] };
        }
      }
    }
    return null;
  }
  function applyStep(grid, cands, n, st) {
    if (st.cell !== undefined && st.val) place(grid, cands, n, st.cell, st.val);
    else st.elim.forEach(function (e) { cands[e[0]] &= ~e[1]; });
  }
  function grade(puzzle, n) {
    var g = puzzle.slice(), c = initCands(g, n), maxT = 0, used = {};
    for (var guard = 0; guard < 2000; guard++) {
      if (g.every(function (v) { return v; })) return { level: maxT, used: used };
      var st = findStep(g, c, n, 6);
      if (!st) return { level: 99, used: used };
      maxT = Math.max(maxT, st.tech); used[st.tech] = (used[st.tech] || 0) + 1;
      applyStep(g, c, n, st);
    }
    return { level: 99, used: used };
  }
  function hint(grid, n) {
    var g = grid.slice(), c = initCands(g, n), notes = [];
    for (var guard = 0; guard < 300; guard++) {
      var st = findStep(g, c, n, 6);
      if (!st) return null;
      if (st.cell !== undefined) { st.notes = notes; return st; }
      notes.push(st); applyStep(g, c, n, st);
    }
    return null;
  }
  function makePuzzle(sol, n, minGivens, noSym) {
    var p = sol.slice(), order = shuffle(Array.from({ length: n * n }, function (_, i) { return i; })), givens = n * n;
    for (var k = 0; k < order.length && givens > minGivens; k++) {
      var i = order[k], j = noSym ? i : n * n - 1 - i, back1 = p[i], back2 = p[j];
      p[i] = 0; if (j !== i) p[j] = 0;
      if (countSolutions(p, n, 2) !== 1) { p[i] = back1; p[j] = back2; }
      else givens -= (j !== i && back2) ? 2 : 1;
    }
    return p;
  }
  function transform(puz, sol, n) {
    var G = geo(n), perm = shuffle(Array.from({ length: n }, function (_, i) { return i + 1; }));
    function bandPerm(size, groups) {
      var gs = shuffle(Array.from({ length: groups }, function (_, i) { return i; })), out = [];
      gs.forEach(function (g) { shuffle(Array.from({ length: size }, function (_, i) { return i; })).forEach(function (x) { out.push(g * size + x); }); });
      return out;
    }
    var rp = bandPerm(G.br, n / G.br), cp = bandPerm(G.bc, n / G.bc), tr = G.br === G.bc && Math.random() < 0.5;
    var P = [], S = [];
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      var sr = rp[r], sc = cp[c]; if (tr) { var t = sr; sr = sc; sc = t; }
      var v = puz[sr * n + sc], s = sol[sr * n + sc];
      P.push(v ? perm[v - 1] : 0); S.push(perm[s - 1]);
    }
    return { puzzle: P, solution: S };
  }
  var SPEC = {
    1: { n: 4, giv: 10, tech: [1, 2] }, 2: { n: 4, giv: 5, tech: [1, 2] },
    3: { n: 6, giv: 22, tech: [1, 1] }, 4: { n: 6, giv: 13, tech: [2, 2] },
    5: { n: 9, giv: 40, tech: [1, 1] }, 6: { n: 9, giv: 32, tech: [2, 2] }, 7: { n: 9, giv: 25, tech: [2, 2], noSym: 1 },
    8: { n: 9, giv: 22, tech: [3, 3] }, 9: { n: 9, giv: 22, tech: [4, 5] }, 10: { n: 9, giv: 22, tech: [6, 6] }
  };
  function generate(level, bank) {
    var sp = SPEC[level], n = sp.n;
    if (bank && bank[level] && bank[level].length) {
      var e = bank[level][Math.floor(Math.random() * bank[level].length)];
      var P = e.p.split('').map(Number), S = e.s.split('').map(Number);
      var t = transform(P, S, n);
      return { n: n, puzzle: t.puzzle, solution: t.solution, tech: e.t };
    }
    var best = null, deadline = Date.now() + 2500, sol, puz, gr;
    for (var tries = 0; Date.now() < deadline; tries++) {
      sol = randomSolution(n); puz = makePuzzle(sol, n, sp.giv, sp.noSym); gr = grade(puz, n);
      if (gr.level >= sp.tech[0] && gr.level <= sp.tech[1]) return { n: n, puzzle: puz, solution: sol, tech: gr.level };
      if (gr.level <= sp.tech[1] && (!best || gr.level > best.tech)) best = { n: n, puzzle: puz, solution: sol, tech: gr.level };
    }
    return best || { n: n, puzzle: puz, solution: sol, tech: gr.level };
  }
  return { geo: geo, countSolutions: countSolutions, randomSolution: randomSolution, makePuzzle: makePuzzle, grade: grade, hint: hint, initCands: initCands, transform: transform, generate: generate, SPEC: SPEC, TECH: TECH, bits: bits };
})();
if (typeof module !== 'undefined') module.exports = SudokuEngine;