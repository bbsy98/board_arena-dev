
'use strict';
// ======================= 바둑 엔진 (MCTS + RAVE + 휴리스틱 플레이아웃) =======================
var EMPTY = 0, BLACK = 1, WHITE = 2, EDGE = 3, PASS = 0;

var _seed = ((Math.random() * 4294967295) >>> 0) || 1;
function rnd() { _seed ^= _seed << 13; _seed ^= _seed >>> 17; _seed ^= _seed << 5; return (_seed >>> 0) / 4294967296; }
function rndInt(n) { return (rnd() * n) | 0; }

var ZOB1 = [], ZOB2 = [];
(function () {
  var s = 0x2545F491;
  function r() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s | 0; }
  for (var c = 0; c < 3; c++) {
    ZOB1[c] = new Int32Array(441); ZOB2[c] = new Int32Array(441);
    for (var i = 0; i < 441; i++) { ZOB1[c][i] = r(); ZOB2[c][i] = r(); }
  }
})();

var PAT = new Uint8Array(65536);
(function () {
  var src = [
    ['XOX', '...', '???'], ['XO.', '...', '?.?'], ['XO?', 'X..', 'x.?'], ['.O.', 'X..', '...'],
    ['XO?', 'O.o', '?o?'], ['XO?', 'O.X', '???'], ['?X?', 'O.O', 'ooo'], ['OX?', 'o.O', '???'],
    ['X.?', 'O.?', '   '], ['OX?', 'X.O', '   '], ['?X?', 'x.O', '   '], ['?XO', 'x.x', '   '], ['?OX', 'X.O', '   ']
  ];
  var VAL = { '.': [0], 'X': [1], 'O': [2], ' ': [3], '?': [0, 1, 2, 3], 'x': [0, 2, 3], 'o': [0, 1, 3] };
  function grid(p) { return [p[0].split(''), p[1].split(''), p[2].split('')]; }
  function rot(g) { var o = [[], [], []]; for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) o[c][2 - r] = g[r][c]; return o; }
  function flip(g) { return g.map(function (row) { return row.slice().reverse(); }); }
  function swap(g) { var m = { X: 'O', O: 'X', x: 'o', o: 'x' }; return g.map(function (row) { return row.map(function (ch) { return m[ch] || ch; }); }); }
  var ORDER = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]];
  src.forEach(function (p) {
    var g = grid(p), vars = [];
    for (var f = 0; f < 2; f++) { for (var r = 0; r < 4; r++) { vars.push(g); vars.push(swap(g)); g = rot(g); } g = flip(g); }
    vars.forEach(function (v) {
      (function rec(k, code) {
        if (k === 8) { PAT[code] = 1; return; }
        var ch = v[ORDER[k][0]][ORDER[k][1]], vals = VAL[ch];
        for (var i = 0; i < vals.length; i++) rec(k + 1, code | (vals[i] << (2 * k)));
      })(0, 0);
    });
  });
})();

function Board(n) {
  var w = n + 2, sz = w * w;
  this.n = n; this.w = w; this.sz = sz;
  this.col = new Int8Array(sz); this.head = new Int16Array(sz); this.nxt = new Int16Array(sz);
  this.plib = new Int16Array(sz); this.size = new Int16Array(sz);
  this.lsum = new Int32Array(sz); this.lsq = new Float64Array(sz);
  this.dirs = [-w, 1, w, -1];
  this.diag = [-w - 1, -w + 1, w - 1, w + 1];
  this.n8 = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  this.ko = 0; this.toPlay = BLACK; this.passes = 0; this.last = 0; this.last2 = 0; this.moveNum = 0;
  this.cap = [0, 0, 0]; this.h1 = 0; this.h2 = 0;
  this._lb = new Int16Array(8);
  this.col.fill(EDGE);
  var pts = [];
  for (var r = 1; r <= n; r++) for (var c = 1; c <= n; c++) { var p = r * w + c; this.col[p] = EMPTY; pts.push(p); }
  this.pts = Int16Array.from(pts);
  this.line = new Int8Array(sz);
  for (var i = 0; i < pts.length; i++) {
    var pr = ((pts[i] / w) | 0) - 1, pc = pts[i] % w - 1;
    this.line[pts[i]] = Math.min(pr, pc, n - 1 - pr, n - 1 - pc);
  }
}
Board.prototype.copyFrom = function (o) {
  this.col.set(o.col); this.head.set(o.head); this.nxt.set(o.nxt); this.plib.set(o.plib);
  this.size.set(o.size); this.lsum.set(o.lsum); this.lsq.set(o.lsq);
  this.ko = o.ko; this.toPlay = o.toPlay; this.passes = o.passes; this.last = o.last; this.last2 = o.last2;
  this.moveNum = o.moveNum; this.cap[1] = o.cap[1]; this.cap[2] = o.cap[2]; this.h1 = o.h1; this.h2 = o.h2;
};
Board.prototype.clone = function () { var b = new Board(this.n); b.copyFrom(this); return b; };
Board.prototype.key = function () { return this.h1 + '_' + this.h2; };
Board.prototype.pt = function (r, c) { return (r + 1) * this.w + c + 1; };
Board.prototype.inAtari = function (h) { var s = this.lsum[h]; return this.plib[h] * this.lsq[h] === s * s; };
Board.prototype.atariLib = function (h) { return this.lsum[h] / this.plib[h]; };

