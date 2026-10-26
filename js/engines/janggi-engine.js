// ======================= 장기 엔진 v3 (PVS + TT + Null move + LMR) + 10단계 강도 조절 =======================
var JanggiEngine = (function () {
  'use strict';
  var K = 1, A = 2, E = 3, H = 4, R = 5, C = 6, P = 7;
  var CHO = 0, HAN = 1;
  var PIECE_VAL = [0, 0, 300, 280, 520, 1300, 720, 200];
  var POINTS = [0, 0, 3, 3, 5, 13, 7, 2];
  var ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var DIAGS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  var MATE = 30000, INF = 32000;

  function pside(p) { return p >> 3; }
  function mkp(t, s) { return t | (s << 3); }
  function inB(r, c) { return r >= 0 && r < 10 && c >= 0 && c < 9; }
  function inPal(r, c) { return c >= 3 && c <= 5 && ((r >= 0 && r <= 2) || (r >= 7 && r <= 9)); }
  function ownPal(s, r, c) { return c >= 3 && c <= 5 && (s === HAN ? (r >= 0 && r <= 2) : (r >= 7 && r <= 9)); }
  var OND = [];
  for (var r0 = 0; r0 < 10; r0++) for (var c0 = 0; c0 < 9; c0++) {
    var v0 = false;
    if (inPal(r0, c0)) { var rc = r0 <= 2 ? 1 : 8; v0 = Math.abs(r0 - rc) === Math.abs(c0 - 4); }
    OND[r0 * 9 + c0] = v0;
  }
  function onDiag(r, c) { return inB(r, c) && OND[r * 9 + c]; }

  var Z1 = [], Z2 = [], ZS1, ZS2;
  (function () {
    var s = 0x5A17C3;
    function rr() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s | 0; }
    for (var p = 0; p < 16; p++) { Z1[p] = new Int32Array(90); Z2[p] = new Int32Array(90); for (var q = 0; q < 90; q++) { Z1[p][q] = rr(); Z2[p][q] = rr(); } }
    ZS1 = rr(); ZS2 = rr();
  })();
  function hashOf(b, s) {
    var h1 = 0, h2 = 0;
    for (var i = 0; i < 90; i++) if (b[i]) { h1 ^= Z1[b[i]][i]; h2 ^= Z2[b[i]][i]; }
    if (s) { h1 ^= ZS1; h2 ^= ZS2; }
    return [h1, h2];
  }

  function genMoves(b, s, capOnly, out) {
    var list = out || [], n = 0;
    function add(from, to) {
      var t = b[to];
      if (t) { if (pside(t) === s) return; }
      else if (capOnly) return;
      list[n++] = from | (to << 7);
    }
    for (var i = 0; i < 90; i++) {
      var p = b[i];
      if (!p || pside(p) !== s) continue;
      var r = (i / 9) | 0, c = i % 9, t = p & 7, k, nr, nc, d, q;
      switch (t) {
        case K: case A:
          for (k = 0; k < 4; k++) { nr = r + ORTH[k][0]; nc = c + ORTH[k][1]; if (ownPal(s, nr, nc)) add(i, nr * 9 + nc); }
          if (OND[i]) for (k = 0; k < 4; k++) { nr = r + DIAGS[k][0]; nc = c + DIAGS[k][1]; if (ownPal(s, nr, nc) && onDiag(nr, nc)) add(i, nr * 9 + nc); }
          break;
        case R:
          for (k = 0; k < 4; k++) {
            d = ORTH[k]; nr = r + d[0]; nc = c + d[1];
            while (inB(nr, nc)) { q = nr * 9 + nc; if (b[q]) { add(i, q); break; } add(i, q); nr += d[0]; nc += d[1]; }
          }
          if (OND[i]) for (k = 0; k < 4; k++) {
            d = DIAGS[k]; nr = r + d[0]; nc = c + d[1];
            while (onDiag(nr, nc)) { q = nr * 9 + nc; if (b[q]) { add(i, q); break; } add(i, q); nr += d[0]; nc += d[1]; }
          }
          break;
        case C:
          for (k = 0; k < 8; k++) {
            var diag = k >= 4;
            if (diag && !OND[i]) continue;
            d = diag ? DIAGS[k - 4] : ORTH[k];
            nr = r + d[0]; nc = c + d[1];
            var jumped = false;
            while (diag ? onDiag(nr, nc) : inB(nr, nc)) {
              q = nr * 9 + nc; var x = b[q];
              if (!jumped) { if (x) { if ((x & 7) === C) break; jumped = true; } }
              else {
                if (!x) { if (!capOnly) list[n++] = i | (q << 7); }
                else { if ((x & 7) !== C && pside(x) !== s) list[n++] = i | (q << 7); break; }
              }
              nr += d[0]; nc += d[1];
            }
          }
          break;
        case H:
          for (k = 0; k < 4; k++) {
            d = ORTH[k];
            var lr = r + d[0], lc = c + d[1];
            if (!inB(lr, lc) || b[lr * 9 + lc]) continue;
            for (var sg = -1; sg <= 1; sg += 2) {
              if (d[0] !== 0) { nr = r + 2 * d[0]; nc = c + sg; } else { nr = r + sg; nc = c + 2 * d[1]; }
              if (inB(nr, nc)) add(i, nr * 9 + nc);
            }
          }
          break;
        case E:
          for (k = 0; k < 4; k++) {
            d = ORTH[k];
            var l1r = r + d[0], l1c = c + d[1];
            if (!inB(l1r, l1c) || b[l1r * 9 + l1c]) continue;
            for (var sg2 = -1; sg2 <= 1; sg2 += 2) {
              var dr = d[0] !== 0 ? d[0] : sg2, dc = d[0] !== 0 ? sg2 : d[1];
              var l2r = l1r + dr, l2c = l1c + dc;
              if (!inB(l2r, l2c) || b[l2r * 9 + l2c]) continue;
              nr = l2r + dr; nc = l2c + dc;
              if (inB(nr, nc)) add(i, nr * 9 + nc);
            }
          }
          break;
        case P:
          var f = s === CHO ? -1 : 1;
          if (inB(r + f, c)) add(i, (r + f) * 9 + c);
          if (c > 0) add(i, i - 1);
          if (c < 8) add(i, i + 1);
          if (OND[i]) for (var dc2 = -1; dc2 <= 1; dc2 += 2) { if (onDiag(r + f, c + dc2)) add(i, (r + f) * 9 + c + dc2); }
          break;
      }
    }
    if (!out) return list;
    return n;
  }

  function attacked(b, sq, by) {
    var r = (sq / 9) | 0, c = sq % 9, k, d, nr, nc, p, screen;
    for (k = 0; k < 8; k++) {
      var diag = k >= 4;
      if (diag && !OND[sq]) continue;
      d = diag ? DIAGS[k - 4] : ORTH[k];
      nr = r + d[0]; nc = c + d[1]; screen = false;
      while (diag ? onDiag(nr, nc) : inB(nr, nc)) {
        p = b[nr * 9 + nc];
        if (p) {
          if (!screen) {
            if (pside(p) === by && (p & 7) === R) return true;
            if ((p & 7) === C) break;
            screen = true;
          } else {
            if (pside(p) === by && (p & 7) === C && (b[sq] & 7) !== C) return true;
            break;
          }
        }
        nr += d[0]; nc += d[1];
      }
    }
    var hk = mkp(H, by), ek = mkp(E, by), pk = mkp(P, by);
    for (k = 0; k < 4; k++) {
      d = ORTH[k];
      for (var sg = -1; sg <= 1; sg += 2) {
        var hr, hc;
        if (d[0] !== 0) { hr = r - 2 * d[0]; hc = c - sg; } else { hr = r - sg; hc = c - 2 * d[1]; }
        if (inB(hr, hc) && b[hr * 9 + hc] === hk && !b[(hr + d[0]) * 9 + hc + d[1]]) return true;
        var dr = d[0] !== 0 ? d[0] : sg, dc = d[0] !== 0 ? sg : d[1];
        var er = r - d[0] - 2 * dr, ec = c - d[1] - 2 * dc;
        if (inB(er, ec) && b[er * 9 + ec] === ek && !b[(er + d[0]) * 9 + ec + d[1]] && !b[(er + d[0] + dr) * 9 + ec + d[1] + dc]) return true;
      }
    }
    var f = by === CHO ? -1 : 1;
    if (inB(r - f, c) && b[(r - f) * 9 + c] === pk) return true;
    if (c > 0 && b[sq - 1] === pk) return true;
    if (c < 8 && b[sq + 1] === pk) return true;
    if (OND[sq]) for (var dc2 = -1; dc2 <= 1; dc2 += 2) {
      if (onDiag(r - f, c + dc2) && b[(r - f) * 9 + c + dc2] === pk) return true;
    }
    var kk = mkp(K, by), ak = mkp(A, by);
    for (k = 0; k < 4; k++) {
      nr = r + ORTH[k][0]; nc = c + ORTH[k][1];
      if (ownPal(by, nr, nc) && ownPal(by, r, c)) { p = b[nr * 9 + nc]; if (p === kk || p === ak) return true; }
    }
    if (OND[sq]) for (k = 0; k < 4; k++) {
      nr = r + DIAGS[k][0]; nc = c + DIAGS[k][1];
      if (onDiag(nr, nc) && ownPal(by, nr, nc) && ownPal(by, r, c)) { p = b[nr * 9 + nc]; if (p === kk || p === ak) return true; }
    }
    return false;
  }

  var PAL_SQ = [[66, 67, 68, 75, 76, 77, 84, 85, 86], [3, 4, 5, 12, 13, 14, 21, 22, 23]];
  function kingSq(b, s) {
    var kp = mkp(K, s), a = PAL_SQ[s];
    for (var i = 0; i < 9; i++) if (b[a[i]] === kp) return a[i];
    return -1;
  }
  function inCheck(b, s) { var k = kingSq(b, s); return k >= 0 && attacked(b, k, s ^ 1); }
  function bikjang(b) {
    var k0 = kingSq(b, CHO), k1 = kingSq(b, HAN);
    if (k0 < 0 || k1 < 0 || k0 % 9 !== k1 % 9) return false;
    for (var q = k1 + 9; q < k0; q += 9) if (b[q]) return false;
    return true;
  }
  function makeMove(b, m) { var f = m & 127, t = m >> 7, cap = b[t]; b[t] = b[f]; b[f] = 0; return cap; }
  function unmakeMove(b, m, cap) { var f = m & 127, t = m >> 7; b[f] = b[t]; b[t] = cap; }
  function legalMoves(b, s) {
    var ms = genMoves(b, s, false), out = [];
    for (var i = 0; i < ms.length; i++) {
      var cap = makeMove(b, ms[i]);
      if (!inCheck(b, s)) out.push(ms[i]);
      unmakeMove(b, ms[i], cap);
    }
    return out;
  }
  function points(b, s) {
    var t = s === HAN ? 1.5 : 0;
    for (var i = 0; i < 90; i++) if (b[i] && pside(b[i]) === s) t += POINTS[b[i] & 7];
    return t;
  }
  function posKey(b, s) { return s + ':' + Array.prototype.join.call(b, ','); }

  var PST = [[], []];
  for (var s0 = 0; s0 < 2; s0++) for (var t0 = 0; t0 < 8; t0++) {
    PST[s0][t0] = new Int16Array(90);
    for (var sq0 = 0; sq0 < 90; sq0++) {
      var r = (sq0 / 9) | 0, c = sq0 % 9, adv = s0 === CHO ? 9 - r : r, v = 0, cen = 4 - Math.abs(c - 4);
      switch (t0) {
        case P: v = (adv >= 4 ? (adv - 3) * 12 : 0) + cen * 3; if (adv >= 7 && c >= 3 && c <= 5) v += 30; if (adv === 9) v -= 30; break;
        case H: v = cen * 6 + (adv >= 3 && adv <= 6 ? 14 : 0) - (adv === 0 ? 12 : 0); break;
        case E: v = cen * 3 + (adv >= 2 && adv <= 5 ? 8 : 0); break;
        case R: v = (adv >= 5 ? 15 : 0) + (adv >= 7 && c >= 3 && c <= 5 ? 14 : 0) + (c === 4 ? 4 : 0); break;
        case C: v = (adv === 2 ? 12 : 0) + (c === 4 ? 8 : 0) + (adv >= 7 && c >= 3 && c <= 5 ? 10 : 0); break;
        case K: v = (c === 4 ? 10 : 0) + (adv === 1 ? 8 : 0) - (adv === 2 ? 6 : 0); break;
        case A: v = (c === 4 || adv === 1 ? 6 : 0); break;
      }
      PST[s0][t0][sq0] = v;
    }
  }
  function evaluate(b, s) {
    var sc = 0, cnt = 0, adv = [0, 0], cannons = [0, 0], guards = [0, 0];
    for (var i = 0; i < 90; i++) {
      var p = b[i]; if (!p) continue;
      cnt++;
      var t = p & 7, ps = p >> 3, v = PIECE_VAL[t] + PST[ps][t][i];
      sc += ps === s ? v : -v;
      if (t === C) cannons[ps]++;
      if (t === A) guards[ps]++;
      if (t === R || t === H || t === C) {
        var rr = (i / 9) | 0, inEnemyPal = ps === CHO ? rr <= 2 : rr >= 7;
        if (inEnemyPal) adv[ps]++;
      }
    }
    if (cnt < 22) { var pen = (22 - cnt) * 12; sc += (cannons[s] - cannons[s ^ 1]) * -pen; }
    sc -= adv[s ^ 1] * (guards[s] < 2 ? 40 : 18);
    sc += adv[s] * (guards[s ^ 1] < 2 ? 40 : 18);
    return sc + 12;
  }

  var TT_SIZE = 1 << 20, TT_MASK = TT_SIZE - 1, ttK = null, ttM, ttS, ttD, ttF;
  function ttInit() { if (ttK) return; ttK = new Int32Array(TT_SIZE); ttM = new Int32Array(TT_SIZE); ttS = new Int16Array(TT_SIZE); ttD = new Int8Array(TT_SIZE); ttF = new Uint8Array(TT_SIZE); }
  var St = { nodes: 0, deadline: 0, stop: false, killers: [], hist: null, rule: 'draw', h1: 0, h2: 0, path1: [], path2: [], rep: null, noQ: false };
  var MB = [], SB = [];
  for (var q0 = 0; q0 < 100; q0++) { MB.push(new Int32Array(160)); SB.push(new Int32Array(160)); }

  function bikScore(b, mover, ply) {
    if (St.rule === 'draw') return 0;
    return points(b, mover) > points(b, mover ^ 1) ? (MATE - 500 - ply) : -(MATE - 500 - ply);
  }
  function tick() { if ((++St.nodes & 2047) === 0 && Date.now() > St.deadline) St.stop = true; return St.stop; }
  function doMove(b, m) {
    var f = m & 127, t = m >> 7, p = b[f], cap = b[t];
    St.h1 ^= Z1[p][f] ^ Z1[p][t] ^ ZS1; St.h2 ^= Z2[p][f] ^ Z2[p][t] ^ ZS2;
    if (cap) { St.h1 ^= Z1[cap][t]; St.h2 ^= Z2[cap][t]; }
    b[t] = p; b[f] = 0; return cap;
  }
  function undoMove(b, m, cap) {
    var f = m & 127, t = m >> 7, p = b[t];
    b[f] = p; b[t] = cap;
    St.h1 ^= Z1[p][f] ^ Z1[p][t] ^ ZS1; St.h2 ^= Z2[p][f] ^ Z2[p][t] ^ ZS2;
    if (cap) { St.h1 ^= Z1[cap][t]; St.h2 ^= Z2[cap][t]; }
  }
  function scoreMoves(b, ms, sc, n, ply, ttMove) {
    var kl = St.killers[ply], h = St.hist;
    for (var i = 0; i < n; i++) {
      var m = ms[i], v = b[m >> 7], x;
      if (m === ttMove) x = 2000000;
      else if (v) x = 1000000 + PIECE_VAL[v & 7] * 10 - PIECE_VAL[b[m & 127] & 7] / 10;
      else if (kl && (m === kl[0] || m === kl[1])) x = 900000;
      else x = h[(b[m & 127] & 15) * 90 + (m >> 7)];
      sc[i] = x;
    }
  }
  function pick(ms, sc, n, i) {
    var bi = i, bv = sc[i];
    for (var j = i + 1; j < n; j++) if (sc[j] > bv) { bv = sc[j]; bi = j; }
    if (bi !== i) { var t = ms[i]; ms[i] = ms[bi]; ms[bi] = t; t = sc[i]; sc[i] = sc[bi]; sc[bi] = t; }
    return ms[i];
  }
  function quiesce(b, s, alpha, beta, ply) {
    if (tick()) return 0;
    var stand = evaluate(b, s);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply >= 90) return stand;
    var ms = MB[ply], sc = SB[ply], n = genMoves(b, s, true, ms);
    scoreMoves(b, ms, sc, n, ply, 0);
    for (var i = 0; i < n; i++) {
      var m = pick(ms, sc, n, i), victim = b[m >> 7];
      if ((victim & 7) === K) return MATE - ply;
      if (stand + PIECE_VAL[victim & 7] + 200 < alpha) continue;
      var cap = doMove(b, m);
      if (inCheck(b, s)) { undoMove(b, m, cap); continue; }
      var v = bikjang(b) ? bikScore(b, s, ply) : -quiesce(b, s ^ 1, -beta, -alpha, ply + 1);
      undoMove(b, m, cap);
      if (St.stop) return 0;
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function hasBig(b, s) {
    for (var i = 0; i < 90; i++) { var p = b[i]; if (p && (p >> 3) === s) { var t = p & 7; if (t === R || t === C || t === H) return true; } }
    return false;
  }
  function isRep(ply) {
    var h1 = St.h1, h2 = St.h2;
    for (var i = ply - 2; i >= 0; i -= 2) if (St.path1[i] === h1 && St.path2[i] === h2) return true;
    return St.rep && St.rep.has(h1 + ':' + h2);
  }
  function negamax(b, s, depth, alpha, beta, ply, allowNull) {
    if (tick()) return 0;
    St.path1[ply] = St.h1; St.path2[ply] = St.h2;
    if (ply > 0 && isRep(ply)) return 0;
    var ma = -MATE + ply, mb = MATE - ply - 1;
    if (ma > alpha) alpha = ma; if (mb < beta) beta = mb; if (alpha >= beta) return alpha;
    var chk = inCheck(b, s);
    if (chk && ply < 40) depth++;
    if (depth <= 0) return St.noQ ? evaluate(b, s) : quiesce(b, s, alpha, beta, ply);
    if (ply >= 90) return evaluate(b, s);
    var idx = St.h1 & TT_MASK, ttMove = 0, pv = beta - alpha > 1, useTT = !St.noQ;
    if (useTT && ttK[idx] === St.h2) {
      ttMove = ttM[idx];
      if (ttD[idx] >= depth && !pv) {
        var ts = ttS[idx], tf = ttF[idx];
        if (ts > MATE - 300) ts -= ply; else if (ts < -MATE + 300) ts += ply;
        if (tf === 1 || (tf === 2 && ts >= beta) || (tf === 3 && ts <= alpha)) return ts;
      }
    }
    var se = 0;
    if (!pv && !chk) {
      se = evaluate(b, s);
      if (depth <= 3 && se - 130 * depth >= beta && Math.abs(beta) < MATE - 300) return se;
      if (allowNull && depth >= 3 && se >= beta && hasBig(b, s)) {
        var Rn = depth >= 6 ? 3 : 2;
        St.h1 ^= ZS1; St.h2 ^= ZS2;
        var nv = -negamax(b, s ^ 1, depth - 1 - Rn, -beta, -beta + 1, ply + 1, false);
        St.h1 ^= ZS1; St.h2 ^= ZS2;
        if (St.stop) return 0;
        if (nv >= beta) return nv >= MATE - 300 ? beta : nv;
      }
    }
    var ms = MB[ply], sc = SB[ply], n = genMoves(b, s, false, ms);
    scoreMoves(b, ms, sc, n, ply, ttMove);
    var best = -INF, bestM = 0, legal = 0, a0 = alpha;
    for (var i = 0; i < n; i++) {
      var m = pick(ms, sc, n, i), isCap = b[m >> 7] !== 0;
      if (!pv && !chk && depth <= 2 && legal > 0 && !isCap && se + 160 * depth <= alpha) continue;
      var cap = doMove(b, m);
      if (inCheck(b, s)) { undoMove(b, m, cap); continue; }
      legal++;
      var v;
      if (bikjang(b)) v = bikScore(b, s, ply);
      else if (legal === 1) v = -negamax(b, s ^ 1, depth - 1, -beta, -alpha, ply + 1, true);
      else {
        var red = 0;
        if (depth >= 3 && legal > 3 && !isCap && !chk && sc[i] < 900000 && !inCheck(b, s ^ 1)) { red = legal > 10 ? 2 : 1; if (pv) red = Math.max(0, red - 1); }
        v = -negamax(b, s ^ 1, depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (v > alpha && red) v = -negamax(b, s ^ 1, depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (v > alpha && v < beta) v = -negamax(b, s ^ 1, depth - 1, -beta, -alpha, ply + 1, true);
      }
      undoMove(b, m, cap);
      if (St.stop) return 0;
      if (v > best) { best = v; bestM = m; }
      if (v > alpha) {
        alpha = v;
        if (alpha >= beta) {
          if (!cap) {
            var kl = St.killers[ply] || (St.killers[ply] = [0, 0]);
            if (kl[0] !== m) { kl[1] = kl[0]; kl[0] = m; }
            var hi = (b[m & 127] & 15) * 90 + (m >> 7);
            St.hist[hi] += depth * depth; if (St.hist[hi] > 800000) for (var z = 0; z < St.hist.length; z++) St.hist[z] >>= 1;
          }
          break;
        }
      }
    }
    if (!legal) {
      if (chk) return -MATE + ply;
      St.h1 ^= ZS1; St.h2 ^= ZS2;
      var pv2 = -negamax(b, s ^ 1, depth - 1, -beta, -alpha, ply + 1, false);
      St.h1 ^= ZS1; St.h2 ^= ZS2;
      return pv2;
    }
    if (useTT) {
      var store = best;
      if (store > MATE - 300) store += ply; else if (store < -MATE + 300) store -= ply;
      ttK[idx] = St.h2; ttM[idx] = bestM; ttS[idx] = store; ttD[idx] = depth; ttF[idx] = best >= beta ? 2 : best > a0 ? 1 : 3;
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
  // opts: {timeMs, maxDepth, exact, noQ, noJitter, blunder, margin, pool, rule, rep:[posKey...]}
  function think(b, s, opts) {
    ttInit();
    St.nodes = 0; St.stop = false; St.killers = []; St.hist = new Int32Array(16 * 90); St.rule = opts.rule || 'draw'; St.noQ = !!opts.noQ;
    var tm = opts.timeMs || 2000;
    St.deadline = Date.now() + tm;
    var hh = hashOf(b, s); St.h1 = hh[0]; St.h2 = hh[1];
    St.rep = new Set();
    (opts.rep || []).forEach(function (k) {
      var parts = k.split(':'), side = +parts[0], arr = parts[1].split(',').map(Number);
      var h = hashOf(arr, side); St.rep.add(h[0] + ':' + h[1]);
    });
    St.rep.delete(St.h1 + ':' + St.h2);
    var root = legalMoves(b, s);
    if (!root.length) return { move: -1, score: 0, depth: 0, nodes: 0 };
    St.path1[0] = St.h1; St.path2[0] = St.h2;
    if (opts.exact) {
      var d0 = opts.maxDepth || 2, list = [];
      for (var k = 0; k < root.length; k++) {
        var cp = doMove(b, root[k]), xs;
        if (bikjang(b)) xs = bikScore(b, s, 1);
        else xs = -negamax(b, s ^ 1, d0 - 1, -INF, INF, 1, true);
        undoMove(b, root[k], cp);
        if (St.stop) break;
        list.push({ m: root[k], s: xs + (opts.noJitter ? 0 : Math.floor(Math.random() * 6)) });
      }
      if (!list.length) return { move: root[0], score: 0, depth: 0, nodes: St.nodes };
      list.sort(function (a, c) { return c.s - a.s; });
      var ci = chooseIndex(list, opts);
      return { move: list[ci].m, score: list[0].s, depth: d0, nodes: St.nodes, blunder: ci > 0, all: opts.wantAll ? list : undefined };
    }
    var best = root[0], bestScore = -INF, done = 0, scores = new Array(root.length).fill(0);
    for (var d = 1; d <= (opts.maxDepth || 64); d++) {
      var ord = root.map(function (m, i) { return [m === best ? 1e9 : scores[i], m]; }).sort(function (a, b2) { return b2[0] - a[0]; });
      root = ord.map(function (x) { return x[1]; });
      scores = new Array(root.length).fill(-INF);
      var alpha = -INF, cb = 0, cs = -INF;
      for (var i = 0; i < root.length; i++) {
        var m = root[i], cap = doMove(b, m), v;
        if (bikjang(b)) v = bikScore(b, s, 1);
        else if (i === 0) v = -negamax(b, s ^ 1, d - 1, -INF, -alpha, 1, true);
        else {
          v = -negamax(b, s ^ 1, d - 1, -alpha - 1, -alpha, 1, true);
          if (v > alpha && !St.stop) v = -negamax(b, s ^ 1, d - 1, -INF, -alpha, 1, true);
        }
        undoMove(b, m, cap);
        if (St.stop) break;
        scores[i] = v;
        if (v > cs) { cs = v; cb = m; }
        if (v > alpha) alpha = v;
      }
      if (St.stop) { if (cb && cs > bestScore - 50) best = cb; break; }
      best = cb; bestScore = cs; done = d;
      if (Math.abs(cs) > MATE - 300) break;
      if (!opts.maxDepth && Date.now() > St.deadline - tm * 0.5 && d >= 4) break;
    }
    return { move: best, score: bestScore, depth: done, nodes: St.nodes };
  }

  return { genMoves: genMoves, legalMoves: legalMoves, think: think, inCheck: inCheck, bikjang: bikjang, makeMove: makeMove, unmakeMove: unmakeMove,
    attacked: attacked, kingSq: kingSq, points: points, posKey: posKey, mkp: mkp, pside: pside, K: K, A: A, E: E, H: H, R: R, C: C, P: P, CHO: CHO, HAN: HAN, MATE: MATE, PIECE_VAL: PIECE_VAL };
})();

if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof importScripts === 'function' && !self.__engineBound) {
  self.__engineBound = true;
  self.onmessage = function (e) {
    var d = e.data, b = Int8Array.from(d.board);
    self.postMessage({ id: d.id, res: JanggiEngine.think(b, d.side, d.opts) });
  };
}
if (typeof module !== 'undefined') module.exports = JanggiEngine;