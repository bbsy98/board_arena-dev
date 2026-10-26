// ======================= 체스 (튜토리얼 · 교육 · 대련) =======================
const ChessGame = (() => {
  const CE = ChessEngine, { P, N, B, R, Q, K, WHITE, BLACK } = CE;
  const SQ = 80, PAD = 26, SIZE = SQ * 8 + PAD * 2;
  const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
  const NAME = { 1: '폰', 2: '나이트', 3: '비숍', 4: '룩', 5: '퀸', 6: '킹' };
  const PVAL = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0 };
  let G = null;
  const sqName = CE.sqName;
  const ctx = { worker: null, reqId: 0 };
  const cname = s => s === WHITE ? '백' : '흑';
  const josa = (w, a, b) => {
    // 복구된 기록/비정상 수순 등으로 기물명이 없더라도 안내 문구에서 앱이 중단되지 않게 방어합니다.
    if (typeof w !== 'string' || !w.length) w = '기물';
    const c = w.charCodeAt(w.length - 1);
    return w + ((c - 0xAC00) % 28 ? a : b);
  };

  function xy(sq) { const f = sq & 7, r = sq >> 4, c = G.flip ? 7 - f : f, row = G.flip ? r : 7 - r; return [PAD + c * SQ + SQ / 2, PAD + row * SQ + SQ / 2]; }
  function start(o) {
    const tut = o.mode === 'tutorial';
    ctx.reqId++; if (ctx.worker) ctx.worker.terminate(); ctx.worker = tut ? null : makeWorker('srcChess');
    const pos = new CE.Pos().fromFEN(tut ? LESSONS.chess[o.lesson].fen : CE.START);
    const human = tut ? WHITE : o.human;
    G = { pos, human, ai: human ^ 8, flip: human === BLACK, sel: -1, targets: [], last: 0, anim: null, capFx: null, hl: null, mode: o.mode,
          over: false, thinking: false, hist: [], plies: 0, caps: { 0: [], 8: [] }, o, prevEval: null, blunders: [], best: null, lastHumanTxt: '', lastHumanNo: 0,
          hints: 0, hintStage: 0, hintMove: 0, warns: 0, heeded: 0, undos: 0, coachBase: null, rec: [], rec0: 0 };
    G.st = stNew({ castled: 0, castleMove: 0, earlyQ: 0 }); Adapt.init(G, o.level || 1); G.turnT = Date.now();
    const host = $('boardHost');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`); svg.id = 'csvg';
    host.insertBefore(svg, host.firstChild);
    svg.addEventListener('click', e => { const s = e.target.getAttribute('data-sq'); if (s !== null) onClick(+s); });
    if (!tut) $('gExtra').innerHTML = (o.mode === 'train' ? Adapt.html(G) : '') + `<div class="card" style="padding:10px 12px;margin-top:${o.mode === 'train' ? 10 : 0}px">
      <div class="wrl" style="margin-bottom:4px"><span>내가 잡은 기물</span><b id="cPtMe"></b></div><div class="tray" id="cTrayMe" style="font-size:22px"></div>
      <div class="wrl" style="margin:8px 0 4px"><span>AI가 잡은 기물</span><b id="cPtAi"></b></div><div class="tray" id="cTrayAi" style="font-size:22px"></div>
      <div class="bars" style="margin-top:8px"><div class="wr"><div class="a" id="cWr" style="width:50%"></div><div class="b"></div></div><div class="wrl"><span>나</span><span>형세</span><span>AI</span></div></div></div>`;
    if (tut) Shell.buttons([{ id: 'cReset', label: '다시 하기', on: () => Tutorial.start('chess', o.lesson) }, { id: 'cHint', label: '💡 힌트', cls: 'green', on: tutHint }, { id: 'cList', label: '목록으로', on: () => Shell.close() }]);
    else if (o.mode === 'train') Shell.buttons([{ id: 'cHint', label: '💡 힌트', cls: 'green', on: hint }, { id: 'cUndo', label: '무르기', on: undo }, { id: 'cDraw', label: '무승부 제안', on: offerDraw }, { id: 'cRes', label: '기권', cls: 'danger', on: resign }]);
    else Shell.buttons([{ id: 'cDraw', label: '무승부 제안', on: offerDraw }, { id: 'cRes', label: '기권', cls: 'danger', on: resign }]);
    if (!tut) Shell.log(`대국 시작 — 나는 ${cname(G.human)}`, 'sys');
    if (o.mode === 'train') Shell.coach('수를 두기 전에 위험하면 제가 알려줄게요. 막히면 <b>💡 힌트</b>를 눌러 보세요.');
    if (o.resume) restore(o.resume);
    resize(); render(); update();
    window.addEventListener('resize', resize);
    if (!tut && G.pos.side === G.ai) setTimeout(aiMove, 300); else prefetchCoach();
  }
  // ---------- 저장 · 이어하기 ----------
  function restore(r) {
    if (!Array.isArray(r.moves)) throw new Error('저장 데이터 형식 오류');
    r.moves.forEach(m => {
      if (!G.pos.legalMoves().includes(m)) throw new Error('저장된 수순이 올바르지 않아요');
      const mover = G.pos.side, t = (m >> 7) & 127, flag = m >> 17, san = CE.san(G.pos, m);
      let cap = G.pos.b[t]; if (flag & 1) cap = P | (mover ^ 8);
      G.rec.push({ s: G.pos.state(), m, h: mover === G.human, txt: san, side: mover });
      G.pos.make(m); G.plies++; G.last = m; if (cap) G.caps[mover].push(cap);
      Shell.log(`${Math.ceil(G.plies / 2)}${mover === WHITE ? '.' : '...'} ${san}`, mover === G.human ? 'me' : 'ai');
    });
    Resume.restoreCommon(G, r);
    Shell.log('— 저장된 대국을 이어서 둡니다 —', 'sys');
  }
  function resumeData() {
    if (!G || G.mode === 'tutorial' || G.over) return null;
    return Object.assign({ o: { mode: G.o.mode, level: G.o.level, human: G.human }, moves: G.rec.map(r => r.m), prevEval: G.prevEval }, Resume.commonData(G));
  }
  function coachKey() { return G.pos.h1 + ':' + G.pos.h2 + ':' + G.plies; }
  function prefetchCoach() {
    if (!G || G.mode !== 'train' || G.over || G.pos.side !== G.human) return;
    const st = G.pos.state(), clone = G.pos.clone();
    G.coachP = { key: coachKey(), p: helperCall(ctx, 'coachW', 'srcChess', { state: st, opts: LEVELS.coach }, () => CE.think(clone, LEVELS.coach), LEVELS.coach.timeMs) };
  }
  function destroy() { helperStop(ctx, 'coachW'); helperStop(ctx, 'hintW'); ctx.reqId++; if (ctx.cancel) ctx.cancel(); if (ctx.worker) ctx.worker.terminate(); ctx.worker = null; window.removeEventListener('resize', resize); G = null; const pr = $('promo'); if (pr) pr.remove(); }
  function resize() { const s = boardPx(1); const svg = $('csvg'); if (svg) { svg.style.width = s + 'px'; svg.style.height = s + 'px'; } }
  function snapshot() { return { rl: G.rec.length, pos: G.pos.clone(), last: G.last, plies: G.plies, caps: { 0: G.caps[0].slice(), 8: G.caps[8].slice() }, log: $('gLog').innerHTML, prevEval: G.prevEval, bl: G.blunders.length }; }

  function tutMove(m) {
    const L = LESSONS.chess[G.o.lesson], g = L.goal, f = m & 127, t = (m >> 7) & 127, flag = m >> 17, cap = G.pos.b[t];
    const snap = G.pos.clone();
    G.pos.make(m); G.last = m; G.anim = { f, t }; G.capFx = cap ? t : null; G.sel = -1; G.targets = []; G.hl = null;
    render(); G.anim = null; G.capFx = null; Sound.play(cap ? 'capture' : 'move');
    let pass = false;
    if (g.type === 'capture') pass = t === g.sq && !!cap;
    else if (g.type === 'escape') pass = !G.pos.inCheck(WHITE);
    else if (g.type === 'mate') pass = G.pos.inCheck(G.pos.side) && G.pos.legalMoves().length === 0;
    else if (g.type === 'castle') pass = !!(flag & 2);
    if (pass) {
      G.over = true; update();
      const msg = { capture: `${josa(NAME[cap & 7], '을', '를')} 잡았어요!`, escape: '체크를 피했어요! 체크를 받으면 이렇게 꼭 피하거나 막아야 해요.', mate: '체크메이트! 실제 대국에서는 이렇게 이겨요.', castle: '캐슬링 성공! 킹은 구석으로, 룩은 가운데로 나왔어요.' }[g.type];
      Tutorial.pass('chess', G.o.lesson, msg);
    } else {
      setTimeout(() => { if (!G) return; G.pos = snap; G.last = 0; render(); }, 650);
      Tutorial.fail(g.type === 'mate' ? '상대 킹이 아직 피할 곳이 있어요' : '목표와 다른 수예요');
    }
  }
  function tutHint() { const L = LESSONS.chess[G.o.lesson]; G.hl = { from: L.hint[0], to: L.hint[1] }; render(); Shell.info('💡 파란 표시가 된 기물을 화살표 방향으로 움직여 보세요.'); }

  function doMove(m, byHuman) {
    const pos = G.pos, mover = pos.side, f = m & 127, t = (m >> 7) & 127, flag = m >> 17;
    const san = CE.san(pos, m);
    let cap = pos.b[t]; if (flag & 1) cap = P | (mover ^ 8);
    const piece = pos.b[f];
    G.rec.push({ s: pos.state(), m, h: !!byHuman, txt: san, side: mover });
    pos.make(m);
    if (byHuman) {
      const st = G.st, no0 = Math.ceil((G.plies + 1) / 2);
      stThink(G); st.moves++; st.use[piece & 7] = (st.use[piece & 7] || 0) + 1;
      if (cap) st.caps++;
      if (mover === WHITE ? (t >> 4) > (f >> 4) : (t >> 4) < (f >> 4)) st.adv++;
      if (pos.inCheck(pos.side)) st.checks++;
      if ((flag & 2) && !st.castled) { st.castled = 1; st.castleMove = no0; }
      if ((piece & 7) === Q && no0 <= 5) st.earlyQ = 1;
    }
    G.plies++; G.last = m; G.anim = { f, t }; G.capFx = cap ? t : null;
    G.aiTxt = byHuman ? '' : `🤖 AI: ${NAME[piece & 7]} ${sqName(f)}→${sqName(t)}${cap ? ` (내 ${NAME[cap & 7]} 잡음)` : ''}`;
    const no = Math.ceil(G.plies / 2);
    Shell.log(`${no}${mover === WHITE ? '.' : '...'} ${san}`, byHuman ? 'me' : 'ai');
    if (byHuman) { G.lastHumanTxt = san; G.lastHumanNo = no; }
    if (cap) { G.caps[mover].push(cap); G.capVal = { v: PVAL[cap & 7], me: byHuman }; }
    const evt = { cap, piece, byHuman, promo: (m >> 14) & 7, castle: !!(flag & 2) };
    G.sel = -1; G.targets = []; G.hl = null; G.hintStage = 0; G.coachBase = null;
    if (G.mode === 'train') Shell.coach('');
    render(); G.anim = null; G.capFx = null; G.capVal = null;
    if (checkEnd(mover)) return;
    announce(evt, pos.inCheck(pos.side));
    update(); Shell.autosave();
    if (pos.side === G.ai) setTimeout(aiMove, Shell.aiDelay(380)); else { G.turnT = Date.now(); prefetchCoach(); }
  }
  // 대국 사건 알림: 잡기·체크·승격을 한 번에, 어떤 기물로 무엇을 잡았는지 보여 줌
  function announce(e, chk) {
    const kid = isKid(), toHuman = G.pos.side === G.human;
    Shell.sfx(chk && toHuman ? 'check' : e.cap ? (e.byHuman ? 'capture' : 'lose') : chk ? 'check' : 'move');
    const chkBadge = chk ? (toHuman ? '체크 받음!' : '체크!') : '';
    if (e.cap) {
      const v = PVAL[e.cap & 7], chip = Chip.vs(Chip.chess(e.piece), Chip.chess(e.cap)), prio = chk || v >= 3 ? 'major' : 'minor';
      if (e.byHuman) Shell.notify({ kind: 'good', chip, prio, badge: chkBadge,
        title: kid ? `우와! ${josa(NAME[e.cap & 7], '을', '를')} 잡았어!` : `상대 ${josa(NAME[e.cap & 7], '을', '를')} 잡았어요`,
        sub: kid ? `+${v}점 ⭐` : `내 ${roJosa(NAME[e.piece & 7])} 잡았어요 · <b>+${v}점</b>` });
      else Shell.notify({ kind: 'bad', chip, prio, badge: chkBadge,
        title: kid ? `앗, 내 ${josa(NAME[e.cap & 7], '이', '가')} 잡혔어` : `내 ${josa(NAME[e.cap & 7], '을', '를')} 잃었어요`,
        sub: kid ? (chk ? '킹을 먼저 지키자!' : '괜찮아, 다시 해 보자!') : `AI ${NAME[e.piece & 7]}에게 잡혔어요 · <b>−${v}점</b>${chk ? ' · 킹을 먼저 지키세요' : ''}` });
      return;
    }
    if (e.promo) { Shell.notify({ kind: e.byHuman ? 'good' : 'bad', prio: 'major', chip: Chip.chess(e.promo | (e.byHuman ? G.human : G.ai)), badge: chkBadge, title: e.byHuman ? `폰이 ${roJosa(NAME[e.promo])} 승격했어요` : `AI 폰이 ${roJosa(NAME[e.promo])} 승격했어요`, sub: '마지막 줄에 도착한 폰은 다른 기물로 바뀌어요' }); return; }
    if (chk) {
      if (toHuman) Shell.notify({ kind: 'bad', prio: 'major', chip: Chip.chess(K | G.human), title: kid ? '체크야! 킹을 지켜!' : '체크를 받았어요', sub: '킹을 피하거나, 막거나, 공격한 기물을 잡으세요' });
      else Shell.notify({ kind: 'warn', prio: 'major', chip: Chip.chess(K | G.ai), title: kid ? '체크! 멋져!' : '체크!', sub: 'AI 킹을 몰아붙였어요' });
      return;
    }
    if (e.castle) Shell.notify({ kind: 'info', prio: 'minor', chip: Chip.chess(K | (e.byHuman ? G.human : G.ai)) + Chip.chess(R | (e.byHuman ? G.human : G.ai)), title: e.byHuman ? '캐슬링 완료' : 'AI가 캐슬링했어요', sub: '킹은 안전한 구석으로, 룩은 가운데로' });
  }
  function checkEnd(mover) {
    const pos = G.pos, lm = pos.legalMoves(), me = G.human;
    if (!lm.length) { if (pos.inCheck(pos.side)) return end(mover === me ? 'win' : 'loss', `체크메이트 — ${cname(mover)} 승`); return end('draw', '스테일메이트'); }
    if (pos.half >= 100) return end('draw', '50수 규칙');
    if (pos.isRepetition(2)) return end('draw', '3회 동형 반복');
    if (pos.insufficient()) return end('draw', '기물 부족');
    return false;
  }
  function material(s) { let v = 0; for (let q = 0; q < 128; q++) { if (q & 0x88) continue; const p = G.pos.b[q]; if (p && (p & 8) === s) v += PVAL[p & 7]; } return v; }
  function end(result, reason) {
    G.over = true; G.thinking = false; ctx.reqId++; stopProg(); Shell.coach(''); update(); render();
    const extra = [`최종 기물 점수: 나 <b>${material(G.human)}</b> · AI <b>${material(G.ai)}</b>`];
    if (G.caps[G.ai].some(p => (p & 7) === Q)) extra.push('퀸을 잃은 뒤로 공격력이 크게 떨어졌어요.');
    Object.assign(G.st, { warns: G.warns, heeded: G.heeded, hints: G.hints });
    const tr = G.mode === 'train' ? { lvf: G.lvf, endLevel: G.lvNow, lvPath: G.lvPath, quality: G.quality } : {};
    Shell.finish(result, reason, Object.assign({ moves: Math.ceil(G.plies / 2), blunders: G.blunders, best: G.best, extra, hints: G.hints, warns: G.warns, heeded: G.heeded, undos: G.undos, style: G.st }, tr));
    return true;
  }
  async function aiMove() {
    if (!G || G.over || G.pos.side !== G.ai) return;
    G.thinking = true; update();
    const lv = G.mode === 'train' ? G.lvNow : G.o.level;
    const opts = Object.assign({}, LEVELS.board[lv]), myG = G, st = G.pos.state();
    const res = await engineCall(ctx, { state: st, opts }, () => CE.think(CE.Pos.fromState(st), Object.assign({}, opts, { timeMs: Math.min(opts.timeMs || 3000, 3000) })), opts.timeMs || 3000, Shell.aiDelay(700));
    if (!res || myG !== G || G.over) return;
    G.thinking = false;
    const s = res.score, mateLike = Math.abs(s) > CE.MATE - 300;
    const hEval = mateLike ? (s > 0 ? -2000 : 2000) : -s;
    if (G.prevEval !== null && G.lastHumanNo && lv >= 3) {
      const drop = G.prevEval - hEval;
      if (drop >= 180) G.blunders.push({ no: G.lastHumanNo, drop, text: mateLike && s > 0 ? `<b>${G.lastHumanTxt}</b> 이후 AI가 메이트 수순을 찾아냈어요.` : `<b>${G.lastHumanTxt}</b> 이후 형세가 약 <b>${(drop / 100).toFixed(1)}폰</b> 만큼 기울었어요.` });
      if (-drop >= 180 && (!G.best || -drop > G.best.drop)) G.best = { no: G.lastHumanNo, drop: -drop, text: `<b>${G.lastHumanTxt}</b> — 형세를 약 ${(-drop / 100).toFixed(1)}폰 끌어올렸어요.` };
    }
    G.prevEval = hEval;
    $('cWr').style.width = (100 / (1 + Math.exp(-hEval / 250))) + '%';
    Shell.info(G.mode === 'train' ? `AI가 Lv.${lv}로 두었어요` : '');
    if (!res.move) return;
    doMove(res.move, false);
  }

  // ---------- 교육: 코치 ----------
  async function coachCheck(m) {
    G.moveLoss = null; G.moveRank = undefined;
    if (!G.coachBase) {
      if (!G.coachP || G.coachP.key !== coachKey()) prefetchCoach();
      const myG = G, cb = await G.coachP.p;
      if (G !== myG) return false;
      G.coachBase = cb || CE.think(G.pos.clone(), LEVELS.coach);
    }
    const p2 = G.pos.clone(); p2.make(m);
    if (!p2.legalMoves().length) { G.moveLoss = 0; return true; }
    const all = G.coachBase.all || [], e = all.find(x => x.m === m);
    if (!e) { G.moveLoss = null; return true; }
    const loss = all.length ? Math.max(0, all[0].s - e.s) : 0;
    G.moveLoss = loss; G.moveRank = all.filter(x => x.s > e.s).length;
    if (loss < 150) return true;
    const r = CE.think(p2, Object.assign({}, LEVELS.coach, { maxDepth: 1, wantAll: 0 })), after = e ? e.s : -r.score;
    const tq = r.move ? (r.move >> 7) & 127 : -1, victim = tq >= 0 ? p2.b[tq] : 0;
    let msg;
    if (after <= -(CE.MATE - 300)) msg = '이 수를 두면 <b>체크메이트를 당할 수 있어요!</b>';
    else if (victim) msg = `이 수를 두면 AI가 내 <b>${josa(NAME[victim & 7], '을', '를')}</b> 잡을 수 있어요. (빨간 화살표)`;
    else msg = '이 수를 두면 형세가 많이 나빠져요.';
    G.warns++;
    G.hl = { threat: r.move, danger: victim ? [tq] : [] };
    G.sel = -1; G.targets = [];
    const keep = G.pos; G.pos = p2; render(); G.pos = keep;
    const go = await Shell.coachAsk('⚠️ 잠깐!', msg);
    if (!G) return false;
    G.hl = null; render();
    if (!go) { G.heeded++; Shell.coach('좋아요! 다른 수를 찾아봐요. 막히면 <b>💡 힌트</b>를 눌러 보세요.'); }
    return go;
  }
  async function hint() {
    if (!G || G.over || G.pos.side !== G.human || G.thinking || G.busy) return;
    const pos = G.pos;
    G.hintThisTurn = true;
    if (G.hintStage === 0) {
      G.hints++;
      const danger = [], targets = [];
      for (let q = 0; q < 128; q++) { if (q & 0x88) continue; const p = pos.b[q]; if (p && (p & 8) === G.human && (p & 7) !== K && pos.attacked(q, G.ai)) danger.push(q); }
      pos.legalMoves().forEach(m => { const t = (m >> 7) & 127; if (pos.b[t] && targets.indexOf(t) < 0) targets.push(t); });
      G.hl = { danger, targets }; G.hintStage = 1;
      let t = '<b>힌트 1/3 · 위험 살피기</b><br>';
      if (pos.inCheck(G.human)) t += '지금 <b>체크</b>예요! 킹을 지키는 게 먼저예요.<br>';
      t += danger.length ? `🔴 공격받는 내 기물: <b>${danger.map(q => NAME[pos.b[q] & 7]).join(', ')}</b><br>` : '🔴 지금 공격받는 내 기물은 없어요.<br>';
      t += targets.length ? `🟢 잡을 수 있는 상대 기물: <b>${targets.map(q => NAME[pos.b[q] & 7]).join(', ')}</b>` : '🟢 지금 바로 잡을 수 있는 상대 기물은 없어요.';
      Shell.coach(t + '<br><span style="color:var(--sub)">힌트를 한 번 더 누르면 움직일 기물을 알려줘요.</span>');
    } else if (G.hintStage === 1) {
      const myG = G, ho = { maxDepth: 5, timeMs: 1500 }, clone = pos.clone(), pl0 = G.plies;
      G.busy = true; Shell.info('💡 힌트를 계산하고 있어요…');
      const r = await helperCall(ctx, 'hintW', 'srcChess', { state: pos.state(), opts: ho }, () => CE.think(clone, ho), ho.timeMs);
      if (G !== myG) return;
      G.busy = false; Shell.info('');
      if (!r || !r.move || G.over || G.plies !== pl0) { update(); return; }
      G.hintMove = r.move; G.hl = { from: r.move & 127 }; G.hintStage = 2;
      Shell.coach(`<b>힌트 2/3 · 움직일 기물</b><br>파란 동그라미의 <b>${josa(NAME[pos.b[r.move & 127] & 7], '을', '를')}</b> 움직여 보세요. 어디로 가면 좋을까요?`);
    } else if (G.hintStage === 2) {
      const m = G.hintMove, f = m & 127, t = (m >> 7) & 127, cap = pos.b[t], pc = pos.b[f];
      const p2 = pos.clone(); p2.make(m);
      let why;
      if ((m >> 17) & 2) why = '캐슬링으로 킹을 안전하게 지킬 수 있어요.';
      else if (cap) why = `상대 ${josa(NAME[cap & 7], '을', '를')} 잡을 수 있어요.`;
      else if (pos.inCheck(G.human)) why = '체크를 막을 수 있어요.';
      else if (pos.attacked(f, G.ai)) why = `공격받는 ${josa(NAME[pc & 7], '을', '를')} 안전한 곳으로 피할 수 있어요.`;
      else if (p2.inCheck(p2.side)) why = '상대 킹에게 체크를 걸 수 있어요.';
      else why = 'AI 계산으로 형세가 가장 좋아지는 자리예요.';
      G.hl = { from: f, to: t }; G.hintStage = 3;
      Shell.coach(`<b>힌트 3/3 · 추천 수</b><br>파란 화살표처럼 움직여 보세요. ${why}`);
    }
    render(); update();
  }

  async function onClick(sq) {
    if (!G || G.over || G.pos.side !== G.human || G.thinking || G.busy || $('promo')) return;
    const p = G.pos.b[sq];
    if (G.sel >= 0 && G.targets.includes(sq)) {
      const cands = G.pos.legalMoves().filter(m => (m & 127) === G.sel && ((m >> 7) & 127) === sq);
      if (cands.length > 1) { choosePromo(cands); return; }
      play(cands[0]); return;
    }
    if (p && (p & 8) === G.human) {
      G.sel = sq;
      G.targets = G.pos.legalMoves().filter(m => (m & 127) === sq).map(m => (m >> 7) & 127);
      Shell.info(!G.targets.length ? (G.pos.inCheck(G.human) ? '체크 상태예요 — 이 기물로는 막을 수 없어요.' : '이 기물은 지금 움직일 수 없어요.') : '');
    } else { G.sel = -1; G.targets = []; }
    render();
  }
  async function play(m) {
    if (G.mode === 'tutorial') { tutMove(m); return; }
    if (G.mode === 'train') {
      G.busy = true; const ok = await coachCheck(m); if (G) G.busy = false;
      if (!G || !ok) { if (G) { G.sel = -1; G.targets = []; render(); } return; }
      if (G.moveLoss !== null) Adapt.step(G, Adapt.classify(G.moveLoss, LEVELS.adapt.chess, G.moveRank));
    }
    G.hist.push(snapshot()); doMove(m, true);
  }
  function choosePromo(cands) {
    const d = document.createElement('div'); d.id = 'promo';
    const box = document.createElement('div'); box.className = 'pbox';
    [Q, R, B, N].forEach(t => {
      const m = cands.find(x => ((x >> 14) & 7) === t); if (!m) return;
      const b = document.createElement('button'); b.textContent = GLYPH[t] + '\uFE0E'; b.title = NAME[t];
      b.onclick = () => { d.remove(); play(m); };
      box.appendChild(b);
    });
    d.appendChild(box); d.onclick = e => { if (e.target === d) d.remove(); };
    $('boardHost').appendChild(d);
  }
  function undo() {
    if (!G || !G.hist.length || G.over || G.busy) return;
    ctx.reqId++; if (G.thinking) { ctx.worker && ctx.worker.terminate(); ctx.worker = makeWorker('srcChess'); }
    stopProg(); G.thinking = false; G.undos++; Notify.clear(); G.aiTxt = '';
    const s = G.hist.pop();
    G.pos = s.pos; G.last = s.last; G.plies = s.plies; G.rec.length = s.rl; G.caps = s.caps; G.prevEval = s.prevEval; G.blunders.length = s.bl;
    $('gLog').innerHTML = s.log; G.sel = -1; G.targets = []; G.hl = null; G.hintStage = 0; G.coachBase = null; Shell.coach('');
    render(); update(); Shell.autosave(); prefetchCoach();
  }
  function offerDraw() {
    if (!G || G.over || G.thinking) return;
    const aiEval = G.prevEval === null ? 0 : -G.prevEval;
    if (aiEval <= -50 || (Math.abs(aiEval) < 30 && G.plies > 60)) end('draw', '무승부 합의');
    else Shell.toast('AI가 무승부를 거절했어요', aiEval > 0 ? 'AI는 자기가 유리하다고 봐요' : '아직 승부가 남았다고 봐요', 'info');
  }
  async function resign() { if (!G || G.over) return; const myG = G; if (!(await confirmResign()) || myG !== G || G.over) return; end('loss', '기권'); }
  function update() {
    if (!G) return;
    const pos = G.pos, chk = pos.inCheck(pos.side);
    if (G.mode === 'tutorial') { Shell.status(G.over ? '🎉 성공!' : chk ? '⚠️ 체크를 받았어요!' : '👉 기물을 눌러서 움직여 보세요', G.over ? '' : chk ? 'alert' : 'me'); $('cHint').disabled = G.over; return; }
    if (G.over) Shell.status('대국 종료');
    else if (pos.side === G.ai) Shell.status(`🤖 AI(${cname(G.ai)})가 생각 중<span class="dots"></span>`, 'think');
    else if (chk) Shell.status('⚠️ 체크! 킹을 지키세요', 'alert');
    else Shell.status(`👉 내 차례 (${cname(G.human)})${G.aiTxt ? `<small class="stsub">${G.aiTxt}</small>` : ''}`, 'me');
    const busy = G.over || G.thinking;
    if ($('cUndo')) $('cUndo').disabled = busy || !G.hist.length;
    if ($('cHint')) $('cHint').disabled = busy || pos.side !== G.human || G.hintStage >= 3;
    $('cDraw').disabled = busy; $('cRes').disabled = G.over;
    const tray = arr => arr.slice().sort((a, b) => PVAL[b & 7] - PVAL[a & 7]).map(p => `<span style="color:${(p & 8) ? '#222' : '#fff'};text-shadow:0 0 2px #000">${GLYPH[p & 7]}\uFE0E</span>`).join('') || '<span style="font-size:12px">-</span>';
    $('cTrayMe').innerHTML = tray(G.caps[G.human]); $('cTrayAi').innerHTML = tray(G.caps[G.ai]);
    const d = material(G.human) - material(G.ai);
    $('cPtMe').textContent = d > 0 ? `+${d}` : ''; $('cPtAi').textContent = d < 0 ? `+${-d}` : '';
  }
  function arrowSvg(f, t, col, mk, w) {
    const [x1, y1] = xy(f), [x2, y2] = xy(t), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    return `<line x1="${x1 + ux * 10}" y1="${y1 + uy * 10}" x2="${x2 - ux * 30}" y2="${y2 - uy * 30}" stroke="${col}" stroke-width="${w || 9}" stroke-linecap="round" opacity=".8" marker-end="url(#${mk})"/>`;
  }
  function render() {
    const svg = $('csvg'); if (!svg || !G) return;
    const pos = G.pos;
    const mkr = (id, c) => `<marker id="${id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.6" markerHeight="3.6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`;
    let h = `<defs>${mkr('caH', '#f59e0b')}${mkr('caHint', '#2f7bff')}${mkr('caThr', '#e5484d')}<filter id="csh"><feDropShadow dx="1" dy="2" stdDeviation="1.2" flood-opacity=".5"/></filter></defs>`;
    h += `<rect width="${SIZE}" height="${SIZE}" fill="#3b2a1d"/>`;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const sq = r * 16 + f, [x, y] = xy(sq), light = (r + f) % 2 === 1; h += `<rect x="${x - SQ / 2}" y="${y - SQ / 2}" width="${SQ}" height="${SQ}" fill="${light ? '#f0d9b5' : '#b58863'}"/>`; }
    for (let i = 0; i < 8; i++) {
      const fileCh = String.fromCharCode(97 + (G.flip ? 7 - i : i)), rankCh = G.flip ? i + 1 : 8 - i;
      h += `<text x="${PAD + i * SQ + SQ / 2}" y="${SIZE - 8}" text-anchor="middle" font-size="14" fill="#e8d3b0" font-family="sans-serif">${fileCh}</text>`;
      h += `<text x="${PAD / 2}" y="${PAD + i * SQ + SQ / 2 + 5}" text-anchor="middle" font-size="14" fill="#e8d3b0" font-family="sans-serif">${rankCh}</text>`;
    }
    let over = '';
    if (G.last) {
      const f = G.last & 127, t = (G.last >> 7) & 127, [x1, y1] = xy(f), [x2, y2] = xy(t);
      h += `<rect x="${x1 - SQ / 2}" y="${y1 - SQ / 2}" width="${SQ}" height="${SQ}" fill="rgba(245,190,40,.38)"/>`;
      h += `<rect x="${x2 - SQ / 2}" y="${y2 - SQ / 2}" width="${SQ}" height="${SQ}" fill="rgba(245,190,40,.55)"><animate attributeName="opacity" values="1;.55;1" dur="1.6s" repeatCount="indefinite"/></rect>`;
      over += arrowSvg(f, t, '#f59e0b', 'caH');
    }
    if (G.sel >= 0) { const [x, y] = xy(G.sel); h += `<rect x="${x - SQ / 2}" y="${y - SQ / 2}" width="${SQ}" height="${SQ}" fill="rgba(80,170,90,.55)"/>`; }
    [WHITE, BLACK].forEach(s => { if (pos.inCheck(s)) { const [x, y] = xy(pos.kings[s >> 3]); h += `<circle cx="${x}" cy="${y}" r="38" fill="rgba(230,30,30,.55)"><animate attributeName="r" values="30;40;30" dur="1s" repeatCount="indefinite"/></circle>`; } });
    const hl = G.hl || {};
    (hl.danger || []).forEach(q => { const [x, y] = xy(q); h += `<rect x="${x - SQ / 2 + 3}" y="${y - SQ / 2 + 3}" width="${SQ - 6}" height="${SQ - 6}" fill="rgba(229,72,77,.25)" stroke="#e5484d" stroke-width="4" stroke-dasharray="8 5"/>`; });
    (hl.targets || []).forEach(q => { const [x, y] = xy(q); h += `<rect x="${x - SQ / 2 + 3}" y="${y - SQ / 2 + 3}" width="${SQ - 6}" height="${SQ - 6}" fill="rgba(47,191,113,.25)" stroke="#2fbf71" stroke-width="4" stroke-dasharray="8 5"/>`; });
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = r * 16 + f, p = pos.b[sq]; if (!p) continue;
      const [x, y] = xy(sq), white = !(p & 8);
      let anim = '';
      if (G.anim && G.anim.t === sq) { const [fx, fy] = xy(G.anim.f); anim = `<animateTransform attributeName="transform" type="translate" from="${fx - x} ${fy - y}" to="0 0" dur="0.32s" fill="freeze"/>`; }
      h += `<g>${anim}<text x="${x}" y="${y + 23}" text-anchor="middle" font-size="64" fill="${white ? '#ffffff' : '#1d1d1d'}" stroke="${white ? '#1d1d1d' : '#000'}" stroke-width="${white ? 1.6 : 0.8}" filter="url(#csh)" font-family="'Segoe UI Symbol','DejaVu Sans','Noto Sans Symbols2','Arial Unicode MS',serif">${GLYPH[p & 7]}\uFE0E</text></g>`;
    }
    h += over;
    if (hl.from !== undefined) { const [x, y] = xy(hl.from); h += `<circle cx="${x}" cy="${y}" r="36" fill="none" stroke="#2f7bff" stroke-width="5"><animate attributeName="r" values="31;39;31" dur="1.1s" repeatCount="indefinite"/></circle>`; }
    if (hl.to !== undefined) { const [x, y] = xy(hl.to); h += `<rect x="${x - SQ / 2 + 4}" y="${y - SQ / 2 + 4}" width="${SQ - 8}" height="${SQ - 8}" fill="rgba(47,123,255,.25)" stroke="#2f7bff" stroke-width="3"/>` + arrowSvg(hl.from, hl.to, '#2f7bff', 'caHint', 10); }
    if (hl.threat) h += arrowSvg(hl.threat & 127, (hl.threat >> 7) & 127, '#e5484d', 'caThr', 10);
    if (G.capFx !== null) {
      const [x, y] = xy(G.capFx); h += `<circle cx="${x}" cy="${y}" r="20" fill="none" stroke="#ff4d4d" stroke-width="7" opacity="0"><animate attributeName="r" from="20" to="78" begin=".26s" dur=".7s" fill="freeze"/><animate attributeName="opacity" values="1;0" begin=".26s" dur=".7s" fill="freeze"/></circle>`;
      if (G.capVal) {
        const cv = G.capVal, col = cv.me ? '#1f9d5c' : '#d63b40';
        h += `<g pointer-events="none" opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.7;1" begin=".25s" dur="1.3s" fill="freeze"/><animateTransform attributeName="transform" type="translate" from="0 0" to="0 -34" begin=".25s" dur="1.3s" fill="freeze"/><text x="${x}" y="${y - 30}" text-anchor="middle" font-size="30" font-weight="900" fill="${col}" stroke="#fff" stroke-width="5" paint-order="stroke" font-family="sans-serif">${cv.me ? '+' : '−'}${cv.v}</text></g>`;
      }
    }
    G.targets.forEach(q => { const [x, y] = xy(q); h += pos.b[q] ? `<circle cx="${x}" cy="${y}" r="36" fill="none" stroke="rgba(200,40,40,.85)" stroke-width="6"/>` : `<circle cx="${x}" cy="${y}" r="12" fill="rgba(40,120,50,.7)"/>`; });
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const sq = r * 16 + f, [x, y] = xy(sq); h += `<rect x="${x - SQ / 2}" y="${y - SQ / 2}" width="${SQ}" height="${SQ}" fill="transparent" data-sq="${sq}" style="cursor:pointer"/>`; }
    svg.innerHTML = h;
    // SVG 애니메이션 시계를 0으로: 이동·잡기 효과가 매번 처음부터 재생되게 함 (v0.7까지는 재생되지 않던 문제)
    try { if (svg.setCurrentTime) svg.setCurrentTime(0); } catch (e) {}
  }

  // ---------- 복기 · 대국 후 분석 ----------
  const ANALYZE = { exact: 1, maxDepth: 3, noJitter: 1, wantAll: 1, timeMs: 4000 };
  const clampEval = v => Math.max(-2000, Math.min(2000, v));
  const review = {
    len: () => G ? G.rec.length : 0,
    moves: () => G ? G.rec.map((r, i) => { const no = Math.floor(G.rec0 + i / 2) + 1; return { txt: r.txt, h: r.h, side: r.side === WHITE ? 0 : 1, no, lab: r.side === WHITE ? no + '.' : no + '…' }; }) : [],
    show(k, best) {
      if (!G) return;
      if (!G.finalPos) G.finalPos = G.pos;
      G.pos = k >= G.rec.length ? G.finalPos : CE.Pos.fromState(G.rec[k].s);
      G.last = k > 0 ? G.rec[k - 1].m : 0;
      G.hl = best ? { from: best & 127, to: (best >> 7) & 127 } : null;
      G.sel = -1; G.targets = []; G.anim = null; G.capFx = null;
      render();
    },
    jobs() {
      const out = [];
      G.rec.forEach((r, i) => { if (r.h) out.push({ idx: i, msg: { state: r.s, opts: ANALYZE }, local: () => CE.think(CE.Pos.fromState(r.s), Object.assign({}, ANALYZE, { timeMs: 1500 })) }); });
      return { src: 'srcChess', list: out, parallel: 2 };
    },
    judge(jobs, results) {
      const res = {};
      jobs.list.forEach((j, n) => {
        const r = results[n]; if (!r || !r.all || !r.all.length) return;
        const rec = G.rec[j.idx], played = r.all.find(x => x.m === rec.m); if (!played) return;
        const best = r.all[0], loss = Math.max(0, clampEval(best.s) - clampEval(played.s)), rank = r.all.filter(x => x.s > played.s).length;
        const pos = CE.Pos.fromState(rec.s);
        res[j.idx] = { decided: Math.abs(best.s) >= 1000, loss, cls: Adapt.classify(loss, LEVELS.adapt.chess, rank), best: best.m === rec.m ? 0 : best.m, bestTxt: best.m === rec.m ? '' : CE.san(pos, best.m), unit: 'pawn' };
      });
      return res;
    }
  };
  return { start, destroy, review, resumeData, moveCount: () => G ? G.plies : 0, _g: () => G, _render: () => { render(); update(); } };
})();