Board.prototype.play = function (p) {
  var c = this.toPlay, o = 3 - c;
  this.last2 = this.last; this.last = p; this.moveNum++; this.toPlay = o;
  if (p === PASS) { this.passes++; this.ko = 0; return 0; }
  this.passes = 0;
  var col = this.col, head = this.head, plib = this.plib, size = this.size, lsum = this.lsum, lsq = this.lsq, dirs = this.dirs;
  var i, q, cq, h, pp = p * p;
  col[p] = c; this.h1 ^= ZOB1[c][p]; this.h2 ^= ZOB2[c][p];
  head[p] = p; this.nxt[p] = p; size[p] = 1; plib[p] = 0; lsum[p] = 0; lsq[p] = 0;
  for (i = 0; i < 4; i++) {
    q = p + dirs[i]; cq = col[q];
    if (cq === EMPTY) { plib[p]++; lsum[p] += q; lsq[p] += q * q; }
    else if (cq !== EDGE) { h = head[q]; plib[h]--; lsum[h] -= p; lsq[h] -= pp; }
  }
  for (i = 0; i < 4; i++) {
    q = p + dirs[i];
    if (col[q] === c) { h = head[q]; var hp = head[p]; if (h !== hp) this.merge(hp, h); }
  }
  var capN = 0, capPt = 0;
  for (i = 0; i < 4; i++) {
    q = p + dirs[i];
    if (col[q] === o) { h = head[q]; if (plib[h] === 0) { capN += size[h]; capPt = q; this.remove(h, c); } }
  }
  this.cap[c] += capN;
  h = head[p];
  this.ko = (capN === 1 && size[h] === 1 && plib[h] === 1) ? capPt : 0;
  return capN;
};
Board.prototype.merge = function (a, b) {
  var head = this.head, nxt = this.nxt, size = this.size;
  if (size[a] < size[b]) { var t = a; a = b; b = t; }
  var s = b;
  do { head[s] = a; s = nxt[s]; } while (s !== b);
  var t2 = nxt[a]; nxt[a] = nxt[b]; nxt[b] = t2;
  size[a] += size[b]; this.plib[a] += this.plib[b]; this.lsum[a] += this.lsum[b]; this.lsq[a] += this.lsq[b];
};
Board.prototype.remove = function (h, c) {
  var col = this.col, nxt = this.nxt, head = this.head, dirs = this.dirs, o = 3 - c, s = h, i, q, hh;
  var Z1 = ZOB1[o], Z2 = ZOB2[o];
  do { col[s] = EMPTY; this.h1 ^= Z1[s]; this.h2 ^= Z2[s]; s = nxt[s]; } while (s !== h);
  s = h;
  do {
    for (i = 0; i < 4; i++) {
      q = s + dirs[i];
      if (col[q] === c) { hh = head[q]; this.plib[hh]++; this.lsum[hh] += s; this.lsq[hh] += s * s; }
    }
    s = nxt[s];
  } while (s !== h);
};
Board.prototype.legal = function (p) {
  if (p === PASS) return true;
  var col = this.col;
  if (col[p] !== EMPTY || p === this.ko) return false;
  var c = this.toPlay, dirs = this.dirs, i, q, cq;
  for (i = 0; i < 4; i++) if (col[p + dirs[i]] === EMPTY) return true;
  for (i = 0; i < 4; i++) {
    q = p + dirs[i]; cq = col[q];
    if (cq === c) { if (!this.inAtari(this.head[q])) return true; }
    else if (cq !== EDGE) { if (this.inAtari(this.head[q])) return true; }
  }
  return false;
};
Board.prototype.eyeish = function (p, c) {
  var col = this.col, dirs = this.dirs, i, x;
  for (i = 0; i < 4; i++) { x = col[p + dirs[i]]; if (x !== c && x !== EDGE) return false; }
  var opp = 0, edge = 0, o = 3 - c, dg = this.diag;
  for (i = 0; i < 4; i++) { x = col[p + dg[i]]; if (x === o) opp++; else if (x === EDGE) edge = 1; }
  return edge ? opp === 0 : opp < 2;
};
Board.prototype.libsAfter = function (p, c) {
  var col = this.col, dirs = this.dirs, head = this.head, nxt = this.nxt, L = this._lb, o = 3 - c;
  var n = 0, i, j, k, q, r, s, h, dup;
  for (i = 0; i < 4; i++) {
    q = p + dirs[i];
    if (col[q] === EMPTY) { L[n++] = q; }
    else if (col[q] === o && this.inAtari(head[q])) return 3;
  }
  if (n >= 3) return 3;
  for (i = 0; i < 4; i++) {
    q = p + dirs[i];
    if (col[q] !== c) continue;
    h = head[q]; s = h;
    do {
      for (j = 0; j < 4; j++) {
        r = s + dirs[j];
        if (col[r] === EMPTY && r !== p) {
          dup = false;
          for (k = 0; k < n; k++) if (L[k] === r) { dup = true; break; }
          if (!dup) { L[n++] = r; if (n >= 3) return 3; }
        }
      }
      s = nxt[s];
    } while (s !== h);
  }
  return n;
};
Board.prototype.patCode = function (p) {
  var col = this.col, o = this.n8;
  return col[p + o[0]] | (col[p + o[1]] << 2) | (col[p + o[2]] << 4) | (col[p + o[3]] << 6) |
    (col[p + o[4]] << 8) | (col[p + o[5]] << 10) | (col[p + o[6]] << 12) | (col[p + o[7]] << 14);
};
Board.prototype.score = function (komi, own) {
  var col = this.col, pts = this.pts, dirs = this.dirs, s = 0, i, p, cp, m, o;
  for (i = 0; i < pts.length; i++) {
    p = pts[i]; cp = col[p];
    if (cp === BLACK) { s++; o = 1; }
    else if (cp === WHITE) { s--; o = 2; }
    else {
      m = (1 << col[p + dirs[0]]) | (1 << col[p + dirs[1]]) | (1 << col[p + dirs[2]]) | (1 << col[p + dirs[3]]);
      m &= 6;
      if (m === 2) { s++; o = 1; } else if (m === 4) { s--; o = 2; } else o = 0;
    }
    if (own) own[p] = o;
  }
  return s - komi;
};
Board.fromState = function (st) {
  var b = new Board(st.n);
  for (var i = 0; i < b.pts.length; i++) {
    var p = b.pts[i], c = st.col[p];
    if (c === BLACK || c === WHITE) { b.toPlay = c; b.play(p); }
  }
  b.toPlay = st.toPlay; b.ko = st.ko; b.passes = st.passes; b.last = st.last; b.last2 = st.last2 || 0;
  b.moveNum = st.moveNum; b.cap[1] = st.cap1 || 0; b.cap[2] = st.cap2 || 0;
  return b;
};
Board.prototype.state = function () {
  return { n: this.n, col: Array.from(this.col), toPlay: this.toPlay, ko: this.ko, passes: this.passes, last: this.last, last2: this.last2,
    moveNum: this.moveNum, cap1: this.cap[1], cap2: this.cap[2] };
};

