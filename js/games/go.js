// ======================= 바둑 (튜토리얼 · 교육 · 대련) =======================
const GoGame = (() => {
  const MAXW = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1));
  const COLS = 'ABCDEFGHJKLMNOPQRST';
  let G = null, workers = [], workerOK = true, reqId = 0, cancelSearch = null, hover = 0, cv = null, cx = null;
  let S = 600, M = 34, CELL = 30, woodCanvas = null, raf = 0;
  const cname = c => c === 1 ? '흑' : '백';

  function makeWorkers() {
    workers.forEach(w => w.terminate()); workers = [];
    if (!workerOK) return;
    for (let i = 0; i < MAXW; i++) { const w = makeWorker('srcGo'); if (!w) { workerOK = false; break; } w.onerror = e => { e.preventDefault(); workerOK = false; }; workers.push(w); }
  }
  function runSearch(board, lv, minMs) {
    return new Promise(resolve => {
      const id = ++reqId, t0 = Date.now(), time = lv.time || 30000;
      const opts = { time, maxSims: lv.maxSims, komi: G.komi, history: [...G.hist], cap: board.n <= 9 ? 1200000 : 1600000 };
      const st = board.state(), use = workerOK ? (lv.maxSims ? workers.slice(0, 1) : workers) : [];
      let done = false, timeout = null;
      const got = [];
      const cancel = () => {
        if (done) return;
        done = true; clearTimeout(timeout);
        if (id === reqId) stopProg();
        if (cancelSearch === cancel) cancelSearch = null;
        resolve(null);
      };
      if (cancelSearch) cancelSearch();
      cancelSearch = cancel;
      startProg(lv.time || 1500);
      const deliver = r => {
        const wait = Math.max(0, (minMs || 0) - (Date.now() - t0));
        setTimeout(() => {
          if (id === reqId) stopProg();
          if (cancelSearch === cancel) cancelSearch = null;
          resolve(id === reqId ? r : null);
        }, wait);
      };
      const fallback = () => {
        try { return combine([search(Board.fromState(st), Object.assign({}, opts, { time: Math.min(time, 4000) }))], board); }
        catch (error) { console.error('바둑 AI 대체 탐색 실패:', error); return null; }
      };
      const failToFallback = () => {
        if (done || id !== reqId) return;
        done = true; clearTimeout(timeout); workerOK = false; makeWorkers(); deliver(fallback());
      };
      if (!use.length) { setTimeout(() => { if (!done && id === reqId) { done = true; deliver(fallback()); } }, 50); return; }
      timeout = setTimeout(failToFallback, time + 10000);
      use.forEach(w => {
        w.onmessage = e => {
          if (!e.data || e.data.id !== id || done) return;
          if (!e.data.res || !Array.isArray(e.data.res.children)) { failToFallback(); return; }
          got.push(e.data.res);
          if (got.length === use.length) {
            done = true; clearTimeout(timeout);
            try { deliver(combine(got, board)); } catch (error) { console.error('바둑 AI 결과 병합 실패:', error); workerOK = false; makeWorkers(); deliver(fallback()); }
          }
        };
        w.onerror = e => { if (e.preventDefault) e.preventDefault(); failToFallback(); };
        try { w.postMessage({ id, state: st, opts }); }
        catch (error) { console.warn('바둑 AI Worker 메시지 전송 실패:', error); failToFallback(); }
      });
    });
  }
  function combine(list, board) {
    const map = new Map(); let sims = 0; const own = new Float64Array(board.sz);
    list.forEach(r => {
      sims += r.sims;
      r.children.forEach(c => { const o = map.get(c.m) || { m: c.m, n: 0, w: 0 }; o.n += c.n; o.w += c.w; map.set(c.m, o); });
      for (let i = 0; i < board.sz; i++) own[i] += r.own[i] * r.sims;
    });
    if (sims) for (let i = 0; i < board.sz; i++) own[i] /= sims;
    return { ch: [...map.values()].filter(c => c.n > 0).sort((a, b) => b.n - a.n), sims, own };
  }
  function hoshi(n) { const a = n <= 9 ? 2 : 3; return { a, z: n - 1 - a, m: (n - 1) / 2 }; }
  function handicapPoints(n, k) {
    const { a, z, m } = hoshi(n);
    const TR = [a, z], BL = [z, a], BR = [z, z], TL = [a, a], Cc = [m, m], ML = [m, a], MR = [m, z], MT = [a, m], MB = [z, m];
    const sets = { 2: [TR, BL], 3: [TR, BL, BR], 4: [TR, BL, BR, TL], 5: [TR, BL, BR, TL, Cc], 6: [TR, BL, BR, TL, ML, MR], 7: [TR, BL, BR, TL, ML, MR, Cc], 8: [TR, BL, BR, TL, ML, MR, MT, MB], 9: [TR, BL, BR, TL, ML, MR, MT, MB, Cc] };
    return sets[k] || [];
  }

  function start(o) {
    const tut = o.mode === 'tutorial';
    reqId++; if (!tut) makeWorkers();
    let b, n, human, komi = 7.5, hcp = 0;
    if (tut) {
      const L = LESSONS.go[o.lesson]; n = 9; human = 1; b = new Board(9);
      L.board.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') { b.toPlay = ch === 'X' ? 1 : 2; b.play(b.pt(r, c)); } }));
      b.toPlay = 1; b.last = 0; b.last2 = 0; b.ko = 0; b.passes = 0; b.moveNum = 0; b.cap[1] = b.cap[2] = 0;
    } else {
      n = o.size; human = o.human; hcp = o.hcp; komi = o.komi === 'auto' ? (hcp ? 0.5 : 7.5) : +o.komi;
      b = new Board(n);
      handicapPoints(n, hcp).forEach(([r, c]) => { b.toPlay = 1; b.play(b.pt(r, c)); });
      b.toPlay = hcp ? 2 : 1; b.moveNum = 0; b.last = 0; b.last2 = 0; b.passes = 0; b.ko = 0; b.cap[1] = b.cap[2] = 0;
    }
    G = { b, n, human, ai: 3 - human, komi, hcp, hist: new Set([b.key()]), moves: [], undo: [], over: false, thinking: false, scoring: false, mode: o.mode,
          dead: new Set(), own: null, showOwn: false, hints: null, o, prevWr: null, blunders: [], best: null, pulse: null,
          hintCount: 0, warns: 0, heeded: 0, undos: 0, tutHint: null, rec: [] };
    G.st = stNew({ contact: 0, l3: 0, l4: 0 }); Adapt.init(G, o.level || 1); G.turnT = Date.now();
    cv = document.createElement('canvas'); cv.id = 'gocv'; cx = cv.getContext('2d');
    $('boardHost').insertBefore(cv, $('boardHost').firstChild);
    cv.addEventListener('mousemove', e => { if (!G) return; const p = pointAt(e); if (p !== hover) { hover = p; render(); } });
    cv.addEventListener('mouseleave', () => { hover = 0; render(); });
    cv.addEventListener('click', e => { if (!G) return; const p = pointAt(e); if (!p) return; if (G.scoring && !G.thinking) { toggleDead(p); return; } humanMove(p); });
    if (!tut) $('gExtra').innerHTML = (o.mode === 'train' ? Adapt.html(G) : '') + `<div class="card" style="padding:10px 12px;margin-top:${o.mode === 'train' ? 10 : 0}px">
      <div class="wrl"><span>● 흑 따낸 돌 <b id="gCapB">0</b></span><span>○ 백 따낸 돌 <b id="gCapW">0</b></span></div>
      <div class="bars" style="margin-top:8px"><div class="wr"><div class="a" id="gWr" style="width:50%"></div><div class="b"></div></div><div class="wrl"><span>나</span><span id="gWrL">형세</span><span>AI</span></div></div>
      <div id="gScore" style="display:none;margin-top:10px;font-size:13px;line-height:1.6"></div></div>`;
    if (tut) Shell.buttons([{ id: 'gReset', label: '다시 하기', on: () => Tutorial.start('go', o.lesson) }, { id: 'gHint', label: '💡 힌트', cls: 'green', on: () => { G.tutHint = LESSONS.go[o.lesson].hint.map(([r, c]) => G.b.pt(r, c)); render(); Shell.info('💡 파란 점에 두어 보세요.'); } }, { id: 'gList', label: '목록으로', on: () => Shell.close() }]);
    else if (o.mode === 'train') Shell.buttons([
      { id: 'gHint', label: '💡 힌트', cls: 'green', on: hint }, { id: 'gEval', label: '형세 판단', cls: 'green', on: evalPos }, { id: 'gUndo', label: '무르기', on: undo },
      { id: 'gPass', label: '패스', on: () => humanMove(0) }, { id: 'gRes', label: '기권', cls: 'danger', on: resign }, { id: 'gCoord', label: '좌표', on: () => { G.noCoord = !G.noCoord; resize(); } }]);
    else Shell.buttons([{ id: 'gPass', label: '패스', on: () => humanMove(0) }, { id: 'gRes', label: '기권', cls: 'danger', on: resign }, { id: 'gCoord', label: '좌표', on: () => { G.noCoord = !G.noCoord; resize(); } }]);
    if (!tut) Shell.log(`대국 시작 — ${n}줄 · 나는 ${cname(human)} · 덤 ${komi}${hcp ? ` · ${hcp}점 접바둑` : ''}`, 'sys');
    if (o.mode === 'train') Shell.coach('바로 잡힐 자리에 두려고 하면 알려줄게요. <b>💡 힌트</b>는 좋은 자리 3곳을, <b>형세 판단</b>은 집 계산을 보여줘요.');
    if (o.resume) restore(o.resume);
    window.addEventListener('resize', resize);
    resize(); update(); loop();
    if (!tut && G.b.passes >= 2) setTimeout(() => { if (G && !G.over && !G.scoring) startScoring(); }, 200);
    else if (!tut && G.b.toPlay === G.ai) setTimeout(aiTurn, 300);
  }
  // ---------- 저장 · 이어하기 ----------
  function restore(r) {
    if (!Array.isArray(r.moves)) throw new Error('저장 데이터 형식 오류');
    r.moves.forEach(p => {
      const b = G.b;
      if (!Number.isInteger(p) || (p !== 0 && (p < 0 || p >= b.sz || !b.legal(p)))) throw new Error('저장된 수순이 올바르지 않아요');
      if (p) { const t = b.clone(); t.play(p); if (G.hist.has(t.key())) throw new Error('저장된 수순이 올바르지 않아요'); }
      const c = b.toPlay, before = b.cap[c];
      G.rec.push({ st: b.state(), p, c, h: c === G.human, txt: name(p) });
      b.play(p); G.hist.add(b.key()); G.moves.push({ c, p });
      const got = b.cap[c] - before;
      Shell.log(`${G.moves.length}. ${c === 1 ? '●' : '○'} ${name(p)}${got ? ` (${got}점 따냄)` : ''}`, c === G.human ? 'me' : 'ai');
    });
    Resume.restoreCommon(G, r);
    if (typeof r.prevWr === 'number') { G.prevWr = r.prevWr; setWR(r.prevWr); }
    Shell.log('— 저장된 대국을 이어서 둡니다 —', 'sys');
  }
  function resumeData() {
    if (!G || G.mode === 'tutorial' || G.over) return null;
    return Object.assign({ o: { mode: G.o.mode, level: G.o.level, size: G.n, human: G.human, hcp: G.hcp, komi: G.o.komi }, moves: G.rec.map(r => r.p), prevWr: G.prevWr }, Resume.commonData(G));
  }
  function destroy() { reqId++; if (cancelSearch) cancelSearch(); cancelSearch = null; workers.forEach(w => w.terminate()); workers = []; window.removeEventListener('resize', resize); cancelAnimationFrame(raf); G = null; }
  function loop() { raf = requestAnimationFrame(() => { if (!G) return; if (G.pulse && performance.now() - G.pulse.t0 < 1400) render(); loop(); }); }
  function name(p) { if (!p) return '패스'; const w = G.b.w, r = ((p / w) | 0) - 1, c = p % w - 1; return COLS[c] + (G.n - r); }
  function isLegalHuman(p) { const b = G.b; if (!b.legal(p)) return false; const t = b.clone(); t.play(p); return !G.hist.has(t.key()); }
  function applyMove(p, byHuman) {
    const b = G.b, c = b.toPlay, before = b.cap[c];
    if (byHuman && p && G.mode !== 'tutorial') {
      const st = G.st; stThink(G); st.moves++;
      if (b.n8.some(d => b.col[p + d] === 3 - c)) st.contact++;
      if (st.moves <= 15 && b.n >= 13) { if (b.line[p] === 2) st.l3++; else if (b.line[p] === 3) st.l4++; }
    }
    if (G.mode !== 'tutorial') G.rec.push({ st: b.state(), p, c, h: !!byHuman, txt: name(p) });
    b.play(p); G.hist.add(b.key()); G.moves.push({ c, p }); G.hints = null; G.showOwn = false;
    const got = b.cap[c] - before;
    if (G.mode !== 'tutorial') Shell.log(`${G.moves.length}. ${c === 1 ? '●' : '○'} ${name(p)}${got ? ` (${got}점 따냄)` : ''}`, byHuman ? 'me' : 'ai');
    if (got && byHuman && G.st) G.st.caps += got;
    Shell.sfx(got ? (byHuman ? 'capture' : 'lose') : p ? 'stone' : 'pass');
    if (got && G.mode !== 'tutorial') {
      const kid = isKid(), chip = Chip.go(3 - c, got);
      if (byHuman) Shell.notify({ kind: 'good', chip, prio: 'major', title: kid ? `우와! 돌 ${got}개를 땄어!` : `${c === 1 ? '백' : '흑'} 돌 ${got}개를 따냈어요`, sub: kid ? `+${got}점 ⭐` : `${name(p)}에 두어 활로를 모두 막았어요 · <b>+${got}</b>` });
      else Shell.notify({ kind: 'bad', chip, prio: 'major', title: kid ? `앗, 내 돌 ${got}개가 잡혔어` : `내 돌 ${got}개를 잃었어요`, sub: kid ? '숨구멍(활로)을 많이 만들어 보자!' : `AI가 ${name(p)}에 두어 활로를 막았어요 · <b>−${got}</b>` });
    }
    G.aiTxt = byHuman ? '' : (p ? `🤖 AI: ${name(p)}에 두었어요 (빨간 동그라미)` : '🤖 AI: 패스');
    if (p) G.pulse = { p, t0: performance.now() };
    else if (!byHuman) Shell.notify({ kind: 'warn', prio: 'feedback', title: 'AI가 패스했어요', sub: '더 둘 곳이 없으면 나도 <b>패스</b> → 집 계산(계가)을 해요' });
    if (G.mode === 'train') Shell.coach('');
    if (b.passes >= 2) { Shell.autosave(); startScoring(); return; }
    if (G.mode !== 'tutorial') Shell.autosave();
  }
  function tutMove(p) {
    const L = LESSONS.go[G.o.lesson], g = L.goal, snap = G.b.clone();
    G.b.play(p); G.pulse = { p, t0: performance.now() }; G.tutHint = null; render(); Sound.play('stone');
    const pass = g.type === 'capture' ? G.b.cap[1] >= g.n : g.pts.some(([r, c]) => G.b.pt(r, c) === p);
    if (pass) {
      G.over = true; update();
      const msg = g.type === 'capture' ? `백 돌 ${G.b.cap[1]}개를 따냈어요!${G.b.ko ? ' 빨간 네모 자리는 백이 바로 되따낼 수 없는 "패" 자리예요.' : ''}` : '정답이에요! 이 자리가 급소예요.';
      Tutorial.pass('go', G.o.lesson, msg);
    } else { setTimeout(() => { if (!G) return; G.b = snap; render(); }, 650); Tutorial.fail(); }
  }
  async function humanMove(p) {
    if (!G || G.over || G.scoring || G.thinking || G.busy || G.b.toPlay !== G.human) return;
    if (p !== 0 && !isLegalHuman(p)) {
      if (G.b.col[p] !== 0) return;
      Shell.toast(p === G.b.ko ? '패!' : '둘 수 없는 자리', p === G.b.ko ? '바로 되따낼 수 없어요. 다른 곳에 한 수 두고 오세요.' : '자충수 또는 같은 모양 반복이에요.', 'warn');
      return;
    }
    if (G.mode === 'tutorial') { if (p) tutMove(p); return; }
    if (G.mode === 'train' && p) {
      const t = G.b.clone(), before = t.cap[G.human]; t.play(p);
      const h = t.head[p];
      if (t.cap[G.human] === before && t.inAtari(h)) {
        G.warns++; G.busy = true;
        const sz = t.size[h];
        G.hints = [{ m: p, wr: null }]; render();
        const go = await Shell.coachAsk('⚠️ 잠깐!', `★ 자리에 두면 ${sz > 1 ? `돌 <b>${sz}개 덩어리</b>가` : '이 돌이'} <b>단수</b>(숨구멍 1개)가 돼서 AI가 바로 잡을 수 있어요.`);
        if (G) { G.hints = null; render(); }
        if (G) G.busy = false;
        if (!G || !go) { if (G) { G.heeded++; Shell.coach('좋아요! 활로가 넉넉한 자리를 찾아봐요.'); } return; }
        G.ignoredWarn = true;
      }
    }
    G.undo.push({ b: G.b.clone(), hist: new Set(G.hist), movesLen: G.moves.length, log: $('gLog').innerHTML, prevWr: G.prevWr, bl: G.blunders.length });
    G.lastHuman = { no: G.moves.length + 1, txt: name(p) };
    applyMove(p, true); render(); update();
    if (!G.scoring && !G.over) setTimeout(aiTurn, 60);
  }
  async function aiTurn() {
    if (!G || G.over || G.scoring || G.b.toPlay !== G.ai) return;
    G.thinking = true; update();
    const myG = G, lvN = G.mode === 'train' ? G.lvNow : G.o.level, lv = LEVELS.go[lvN];
    const r = await runSearch(G.b, lv, Shell.aiDelay(700));
    if (!r || myG !== G || !G.thinking) return;
    G.thinking = false; G.own = r.own;
    if (!r.ch.length) { applyMove(0, false); render(); update(); return; }
    let best = r.ch[0];
    if (lv.blunder && Math.random() < lv.blunder) { const pool = r.ch.filter(c => c.m !== 0).slice(1, 1 + (lv.pool || 3)); if (pool.length) best = pool[Math.floor(Math.random() * pool.length)]; }
    const top = r.ch[0], wr = top.w / Math.max(1, top.n), hwr = 1 - wr;
    if (G.prevWr !== null && G.lastHuman && lvN >= 4) {
      const drop = G.prevWr - hwr;
      if (drop >= 0.18) G.blunders.push({ no: G.lastHuman.no, drop: drop * 1000, text: `<b>${G.lastHuman.txt}</b> 이후 내 승률이 약 <b>${Math.round(drop * 100)}%p</b> 떨어졌어요.` });
      if (-drop >= 0.15 && (!G.best || -drop * 1000 > G.best.drop)) G.best = { no: G.lastHuman.no, drop: -drop * 1000, text: `<b>${G.lastHuman.txt}</b> — 승률을 약 ${Math.round(-drop * 100)}%p 끌어올렸어요.` };
    }
    if (G.mode === 'train' && G.prevWr !== null && G.lastHuman) {
      const drop = G.prevWr - hwr, th = LEVELS.adapt.go;
      Adapt.step(G, G.ignoredWarn ? 'blunder' : drop <= th[0] ? 'good' : drop <= th[1] ? 'ok' : drop <= th[2] ? 'slip' : 'blunder');
    }
    G.ignoredWarn = false;
    G.prevWr = hwr; setWR(hwr);
    Shell.info(G.mode === 'train' ? `AI가 Lv.${lvN}로 두었어요` : '');
    const tot = r.ch.reduce((a, c) => a + c.n, 0);
    if (wr < 0.06 && tot > 2000 && G.b.moveNum > G.n * G.n / 3) { endGame('win', 'AI 기권 — 불계승'); return; }
    if (G.b.last === 0 && G.b.moveNum > 0) {
      const dead = estimateDead(G.b, r.own), sc = areaScore(G.b, dead, G.komi).diff;
      let settled = 0; for (const p of G.b.pts) if (Math.abs(r.own[p]) > 0.7) settled++;
      const aiWins = (G.ai === 1 ? sc > 0 : sc < 0) && settled >= G.b.pts.length * 0.85;
      const passC = r.ch.find(c => c.m === 0);
      if (aiWins || (passC && passC.w / passC.n >= wr - 0.03)) best = { m: 0 };
    }
    applyMove(best.m, false); render(); update(); G.turnT = Date.now();
  }
  function setWR(h) { const e = $('gWr'); if (e) e.style.width = Math.max(0, Math.min(100, h * 100)) + '%'; const l = $('gWrL'); if (l) l.textContent = `내 승률 ${(h * 100).toFixed(0)}%`; }
  function undo() {
    if (!G || !G.undo.length || G.over) return;
    reqId++; if (G.thinking) makeWorkers(); stopProg(); G.undos++; Notify.clear(); G.aiTxt = '';
    const s = G.undo.pop();
    G.b = s.b; G.hist = s.hist; G.moves.length = s.movesLen; G.rec.length = s.movesLen; $('gLog').innerHTML = s.log; G.prevWr = s.prevWr; G.blunders.length = s.bl;
    G.thinking = false; G.scoring = false; G.dead = new Set(); G.hints = null; G.showOwn = false; $('gScore').style.display = 'none';
    render(); update(); Shell.autosave();
  }
  async function hint() {
    if (!G || G.over || G.scoring || G.thinking || G.b.toPlay !== G.human) return;
    G.thinking = true; G.hintCount++; G.hintThisTurn = true; update(); Shell.info('힌트 계산 중...');
    const myG = G, r = await runSearch(G.b, { time: 3000 });
    if (!r || myG !== G) return;
    G.thinking = false;
    G.hints = r.ch.filter(c => c.m !== 0).slice(0, 3).map(c => ({ m: c.m, wr: c.w / c.n }));
    Shell.coach('<b>힌트 · 추천 자리</b><br>' + G.hints.map((h, i) => `${'ABC'[i]} ${name(h.m)} (예상 승률 ${(h.wr * 100).toFixed(0)}%)`).join('<br>') + '<br><span style="color:var(--sub)">A가 가장 좋은 자리예요.</span>');
    Shell.info(''); render(); update();
  }
  async function evalPos() {
    if (!G || G.thinking || G.scoring || G.over) return;
    if (G.showOwn) { G.showOwn = false; render(); return; }
    G.thinking = true; update(); Shell.info('형세 판단 중...');
    const myG = G, r = await runSearch(G.b, { time: 3000 });
    if (!r || myG !== G) return;
    G.thinking = false; G.own = r.own; G.showOwn = true;
    let s = 0; for (const p of G.b.pts) s += r.own[p]; s -= G.komi;
    const mine = G.human === 1 ? s : -s;
    Shell.info(`형세 추정: ${mine >= 0 ? '내가' : 'AI가'} 약 ${Math.abs(s).toFixed(1)}집 우세 · 검은/흰 네모는 각자의 집, 빨간 X는 위험한 돌이에요.`);
    render(); update();
  }
  async function resign() {
    if (!G || G.over || G.scoring) return;
    const myG = G;
    if (!(await confirmResign()) || myG !== G || G.over) return;
    reqId++; stopProg(); G.thinking = false;
    endGame('loss', '기권 — AI 불계승');
  }
  function estimateDead(b, own) {
    const dead = new Set(), seen = new Set();
    for (const p of b.pts) {
      const c = b.col[p]; if (c !== 1 && c !== 2) continue;
      const h = b.head[p]; if (seen.has(h)) continue; seen.add(h);
      let s = 0, k = 0, q = h;
      do { s += own ? own[q] : 0; k++; q = b.nxt[q]; } while (q !== h);
      s /= k;
      if ((c === 1 && s < -0.2) || (c === 2 && s > 0.2)) { q = h; do { dead.add(q); q = b.nxt[q]; } while (q !== h); }
    }
    return dead;
  }
  function areaScore(b, dead, komi) {
    const col = Int8Array.from(b.col); dead.forEach(p => col[p] = 0);
    const terr = new Int8Array(b.sz), seen = new Uint8Array(b.sz);
    let bs = 0, ws = 0, bt = 0, wt = 0;
    for (const p of b.pts) {
      if (col[p] === 1) bs++; else if (col[p] === 2) ws++;
      else if (!seen[p]) {
        const reg = [p], st = [p]; seen[p] = 1; let m = 0;
        while (st.length) { const x = st.pop(); for (const d of b.dirs) { const y = x + d, cy = col[y]; if (cy === 0 && !seen[y]) { seen[y] = 1; st.push(y); reg.push(y); } else if (cy === 1 || cy === 2) m |= cy; } }
        if (m === 1 || m === 2) { reg.forEach(x => terr[x] = m); if (m === 1) bt += reg.length; else wt += reg.length; }
      }
    }
    const B = bs + bt, W = ws + wt;
    return { B, W, bs, ws, bt, wt, diff: B - W - komi, terr };
  }
  async function startScoring() {
    G.scoring = true; G.thinking = true; update(); Shell.info('계가 중 — 사활 판정...');
    const myG = G, r = await runSearch(G.b, { time: 3000 });
    if (!r || myG !== G) return;
    G.thinking = false; G.own = r.own; G.dead = estimateDead(G.b, r.own);
    showScore(); render(); update();
  }
  function showScore() {
    const s = areaScore(G.b, G.dead, G.komi), box = $('gScore');
    box.style.display = 'block';
    box.innerHTML = `<b style="font-size:15px">계가: ${s.diff > 0 ? '흑' : '백'} ${Math.abs(s.diff)}집 승</b><br>흑 ${s.bs}+${s.bt}=${s.B} · 백 ${s.ws}+${s.wt}+덤${G.komi}=${s.W + G.komi}<br><span style="color:var(--sub)">죽은 돌 판정이 틀리면 돌을 클릭해 바꾼 뒤 확정하세요.</span><button id="gConfirm" class="primary" style="width:100%;margin-top:6px">계가 확정</button>`;
    $('gConfirm').onclick = () => { G.scoring = false; G.scoreInfo = s; const me = (s.diff > 0) === (G.human === 1); endGame(me ? 'win' : 'loss', `계가 — ${s.diff > 0 ? '흑' : '백'} ${Math.abs(s.diff)}집 승`, s); };
  }
  function toggleDead(p) {
    const b = G.b, c = b.col[p]; if (c !== 1 && c !== 2) return;
    const h = b.head[p], isDead = G.dead.has(p); let q = h;
    do { if (isDead) G.dead.delete(q); else G.dead.add(q); q = b.nxt[q]; } while (q !== h);
    showScore(); render();
  }
  function endGame(result, reason, s) {
    G.over = true; G.thinking = false; G.scoring = false; reqId++; stopProg(); Shell.coach(''); update(); render();
    const extra = [`따낸 돌: 나 <b>${G.b.cap[G.human]}</b> · AI <b>${G.b.cap[G.ai]}</b>`];
    if (s) { const my = G.human === 1 ? s.B : s.W + G.komi, ai = G.human === 1 ? s.W + G.komi : s.B; extra.push(`최종 점수: 나 <b>${my}</b> · AI <b>${ai}</b> (중국식, 덤 ${G.komi})`); }
    Object.assign(G.st, { warns: G.warns, heeded: G.heeded, hints: G.hintCount });
    const tr = G.mode === 'train' ? { lvf: G.lvf, endLevel: G.lvNow, lvPath: G.lvPath, quality: G.quality } : {};
    Shell.finish(result, reason, Object.assign({ moves: G.moves.length, blunders: G.blunders, best: G.best, extra, hints: G.hintCount, warns: G.warns, heeded: G.heeded, undos: G.undos, style: G.st }, tr));
  }
  function update() {
    if (!G) return;
    const b = G.b;
    if (G.mode === 'tutorial') { Shell.status(G.over ? '🎉 성공!' : '👉 점을 눌러 돌을 놓아 보세요 (나는 흑)', G.over ? '' : 'me'); $('gHint').disabled = G.over; return; }
    $('gCapB').textContent = b.cap[1]; $('gCapW').textContent = b.cap[2];
    if (G.over) Shell.status('대국 종료');
    else if (G.scoring) Shell.status('🧮 계가 단계', '');
    else if (G.thinking && b.toPlay === G.ai) Shell.status(`🤖 AI(${cname(G.ai)})가 생각 중<span class="dots"></span>`, 'think');
    else if (G.thinking) Shell.status(`분석 중<span class="dots"></span>`, 'think');
    else if (b.last === 0 && b.moveNum > 0) Shell.status('⚠️ AI가 패스했어요 — 패스하면 계가', 'alert');
    else Shell.status(`👉 내 차례 (${cname(G.human)})${G.aiTxt ? `<small class="stsub">${G.aiTxt}</small>` : ''}`, 'me');
    const busy = G.thinking || G.over || G.scoring;
    $('gPass').disabled = busy || b.toPlay !== G.human; $('gRes').disabled = G.over || G.scoring;
    if ($('gHint')) $('gHint').disabled = busy || b.toPlay !== G.human;
    if ($('gEval')) $('gEval').disabled = busy;
    if ($('gUndo')) $('gUndo').disabled = !G.undo.length || G.over;
  }
  function resize() {
    if (!G) return;
    S = boardPx(1);
    const dpr = window.devicePixelRatio || 1;
    cv.width = S * dpr; cv.height = S * dpr; cv.style.width = S + 'px'; cv.style.height = S + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    M = !G.noCoord ? Math.max(24, S * 0.055) : Math.max(16, S * 0.035);
    CELL = (S - 2 * M) / (G.n - 1); woodCanvas = null;
    render();
  }
  function xy(p) { const w = G.b.w; return [M + (p % w - 1) * CELL, M + (((p / w) | 0) - 1) * CELL]; }
  function wood() {
    if (woodCanvas) return woodCanvas;
    const c = document.createElement('canvas'); c.width = c.height = Math.round(S);
    const x = c.getContext('2d'), W = c.width;
    const g = x.createLinearGradient(0, 0, W, W); g.addColorStop(0, '#e6b96c'); g.addColorStop(.5, '#ddac5c'); g.addColorStop(1, '#d09e52');
    x.fillStyle = g; x.fillRect(0, 0, W, W);
    let seed = 7; const Rn = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 140; i++) {
      x.strokeStyle = `rgba(${120 + Rn() * 40},${70 + Rn() * 30},20,${0.03 + Rn() * 0.07})`; x.lineWidth = 0.6 + Rn() * 2.4;
      const y0 = Rn() * W, amp = 2 + Rn() * 6, ph = Rn() * 6;
      x.beginPath(); x.moveTo(0, y0); for (let k = 0; k <= 40; k++) x.lineTo(k * W / 40, y0 + Math.sin(k * .35 + ph) * amp); x.stroke();
    }
    return (woodCanvas = c);
  }
  function stone(x, y, c, alpha) {
    const r = CELL * 0.48; cx.save(); cx.globalAlpha = alpha == null ? 1 : alpha;
    if (alpha == null) { cx.shadowColor = 'rgba(0,0,0,.45)'; cx.shadowBlur = r * .35; cx.shadowOffsetX = r * .12; cx.shadowOffsetY = r * .18; }
    const g = cx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
    if (c === 1) { g.addColorStop(0, '#6b6b6b'); g.addColorStop(.35, '#2a2a2a'); g.addColorStop(1, '#050505'); }
    else { g.addColorStop(0, '#fff'); g.addColorStop(.6, '#ecebe6'); g.addColorStop(1, '#bdbbb4'); }
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill(); cx.restore();
  }
  function render() {
    if (!G || !cx) return;
    const b = G.b, n = G.n;
    cx.drawImage(wood(), 0, 0, S, S);
    cx.strokeStyle = '#3a2a14'; cx.lineWidth = 1;
    for (let i = 0; i < n; i++) { const v = Math.round(M + i * CELL) + .5; cx.beginPath(); cx.moveTo(M, v); cx.lineTo(M + (n - 1) * CELL, v); cx.stroke(); cx.beginPath(); cx.moveTo(v, M); cx.lineTo(v, M + (n - 1) * CELL); cx.stroke(); }
    cx.lineWidth = 2; cx.strokeRect(M, M, (n - 1) * CELL, (n - 1) * CELL);
    const { a, z, m } = hoshi(n);
    const hs = n === 19 ? [[a, a], [a, m], [a, z], [m, a], [m, m], [m, z], [z, a], [z, m], [z, z]] : [[a, a], [a, z], [z, a], [z, z], [m, m]];
    cx.fillStyle = '#3a2a14'; hs.forEach(([r, c]) => { cx.beginPath(); cx.arc(M + c * CELL, M + r * CELL, Math.max(2.5, CELL * .1), 0, Math.PI * 2); cx.fill(); });
    if (!G.noCoord) {
      cx.fillStyle = '#4a3418'; cx.font = `bold ${Math.max(10, M * .42)}px sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) { cx.fillText(COLS[i], M + i * CELL, M * .45); cx.fillText(COLS[i], M + i * CELL, S - M * .45); cx.fillText(n - i, M * .45, M + i * CELL); cx.fillText(n - i, S - M * .45, M + i * CELL); }
    }
    const atFinal = G.reviewK === undefined || G.reviewK === null;
    const terr = atFinal && (G.scoring || (G.over && G.scoreInfo)) ? areaScore(b, G.dead, G.komi).terr : null;
    for (const p of b.pts) {
      const [x, y] = xy(p);
      if (terr) { const t = terr[p]; if (t && (b.col[p] === 0 || G.dead.has(p))) { cx.fillStyle = t === 1 ? '#111' : '#f5f5f5'; const s = CELL * .32; cx.fillRect(x - s / 2, y - s / 2, s, s); } }
      else if (G.showOwn && G.own) {
        const o = G.own[p];
        if (Math.abs(o) > .25 && (b.col[p] === 0 || (b.col[p] === 1 && o < 0) || (b.col[p] === 2 && o > 0))) { const s = CELL * (.2 + .35 * Math.abs(o)); cx.fillStyle = o > 0 ? `rgba(0,0,0,${.35 + .5 * Math.abs(o)})` : `rgba(255,255,255,${.4 + .5 * Math.abs(o)})`; cx.fillRect(x - s / 2, y - s / 2, s, s); }
      }
    }
    for (const p of b.pts) {
      const c = b.col[p]; if (c !== 1 && c !== 2) continue;
      const [x, y] = xy(p), dead = atFinal && (G.scoring || G.over) && G.dead.has(p);
      stone(x, y, c, dead ? .45 : null);
      if (dead || (G.showOwn && G.own && ((c === 1 && G.own[p] < -.3) || (c === 2 && G.own[p] > .3)))) {
        cx.strokeStyle = dead ? (c === 1 ? '#fff' : '#000') : '#d22'; cx.lineWidth = 2; const s = CELL * .2;
        cx.beginPath(); cx.moveTo(x - s, y - s); cx.lineTo(x + s, y + s); cx.moveTo(x + s, y - s); cx.lineTo(x - s, y + s); cx.stroke();
      }
    }
    if (b.last > 0 && b.col[b.last]) {
      const [x, y] = xy(b.last), byAI = b.col[b.last] === G.ai;
      cx.strokeStyle = byAI ? '#ff5a3c' : '#2fbf71'; cx.lineWidth = Math.max(2, CELL * .09);
      cx.beginPath(); cx.arc(x, y, CELL * .24, 0, Math.PI * 2); cx.stroke();
      if (G.pulse && G.pulse.p === b.last) { const t = (performance.now() - G.pulse.t0) / 1400; if (t < 1) { cx.globalAlpha = 1 - t; cx.lineWidth = 3; cx.beginPath(); cx.arc(x, y, CELL * (.5 + t * 1.3), 0, Math.PI * 2); cx.stroke(); cx.globalAlpha = 1; } }
    }
    if (b.ko && (!G.over || G.mode === 'tutorial')) { const [x, y] = xy(b.ko); cx.strokeStyle = '#d22'; cx.lineWidth = 3; const s = CELL * .27; cx.strokeRect(x - s, y - s, 2 * s, 2 * s); }
    if (G.tutHint) G.tutHint.forEach(p => { const [x, y] = xy(p); cx.fillStyle = 'rgba(47,123,255,.75)'; cx.beginPath(); cx.arc(x, y, CELL * .3, 0, Math.PI * 2); cx.fill(); });
    if (G.hints) G.hints.forEach((h, i) => {
      const [x, y] = xy(h.m);
      cx.fillStyle = ['rgba(40,160,70,.85)', 'rgba(40,120,200,.8)', 'rgba(200,140,30,.8)'][i]; cx.beginPath(); cx.arc(x, y, CELL * .42, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#fff'; cx.font = `bold ${CELL * .32}px sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      if (h.wr === null || h.wr === undefined) { cx.fillText('★', x, y); return; }
      cx.fillText('ABC'[i], x, y - CELL * .1); cx.font = `${CELL * .22}px sans-serif`; cx.fillText((h.wr * 100).toFixed(0) + '%', x, y + CELL * .18);
    });
    if (hover && !G.over && !G.scoring && !G.thinking && b.toPlay === G.human && b.col[hover] === 0) { const [x, y] = xy(hover); stone(x, y, G.human, .45); }
  }
  function pointAt(e) {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const c = Math.round((x - M) / CELL), rr = Math.round((y - M) / CELL);
    if (c < 0 || rr < 0 || c >= G.n || rr >= G.n) return 0;
    return G.b.pt(rr, c);
  }

  // ---------- 복기 · 대국 후 분석 ----------
  const review = {
    len: () => G ? G.rec.length : 0,
    moves: () => G ? G.rec.map((r, i) => ({ txt: r.txt, h: r.h, side: r.c === 1 ? 0 : 1, no: i + 1, lab: String(i + 1) })) : [],
    show(k, best) {
      if (!G) return;
      if (!G.finalB) G.finalB = G.b;
      G.reviewK = k >= G.rec.length ? null : k;
      G.b = k >= G.rec.length ? G.finalB : Board.fromState(G.rec[k].st);
      G.hints = best ? [{ m: best, wr: null }] : null;
      G.pulse = null; G.showOwn = false;
      render();
    },
    jobs() {
      if (G.n > 13) return { src: 'srcGo', list: [], parallel: 1, skip: '19줄 바둑은 분석 시간이 너무 길어 복기만 제공해요.' };
      const need = new Set();
      G.rec.forEach((r, i) => { if (r.h) { need.add(i); need.add(i + 1); } });
      const states = k => k < G.rec.length ? G.rec[k].st : (G.finalB || G.b).state();
      const opts = { maxSims: G.n <= 9 ? 900 : 700, time: 9000, komi: G.komi, cap: 500000 };
      const list = [...need].sort((a, b) => a - b).map(k => ({ idx: k, msg: { state: states(k), opts }, local: () => search(Board.fromState(states(k)), Object.assign({}, opts, { maxSims: 300 })) }));
      return { src: 'srcGo', list, parallel: Math.max(1, Math.min(4, MAXW)) };
    },
    judge(jobs, results) {
      const wr = {}, top = {};
      jobs.list.forEach((j, n) => {
        const r = results[n]; if (!r || !Array.isArray(r.children)) return;
        const ch = r.children.filter(c => c.n > 0).sort((a, b) => b.n - a.n);
        if (!ch.length) return;
        wr[j.idx] = ch[0].w / ch[0].n; top[j.idx] = ch[0].m;
      });
      const res = {};
      G.rec.forEach((r, i) => {
        if (!r.h || wr[i] === undefined || wr[i + 1] === undefined) return;
        const loss = Math.max(0, wr[i] - (1 - wr[i + 1]));
        const best = top[i] && top[i] !== r.p ? top[i] : 0;
        res[i] = { decided: wr[i] < 0.06 || wr[i] > 0.94, loss, cls: Adapt.classify(loss, LEVELS.adapt.go), best, bestTxt: best ? name(best) : '', unit: 'wr' };
      });
      return res;
    }
  };
  return { start, destroy, review, resumeData, moveCount: () => G ? G.moves.length : 0, _g: () => G };
})();