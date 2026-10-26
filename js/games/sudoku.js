// ======================= 스도쿠 (튜토리얼 · 교육 · 대련) =======================
const SudokuGame = (() => {
  const SE = SudokuEngine;
  let G = null, timer = 0, keyH = null;

  function start(o) {
    let pz;
    if (o.mode === 'tutorial') {
      const L = LESSONS.sudoku[o.lesson];
      if (L.gen) pz = SE.generate(L.gen);
      else { const sol = L.sol.split('').map(Number), p = sol.slice(); L.blanks.forEach(k => p[k] = 0); pz = { n: L.n, puzzle: p, solution: sol, tech: 1 }; }
    } else if (o.resume) pz = Resume.sudokuPuzzle(o.resume);
    else pz = SE.generate(o.level, typeof SUDOKU_BANK !== 'undefined' ? SUDOKU_BANK : null);
    const n = pz.n, geo = SE.geo(n), match = o.mode === 'match';
    G = { o, n, geo, mode: o.mode, given: pz.puzzle.map(v => !!v), val: pz.puzzle.slice(), sol: pz.solution, memo: new Array(n * n).fill(0),
          sel: -1, memoMode: false, check: !match, mistakes: 0, hints: 0, hintTechs: [], hintState: null,
          undo: [], t0: Date.now(), over: false, tech: pz.tech, popCell: -1, targets: o.mode === 'tutorial' ? pz.puzzle.map((v, i) => v ? -1 : i).filter(i => i >= 0) : [] };
    G.st = { inputs: 0, memo: 0, mistakes: 0, sec: 0, hints: 0 };
    if (o.resume) {
      const r = o.resume, ok = a => Array.isArray(a) && a.length === n * n && a.every(v => Number.isInteger(v) && v >= 0);
      if (!ok(r.val) || !ok(r.memo)) throw new Error('저장 데이터 형식 오류');
      G.val = r.val.map((v, i) => G.given[i] ? pz.puzzle[i] : Math.min(n, v)); G.memo = r.memo.slice();
      G.mistakes = Store.count(r.mistakes, 10000); G.hints = Store.count(r.hints, 10000); G.t0 = Date.now() - Store.count(r.sec, 864000) * 1000;
      G.hintTechs = Array.isArray(r.hintTechs) ? r.hintTechs.filter(t => typeof t === 'string').slice(0, 10) : [];
      if (r.st && typeof r.st === 'object') Object.keys(G.st).forEach(k => { G.st[k] = Store.count(r.st[k]); });
    }
    const host = $('boardHost');
    const grid = document.createElement('div'); grid.className = 'sgrid'; grid.id = 'sgrid';
    host.insertBefore(grid, host.firstChild);
    grid.addEventListener('click', e => { const c = e.target.closest('.scell'); if (c) select(+c.dataset.i); });
    const nums = Array.from({ length: n }, (_, i) => `<button data-n="${i + 1}">${i + 1}</button>`).join('');
    $('gExtra').innerHTML = `<div class="card" style="padding:10px 12px">
      <div class="npad" id="sdPad" style="grid-template-columns:repeat(${n <= 6 ? n : 5},1fr)">${nums}<button data-n="0" title="지우기">⌫</button></div>
      <div class="tog" style="margin-top:8px"><button id="sdMemo">✏️ 메모 모드</button>${match ? '' : '<button id="sdChk">✔ 틀린 숫자 표시</button>'}</div>
      <div class="wrl" style="margin-top:8px"><span id="sdTime">00:00</span><span id="sdMis"></span></div></div>`;
    $('sdPad').onclick = e => { const b = e.target.closest('button'); if (b) input(+b.dataset.n); };
    $('sdMemo').onclick = () => { G.memoMode = !G.memoMode; paintTog(); update(); };
    if (!match) $('sdChk').onclick = () => { G.check = !G.check; paintTog(); render(); };
    if (o.mode === 'tutorial') Shell.buttons([{ id: 'sdHint', label: '💡 힌트', cls: 'green', on: hint }, { id: 'sdUndo', label: '되돌리기', on: undo }, { id: 'sdList', label: '목록으로', on: () => Shell.close() }]);
    else if (o.mode === 'train') Shell.buttons([{ id: 'sdHint', label: '💡 힌트', cls: 'green', on: hint }, { id: 'sdUndo', label: '되돌리기', on: undo }, { id: 'sdGive', label: '포기', cls: 'danger', on: giveUp }]);
    else Shell.buttons([{ id: 'sdUndo', label: '되돌리기', on: undo }, { id: 'sdGive', label: '포기', cls: 'danger', on: giveUp }]);
    keyH = e => {
      if (!G || G.over || !$('modal').classList.contains('hidden')) return;
      const k = e.key;
      if (/^[1-9]$/.test(k) && +k <= n) { input(+k); e.preventDefault(); }
      else if (k === 'Backspace' || k === 'Delete' || k === '0') { input(0); e.preventDefault(); }
      else if (k === 'm' || k === 'M') { G.memoMode = !G.memoMode; paintTog(); update(); }
      else if (k.startsWith('Arrow') && G.sel >= 0) {
        let r = Math.floor(G.sel / n), c = G.sel % n;
        if (k === 'ArrowUp') r = (r + n - 1) % n; if (k === 'ArrowDown') r = (r + 1) % n;
        if (k === 'ArrowLeft') c = (c + n - 1) % n; if (k === 'ArrowRight') c = (c + 1) % n;
        select(r * n + c); e.preventDefault();
      }
    };
    document.addEventListener('keydown', keyH);
    clearInterval(timer); timer = setInterval(tickTime, 500);
    window.addEventListener('resize', render);
    if (o.mode === 'train') Shell.coach('틀린 숫자는 빨갛게 표시돼요. 막히면 <b>💡 힌트</b>를 누르면 어디를 볼지부터 차근차근 알려줘요.');
    paintTog(); render(); update();
    Shell.info(`칸을 고르고 숫자를 누르세요 (키보드 1~${n}, 방향키, M=메모)`);
  }
  function destroy() { clearInterval(timer); document.removeEventListener('keydown', keyH); window.removeEventListener('resize', render); G = null; }
  function secs() { return Math.floor((Date.now() - G.t0) / 1000); }
  function tickTime() { if (!G || G.over) return; const s = secs(); $('sdTime').textContent = `⏱ ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  function paintTog() { $('sdMemo').classList.toggle('on', G.memoMode); if ($('sdChk')) $('sdChk').classList.toggle('on', G.check); }
  function select(i) { if (!G || G.over) return; G.sel = i; render(); }
  function input(d) {
    if (!G || G.over || G.sel < 0 || G.given[G.sel]) return;
    const i = G.sel;
    G.undo.push({ i, v: G.val[i], m: G.memo[i], memoAll: null });
    if (d && G.st) { G.st.inputs++; if (G.memoMode && !G.val[i]) G.st.memo++; }
    if (d === 0) { G.val[i] = 0; G.memo[i] = 0; }
    else if (G.memoMode && !G.val[i]) G.memo[i] ^= (1 << d);
    else if (G.val[i] === d) G.val[i] = 0;
    else {
      G.val[i] = d; G.memo[i] = 0; G.popCell = i;
      G.undo[G.undo.length - 1].memoAll = G.geo.peers[i].map(p => [p, G.memo[p]]);
      G.geo.peers[i].forEach(p => G.memo[p] &= ~(1 << d));
      if (d !== G.sol[i]) { G.mistakes++; if (G.check) { Shell.toast('앗, 다른 숫자예요', '같은 줄·상자를 다시 확인해 보세요', 'warn'); Sound.play('err'); } else Sound.play('tick'); }
      else Sound.play('tick');
    }
    G.hintState = null;
    render(); update();
    if (G.val.every((v, k) => v === G.sol[k])) { finish(true); return; }
    Shell.autosave();
    if (G.mode === 'match' && G.val.every(v => v)) Shell.toast('틀린 칸이 있어요', '다 채웠지만 맞지 않는 숫자가 있어요', 'warn');
  }
  function undo() {
    if (!G || G.over || !G.undo.length) return;
    const u = G.undo.pop();
    G.val[u.i] = u.v; G.memo[u.i] = u.m;
    if (u.memoAll) u.memoAll.forEach(([p, m]) => G.memo[p] = m);
    G.sel = u.i; render(); update(); Shell.autosave();
  }
  // 3단계 힌트
  function hint() {
    if (!G || G.over) return;
    const n = G.n;
    const wrong = G.val.findIndex((v, i) => v && !G.given[i] && v !== G.sol[i]);
    if (wrong >= 0) { G.hintState = { stage: 2, cell: wrong }; G.sel = wrong; Shell.coach('💡 <b>이 칸의 숫자가 맞지 않아요.</b> 같은 가로줄·세로줄·상자를 다시 확인해 보세요.'); render(); return; }
    const hs = G.hintState;
    if (!hs || hs.stage === 0) {
      const st = SE.hint(G.val, n);
      if (!st) { Shell.coach('지금 판에서는 논리로 바로 정해지는 칸을 찾지 못했어요.'); return; }
      G.hints++;
      const tn = SE.TECH[st.tech];
      [tn].concat((st.notes || []).map(x => SE.TECH[x.tech])).forEach(t => { if (G.hintTechs.indexOf(t) < 0) G.hintTechs.push(t); });
      let area, msg;
      if (st.tech === 2) { area = G.geo.units[st.unit]; msg = `초록색 <b>${unitName(st.unit)}</b>을 보세요. 숫자 <b>${st.val}</b>이(가) 들어갈 수 있는 칸이 딱 한 곳뿐이에요.`; }
      else { area = G.geo.boxes[G.geo.boxOf[st.cell]]; msg = `초록색 <b>상자</b>를 보세요. 들어갈 수 있는 숫자가 <b>하나뿐인 칸</b>이 있어요.`; }
      if (st.notes && st.notes.length) msg = `먼저 후보를 정리해야 해요: ${st.notes.map(x => x.desc).join(' ')}<br>` + msg;
      G.hintState = { stage: 1, st, area };
      Shell.coach(`<b>힌트 1/3 · ${tn}</b><br>${msg}`);
    } else if (hs.stage === 1) {
      const st = hs.st;
      let why;
      if (st.tech === 2) why = `${unitName(st.unit)}의 다른 빈칸에는 ${st.val}이(가) 같은 줄이나 상자에 이미 있어서 못 들어가요.`;
      else { const seen = new Set(); G.geo.peers[st.cell].forEach(p => { if (G.val[p]) seen.add(G.val[p]); }); why = `이 칸의 가로줄·세로줄·상자에 이미 ${[...seen].sort().join(', ')}이(가) 있어서 남은 숫자는 ${st.val}뿐이에요.`; }
      hs.stage = 2; hs.cell = st.cell; G.sel = st.cell;
      Shell.coach(`<b>힌트 2/3 · 이 칸이에요</b><br>진한 초록 칸! ${why}`);
    } else if (hs.stage === 2 && hs.st) {
      G.sel = hs.st.cell; const v = hs.st.val; G.hintState = null; G.memoMode = false; paintTog();
      Shell.coach(`<b>힌트 3/3</b> · ${v}을(를) 채웠어요.`); input(v); return;
    }
    render();
  }
  function unitName(ui) { const n = G.n; return ui < n ? `${ui + 1}번째 가로줄` : ui < 2 * n ? `${ui - n + 1}번째 세로줄` : `${ui - 2 * n + 1}번째 상자`; }
  async function giveUp() {
    if (!G || G.over) return;
    const myG = G;
    if (!(await Modal.ask('포기할까요?', '정답을 보여주고 "포기"로 기록돼요.', '포기하기', true)) || myG !== G || G.over) return;
    const filled = G.val.filter((v, i) => !G.given[i] && v === G.sol[i]).length, total = G.given.filter(x => !x).length;
    G.reveal = true; G.val = G.sol.slice(); finish(false, filled, total);
  }
  function finish(ok, filled, total) {
    G.over = true; clearInterval(timer); G.sel = -1; G.hintState = null; render(); update();
    if (G.mode === 'tutorial') { Tutorial.pass('sudoku', G.o.lesson, `모든 칸을 맞게 채웠어요! (실수 ${G.mistakes}번 · 힌트 ${G.hints}번)`); return; }
    const s = secs(), t = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    Object.assign(G.st, { mistakes: G.mistakes, sec: s, hints: G.hints });
    Shell.finish(ok ? 'win' : 'loss', ok ? `완성 ${t}` : `포기 (${t})`, { style: G.st, moves: 0, sec: s, hints: G.hints, mistakes: G.mistakes, techName: SE.TECH[G.tech] || '고급 기술', hintTechs: G.hintTechs, n: G.n, filled, total });
  }
  function update() {
    if (!G) return;
    if (G.over) Shell.status(G.reveal ? '정답 공개' : '🎉 완성!');
    else Shell.status(G.memoMode ? '✏️ 메모 모드 — 후보 숫자를 적어요' : (G.mode === 'tutorial' ? '👉 파란 테두리 칸을 채워 보세요' : '👉 빈칸을 채워 보세요'), 'me');
    $('sdMis').textContent = G.check ? `실수 ${G.mistakes}` : '';
    $('sdUndo').disabled = G.over || !G.undo.length;
    if ($('sdHint')) $('sdHint').disabled = G.over;
    if ($('sdGive')) $('sdGive').disabled = G.over;
    const cnt = new Array(G.n + 1).fill(0); G.val.forEach((v, i) => { if (v && v === G.sol[i]) cnt[v]++; });
    document.querySelectorAll('#sdPad button').forEach(b => { const d = +b.dataset.n; b.classList.toggle('done', d > 0 && cnt[d] >= G.n); });
  }
  function render() {
    if (!G) return;
    const n = G.n, geo = G.geo, grid = $('sgrid'); if (!grid) return;
    const px = Math.min(boardPx(1), n <= 6 ? 480 : 640), cell = Math.floor((px - 8) / n);
    grid.style.gridTemplateColumns = `repeat(${n}, ${cell}px)`;
    const selV = G.sel >= 0 ? G.val[G.sel] : 0, peers = G.sel >= 0 ? new Set(geo.peers[G.sel]) : new Set();
    const hs = G.hintState, area = hs && hs.stage === 1 ? new Set(hs.area) : null, hcell = hs && hs.stage === 2 ? hs.cell : -1;
    const tg = new Set(G.targets);
    let h = '';
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, v = G.val[i], cls = ['scell'];
      if (G.given[i]) cls.push('given'); else if (v) cls.push('user');
      if (peers.has(i)) cls.push('peer');
      if (selV && v === selV && i !== G.sel) cls.push('same');
      if (i === G.sel) cls.push('sel');
      if (v && !G.given[i] && v !== G.sol[i] && (G.check || i === hcell)) cls.push('bad');
      if (area && area.has(i)) cls.push('hintu');
      if (i === hcell) cls.push('hintc');
      if (tg.has(i) && !G.over) cls.push('target');
      if (i === G.popCell) cls.push('pop');
      const bt = r % geo.br === 0 ? 3 : 1, bl = c % geo.bc === 0 ? 3 : 1, bb = r === n - 1 ? 3 : 0, br = c === n - 1 ? 3 : 0;
      const style = `width:${cell}px;height:${cell}px;font-size:${Math.floor(cell * .56)}px;border-top:${bt}px solid #2b3140;border-left:${bl}px solid #2b3140;border-bottom:${bb}px solid #2b3140;border-right:${br}px solid #2b3140;`;
      let inner = v ? v : '';
      if (!v && G.memo[i]) {
        const cols = n === 4 ? 2 : 3;
        inner = `<div class="memo" style="grid-template-columns:repeat(${cols},1fr);font-size:${Math.max(9, Math.floor(cell / (cols + 1.6)))}px">` + Array.from({ length: n }, (_, k) => `<span>${G.memo[i] & (1 << (k + 1)) ? k + 1 : ''}</span>`).join('') + '</div>';
      }
      h += `<div class="${cls.join(' ')}" data-i="${i}" style="${style}">${inner}</div>`;
    }
    grid.innerHTML = h; G.popCell = -1;
  }
  function resumeData() {
    if (!G || G.mode === 'tutorial' || G.over) return null;
    return { o: { mode: G.o.mode, level: G.o.level }, pz: { n: G.n, puzzle: G.val.map((v, i) => G.given[i] ? v : 0), solution: G.sol.slice(), tech: G.tech },
      val: G.val.slice(), memo: G.memo.slice(), sec: secs(), mistakes: G.mistakes, hints: G.hints, hintTechs: G.hintTechs.slice(), st: Object.assign({}, G.st), moves: G.val.filter((v, i) => v && !G.given[i]).length };
  }
  return { start, destroy, resumeData, moveCount: () => G ? G.undo.length : 0, _g: () => G };
})();

App.init();