var _cand = new Int16Array(512);
function captureMove(b) {
  var c = b.toPlay, o = 3 - c, L = b.last, col = b.col, head = b.head, nxt = b.nxt, dirs = b.dirs, n8 = b.n8;
  var k = 0, i, j, q, cq, h, lib, s, r, hh, l2;
  for (i = -1; i < 8; i++) {
    q = i < 0 ? L : L + n8[i]; cq = col[q];
    if (cq !== BLACK && cq !== WHITE) continue;
    h = head[q];
    if (!b.inAtari(h)) continue;
    lib = b.atariLib(h);
    if (cq === o) { if (b.legal(lib)) _cand[k++] = lib; }
    else {
      if (b.legal(lib) && b.libsAfter(lib, c) >= 2) _cand[k++] = lib;
      s = h;
      do {
        for (j = 0; j < 4; j++) {
          r = s + dirs[j];
          if (col[r] === o) { hh = head[r]; if (b.inAtari(hh)) { l2 = b.atariLib(hh); if (b.legal(l2)) _cand[k++] = l2; } }
        }
        s = nxt[s];
      } while (s !== h && k < 500);
    }
  }
  return k ? _cand[rndInt(k)] : 0;
}
function patternMove(b) {
  var c = b.toPlay, L = b.last, col = b.col, n8 = b.n8, k = 0, i, q;
  for (i = 0; i < 8; i++) {
    q = L + n8[i];
    if (col[q] !== EMPTY || !PAT[b.patCode(q)] || !b.legal(q)) continue;
    if (b.libsAfter(q, c) < 2 && rnd() < 0.9) continue;
    _cand[k++] = q;
  }
  if (b.last2 > 0) {
    var L2 = b.last2;
    for (i = 0; i < 8; i++) {
      q = L2 + n8[i];
      if (col[q] !== EMPTY || !PAT[b.patCode(q)] || !b.legal(q)) continue;
      if (b.libsAfter(q, c) < 2) continue;
      if (rnd() < 0.5) _cand[k++] = q;
    }
  }
  return k ? _cand[rndInt(k)] : 0;
}
function randomMove(b) {
  var pts = b.pts, N = pts.length, start = rndInt(N), c = b.toPlay, col = b.col, dirs = b.dirs, k, idx, p, la, fr, i;
  for (k = 0; k < N; k++) {
    idx = start + k; if (idx >= N) idx -= N;
    p = pts[idx];
    if (col[p] !== EMPTY || b.eyeish(p, c) || !b.legal(p)) continue;
    la = b.libsAfter(p, c);
    if (la < 2) {
      fr = false;
      for (i = 0; i < 4; i++) if (col[p + dirs[i]] === c) { fr = true; break; }
      if (rnd() < (fr ? 0.95 : 0.5)) continue;
    }
    return p;
  }
  return PASS;
}
function playout(b, seqM, seqC, len, limit) {
  while (b.passes < 2 && b.moveNum < limit) {
    var c = b.toPlay, m = 0;
    if (b.last > 0) {
      if (rnd() < 0.9) m = captureMove(b);
      if (!m && rnd() < 0.95) m = patternMove(b);
    }
    if (!m) m = randomMove(b);
    if (len < seqM.length) { seqM[len] = m; seqC[len] = c; len++; }
    b.play(m);
  }
  return len;
}

