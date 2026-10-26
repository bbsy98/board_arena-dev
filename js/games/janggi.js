// ======================= 장기 (튜토리얼 · 교육 · 대련) =======================
const JanggiGame = (() => {
  const J = JanggiEngine, { K, A, E, H, R, C, P, CHO, HAN } = J;
  const CELL = 64, PADX = 44, PADY = 44;
  const PATS = ['마상마상', '상마상마', '마상상마', '상마마상'];
  const HANJA = { 0: ['', '楚', '士', '象', '馬', '車', '包', '卒'], 1: ['', '漢', '士', '象', '馬', '車', '包', '兵'] };
  const KNAME = ['', '장', '사', '상', '마', '차', '포', '졸'];
  const TYPE = { K, A, E, H, R, C, P };
  const PTS = [0, 0, 3, 3, 5, 13, 7, 2];
  const RAD = [0, 30, 20, 25, 25, 25, 25, 20];
  const COL = ['#1257a8', '#c0262d'];
  let G = null;
  const ctx = { worker: null, reqId: 0 };

  const pname = p => ((p & 7) === P && (p >> 3) === HAN) ? '병' : KNAME[p & 7];
  const sname = s => s === CHO ? '초' : '한';
  const xy = sq => { const v = G.flip ? 89 - sq : sq; return [PADX + (v % 9) * CELL, PADY + ((v / 9) | 0) * CELL]; };
  const josa = (w, a, b) => {
    // 복구된 기록/비정상 수순 등으로 기물명이 없더라도 안내 문구에서 앱이 중단되지 않게 방어합니다.
    if (typeof w !== 'string' || !w.length) w = '기물';
    const c = w.charCodeAt(w.length - 1);
    return w + ((c - 0xAC00) % 28 ? a : b);
  };

  function setupBoard(choPat, hanPat) {
    const b = new Int8Array(90), T = { '마': H, '상': E }, mk = J.mkp;
    const back = [R, 0, 0, A, 0, A, 0, 0, R];
    for (let c = 0; c < 9; c++) if (back[c]) { b[c] = mk(back[c], HAN); b[81 + c] = mk(back[c], CHO); }
    [1, 2, 6, 7].forEach((c, i) => b[81 + c] = mk(T[choPat[i]], CHO));
    [7, 6, 2, 1].forEach((c, i) => b[c] = mk(T[hanPat[i]], HAN));
    b[13] = mk(K, HAN); b[76] = mk(K, CHO);
    b[19] = b[25] = mk(C, HAN); b[64] = b[70] = mk(C, CHO);
    [0, 2, 4, 6, 8].forEach(c => { b[27 + c] = mk(P, HAN); b[54 + c] = mk(P, CHO); });
    return b;
  }
  // 사람이 읽기 쉬운 이동 설명 — 내가 보는 화면 방향 기준 (예: '아래로 2칸, 오른쪽으로 1칸 옮겼어요')
  function dirTxt(m) {
    const f = m & 127, t = m >> 7, s = G && G.flip ? -1 : 1;
    const dr = (((t / 9) | 0) - ((f / 9) | 0)) * s, dc = (t % 9 - f % 9) * s, parts = [];
    if (dr) parts.push(`${dr > 0 ? '아래로' : '위로'} ${Math.abs(dr)}칸`);
    if (dc) parts.push(`${dc > 0 ? '오른쪽으로' : '왼쪽으로'} ${Math.abs(dc)}칸`);
    return (parts.join(', ') || '') + ' 옮겼어요';
  }
  function notation(m, piece) {
    const f = m & 127, t = m >> 7, lbl = sq => `${(((sq / 9) | 0) + 1) % 10}${(sq % 9) + 1}`;
    return `${lbl(f)}${pname(piece)}${lbl(t)}`;
  }

  function start(o) {
    const tut = o.mode === 'tutorial';
    ctx.reqId++; if (ctx.worker) ctx.worker.terminate(); ctx.worker = tut ? null : makeWorker('srcJanggi');
    let b, human = tut ? CHO : o.human, info = '';
    if (tut) { const L = LESSONS.janggi[o.lesson]; b = new Int8Array(90); L.setup.forEach(([sq, t, s]) => b[sq] = J.mkp(TYPE[t], s)); }
    else {
      var aiPat = o.aiPat === 'rand' || PATS.indexOf(o.aiPat) < 0 ? PATS[(Math.random() * 4) | 0] : o.aiPat;
      if (PATS.indexOf(o.pat) < 0) o.pat = PATS[0];
      const choPat = human === CHO ? o.pat : aiPat, hanPat = human === HAN ? o.pat : aiPat;
      b = setupBoard(choPat, hanPat); info = `초: ${choPat} / 한: ${hanPat}`;
    }
    G = { b, turn: CHO, human, ai: human ^ 1, sel: -1, targets: [], last: null, anim: null, capFx: null, hl: null,
          over: false, thinking: false, flip: human === HAN, hist: [], rep: [], moves: 0, caps: [[], []], o, mode: o.mode,
          prevEval: null, blunders: [], best: null, lastHumanTxt: '', lastHumanNo: 0,
          hints: 0, hintStage: 0, hintMove: 0, warns: 0, heeded: 0, undos: 0, coachBase: null, rec: [], aiPat: tut ? null : aiPat };
    G.st = stNew({ pat: {} }); if (!tut) G.st.pat[o.pat] = 1;
    Adapt.init(G, o.level || 1); G.turnT = Date.now();
    G.rep.push(J.posKey(G.b, G.turn));
    const host = $('boardHost');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-24 0 624 688'); svg.id = 'jsvg';
    host.insertBefore(svg, host.firstChild);
    svg.addEventListener('click', e => { const s = e.target.getAttribute('data-sq'); if (s !== null) onClick(+s); });
    if (!tut) $('gExtra').innerHTML = (o.mode === 'train' ? Adapt.html(G) : '') + `<div class="card" style="padding:10px 12px;margin-top:${o.mode === 'train' ? 10 : 0}px">
      <div class="wrl" style="margin-bottom:4px"><span>내가 잡은 기물</span><b id="jPtMe"></b></div><div class="tray" id="jTrayMe"></div>
      <div class="wrl" style="margin:8px 0 4px"><span>AI가 잡은 기물</span><b id="jPtAi"></b></div><div class="tray" id="jTrayAi"></div>
      <div class="bars" style="margin-top:8px"><div class="wr"><div class="a" id="jWr" style="width:50%"></div><div class="b"></div></div><div class="wrl"><span>나</span><span id="jPts">형세</span><span>AI</span></div></div></div>`;
    if (tut) Shell.buttons([{ id: 'jReset', label: '다시 하기', on: () => Tutorial.start('janggi', o.lesson) }, { id: 'jHint', label: '💡 힌트', cls: 'green', on: tutHint }, { id: 'jList', label: '목록으로', on: () => Shell.close() }]);
    else if (o.mode === 'train') Shell.buttons([{ id: 'jHint', label: '💡 힌트', cls: 'green', on: hint }, { id: 'jUndo', label: '무르기', on: undo }, { id: 'jPass', label: '한수 쉼', on: pass }, { id: 'jRes', label: '기권', cls: 'danger', on: resign }]);
    else Shell.buttons([{ id: 'jPass', label: '한수 쉼', on: pass }, { id: 'jRes', label: '기권', cls: 'danger', on: resign }]);
    if (!tut) Shell.log(`대국 시작 — ${info} · 나는 ${sname(human)}`, 'sys');
    if (o.mode === 'train') Shell.coach('수를 두기 전에 위험하면 제가 알려줄게요. 막히면 <b>💡 힌트</b>를 눌러 보세요.');
    if (o.resume) restore(o.resume);
    resize(); render(); update();
    window.addEventListener('resize', resize);
    if (!tut && G.turn === G.ai) setTimeout(aiMove, 300); else prefetchCoach();
  }
  // ---------- 저장 · 이어하기 ----------
  function restore(r) {
    if (!Array.isArray(r.moves)) throw new Error('저장 데이터 형식 오류');
    r.moves.forEach(m => {
      const mover = G.turn;
      if (m < 0) {
        if (J.inCheck(G.b, mover)) throw new Error('저장된 수순이 올바르지 않아요');
        G.rec.push({ b: Array.from(G.b), side: mover, m, h: mover === G.human, txt: '한수 쉼' });
        Shell.log(`${G.moves + 1}. ${sname(mover)}: 한수 쉼`, mover === G.human ? 'me' : 'ai');
        G.last = null;
      } else {
        if (!J.legalMoves(G.b, mover).includes(m)) throw new Error('저장된 수순이 올바르지 않아요');
        const piece = G.b[m & 127], cap = G.b[m >> 7], txt = notation(m, piece) + (cap ? ` ×${pname(cap)}` : '');
        G.rec.push({ b: Array.from(G.b), side: mover, m, h: mover === G.human, txt });
        J.makeMove(G.b, m); G.last = m; if (cap) G.caps[mover].push(cap);
        Shell.log(`${G.moves + 1}. ${sname(mover)}: ${txt}`, mover === G.human ? 'me' : 'ai');
      }
      G.moves++; G.turn ^= 1; G.rep.push(J.posKey(G.b, G.turn));
    });
    Resume.restoreCommon(G, r);
    Shell.log('— 저장된 대국을 이어서 둡니다 —', 'sys');
  }
  function resumeData() {
    if (!G || G.mode === 'tutorial' || G.over) return null;
    return Object.assign({ o: { mode: G.o.mode, level: G.o.level, human: G.human, bik: G.o.bik, pat: G.o.pat, aiPat: G.aiPat }, moves: G.rec.map(r => r.m), prevEval: G.prevEval }, Resume.commonData(G));
  }
  function coachKey() { return G.rep[G.rep.length - 1] + '#' + G.moves; }
  function prefetchCoach() {
    if (!G || G.mode !== 'train' || G.over || G.turn !== G.human) return;
    const b = Array.from(G.b), opts = coachOpts();
    G.coachP = { key: coachKey(), p: helperCall(ctx, 'coachW', 'srcJanggi', { board: b, side: G.human, opts }, () => J.think(Int8Array.from(b), G ? G.human : 0, opts), opts.timeMs) };
  }
  function destroy() { helperStop(ctx, 'coachW'); helperStop(ctx, 'hintW'); ctx.reqId++; if (ctx.cancel) ctx.cancel(); if (ctx.worker) ctx.worker.terminate(); ctx.worker = null; window.removeEventListener('resize', resize); G = null; }
  function resize() { const s = boardPx(688 / 624); const svg = $('jsvg'); if (svg) { svg.style.width = s + 'px'; svg.style.height = Math.round(s * 688 / 624) + 'px'; } }
  function snapshot() { return { rl: G.rec.length, b: G.b.slice(), turn: G.turn, last: G.last, rep: G.rep.length, moves: G.moves, caps: [G.caps[0].slice(), G.caps[1].slice()], log: $('gLog').innerHTML, prevEval: G.prevEval, bl: G.blunders.length }; }

  // ---------- 튜토리얼 ----------
  function tutMove(m) {
    const L = LESSONS.janggi[G.o.lesson], g = L.goal, f = m & 127, t = m >> 7, cap = G.b[t];
    const snap = G.b.slice();
    J.makeMove(G.b, m); G.last = m; G.anim = { f, t }; G.capFx = cap ? t : null; G.sel = -1; G.targets = []; G.hl = null;
    render(); G.anim = null; G.capFx = null; Sound.play(cap ? 'capture' : 'move');
    let pass = false;
    if (g.type === 'capture') pass = t === g.sq && !!cap;
    else if (g.type === 'reach') pass = f === g.from && t === g.sq;
    else if (g.type === 'escape') pass = !J.inCheck(G.b, CHO);
    else if (g.type === 'mate') pass = J.inCheck(G.b, HAN) && J.legalMoves(G.b, HAN).length === 0;
    if (pass) {
      G.over = true; update();
      const msg = { capture: `${josa(pname(cap), '을', '를')} 잡았어요!`, reach: '궁성 안에서는 선을 따라 대각선으로도 움직일 수 있어요.', escape: '장군을 피했어요! 장군을 받으면 이렇게 꼭 피하거나 막아야 해요.', mate: '외통이에요! 실제 대국에서는 외통을 만들면 이겨요.' }[g.type];
      Tutorial.pass('janggi', G.o.lesson, msg);
    } else {
      setTimeout(() => { if (!G) return; G.b = snap; G.last = null; render(); }, 650);
      Tutorial.fail(g.type === 'mate' ? '상대 장이 아직 피할 곳이 있어요' : '목표와 다른 수예요');
    }
  }
  function tutHint() { const L = LESSONS.janggi[G.o.lesson]; G.hl = { from: L.hint[0], to: L.hint[1] }; render(); Shell.info('💡 파란 표시가 된 기물을 화살표 방향으로 움직여 보세요.'); }

  // ---------- 진행 ----------
  function doMove(m, byHuman) {
    const mover = G.turn;
    const recE = { b: Array.from(G.b), side: mover, m, h: !!byHuman, txt: '한수 쉼' };
    if (m >= 0) recE.txt = notation(m, G.b[m & 127]) + (G.b[m >> 7] ? ` ×${pname(G.b[m >> 7])}` : '');
    G.rec.push(recE);
    if (m < 0) {
      Shell.log(`${G.moves + 1}. ${sname(mover)}: 한수 쉼`, byHuman ? 'me' : 'ai');
      G.last = null; G.anim = null;
      if (!byHuman) Shell.notify({ kind: 'info', title: isKid() ? 'AI가 한 번 쉬었어' : 'AI가 한수 쉬었어요', sub: '이번 차례는 움직이지 않았어요', prio: 'minor' });
    } else {
      const piece = G.b[m & 127], cap = G.b[m >> 7];
      let txt = notation(m, piece);
      if (cap) txt += ` ×${pname(cap)}`;
      J.makeMove(G.b, m);
      G.last = m; G.anim = { f: m & 127, t: m >> 7 }; G.capFx = cap ? m >> 7 : null;
      G.aiTxt = byHuman ? '' : `🤖 AI: ${josa(pname(piece), '을', '를')} ${dirTxt(m)}${cap ? ` · 내 ${josa(pname(cap), '을', '를')} 잡음` : ''}`;
      if (byHuman) {
        const st = G.st, fr = ((m & 127) / 9) | 0, tr = ((m >> 7) / 9) | 0;
        stThink(G); st.moves++; st.use[piece & 7] = (st.use[piece & 7] || 0) + 1;
        if (cap) st.caps++;
        if (mover === CHO ? tr < fr : tr > fr) st.adv++;
        if (J.inCheck(G.b, G.ai)) st.checks++;
      }
      Shell.log(`${G.moves + 1}. ${sname(mover)}: ${txt}`, byHuman ? 'me' : 'ai');
      if (byHuman) { G.lastHumanTxt = txt; G.lastHumanNo = G.moves + 1; }
      if (cap) { G.caps[mover].push(cap); G.capVal = { v: PTS[cap & 7], me: byHuman }; }
      G.evt = { cap, piece, byHuman };
    }
    G.moves++; G.turn ^= 1; G.sel = -1; G.targets = []; G.hl = null; G.hintStage = 0; G.coachBase = null;
    if (G.mode === 'train') Shell.coach('');
    G.rep.push(J.posKey(G.b, G.turn));
    render(); G.anim = null; G.capFx = null; G.capVal = null;
    if (checkEnd(mover)) return;
    announce(G.evt, J.inCheck(G.b, G.turn)); G.evt = null;
    update(); Shell.autosave();
    if (G.turn === G.ai) setTimeout(aiMove, Shell.aiDelay(420)); else { G.turnT = Date.now(); prefetchCoach(); }
  }
  // 대국 사건 알림: 잡기와 장군을 한 번에, 어떤 기물로 무엇을 잡았는지 보여 줌
  function announce(e, chk) {
    const kid = isKid(), toHuman = G.turn === G.human;
    Shell.sfx(chk && toHuman ? 'check' : e && e.cap ? (e.byHuman ? 'capture' : 'lose') : chk ? 'check' : e ? 'move' : 'pass');
    const chkBadge = chk ? (toHuman ? '장군 받음!' : '장군!') : '';
    if (e && e.cap) {
      const v = PTS[e.cap & 7], chip = Chip.vs(Chip.janggi(e.piece), Chip.janggi(e.cap));
      const prio = chk || v >= 3 ? 'major' : 'minor';
      if (e.byHuman) Shell.notify({ kind: 'good', chip, prio, badge: chkBadge,
        title: kid ? `우와! ${josa(pname(e.cap), '을', '를')} 잡았어!` : `상대 ${josa(pname(e.cap), '을', '를')} 잡았어요`,
        sub: kid ? `+${v}점 ⭐ 내 ${pname(e.piece)} 최고!` : `내 ${roJosa(pname(e.piece))} 잡았어요 · <b>+${v}점</b>` });
      else Shell.notify({ kind: 'bad', chip, prio, badge: chkBadge,
        title: kid ? `앗, 내 ${josa(pname(e.cap), '이', '가')} 잡혔어` : `내 ${josa(pname(e.cap), '을', '를')} 잃었어요`,
        sub: kid ? (chk ? '장을 먼저 지키자!' : '괜찮아, 다시 해 보자!') : `AI ${pname(e.piece)}에게 잡혔어요 · <b>−${v}점</b>${chk ? ' · 장을 먼저 지키세요' : ''}` });
      return;
    }
    if (chk) {
      if (toHuman) Shell.notify({ kind: 'bad', prio: 'major', chip: Chip.janggi(J.mkp(K, G.human)), title: kid ? '장군이야! 장을 지켜!' : '장군을 받았어요', sub: kid ? '장을 피하거나 막아 줘' : '장을 피하거나, 다른 기물로 막거나, 공격한 기물을 잡으세요' });
      else Shell.notify({ kind: 'warn', prio: 'major', chip: Chip.janggi(J.mkp(K, G.ai)), title: kid ? '장군! 멋져!' : '장군!', sub: kid ? 'AI 장이 공격받고 있어' : 'AI 장을 몰아붙였어요' });
    }
  }
  function checkEnd(mover) {
    const me = G.human;
    if (J.bikjang(G.b)) {
      const pc = J.points(G.b, CHO), ph = J.points(G.b, HAN);
      if (G.o.bik === 'draw') return end('draw', `빅장 — 무승부 (초 ${pc} : 한 ${ph})`);
      const w = pc > ph ? CHO : HAN;
      return end(w === me ? 'win' : 'loss', `빅장 점수 판정 (초 ${pc} : 한 ${ph})`);
    }
    const key = G.rep[G.rep.length - 1];
    if (G.rep.reduce((n, k) => n + (k === key ? 1 : 0), 0) >= 3) return end('draw', '같은 모양 3회 반복 — 무승부');
    const lm = J.legalMoves(G.b, G.turn);
    if (!lm.length && J.inCheck(G.b, G.turn)) return end(mover === me ? 'win' : 'loss', `외통 — ${sname(mover)} 승`);
    if (G.moves >= 200) {
      const pc = J.points(G.b, CHO), ph = J.points(G.b, HAN), w = pc > ph ? CHO : HAN;
      return end(w === me ? 'win' : 'loss', `200수 점수 판정 (초 ${pc} : 한 ${ph})`);
    }
    if (!lm.length && G.turn === G.human) setTimeout(() => { if (G && !G.over && G.turn === G.human) doMove(-1, true); }, 400);
    return false;
  }
  function end(result, reason) {
    G.over = true; G.thinking = false; ctx.reqId++; stopProg(); Shell.coach(''); update(); render();
    const myPts = G.caps[G.human].reduce((a, p) => a + PTS[p & 7], 0), aiPts = G.caps[G.ai].reduce((a, p) => a + PTS[p & 7], 0);
    const extra = [`잡은 기물 점수: 나 <b>${myPts}점</b> · AI <b>${aiPts}점</b>`];
    const bigLost = G.caps[G.ai].filter(p => (p & 7) === R).length;
    if (bigLost) extra.push(`차를 ${bigLost}개 잃었어요. 차는 가장 비싼 기물(13점)이라 손실이 컸어요.`);
    Object.assign(G.st, { warns: G.warns, heeded: G.heeded, hints: G.hints });
    const tr = G.mode === 'train' ? { lvf: G.lvf, endLevel: G.lvNow, lvPath: G.lvPath, quality: G.quality } : {};
    Shell.finish(result, reason, Object.assign({ moves: G.moves, blunders: G.blunders, best: G.best, extra, hints: G.hints, warns: G.warns, heeded: G.heeded, undos: G.undos, style: G.st }, tr));
    return true;
  }
  async function aiMove() {
    if (!G || G.over || G.turn !== G.ai) return;
    G.thinking = true; update();
    const lv = G.mode === 'train' ? G.lvNow : G.o.level;
    const opts = Object.assign({ rule: G.o.bik, rep: G.rep.slice(-40) }, LEVELS.board[lv]);
    const myG = G;
    const res = await engineCall(ctx, { board: Array.from(G.b), side: G.ai, opts },
      () => J.think(G.b.slice(), G.ai, Object.assign({}, opts, { timeMs: Math.min(opts.timeMs || 3000, 3000) })), opts.timeMs || 3000, Shell.aiDelay(700));
    if (!res || myG !== G || G.over) return;
    G.thinking = false;
    const s = res.score, mateLike = Math.abs(s) > J.MATE - 400;
    const hEval = mateLike ? (s > 0 ? -3000 : 3000) : -s;
    if (G.prevEval !== null && G.lastHumanNo && lv >= 4) {
      const drop = G.prevEval - hEval;
      if (drop >= 300) G.blunders.push({ no: G.lastHumanNo, drop, text: mateLike && s > 0 ? `<b>${G.lastHumanTxt}</b> 이후 AI가 외통 수순을 찾아냈어요.` : `<b>${G.lastHumanTxt}</b> 이후 형세가 약 <b>${(drop / 100).toFixed(1)}점</b> 기울었어요.` });
      if (-drop >= 300 && (!G.best || -drop > G.best.drop)) G.best = { no: G.lastHumanNo, drop: -drop, text: `<b>${G.lastHumanTxt}</b> — 형세를 약 ${(-drop / 100).toFixed(1)}점 끌어올린 좋은 수였어요.` };
    }
    G.prevEval = hEval;
    $('jWr').style.width = (100 / (1 + Math.exp(-hEval / 400))) + '%';
    Shell.info(G.mode === 'train' ? `AI가 Lv.${lv}로 두었어요` : '');
    doMove(res.move, false);
  }

  // ---------- 교육: 코치 ----------
  const coachOpts = () => Object.assign({ rule: G.o.bik }, LEVELS.coach);
  async function coachCheck(m) {
    G.moveLoss = null; G.moveRank = undefined;
    if (!G.coachBase) {
      if (!G.coachP || G.coachP.key !== coachKey()) prefetchCoach();
      const myG = G, cb = await G.coachP.p;
      if (G !== myG) return false;
      G.coachBase = cb || J.think(G.b.slice(), G.human, coachOpts());
    }
    const b2 = G.b.slice(); J.makeMove(b2, m);
    if (J.bikjang(b2)) return true;
    if (!J.legalMoves(b2, G.ai).length) { G.moveLoss = 0; return true; }
    const all = G.coachBase.all || [], e = all.find(x => x.m === m);
    if (!e) { G.moveLoss = null; return true; }
    const loss = all.length ? Math.max(0, all[0].s - e.s) : 0;
    G.moveLoss = loss; G.moveRank = all.filter(x => x.s > e.s).length;
    if (loss < 250) return true;
    const r = J.think(b2, G.ai, Object.assign({}, coachOpts(), { maxDepth: 1, wantAll: 0 })), after = e ? e.s : -r.score;
    let msg;
    if (after <= -(J.MATE - 400)) msg = '이 수를 두면 <b>외통을 당할 수 있어요!</b>';
    else if (r.move >= 0 && b2[r.move >> 7]) msg = `이 수를 두면 AI가 내 <b>${josa(pname(b2[r.move >> 7]), '을', '를')}</b> 잡을 수 있어요. (빨간 화살표)`;
    else msg = '이 수를 두면 형세가 많이 나빠져요.';
    G.warns++;
    G.hl = { threat: r.move, danger: r.move >= 0 && b2[r.move >> 7] ? [r.move >> 7] : [] };
    G.sel = -1; G.targets = [];
    const pv = G.b.slice(); J.makeMove(G.b, m); render(); G.b = pv;
    const go = await Shell.coachAsk('⚠️ 잠깐!', msg);
    if (!G) return false;
    G.hl = null; render();
    if (!go) { G.heeded++; Shell.coach('좋아요! 다른 수를 찾아봐요. 막히면 <b>💡 힌트</b>를 눌러 보세요.'); }
    return go;
  }
  async function hint() {
    if (!G || G.over || G.turn !== G.human || G.thinking || G.busy) return;
    G.hintThisTurn = true;
    if (G.hintStage === 0) {
      G.hints++;
      const danger = [], targets = [];
      for (let sq = 0; sq < 90; sq++) { const p = G.b[sq]; if (p && (p >> 3) === G.human && (p & 7) !== K && J.attacked(G.b, sq, G.ai)) danger.push(sq); }
      J.legalMoves(G.b, G.human).forEach(m => { if (G.b[m >> 7] && targets.indexOf(m >> 7) < 0) targets.push(m >> 7); });
      G.hl = { danger, targets }; G.hintStage = 1;
      const dn = danger.map(q => pname(G.b[q])).join(', '), tn = targets.map(q => pname(G.b[q])).join(', ');
      let t = '<b>힌트 1/3 · 위험 살피기</b><br>';
      if (J.inCheck(G.b, G.human)) t += '지금 <b>장군</b>이에요! 장을 피하거나 막는 게 먼저예요.<br>';
      t += danger.length ? `🔴 공격받는 내 기물: <b>${dn}</b><br>` : '🔴 지금 공격받는 내 기물은 없어요.<br>';
      t += targets.length ? `🟢 잡을 수 있는 상대 기물: <b>${tn}</b>` : '🟢 지금 바로 잡을 수 있는 상대 기물은 없어요.';
      Shell.coach(t + '<br><span style="color:var(--sub)">힌트를 한 번 더 누르면 움직일 기물을 알려줘요.</span>');
    } else if (G.hintStage === 1) {
      const myG = G, ho = { maxDepth: 4, timeMs: 1500, rule: G.o.bik }, b0 = Array.from(G.b), mv0 = G.moves;
      G.busy = true; Shell.info('💡 힌트를 계산하고 있어요…');
      const r = await helperCall(ctx, 'hintW', 'srcJanggi', { board: b0, side: G.human, opts: ho }, () => J.think(Int8Array.from(b0), myG.human, ho), ho.timeMs);
      if (G !== myG) return;
      G.busy = false; Shell.info('');
      if (!r || r.move < 0 || G.over || G.moves !== mv0) { update(); return; }
      G.hintMove = r.move; G.hl = { from: r.move & 127 }; G.hintStage = 2;
      Shell.coach(`<b>힌트 2/3 · 움직일 기물</b><br>파란 동그라미의 <b>${josa(pname(G.b[r.move & 127]), '을', '를')}</b> 움직여 보세요. 어디로 가면 좋을까요?`);
    } else if (G.hintStage === 2) {
      const m = G.hintMove, f = m & 127, t = m >> 7, pc = G.b[f], cap = G.b[t];
      const b2 = G.b.slice(); J.makeMove(b2, m);
      let why;
      if (cap) why = `상대 ${josa(pname(cap), '을', '를')} 잡을 수 있어요.`;
      else if (J.inCheck(G.b, G.human)) why = '장군을 막을 수 있어요.';
      else if (J.attacked(G.b, f, G.ai)) why = `공격받는 ${josa(pname(pc), '을', '를')} 안전한 곳으로 피할 수 있어요.`;
      else if (J.inCheck(b2, G.ai)) why = '상대에게 장군을 부를 수 있어요.';
      else why = 'AI 계산으로 형세가 가장 좋아지는 자리예요.';
      G.hl = { from: f, to: t }; G.hintStage = 3;
      Shell.coach(`<b>힌트 3/3 · 추천 수</b><br>파란 화살표처럼 움직여 보세요. ${why}`);
    }
    render();
  }

  // ---------- 입력 ----------
  async function onClick(sq) {
    if (!G || G.over || G.turn !== G.human || G.thinking || G.busy) return;
    const p = G.b[sq];
    if (G.sel >= 0 && G.targets.includes(sq)) {
      const m = G.sel | (sq << 7);
      if (G.mode === 'tutorial') { tutMove(m); return; }
      if (G.mode === 'train') {
        G.busy = true; const ok = await coachCheck(m); if (G) G.busy = false;
        if (!G || !ok) { if (G) { G.sel = -1; G.targets = []; render(); } return; }
        if (G.moveLoss !== null) Adapt.step(G, Adapt.classify(G.moveLoss, LEVELS.adapt.janggi, G.moveRank));
      }
      G.hist.push(snapshot()); doMove(m, true); return;
    }
    if (p && (p >> 3) === G.human) {
      G.sel = sq;
      G.targets = J.legalMoves(G.b, G.human).filter(m => (m & 127) === sq).map(m => m >> 7);
      if (!G.targets.length) Shell.info(J.inCheck(G.b, G.human) ? '장군 상태예요 — 이 기물로는 막을 수 없어요.' : '이 기물은 지금 움직일 수 없어요.');
      else Shell.info('');
    } else { G.sel = -1; G.targets = []; }
    render();
  }
  function undo() {
    if (!G || !G.hist.length || G.over || G.busy) return;
    ctx.reqId++; if (G.thinking) { ctx.worker && ctx.worker.terminate(); ctx.worker = makeWorker('srcJanggi'); }
    stopProg(); G.thinking = false; G.undos++; Notify.clear(); G.aiTxt = '';
    const s = G.hist.pop();
    G.b = s.b; G.turn = s.turn; G.last = s.last; G.rec.length = s.rl; G.rep.length = s.rep; G.moves = s.moves; G.caps = s.caps; G.prevEval = s.prevEval; G.blunders.length = s.bl;
    $('gLog').innerHTML = s.log; G.sel = -1; G.targets = []; G.hl = null; G.hintStage = 0; G.coachBase = null; Shell.coach('');
    render(); update(); Shell.autosave(); prefetchCoach();
  }
  function pass() {
    if (!G || G.over || G.turn !== G.human || G.thinking) return;
    if (J.inCheck(G.b, G.human)) { Shell.toast('장군 상태에서는 쉴 수 없어요', '', 'warn'); return; }
    G.hist.push(snapshot()); doMove(-1, true);
  }
  async function resign() {
    if (!G || G.over) return;
    const myG = G;
    if (!(await confirmResign()) || myG !== G || G.over) return;
    end('loss', '기권');
  }
  function update() {
    if (!G) return;
    const chk = J.inCheck(G.b, G.turn);
    if (G.mode === 'tutorial') Shell.status(G.over ? '🎉 성공!' : (chk ? '⚠️ 장군을 받았어요!' : '👉 기물을 눌러서 움직여 보세요'), G.over ? '' : chk ? 'alert' : 'me');
    else if (G.over) Shell.status('대국 종료');
    else if (G.turn === G.ai) Shell.status(`🤖 AI(${sname(G.ai)})가 생각 중<span class="dots"></span>`, 'think');
    else if (chk) Shell.status(`⚠️ 장군! 장을 피하세요`, 'alert');
    else Shell.status(`👉 내 차례 (${sname(G.human)})${G.aiTxt ? `<small class="stsub">${G.aiTxt}</small>` : ''}`, 'me');
    if (G.mode === 'tutorial') { $('jHint').disabled = G.over; return; }
    const busy = G.over || G.thinking;
    if ($('jUndo')) $('jUndo').disabled = busy || !G.hist.length;
    if ($('jHint')) $('jHint').disabled = busy || G.turn !== G.human || G.hintStage >= 3;
    $('jPass').disabled = busy || G.turn !== G.human;
    $('jRes').disabled = G.over;
    const tray = arr => arr.map(p => `<span class="pc" style="color:${COL[p >> 3]};border:2px solid ${COL[p >> 3]}">${HANJA[p >> 3][p & 7]}</span>`).join('') || '<span>-</span>';
    $('jTrayMe').innerHTML = tray(G.caps[G.human]); $('jTrayAi').innerHTML = tray(G.caps[G.ai]);
    const capPts = arr => arr.reduce((a, p) => a + PTS[p & 7], 0);
    $('jPtMe').textContent = G.caps[G.human].length ? `+${capPts(G.caps[G.human])}점` : '';
    $('jPtAi').textContent = G.caps[G.ai].length ? `+${capPts(G.caps[G.ai])}점` : '';
    $('jPts').textContent = `남은 기물 점수 ${J.points(G.b, G.human)} : ${J.points(G.b, G.ai)}`;
  }
  function octo(x, y, rr) {
    const k = rr * 0.414;
    return [[-k, -rr], [k, -rr], [rr, -k], [rr, k], [k, rr], [-k, rr], [-rr, k], [-rr, -k]].map(([a, b]) => `${(x + a).toFixed(1)},${(y + b).toFixed(1)}`).join(' ');
  }
  function arrowSvg(f, t, col, mk, w) {
    const [x1, y1] = xy(f), [x2, y2] = xy(t), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    return `<line x1="${x1 + ux * 14}" y1="${y1 + uy * 14}" x2="${x2 - ux * 34}" y2="${y2 - uy * 34}" stroke="${col}" stroke-width="${w || 7}" stroke-linecap="round" opacity=".8" marker-end="url(#${mk})"/>`;
  }
  function render() {
    const svg = $('jsvg'); if (!svg || !G) return;
    const mkr = (id, c) => `<marker id="${id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`;
    let h = `<defs>${mkr('arH0', COL[0])}${mkr('arH1', COL[1])}${mkr('arHint', '#2f7bff')}${mkr('arThr', '#e5484d')}
      <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecc985"/><stop offset="1" stop-color="#dcae62"/></linearGradient>
      <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" flood-opacity=".45"/></filter></defs>`;
    h += `<rect x="-24" y="0" width="624" height="688" fill="url(#wood)"/>`;
    for (let r = 0; r < 10; r++) h += `<line x1="${PADX}" y1="${PADY + r * CELL}" x2="${PADX + 8 * CELL}" y2="${PADY + r * CELL}" stroke="#5b3a1a" stroke-width="1.6"/>`;
    for (let c = 0; c < 9; c++) h += `<line x1="${PADX + c * CELL}" y1="${PADY}" x2="${PADX + c * CELL}" y2="${PADY + 9 * CELL}" stroke="#5b3a1a" stroke-width="1.6"/>`;
    [[3, 23], [5, 21], [66, 86], [68, 84]].forEach(([a, b]) => { const [x1, y1] = xy(a), [x2, y2] = xy(b); h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5b3a1a" stroke-width="1.6"/>`; });
    h += `<rect x="${PADX - 3}" y="${PADY - 3}" width="${8 * CELL + 6}" height="${9 * CELL + 6}" fill="none" stroke="#5b3a1a" stroke-width="3"/>`;
    // 좌표: 기보 표기(예: 62차42 = 6행 2열 → 4행 2열)와 같은 번호
    for (let c = 0; c < 9; c++) { const [x] = xy(c); h += `<text x="${x}" y="${PADY + 9 * CELL + 58}" text-anchor="middle" font-size="15" font-weight="700" fill="#8a6235" font-family="sans-serif">${c + 1}</text>`; }
    for (let r = 0; r < 10; r++) { const [, y] = xy(r * 9); h += `<text x="-6" y="${y + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="#8a6235" font-family="sans-serif">${(r + 1) % 10}</text>`; }
    let over = '';
    if (G.last !== null && G.b[G.last >> 7]) {
      const f = G.last & 127, t = G.last >> 7, mover = G.b[t] >> 3, [x1, y1] = xy(f), [x2, y2] = xy(t), col = COL[mover];
      h += `<polygon points="${octo(x1, y1, 24)}" fill="${col}" fill-opacity=".12" stroke="${col}" stroke-width="2.5" stroke-dasharray="5 4"/>`;
      h += `<circle cx="${x2}" cy="${y2}" r="36" fill="${col}" fill-opacity=".18"><animate attributeName="fill-opacity" values=".35;.12;.35" dur="1.6s" repeatCount="indefinite"/></circle>`;
      if (Math.hypot(x2 - x1, y2 - y1) > 50) over += arrowSvg(f, t, col, 'arH' + mover);
    }
    [CHO, HAN].forEach(s => { if (J.kingSq(G.b, s) >= 0 && J.inCheck(G.b, s)) { const [x, y] = xy(J.kingSq(G.b, s)); h += `<circle cx="${x}" cy="${y}" r="40" fill="rgba(255,0,0,.35)"><animate attributeName="r" values="34;44;34" dur="1s" repeatCount="indefinite"/></circle>`; } });
    const hl = G.hl || {};
    (hl.danger || []).forEach(q => { const [x, y] = xy(q); h += `<circle cx="${x}" cy="${y}" r="34" fill="rgba(229,72,77,.22)" stroke="#e5484d" stroke-width="4" stroke-dasharray="7 5"/>`; });
    (hl.targets || []).forEach(q => { const [x, y] = xy(q); h += `<circle cx="${x}" cy="${y}" r="34" fill="rgba(47,191,113,.2)" stroke="#2fbf71" stroke-width="4" stroke-dasharray="7 5"/>`; });
    for (let sq = 0; sq < 90; sq++) {
      const p = G.b[sq]; if (!p) continue;
      const t = p & 7, s = p >> 3, [x, y] = xy(sq), rr = RAD[t], col = COL[s], selected = sq === G.sel;
      const isLast = G.last !== null && sq === (G.last >> 7);
      let anim = '';
      if (G.anim && G.anim.t === sq) { const [fx, fy] = xy(G.anim.f); anim = `<animateTransform attributeName="transform" type="translate" from="${fx - x} ${fy - y}" to="0 0" dur="0.38s" fill="freeze"/>`; }
      h += `<g>${anim}<polygon points="${octo(x, y, rr)}" fill="${selected ? '#fff3c4' : '#f6e7c4'}" stroke="${selected ? '#e09100' : isLast ? '#ffcf3f' : col}" stroke-width="${selected || isLast ? 4 : 2.5}" filter="url(#sh)"/>`;
      h += `<text x="${x}" y="${y + rr * 0.36}" text-anchor="middle" font-size="${rr * 1.05}" font-weight="bold" fill="${col}" font-family="'Batang','Noto Serif KR',serif">${HANJA[s][t]}</text></g>`;
    }
    h += over;
    if (hl.from !== undefined) { const [x, y] = xy(hl.from); h += `<circle cx="${x}" cy="${y}" r="36" fill="none" stroke="#2f7bff" stroke-width="5"><animate attributeName="r" values="32;40;32" dur="1.1s" repeatCount="indefinite"/></circle>`; }
    if (hl.to !== undefined) { const [x, y] = xy(hl.to); h += `<circle cx="${x}" cy="${y}" r="30" fill="rgba(47,123,255,.2)" stroke="#2f7bff" stroke-width="3"/>` + arrowSvg(hl.from, hl.to, '#2f7bff', 'arHint', 8); }
    if (hl.threat !== undefined && hl.threat >= 0) h += arrowSvg(hl.threat & 127, hl.threat >> 7, '#e5484d', 'arThr', 8);
    if (G.capFx !== null) {
      const [x, y] = xy(G.capFx);
      h += `<circle cx="${x}" cy="${y}" r="20" fill="none" stroke="#ffcf3f" stroke-width="6" opacity="0"><animate attributeName="r" from="20" to="70" begin=".3s" dur=".7s" fill="freeze"/><animate attributeName="opacity" values="1;0" begin=".3s" dur=".7s" fill="freeze"/></circle>`;
      if (G.capVal) {
        const cv = G.capVal, col = cv.me ? '#1f9d5c' : '#d63b40';
        h += `<g pointer-events="none" opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.7;1" begin=".25s" dur="1.3s" fill="freeze"/><animateTransform attributeName="transform" type="translate" from="0 0" to="0 -34" begin=".25s" dur="1.3s" fill="freeze"/><text x="${x}" y="${y - 26}" text-anchor="middle" font-size="30" font-weight="900" fill="${col}" stroke="#fff" stroke-width="5" paint-order="stroke" font-family="sans-serif">${cv.me ? '+' : '−'}${cv.v}</text></g>`;
      }
    }
    G.targets.forEach(q => {
      const [x, y] = xy(q);
      if (G.b[q]) h += `<circle cx="${x}" cy="${y}" r="32" fill="rgba(229,72,77,.15)" stroke="#e5484d" stroke-width="4"/>`;
      else h += `<circle cx="${x}" cy="${y}" r="10" fill="#2e9e44" opacity=".85"/>`;
    });
    for (let sq = 0; sq < 90; sq++) { const [x, y] = xy(sq); h += `<circle cx="${x}" cy="${y}" r="31" fill="transparent" data-sq="${sq}" style="cursor:pointer"/>`; }
    svg.innerHTML = h;
    // SVG 애니메이션 시계를 0으로: 이동·잡기 효과가 매번 처음부터 재생되게 함 (v0.7까지는 재생되지 않던 문제)
    try { if (svg.setCurrentTime) svg.setCurrentTime(0); } catch (e) {}
  }

  // ---------- 복기 · 대국 후 분석 ----------
  const ANALYZE = { exact: 1, maxDepth: 3, noJitter: 1, wantAll: 1, timeMs: 4000 };
  const clampEval = v => Math.max(-3000, Math.min(3000, v));
  const review = {
    len: () => G ? G.rec.length : 0,
    moves: () => G ? G.rec.map((r, i) => ({ txt: r.txt, h: r.h, side: r.side, no: i + 1, lab: String(i + 1) })) : [],
    show(k, best) {
      if (!G) return;
      if (!G.finalB) G.finalB = G.b;
      G.b = k >= G.rec.length ? G.finalB : Int8Array.from(G.rec[k].b);
      const lm = k > 0 ? G.rec[k - 1].m : -1;
      G.last = lm >= 0 ? lm : null;
      G.hl = best ? { from: best & 127, to: best >> 7 } : null;
      G.sel = -1; G.targets = []; G.anim = null; G.capFx = null;
      render();
    },
    jobs() {
      const out = [], opts = Object.assign({ rule: G.o.bik }, ANALYZE);
      G.rec.forEach((r, i) => { if (r.h && r.m >= 0) out.push({ idx: i, msg: { board: r.b, side: r.side, opts }, local: () => J.think(Int8Array.from(r.b), r.side, Object.assign({}, opts, { timeMs: 1500 })) }); });
      return { src: 'srcJanggi', list: out, parallel: 2 };
    },
    judge(jobs, results) {
      const res = {};
      jobs.list.forEach((j, n) => {
        const r = results[n]; if (!r || !r.all || !r.all.length) return;
        const rec = G.rec[j.idx], played = r.all.find(x => x.m === rec.m); if (!played) return;
        const best = r.all[0], loss = Math.max(0, clampEval(best.s) - clampEval(played.s)), rank = r.all.filter(x => x.s > played.s).length;
        res[j.idx] = { decided: Math.abs(best.s) >= 2000, loss, cls: Adapt.classify(loss, LEVELS.adapt.janggi, rank), best: best.m === rec.m ? 0 : best.m, bestTxt: best.m === rec.m ? '' : notation(best.m, rec.b[best.m & 127]), unit: 'pt' };
      });
      return res;
    }
  };
  return { start, destroy, review, resumeData, moveCount: () => G ? G.moves : 0, _g: () => G, _render: () => { render(); update(); } };
})();