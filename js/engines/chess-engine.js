// ======================= 체스 엔진 (0x88, PVS + TT + Null move + LMR) + 10단계 강도 조절 =======================
var ChessEngine = (function () {
  'use strict';
  var P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, WHITE = 0, BLACK = 8;
  var KN = [33, 31, 18, 14, -33, -31, -18, -14], KG = [1, -1, 16, -16, 17, 15, -17, -15];
  var BD = [17, 15, -17, -15], RD = [1, -1, 16, -16];
  var VAL = [0, 100, 320, 330, 500, 900, 0];
  var MATE = 30000, INF = 32000;

  var Z1 = [], Z2 = [], ZC1 = new Int32Array(16), ZC2 = new Int32Array(16), ZE1 = new Int32Array(8), ZE2 = new Int32Array(8), ZS1, ZS2;
  (function () {
    var s = 0x1234567;
    function r() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s | 0; }
    for (var p = 0; p < 16; p++) { Z1[p] = new Int32Array(128); Z2[p] = new Int32Array(128); for (var q = 0; q < 128; q++) { Z1[p][q] = r(); Z2[p][q] = r(); } }
    for (var i = 0; i < 16; i++) { ZC1[i] = r(); ZC2[i] = r(); }
    for (i = 0; i < 8; i++) { ZE1[i] = r(); ZE2[i] = r(); }
    ZS1 = r(); ZS2 = r();
  })();
  var CRMASK = new Uint8Array(128);
  for (var i0 = 0; i0 < 128; i0++) CRMASK[i0] = 15;
  CRMASK[4] = 15 & ~3; CRMASK[0] = 15 & ~2; CRMASK[7] = 15 & ~1;
  CRMASK[116] = 15 & ~12; CRMASK[112] = 15 & ~8; CRMASK[119] = 15 & ~4;

  var PST_SRC = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    7: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
  };
  var PST = [[], []];
  (function () {
    for (var t = 1; t <= 7; t++) {
      PST[0][t] = new Int16Array(128); PST[1][t] = new Int16Array(128);
      for (var r = 0; r < 8; r++) for (var f = 0; f < 8; f++) {
        var sq = r * 16 + f;
        PST[0][t][sq] = PST_SRC[t][(7 - r) * 8 + f];
        PST[1][t][sq] = PST_SRC[t][r * 8 + f];
      }
    }
  })();

  function Pos() {
    this.b = new Int8Array(128); this.side = WHITE; this.castle = 0; this.ep = -1; this.half = 0; this.full = 1;
    this.h1 = 0; this.h2 = 0; this.kings = [0, 0];
    this.us = []; this.hh1 = []; this.hh2 = [];
  }
  Pos.prototype.fromFEN = function (fen) {
    var parts = fen.trim().split(/\s+/), b = this.b, r = 7, f = 0, map = { p: P, n: N, b: B, r: R, q: Q, k: K };
    b.fill(0);
    for (var i = 0; i < parts[0].length; i++) {
      var ch = parts[0][i];
      if (ch === '/') { r--; f = 0; }
      else if (ch >= '1' && ch <= '8') f += +ch;
      else { var lc = ch.toLowerCase(), col = ch === lc ? BLACK : WHITE; b[r * 16 + f] = map[lc] | col; if (map[lc] === K) this.kings[col >> 3] = r * 16 + f; f++; }
    }
    this.side = parts[1] === 'b' ? BLACK : WHITE;
    var c = parts[2] || '-'; this.castle = (c.indexOf('K') >= 0 ? 1 : 0) | (c.indexOf('Q') >= 0 ? 2 : 0) | (c.indexOf('k') >= 0 ? 4 : 0) | (c.indexOf('q') >= 0 ? 8 : 0);
    var e = parts[3] || '-'; this.ep = e === '-' ? -1 : (e.charCodeAt(1) - 49) * 16 + e.charCodeAt(0) - 97;
    this.half = +(parts[4] || 0); this.full = +(parts[5] || 1);
    this.rehash(); this.us = []; this.hh1 = [this.h1]; this.hh2 = [this.h2];
    return this;
  };
  Pos.prototype.rehash = function () {
    var h1 = 0, h2 = 0;
    for (var sq = 0; sq < 128; sq++) { if (sq & 0x88) continue; var p = this.b[sq]; if (p) { h1 ^= Z1[p][sq]; h2 ^= Z2[p][sq]; } }
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    if (this.side) { h1 ^= ZS1; h2 ^= ZS2; }
    this.h1 = h1; this.h2 = h2;
  };
  Pos.prototype.clone = function () {
    var p = new Pos(); p.b.set(this.b); p.side = this.side; p.castle = this.castle; p.ep = this.ep; p.half = this.half; p.full = this.full;
    p.h1 = this.h1; p.h2 = this.h2; p.kings = this.kings.slice(); p.hh1 = this.hh1.slice(); p.hh2 = this.hh2.slice(); p.us = [];
    return p;
  };
  Pos.prototype.state = function () {
    return { b: Array.from(this.b), side: this.side, castle: this.castle, ep: this.ep, half: this.half, full: this.full, kings: this.kings.slice(), hh1: this.hh1.slice(-120), hh2: this.hh2.slice(-120) };
  };
  Pos.fromState = function (s) {
    var p = new Pos(); p.b.set(s.b); p.side = s.side; p.castle = s.castle; p.ep = s.ep; p.half = s.half; p.full = s.full; p.kings = s.kings.slice();
    p.rehash(); p.hh1 = s.hh1.slice(); p.hh2 = s.hh2.slice(); return p;
  };

  Pos.prototype.attacked = function (sq, by) {
    var b = this.b, i, t, p;
    if (by === WHITE) {
      t = sq - 15; if (!(t & 0x88) && b[t] === P) return true;
      t = sq - 17; if (!(t & 0x88) && b[t] === P) return true;
    } else {
      t = sq + 15; if (!(t & 0x88) && b[t] === (P | BLACK)) return true;
      t = sq + 17; if (!(t & 0x88) && b[t] === (P | BLACK)) return true;
    }
    var kn = N | by, kg = K | by, bi = B | by, ro = R | by, qu = Q | by;
    for (i = 0; i < 8; i++) { t = sq + KN[i]; if (!(t & 0x88) && b[t] === kn) return true; }
    for (i = 0; i < 8; i++) { t = sq + KG[i]; if (!(t & 0x88) && b[t] === kg) return true; }
    for (i = 0; i < 4; i++) {
      t = sq + BD[i];
      while (!(t & 0x88)) { p = b[t]; if (p) { if (p === bi || p === qu) return true; break; } t += BD[i]; }
      t = sq + RD[i];
      while (!(t & 0x88)) { p = b[t]; if (p) { if (p === ro || p === qu) return true; break; } t += RD[i]; }
    }
    return false;
  };
  Pos.prototype.inCheck = function (side) { if (side === undefined) side = this.side; return this.attacked(this.kings[side >> 3], side ^ 8); };

  function mv(f, t, promo, flag) { return f | (t << 7) | (promo << 14) | (flag << 17); }
  Pos.prototype.gen = function (out, capsOnly) {
    var b = this.b, s = this.side, o = s ^ 8, n = 0, sq, p, t, to, x, i, d;
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = b[sq]; if (!p || (p & 8) !== s) continue;
      t = p & 7;
      if (t === P) {
        var dir = s ? -16 : 16, rank = sq >> 4, start = s ? 6 : 1, last = s ? 1 : 6;
        to = sq + dir;
        if (!b[to]) {
          if (rank === last) { out[n++] = mv(sq, to, Q, 0); if (!capsOnly) { out[n++] = mv(sq, to, N, 0); out[n++] = mv(sq, to, R, 0); out[n++] = mv(sq, to, B, 0); } }
          else if (!capsOnly) {
            out[n++] = mv(sq, to, 0, 0);
            if (rank === start && !b[to + dir]) out[n++] = mv(sq, to + dir, 0, 4);
          }
        }
        for (i = -1; i <= 1; i += 2) {
          to = sq + dir + i; if (to & 0x88) continue;
          x = b[to];
          if (x && (x & 8) === o) {
            if (rank === last) { out[n++] = mv(sq, to, Q, 0); out[n++] = mv(sq, to, N, 0); out[n++] = mv(sq, to, R, 0); out[n++] = mv(sq, to, B, 0); }
            else out[n++] = mv(sq, to, 0, 0);
          } else if (to === this.ep) out[n++] = mv(sq, to, 0, 1);
        }
      } else if (t === N || t === K) {
        var st = t === N ? KN : KG;
        for (i = 0; i < 8; i++) {
          to = sq + st[i]; if (to & 0x88) continue;
          x = b[to];
          if (x) { if ((x & 8) === o) out[n++] = mv(sq, to, 0, 0); }
          else if (!capsOnly) out[n++] = mv(sq, to, 0, 0);
        }
        if (t === K && !capsOnly) {
          if (s === WHITE && sq === 4) {
            if ((this.castle & 1) && !b[5] && !b[6] && b[7] === R && !this.attacked(4, o) && !this.attacked(5, o) && !this.attacked(6, o)) out[n++] = mv(4, 6, 0, 2);
            if ((this.castle & 2) && !b[3] && !b[2] && !b[1] && b[0] === R && !this.attacked(4, o) && !this.attacked(3, o) && !this.attacked(2, o)) out[n++] = mv(4, 2, 0, 2);
          } else if (s === BLACK && sq === 116) {
            if ((this.castle & 4) && !b[117] && !b[118] && b[119] === (R | BLACK) && !this.attacked(116, o) && !this.attacked(117, o) && !this.attacked(118, o)) out[n++] = mv(116, 118, 0, 2);
            if ((this.castle & 8) && !b[115] && !b[114] && !b[113] && b[112] === (R | BLACK) && !this.attacked(116, o) && !this.attacked(115, o) && !this.attacked(114, o)) out[n++] = mv(116, 114, 0, 2);
          }
        }
      } else {
        var ds = t === B ? BD : t === R ? RD : KG, nd = t === Q ? 8 : 4;
        for (i = 0; i < nd; i++) {
          d = ds[i]; to = sq + d;
          while (!(to & 0x88)) {
            x = b[to];
            if (x) { if ((x & 8) === o) out[n++] = mv(sq, to, 0, 0); break; }
            if (!capsOnly) out[n++] = mv(sq, to, 0, 0);
            to += d;
          }
        }
      }
    }
    return n;
  };

  Pos.prototype.make = function (m) {
    var b = this.b, f = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flag = m >> 17;
    var p = b[f], cap = b[to], s = this.side, h1 = this.h1, h2 = this.h2;
    this.us.push(m, cap, this.castle, this.ep, this.half, h1, h2);
    h1 ^= Z1[p][f]; h2 ^= Z2[p][f];
    if (cap) { h1 ^= Z1[cap][to]; h2 ^= Z2[cap][to]; }
    if (flag & 1) { var cs = to + (s ? 16 : -16); cap = b[cs]; b[cs] = 0; h1 ^= Z1[cap][cs]; h2 ^= Z2[cap][cs]; this.us[this.us.length - 6] = cap; }
    var np = promo ? (promo | s) : p;
    b[to] = np; b[f] = 0; h1 ^= Z1[np][to]; h2 ^= Z2[np][to];
    if ((p & 7) === K) this.kings[s >> 3] = to;
    if (flag & 2) {
      var rf, rt;
      if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 118) { rf = 119; rt = 117; } else { rf = 112; rt = 115; }
      var rp = b[rf]; b[rt] = rp; b[rf] = 0; h1 ^= Z1[rp][rf] ^ Z1[rp][rt]; h2 ^= Z2[rp][rf] ^ Z2[rp][rt];
    }
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    this.castle &= CRMASK[f] & CRMASK[to];
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    this.ep = (flag & 4) ? f + (s ? -16 : 16) : -1;
    if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
    this.half = ((p & 7) === P || cap) ? 0 : this.half + 1;
    if (s) this.full++;
    this.side = s ^ 8; h1 ^= ZS1; h2 ^= ZS2;
    this.h1 = h1; this.h2 = h2;
    this.hh1.push(h1); this.hh2.push(h2);
  };
  Pos.prototype.unmake = function () {
    var us = this.us, L = us.length, m = us[L - 7], cap = us[L - 6];
    this.castle = us[L - 5]; this.ep = us[L - 4]; this.half = us[L - 3]; this.h1 = us[L - 2]; this.h2 = us[L - 1];
    us.length = L - 7; this.hh1.pop(); this.hh2.pop();
    var b = this.b, f = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flag = m >> 17;
    this.side ^= 8; var s = this.side;
    if (s) this.full--;
    var p = promo ? (P | s) : b[to];
    b[f] = p;
    if (flag & 1) { b[to] = 0; b[to + (s ? 16 : -16)] = cap; }
    else b[to] = cap;
    if ((p & 7) === K) this.kings[s >> 3] = f;
    if (flag & 2) {
      var rf, rt;
      if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 118) { rf = 119; rt = 117; } else { rf = 112; rt = 115; }
      b[rf] = b[rt]; b[rt] = 0;
    }
  };
  Pos.prototype.makeNull = function () {
    this.us.push(0, 0, this.castle, this.ep, this.half, this.h1, this.h2);
    if (this.ep >= 0) { this.h1 ^= ZE1[this.ep & 7]; this.h2 ^= ZE2[this.ep & 7]; }
    this.ep = -1; this.side ^= 8; this.h1 ^= ZS1; this.h2 ^= ZS2; this.half++;
    this.hh1.push(this.h1); this.hh2.push(this.h2);
  };
  Pos.prototype.unmakeNull = function () {
    var us = this.us, L = us.length;
    this.castle = us[L - 5]; this.ep = us[L - 4]; this.half = us[L - 3]; this.h1 = us[L - 2]; this.h2 = us[L - 1];
    us.length = L - 7; this.hh1.pop(); this.hh2.pop(); this.side ^= 8;
  };
  var _buf = new Int32Array(256);
  Pos.prototype.legalMoves = function () {
    var n = this.gen(_buf, false), out = [], s = this.side;
    for (var i = 0; i < n; i++) { var m = _buf[i]; this.make(m); if (!this.inCheck(s)) out.push(m); this.unmake(); }
    return out;
  };
  Pos.prototype.isRepetition = function (times) {
    var L = this.hh1.length, c = 0;
    for (var i = L - 3; i >= 0 && i >= L - 1 - this.half; i -= 2) if (this.hh1[i] === this.h1 && this.hh2[i] === this.h2) { c++; if (c >= times) return true; }
    return false;
  };
  Pos.prototype.insufficient = function () {
    var minors = 0;
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      var t = this.b[sq] & 7;
      if (t === P || t === R || t === Q) return false;
      if (t === N || t === B) minors++;
    }
    return minors <= 1;
  };

  var pawnF = [new Int8Array(10), new Int8Array(10)];
  Pos.prototype.evaluate = function () {
    var b = this.b, mg = 0, eg = 0, phase = 0, sc = 0, bish = [0, 0], sq, p, t, c, sgn;
    pawnF[0].fill(0); pawnF[1].fill(0);
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = b[sq]; if (!p) continue;
      t = p & 7; c = p >> 3; sgn = c ? -1 : 1;
      if (t === K) { mg += sgn * PST[c][6][sq]; eg += sgn * PST[c][7][sq]; continue; }
      sc += sgn * (VAL[t] + PST[c][t][sq]);
      if (t === P) pawnF[c][(sq & 7) + 1]++;
      else { phase += t === Q ? 4 : t === R ? 2 : 1; if (t === B) bish[c]++; }
    }
    if (phase > 24) phase = 24;
    sc += Math.round((mg * phase + eg * (24 - phase)) / 24);
    if (bish[0] >= 2) sc += 30; if (bish[1] >= 2) sc -= 30;
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = b[sq]; if (!p) continue;
      t = p & 7; c = p >> 3; sgn = c ? -1 : 1;
      var fl = (sq & 7) + 1;
      if (t === P) {
        var my = pawnF[c], op = pawnF[c ^ 1];
        if (my[fl] > 1) sc -= sgn * 12;
        if (!my[fl - 1] && !my[fl + 1]) sc -= sgn * 12;
        if (!op[fl] && !op[fl - 1] && !op[fl + 1]) {
          var rk = c ? 7 - (sq >> 4) : (sq >> 4);
          sc += sgn * [0, 5, 10, 20, 35, 60, 100, 0][rk] * (phase < 12 ? 2 : 1);
        }
      } else if (t === R) {
        if (!pawnF[c][fl]) sc += sgn * (pawnF[c ^ 1][fl] ? 10 : 20);
      }
    }
    return this.side ? -sc : sc;
  };

  var TT_BITS = 20, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  var ttK = null, ttM, ttS, ttD, ttF;
  function ttInit() { if (ttK) return; ttK = new Int32Array(TT_SIZE); ttM = new Int32Array(TT_SIZE); ttS = new Int16Array(TT_SIZE); ttD = new Int8Array(TT_SIZE); ttF = new Uint8Array(TT_SIZE); }
  var S = { nodes: 0, deadline: 0, stop: false, killers: [], hist: null, noQ: false };
  var MOVEBUF = [], SCOREBUF = [];
  for (var q0 = 0; q0 < 128; q0++) { MOVEBUF.push(new Int32Array(256)); SCOREBUF.push(new Int32Array(256)); }

  function scoreMoves(pos, ms, sc, n, ply, ttMove) {
    var b = pos.b, kl = S.killers[ply], h = S.hist;
    for (var i = 0; i < n; i++) {
      var m = ms[i], to = (m >> 7) & 127, f = m & 127, v = b[to], x;
      if (m === ttMove) x = 2000000;
      else if (v || (m >> 17) & 1) x = 1000000 + VAL[v & 7 || 1] * 10 - VAL[b[f] & 7] / 10;
      else if ((m >> 14) & 7) x = 900000;
      else if (kl && (m === kl[0] || m === kl[1])) x = 800000;
      else x = h[(b[f] & 15) * 128 + to];
      sc[i] = x;
    }
  }
  function pick(ms, sc, n, i) {
    var bi = i, bv = sc[i];
    for (var j = i + 1; j < n; j++) if (sc[j] > bv) { bv = sc[j]; bi = j; }
    if (bi !== i) { var t = ms[i]; ms[i] = ms[bi]; ms[bi] = t; t = sc[i]; sc[i] = sc[bi]; sc[bi] = t; }
    return ms[i];
  }
  function tick() { if ((++S.nodes & 2047) === 0 && Date.now() > S.deadline) S.stop = true; return S.stop; }

  function quiesce(pos, alpha, beta, ply) {
    if (tick()) return 0;
    var stand = pos.evaluate();
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply >= 120) return stand;
    var ms = MOVEBUF[ply], sc = SCOREBUF[ply], n = pos.gen(ms, true), s = pos.side;
    scoreMoves(pos, ms, sc, n, ply, 0);
    for (var i = 0; i < n; i++) {
      var m = pick(ms, sc, n, i), v = pos.b[(m >> 7) & 127];
      if (v && stand + VAL[v & 7] + 200 < alpha && !((m >> 14) & 7)) continue;
      pos.make(m);
      if (pos.inCheck(s)) { pos.unmake(); continue; }
      var x = -quiesce(pos, -beta, -alpha, ply + 1);
      pos.unmake();
      if (S.stop) return 0;
      if (x >= beta) return x;
      if (x > alpha) alpha = x;
    }
    return alpha;
  }
  function hasPieces(pos) {
    var b = pos.b, s = pos.side;
    for (var sq = 0; sq < 128; sq++) { if (sq & 0x88) continue; var p = b[sq]; if (p && (p & 8) === s) { var t = p & 7; if (t !== P && t !== K) return true; } }
    return false;
  }
  function search(pos, depth, alpha, beta, ply, allowNull) {
    if (tick()) return 0;
    if (ply > 0) {
      if (pos.half >= 100 || pos.isRepetition(1)) return 0;
      var ma = -MATE + ply, mb = MATE - ply - 1;
      if (ma > alpha) alpha = ma; if (mb < beta) beta = mb; if (alpha >= beta) return alpha;
    }
    var chk = pos.inCheck(pos.side);
    if (chk) depth++;
    if (depth <= 0) return S.noQ ? pos.evaluate() : quiesce(pos, alpha, beta, ply);
    if (ply >= 100) return pos.evaluate();
    var idx = pos.h1 & TT_MASK, ttMove = 0, pv = beta - alpha > 1, useTT = !S.noQ;
    if (useTT && ttK[idx] === pos.h2) {
      ttMove = ttM[idx];
      if (ttD[idx] >= depth && !pv && ply > 0) {
        var ts = ttS[idx], tf = ttF[idx];
        if (ts > MATE - 200) ts -= ply; else if (ts < -MATE + 200) ts += ply;
        if (tf === 1 || (tf === 2 && ts >= beta) || (tf === 3 && ts <= alpha)) return ts;
      }
    }
    var staticEval = 0;
    if (!pv && !chk) {
      staticEval = pos.evaluate();
      if (depth <= 3 && staticEval - 120 * depth >= beta && Math.abs(beta) < MATE - 200) return staticEval;
      if (allowNull && depth >= 3 && staticEval >= beta && hasPieces(pos)) {
        var Rr = depth >= 6 ? 3 : 2;
        pos.makeNull();
        var nv = -search(pos, depth - 1 - Rr, -beta, -beta + 1, ply + 1, false);
        pos.unmakeNull();
        if (S.stop) return 0;
        if (nv >= beta) return nv >= MATE - 200 ? beta : nv;
      }
    }
    var ms = MOVEBUF[ply], sc = SCOREBUF[ply], n = pos.gen(ms, false), s = pos.side;
    scoreMoves(pos, ms, sc, n, ply, ttMove);
    var best = -INF, bestM = 0, legal = 0, a0 = alpha;
    for (var i = 0; i < n; i++) {
      var m = pick(ms, sc, n, i);
      var capt = pos.b[(m >> 7) & 127] || ((m >> 17) & 1), promo = (m >> 14) & 7;
      if (!pv && !chk && depth <= 2 && legal > 0 && !capt && !promo && staticEval + 150 * depth <= alpha) {
        pos.make(m); var gc = pos.inCheck(pos.side); pos.unmake();
        if (!gc) continue;
      }
      pos.make(m);
      if (pos.inCheck(s)) { pos.unmake(); continue; }
      legal++;
      var x;
      if (legal === 1) x = -search(pos, depth - 1, -beta, -alpha, ply + 1, true);
      else {
        var red = 0;
        if (depth >= 3 && legal > 3 && !capt && !promo && !chk && sc[i] < 800000 && !pos.inCheck(pos.side)) {
          red = legal > 8 ? 2 : 1; if (pv) red = Math.max(0, red - 1);
        }
        x = -search(pos, depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (x > alpha && red) x = -search(pos, depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (x > alpha && x < beta) x = -search(pos, depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (S.stop) return 0;
      if (x > best) { best = x; bestM = m; }
      if (x > alpha) {
        alpha = x;
        if (alpha >= beta) {
          if (!capt) {
            var kl = S.killers[ply] || (S.killers[ply] = [0, 0]);
            if (kl[0] !== m) { kl[1] = kl[0]; kl[0] = m; }
            var hi = (pos.b[m & 127] & 15) * 128 + ((m >> 7) & 127);
            S.hist[hi] += depth * depth; if (S.hist[hi] > 700000) for (var z = 0; z < S.hist.length; z++) S.hist[z] >>= 1;
          }
          break;
        }
      }
    }
    if (!legal) return chk ? -MATE + ply : 0;
    if (useTT) {
      var store = best;
      if (store > MATE - 200) store += ply; else if (store < -MATE + 200) store -= ply;
      ttK[idx] = pos.h2; ttM[idx] = bestM; ttS[idx] = store; ttD[idx] = depth;
      ttF[idx] = best >= beta ? 2 : best > a0 ? 1 : 3;
    }
    return best;
  }

  function chooseIndex(list, opts) {
    if (!opts.blunder || list.length < 2 || Math.random() >= opts.blunder) return 0;
    var best = list[0].s, cand = [];
    for (var i = 1; i < list.length && cand.length < (opts.pool || 4); i++) {
      if (best - list[i].s <= (opts.margin || 300) && list[i].s > -MATE + 300) cand.push(i);
    }
    return cand.length ? cand[Math.floor(Math.random() * cand.length)] : 0;
  }

  // opts: {timeMs, maxDepth, exact, noQ, blunder, margin, pool}
  function think(pos, opts) {
    ttInit();
    S.nodes = 0; S.stop = false; S.killers = []; S.hist = new Int32Array(16 * 128); S.noQ = !!opts.noQ;
    var tm = opts.timeMs || 2000;
    S.deadline = Date.now() + tm;
    var root = pos.legalMoves();
    if (!root.length) return { move: 0, score: 0, depth: 0, nodes: 0 };
    if (opts.exact) {
      var d0 = opts.maxDepth || 2, list = [];
      for (var k = 0; k < root.length; k++) {
        pos.make(root[k]);
        var xs = -search(pos, d0 - 1, -INF, INF, 1, true);
        pos.unmake();
        if (S.stop) break;
        list.push({ m: root[k], s: xs + (opts.noJitter ? 0 : Math.floor(Math.random() * 6)) });
      }
      if (!list.length) return { move: root[0], score: 0, depth: 0, nodes: S.nodes };
      list.sort(function (a, b) { return b.s - a.s; });
      var ci = chooseIndex(list, opts);
      return { move: list[ci].m, score: list[0].s, depth: d0, nodes: S.nodes, blunder: ci > 0, all: opts.wantAll ? list : undefined };
    }
    var best = root[0], bestScore = 0, done = 0;
    var scores = new Array(root.length).fill(0);
    for (var d = 1; d <= (opts.maxDepth || 64); d++) {
      var ord = root.map(function (m, i) { return [m === best ? 1e9 : scores[i], m]; }).sort(function (a, b) { return b[0] - a[0]; });
      root = ord.map(function (x) { return x[1]; });
      scores = new Array(root.length).fill(-INF);
      var alpha = -INF, cb = 0, cs = -INF;
      for (var i = 0; i < root.length; i++) {
        var m = root[i], x;
        pos.make(m);
        if (i === 0) x = -search(pos, d - 1, -INF, -alpha, 1, true);
        else {
          x = -search(pos, d - 1, -alpha - 1, -alpha, 1, true);
          if (x > alpha && !S.stop) x = -search(pos, d - 1, -INF, -alpha, 1, true);
        }
        pos.unmake();
        if (S.stop) break;
        scores[i] = x;
        if (x > cs) { cs = x; cb = m; }
        if (x > alpha) alpha = x;
      }
      if (S.stop) { if (cb && cs > bestScore - 50) { best = cb; } break; }
      best = cb; bestScore = cs; done = d;
      if (Math.abs(cs) > MATE - 200) break;
      if (!opts.maxDepth && Date.now() > S.deadline - tm * 0.45 && d >= 4) break;
    }
    return { move: best, score: bestScore, depth: done, nodes: S.nodes };
  }

  function sqName(sq) { return String.fromCharCode(97 + (sq & 7)) + ((sq >> 4) + 1); }
  var LET = ['', '', 'N', 'B', 'R', 'Q', 'K'];
  function san(pos, m) {
    var f = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flag = m >> 17, p = pos.b[f], t = p & 7, s = '';
    if (flag & 2) s = (to & 7) === 6 ? 'O-O' : 'O-O-O';
    else {
      var capt = pos.b[to] || (flag & 1);
      if (t === P) { if (capt) s = sqName(f)[0] + 'x'; s += sqName(to); if (promo) s += '=' + LET[promo]; }
      else {
        s = LET[t];
        var others = pos.legalMoves().filter(function (o) { return o !== m && ((o >> 7) & 127) === to && pos.b[o & 127] === p; });
        if (others.length) {
          var sameF = others.some(function (o) { return ((o & 127) & 7) === (f & 7); });
          var sameR = others.some(function (o) { return ((o & 127) >> 4) === (f >> 4); });
          if (!sameF) s += sqName(f)[0]; else if (!sameR) s += sqName(f)[1]; else s += sqName(f);
        }
        if (capt) s += 'x';
        s += sqName(to);
      }
    }
    pos.make(m);
    if (pos.inCheck(pos.side)) s += pos.legalMoves().length ? '+' : '#';
    pos.unmake();
    return s;
  }

  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  return { Pos: Pos, think: think, san: san, sqName: sqName, START: START, P: P, N: N, B: B, R: R, Q: Q, K: K, WHITE: WHITE, BLACK: BLACK, MATE: MATE, VAL: VAL };
})();

if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof importScripts === 'function' && !self.__engineBound) {
  self.__engineBound = true;
  self.onmessage = function (e) {
    var d = e.data, pos = ChessEngine.Pos.fromState(d.state);
    self.postMessage({ id: d.id, res: ChessEngine.think(pos, d.opts) });
  };
}
if (typeof module !== 'undefined') module.exports = ChessEngine;