var RAVE_EQ = 3500, EXPL = 0.03;
function Tree(cap) {
  this.cap = cap; this.used = 0;
  this.mv = new Int16Array(cap); this.n = new Float32Array(cap); this.w = new Float32Array(cap);
  this.rn = new Float32Array(cap); this.rw = new Float32Array(cap);
  this.pn = new Uint8Array(cap); this.pw = new Uint8Array(cap);
  this.first = new Int32Array(cap); this.cnt = new Int16Array(cap);
}
var _tree = null;

function cfgDistance(b, from, out) {
  out.fill(99);
  if (from <= 0) return;
  var col = b.col, dirs = b.dirs, dq = new Int16Array(b.sz * 2), head = b.sz, tail = b.sz;
  out[from] = 0; dq[tail++] = from;
  while (head < tail) {
    var p = dq[head++], d = out[p];
    if (d >= 3) continue;
    for (var i = 0; i < 4; i++) {
      var q = p + dirs[i], cq = col[q];
      if (cq === EDGE) continue;
      var nd = (cq !== EMPTY && cq === col[p]) ? d : d + 1;
      if (nd < out[q]) { out[q] = nd; if (nd === d) dq[--head] = q; else dq[tail++] = q; }
    }
  }
}
function emptyArea(b, p, dist) {
  var w = b.w, col = b.col, r0 = (p / w) | 0, c0 = p % w;
  for (var dr = -dist; dr <= dist; dr++) {
    var rem = dist - Math.abs(dr);
    for (var dc = -rem; dc <= rem; dc++) {
      var r = r0 + dr, c = c0 + dc;
      if (r < 0 || r >= w || c < 0 || c >= w) continue;
      var x = col[r * w + c];
      if (x === BLACK || x === WHITE) return false;
    }
  }
  return true;
}

var _dist = null, _tb = null;
function expand(T, node, b, history) {
  var c = b.toPlay, o = 3 - c, col = b.col, head = b.head, dirs = b.dirs, pts = b.pts;
  if (!_dist || _dist.length !== b.sz) _dist = new Int8Array(b.sz);
  if (!_tb || _tb.n !== b.n) _tb = new Board(b.n);
  cfgDistance(b, b.last, _dist);
  var start = T.used, k = 0, i, j, p, q, h, pn, pw, capt, esc, la;
  for (i = 0; i < pts.length; i++) {
    p = pts[i];
    if (col[p] !== EMPTY || b.eyeish(p, c) || !b.legal(p)) continue;
    if (history) { _tb.copyFrom(b); _tb.play(p); if (history.has(_tb.key())) continue; }
    if (start + k + 2 >= T.cap) break;
    pn = 10; pw = 5; capt = 0; esc = false;
    for (j = 0; j < 4; j++) {
      q = p + dirs[j];
      if (col[q] === o) { h = head[q]; if (b.inAtari(h)) capt += b.size[h]; }
      else if (col[q] === c) { h = head[q]; if (b.inAtari(h)) esc = true; }
    }
    la = b.libsAfter(p, c);
    if (capt) { if (capt === 1) { pn += 15; pw += 15; } else { pn += 30; pw += 30; } }
    if (esc && la >= 2) { pn += 30; pw += 30; }
    if (la < 2 && !capt) { pn += 10; }
    if (PAT[b.patCode(p)]) { pn += 10; pw += 10; }
    var d = _dist[p];
    if (d === 1) { pn += 24; pw += 24; } else if (d === 2) { pn += 22; pw += 22; } else if (d === 3) { pn += 8; pw += 8; }
    var ln = b.line[p];
    if (ln <= 1 && emptyArea(b, p, 3)) { pn += 10; }
    else if (ln === 2 && emptyArea(b, p, 3)) { pn += 10; pw += 10; }
    var x = start + k;
    T.mv[x] = p; T.pn[x] = pn; T.pw[x] = pw; T.n[x] = pn; T.w[x] = pw; T.rn[x] = 0; T.rw[x] = 0; T.first[x] = -1; T.cnt[x] = 0;
    k++;
  }
  var y = start + k;
  T.mv[y] = PASS; T.pn[y] = 2; T.pw[y] = 1; T.n[y] = 2; T.w[y] = 1; T.rn[y] = 0; T.rw[y] = 0; T.first[y] = -1; T.cnt[y] = 0;
  k++;
  T.first[node] = start; T.cnt[node] = k; T.used = start + k;
}
function selectChild(T, node) {
  var f = T.first[node], e = f + T.cnt[node], best = -1e9, bi = f, lg = Math.log(T.n[node] + 1);
  var n = T.n, w = T.w, rn = T.rn, rw = T.rw;
  for (var j = f; j < e; j++) {
    var v = n[j], r = w[j] / v, a = rn[j];
    if (a > 0) { var beta = a / (a + v + v * a / RAVE_EQ); r = (1 - beta) * r + beta * rw[j] / a; }
    r += EXPL * Math.sqrt(lg / v);
    if (r > best) { best = r; bi = j; }
  }
  return bi;
}

function search(rootB, opts) {
  var n = rootB.n, cap = opts.cap || 1500000;
  if (!_tree || _tree.cap !== cap) _tree = new Tree(cap);
  var T = _tree;
  T.used = 1; T.mv[0] = 0; T.n[0] = 0; T.w[0] = 0; T.first[0] = -1; T.cnt[0] = 0; T.pn[0] = 0; T.pw[0] = 0;
  var hist = new Set(opts.history || []);
  expand(T, 0, rootB, hist);
  var EXPAND = n <= 9 ? 6 : n <= 13 ? 10 : 14;
  var komi = opts.komi, b = new Board(n), path = new Int32Array(2000);
  var seqM = new Int16Array(6000), seqC = new Int8Array(6000), fc = new Int8Array(b.sz), own = new Int8Array(b.sz);
  var ownSum = new Float64Array(b.sz);
  var deadline = Date.now() + (opts.time || 1000), maxSims = opts.maxSims || 1e9, sims = 0, limitAdd = n * n * 3;
  var Tn = T.n, Tw = T.w, Trn = T.rn, Trw = T.rw, Tf = T.first, Tc = T.cnt, Tm = T.mv;
  while (sims < maxSims) {
    if ((sims & 31) === 0 && Date.now() > deadline) break;
    b.copyFrom(rootB);
    var node = 0, depth = 0, len = 0;
    path[0] = 0;
    while (true) {
      if (Tf[node] < 0) {
        if (node !== 0 && Tn[node] - T.pn[node] >= EXPAND && T.used + n * n + 2 < T.cap) expand(T, node, b, null);
        if (Tf[node] < 0) break;
      }
      var ch = selectChild(T, node), m = Tm[ch];
      seqM[len] = m; seqC[len] = b.toPlay; len++;
      b.play(m);
      path[++depth] = ch; node = ch;
      if (b.passes >= 2 || depth >= 1990) break;
    }
    if (b.passes >= 2) b.passes = 0;
    len = playout(b, seqM, seqC, len, b.moveNum + limitAdd);
    var sc = b.score(komi, own), winner = sc > 0 ? BLACK : WHITE;
    for (var i = 0; i < b.pts.length; i++) { var p = b.pts[i]; ownSum[p] += own[p] === 1 ? 1 : own[p] === 2 ? -1 : 0; }
    for (var d = 0; d <= depth; d++) {
      var nd = path[d]; Tn[nd]++;
      if (d > 0 && seqC[d - 1] === winner) Tw[nd]++;
    }
    fc.fill(0);
    for (var s = len - 1; s >= 0; s--) {
      var mm = seqM[s]; if (mm > 0) fc[mm] = seqC[s];
      if (s <= depth) {
        var pn2 = path[s], f = Tf[pn2];
        if (f >= 0) {
          var cc = seqC[s], win = winner === cc ? 1 : 0, e = f + Tc[pn2];
          for (var j = f; j < e; j++) { var cm = Tm[j]; if (cm > 0 && fc[cm] === cc) { Trn[j]++; Trw[j] += win; } }
        }
      }
    }
    sims++;
  }
  var res = [], f0 = Tf[0], e0 = f0 + Tc[0];
  for (var j2 = f0; j2 < e0; j2++) {
    var rn_ = Tn[j2] - T.pn[j2];
    res.push({ m: Tm[j2], n: rn_, w: Tw[j2] - T.pw[j2] });
  }
  var pv = [], nd2 = 0;
  for (var t = 0; t < 8 && Tf[nd2] >= 0; t++) {
    var bj = -1, bn = -1;
    for (var j3 = Tf[nd2]; j3 < Tf[nd2] + Tc[nd2]; j3++) { var vv = Tn[j3] - T.pn[j3]; if (vv > bn) { bn = vv; bj = j3; } }
    if (bn < 20) break;
    pv.push(Tm[bj]); nd2 = bj;
  }
  var ownAvg = new Array(b.sz);
  for (var q2 = 0; q2 < b.sz; q2++) ownAvg[q2] = sims ? ownSum[q2] / sims : 0;
  return { children: res, sims: sims, own: ownAvg, pv: pv, nodes: T.used };
}

if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof importScripts === 'function') {
  self.onmessage = function (e) {
    var d = e.data, b = Board.fromState(d.state);
    var r = search(b, d.opts);
    self.postMessage({ id: d.id, res: r });
  };
}
if (typeof module !== 'undefined') module.exports = { Board: Board, search: search, playout: playout, PAT: PAT, EMPTY: EMPTY, BLACK: BLACK, WHITE: WHITE, EDGE: EDGE, PASS: PASS };

