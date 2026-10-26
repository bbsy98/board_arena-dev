// ======================= 공통: 계정 · 저장소 · 홈 · 확인창 · 셸 · 튜토리얼 · 피드백 =======================
const $ = id => document.getElementById(id);
const GAMES = ['janggi', 'chess', 'go', 'sudoku'];
const GAME_NAME = { go: '바둑', chess: '체스', janggi: '장기', sudoku: '스도쿠' };
const GAME_ICON = { janggi: '🀄', chess: '♟️', go: '⚫⚪', sudoku: '🔢' };
const GAME_BG = { janggi: '將', chess: '♞', go: '⚫', sudoku: '#' };
const MODE_NAME_N = { tutorial: '튜토리얼', train: '교육', match: '대련' };
const MODE_NAME_K = { tutorial: '배우기', train: '연습하기', match: '겨루기' };
const isKid = () => { const u = Store.cur(); return !!(u && u.prefs.ui === 'kid'); };
const mn = m => (isKid() ? MODE_NAME_K : MODE_NAME_N)[m];
const RES_LABEL = { win: '승리', loss: '패배', draw: '무승부' };
const resLabel = (g, r, mode) => mode === 'tutorial' ? '완료' : g === 'sudoku' ? (r === 'win' ? '완성' : '포기') : RES_LABEL[r];
// 받침이 ㄹ이면 '로'(예: 졸로), 그 외 받침이 있으면 '으로'
const roJosa = w => { const c = String(w).charCodeAt(String(w).length - 1) - 0xAC00, j = c >= 0 && c < 11172 ? c % 28 : 0; return w + (j && j !== 8 ? '으로' : '로'); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 안전한 저장소 (막혀 있으면 메모리로 대체) ----------
const SafeStore = (() => {
  const mem = {};
  function test(kind) { try { const s = window[kind], k = '__t'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return null; } }
  const local = test('localStorage'), sess = test('sessionStorage');
  const wrap = s => ({ get: k => { try { return s ? s.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return mem[k] || null; } },
    set: (k, v) => { try { if (s) s.setItem(k, v); else mem[k] = v; return true; } catch (e) { mem[k] = v; return false; } },
    del: k => { try { if (s) s.removeItem(k); } catch (e) {} delete mem[k]; } });
  return { local: wrap(local), sess: wrap(sess), persistent: !!local };
})();

// ---------- 저장소 ----------
const Store = {
  KEY: 'boardArena.v3', data: null,
  // Stored data and imported backups are user-controlled input. Normalize every
  // nested object before the UI interpolates values into HTML.
  object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; },
  count(value, max = 1000000000) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
  },
  level(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(1, Math.min(10, Math.round(n))) : fallback;
  },
  load() {
    let parsed = null;
    try { parsed = JSON.parse(SafeStore.local.get(this.KEY) || 'null'); } catch (e) { console.warn('한수 저장 데이터 파싱 실패; 안전한 빈 저장소로 시작합니다.', e); }
    const root = this.object(parsed);
    const users = this.object(root.users);
    const safeUsers = {};
    Object.keys(users).forEach(key => {
      if (!/^[a-z0-9]{4,16}$/.test(key)) return;
      const user = users[key];
      if (!user || typeof user !== 'object' || Array.isArray(user)) return;
      safeUsers[key] = this.migrate(user);
    });
    const fails = this.object(root.fails), safeFails = {};
    Object.keys(fails).filter(k => /^[a-z0-9]{4,16}$/.test(k)).forEach(k => {
      const f = this.object(fails[k]);
      safeFails[k] = { n: this.count(f.n, 5), until: this.count(f.until, 8640000000000000) };
    });
    this.data = { users: safeUsers, session: typeof root.session === 'string' && /^[a-z0-9]{4,16}$/.test(root.session) ? root.session : null, fails: safeFails };
    // A stale or malformed session must never prevent the login screen loading.
    if (this.data.session && !this.data.users[this.data.session]) this.data.session = null;
    Object.keys(this.data.users).forEach(k => this.data.users[k] = this.migrate(this.data.users[k]));
  },
  migrate(u) {
    u = this.object(u);
    u.id = typeof u.id === 'string' && /^[A-Za-z0-9]{4,16}$/.test(u.id) ? u.id : 'user';
    u.nick = typeof u.nick === 'string' && u.nick.trim() ? u.nick.trim().slice(0, 12) : u.id;
    u.prefs = this.object(u.prefs);
    u.prefs.ui = u.prefs.ui === 'kid' ? 'kid' : 'normal';
    u.prefs.sound = u.prefs.sound !== false;
    u.prefs.notify = ['all', 'key', 'off'].includes(u.prefs.notify) ? u.prefs.notify : 'all';
    u.prefs.aiSpeed = ['fast', 'normal', 'slow'].includes(u.prefs.aiSpeed) ? u.prefs.aiSpeed : 'normal';
    u.prefs.match = this.object(u.prefs.match); u.prefs.train = this.object(u.prefs.train);
    u.stats = this.object(u.stats); u.tut = this.object(u.tut); u.style = this.object(u.style);
    GAMES.forEach(g => {
      u.prefs.match[g] = this.level(u.prefs.match[g], g === 'sudoku' ? 3 : 2);
      u.prefs.train[g] = this.level(u.prefs.train[g], 1);
      const raw = this.object(u.stats[g]);
      const match = this.object(raw.match), train = this.object(raw.train);
      u.stats[g] = {
        match: { w: this.count(match.w), l: this.count(match.l), d: this.count(match.d), best: this.level(match.best, 1) },
        train: { w: this.count(train.w), l: this.count(train.l), d: this.count(train.d) }
      };
      if (!this.count(match.best, 10)) u.stats[g].match.best = 0;
      const lessons = Array.isArray(u.tut[g]) ? u.tut[g] : [];
      const maxLessons = Array.isArray(LESSONS[g]) ? LESSONS[g].length : 100;
      u.tut[g] = [...new Set(lessons.filter(x => (typeof x === 'number' || (typeof x === 'string' && x.trim() !== '')) && Number.isInteger(Number(x)) && Number(x) >= 0 && Number(x) < maxLessons).map(Number))];
      const a = this.object(u.style[g]);
      const cleanStyle = {};
      ['games','moves','caps','checks','adv','think','thinkN','warns','heeded','hints','inputs','memo','mistakes','sec','l3','l4','castled','castleMove','earlyQ'].forEach(k => { cleanStyle[k] = this.count(a[k]); });
      ['use','pat'].forEach(k => {
        const map = this.object(a[k]), clean = {};
        Object.keys(map).slice(0, 40).forEach(key => { if (/^[A-Za-z0-9가-힣_-]{1,24}$/.test(key)) clean[key] = this.count(map[key]); });
        cleanStyle[k] = clean;
      });
      u.style[g] = cleanStyle;
    });
    const logs = Array.isArray(u.log) ? u.log : [];
    u.log = logs.slice(0, 300).filter(e => {
      if (!e || typeof e !== 'object' || !GAMES.includes(e.game) || !['tutorial','train','match'].includes(e.mode) || !['win','loss','draw'].includes(e.result)) return false;
      return true;
    }).map(e => ({
      game: e.game, mode: e.mode, result: e.result,
      date: this.count(e.date, 8640000000000000) || Date.now(),
      level: this.level(e.level, 1), endLevel: this.level(e.endLevel, this.level(e.level, 1)),
      reason: typeof e.reason === 'string' ? e.reason.slice(0, 300) : '',
      moves: this.count(e.moves, 100000), hints: this.count(e.hints, 100000), warns: this.count(e.warns, 100000),
      ...(e.acc !== undefined && e.acc !== null ? { acc: this.count(e.acc, 100), bl: this.count(e.bl, 10000), sl: this.count(e.sl, 10000) } : {})
    }));
    const rs = this.object(u.resume), cleanR = {};
    GAMES.forEach(g => {
      const r = rs[g];
      if (!r || typeof r !== 'object' || Array.isArray(r) || !r.o || typeof r.o !== 'object') return;
      if (!['train', 'match'].includes(r.o.mode)) return;
      if (g !== 'sudoku' && (!Array.isArray(r.moves) || r.moves.length > 3000 || !r.moves.every(Number.isInteger))) return;
      if (g === 'sudoku' && (!r.pz || typeof r.pz !== 'object')) return;
      cleanR[g] = Object.assign({}, r, { o: Resume.cleanOpts(g, r.o), ts: this.count(r.ts, 8640000000000000) || Date.now() });
    });
    u.resume = cleanR;
    const rt = this.object(u.rating), cleanRt = {};
    GAMES.forEach(g => { const r = this.object(rt[g]); if (Number.isFinite(Number(r.r))) cleanRt[g] = { r: Math.max(100, Math.min(3000, Math.round(Number(r.r)))), n: this.count(r.n, 1000000) }; });
    u.rating = cleanRt;
    const ach = this.object(u.ach), cleanAch = {};
    ACH.forEach(a => { if (ach[a.id]) cleanAch[a.id] = this.count(ach[a.id], 8640000000000000) || 1; });
    u.ach = cleanAch;
    u.created = this.count(u.created, 8640000000000000) || Date.now();
    u.lastBackup = this.count(u.lastBackup, 8640000000000000);
    u.salt = typeof u.salt === 'string' && /^[0-9a-f]{32}$/i.test(u.salt) ? u.salt.toLowerCase() : null;
    u.hash = typeof u.hash === 'string' && /^[0-9a-f]{64}$/i.test(u.hash) ? u.hash.toLowerCase() : null;
    return u;
  },
  save() { try { return SafeStore.local.set(this.KEY, JSON.stringify(this.data)); } catch (e) { return false; } },
  sessionId() {
    const tabId = SafeStore.sess.get('boardArena.session');
    if (tabId && this.data.users[tabId]) return tabId;
    if (tabId) SafeStore.sess.del('boardArena.session');
    return this.data.session && this.data.users[this.data.session] ? this.data.session : null;
  },
  setSession(id, keep) {
    if (keep) {
      this.data.session = id;
      // A stale tab-only session must not override the newly selected persistent login.
      SafeStore.sess.del('boardArena.session');
    } else {
      this.data.session = null;
      SafeStore.sess.set('boardArena.session', id);
    }
    this.save();
  },
  clearSession() { this.data.session = null; SafeStore.sess.del('boardArena.session'); this.save(); },
  cur() { const id = this.sessionId(); return id && this.data.users[id] ? this.data.users[id] : null; },
  record(game, mode, result, entry) {
    const u = this.cur(); if (!u) return null;
    // 튜토리얼 완료는 승패 통계가 없으므로 기록(log)에만 남김 (v0.7.0: 여기서 오류가 나 완료 화면이 안 뜨던 문제)
    const s = u.stats[game] && u.stats[game][mode] ? u.stats[game][mode] : null, k = result === 'win' ? 'w' : result === 'loss' ? 'l' : 'd';
    if (s) {
      s[k]++;
      if (mode === 'match' && result === 'win' && entry.level > (s.best || 0)) s.best = entry.level;
    }
    u.log.unshift(Object.assign({ game, mode, result, date: Date.now() }, entry));
    if (u.log.length > 300) u.log.length = 300;
    this.save();
    return s;
  },
  recent(game, mode, level, n) { const u = this.cur(); if (!u) return []; return u.log.filter(e => e.game === game && e.mode === mode && e.level === level).slice(0, n).map(e => e.result); }
};

// ---------- 진행 중인 대국 저장 · 이어하기 (계정별 · 게임별 1개) ----------
const JANGGI_PATS = ['마상마상', '상마상마', '마상상마', '상마마상'];
const Resume = {
  get(g) { const u = Store.cur(); return u && u.resume && u.resume[g] ? u.resume[g] : null; },
  put(g, d) { const u = Store.cur(); if (!u) return; u.resume = u.resume || {}; d.ts = Date.now(); u.resume[g] = d; Store.save(); },
  clear(g) { const u = Store.cur(); if (u && u.resume && u.resume[g]) { delete u.resume[g]; Store.save(); } },
  count(r) { return Array.isArray(r.moves) ? r.moves.length : Store.count(r.moves, 1000); },
  ago(ts) {
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`;
  },
  commonData(G) {
    return {
      ad: G.mode === 'train' ? { lvf: G.lvf, lvNow: G.lvNow, lvPath: G.lvPath.slice(-40), quality: Object.assign({}, G.quality) } : null,
      ctr: { hints: G.hintCount !== undefined ? G.hintCount : G.hints, warns: G.warns, heeded: G.heeded, undos: G.undos },
      st: G.st
    };
  },
  restoreCommon(G, r) {
    const n = v => Store.count(v, 100000);
    if (G.mode === 'train' && r.ad && typeof r.ad === 'object') {
      const lvf = Number(r.ad.lvf);
      G.lvf = Number.isFinite(lvf) ? Math.max(1, Math.min(10, lvf)) : G.lvf;
      G.lvNow = Store.level(r.ad.lvNow, Math.round(G.lvf));
      G.lvPath = Array.isArray(r.ad.lvPath) && r.ad.lvPath.length ? r.ad.lvPath.slice(-40).map(x => Store.level(x, G.lvNow)) : [G.lvNow];
      const q = r.ad.quality && typeof r.ad.quality === 'object' ? r.ad.quality : {};
      G.quality = { good: n(q.good), ok: n(q.ok), slip: n(q.slip), blunder: n(q.blunder) };
      Adapt.paint(G);
    }
    const c = r.ctr && typeof r.ctr === 'object' ? r.ctr : {};
    if (G.hintCount !== undefined) G.hintCount = n(c.hints); else G.hints = n(c.hints);
    G.warns = n(c.warns); G.heeded = n(c.heeded); G.undos = n(c.undos);
    if (r.st && typeof r.st === 'object') Object.keys(r.st).forEach(k => {
      const v = r.st[k];
      if (typeof v === 'number' && k in G.st) G.st[k] = n(v);
      else if (v && typeof v === 'object' && G.st[k] && typeof G.st[k] === 'object') Object.keys(v).slice(0, 40).forEach(kk => { if (/^[A-Za-z0-9가-힣_-]{1,24}$/.test(kk)) G.st[k][kk] = n(v[kk]); });
    });
    if (typeof r.prevEval === 'number' && Number.isFinite(r.prevEval)) G.prevEval = r.prevEval;
  },
  sudokuPuzzle(r) {
    const pz = r && r.pz, n = pz && pz.n;
    if (![4, 6, 9].includes(n)) throw new Error('저장된 퍼즐 형식 오류');
    const okArr = (a, lo) => Array.isArray(a) && a.length === n * n && a.every(v => Number.isInteger(v) && v >= lo && v <= n);
    if (!okArr(pz.puzzle, 0) || !okArr(pz.solution, 1)) throw new Error('저장된 퍼즐 형식 오류');
    const geo = SudokuEngine.geo(n);
    geo.units.forEach(u => { if (new Set(u.map(i => pz.solution[i])).size !== n) throw new Error('저장된 퍼즐 정답 오류'); });
    pz.puzzle.forEach((v, i) => { if (v && v !== pz.solution[i]) throw new Error('저장된 퍼즐 정답 오류'); });
    return { n, puzzle: pz.puzzle.slice(), solution: pz.solution.slice(), tech: Store.count(pz.tech, 99) };
  },
  cleanOpts(g, o) {
    const out = { mode: o.mode === 'train' ? 'train' : 'match', level: Store.level(o.level, 1) };
    if (g === 'chess') out.human = Number(o.human) === 8 ? 8 : 0;
    if (g === 'janggi') {
      out.human = Number(o.human) === 1 ? 1 : 0; out.bik = o.bik === 'points' ? 'points' : 'draw';
      out.pat = JANGGI_PATS.includes(o.pat) ? o.pat : JANGGI_PATS[0]; out.aiPat = JANGGI_PATS.includes(o.aiPat) ? o.aiPat : 'rand';
    }
    if (g === 'go') {
      out.size = [9, 13, 19].includes(Number(o.size)) ? Number(o.size) : 9; out.human = Number(o.human) === 2 ? 2 : 1;
      out.hcp = Math.max(0, Math.min(9, Store.count(o.hcp, 9))); if (out.hcp === 1) out.hcp = 0;
      out.komi = ['7.5', '6.5', '0.5'].includes(String(o.komi)) ? String(o.komi) : 'auto';
    }
    return out;
  }
};
// ---------- 순수 JS SHA-256 · HMAC · PBKDF2 (WebCrypto가 막힌 환경용, 결과는 동일) ----------
const toHex = a => Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
const _K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256(msg) {
  const l = msg.length, nb = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(nb); m.set(msg); m[l] = 0x80;
  const bl = l * 8; m[nb - 4] = bl >>> 24; m[nb - 3] = bl >>> 16; m[nb - 2] = bl >>> 8; m[nb - 1] = bl;
  m[nb - 5] = Math.floor(bl / 4294967296);
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]), W = new Uint32Array(64);
  for (let o = 0; o < nb; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = (m[o + i * 4] << 24) | (m[o + i * 4 + 1] << 16) | (m[o + i * 4 + 2] << 8) | m[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) { const a = W[i - 15], b = W[i - 2]; W[i] = (((a >>> 7 | a << 25) ^ (a >>> 18 | a << 14) ^ (a >>> 3)) + W[i - 7] + ((b >>> 17 | b << 15) ^ (b >>> 19 | b << 13) ^ (b >>> 10)) + W[i - 16]) | 0; }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const t1 = (h + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + ((e & f) ^ (~e & g)) + _K[i] + W[i]) | 0;
      const t2 = (((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32); for (let i = 0; i < 8; i++) { out[i * 4] = H[i] >>> 24; out[i * 4 + 1] = H[i] >>> 16; out[i * 4 + 2] = H[i] >>> 8; out[i * 4 + 3] = H[i]; }
  return out;
}
function hmacSha256(key, data) {
  if (key.length > 64) key = sha256(key);
  const k = new Uint8Array(64); k.set(key);
  const ip = new Uint8Array(64 + data.length), op = new Uint8Array(96);
  for (let i = 0; i < 64; i++) { ip[i] = k[i] ^ 0x36; op[i] = k[i] ^ 0x5c; }
  ip.set(data, 64); op.set(sha256(ip), 64);
  return sha256(op);
}
function pbkdf2Sha256(pw, salt, iter) {
  const s1 = new Uint8Array(salt.length + 4); s1.set(salt); s1[salt.length + 3] = 1;
  let u = hmacSha256(pw, s1); const t = u.slice();
  for (let i = 1; i < iter; i++) { u = hmacSha256(pw, u); for (let j = 0; j < 32; j++) t[j] ^= u[j]; }
  return t;
}

// ---------- 계정 (비밀번호는 PBKDF2로 해시해서 저장) ----------
const Auth = {
  async hash(pw, saltHex) {
    if (typeof saltHex !== 'string' || !/^[0-9a-f]{32}$/i.test(saltHex)) throw new Error('계정의 비밀번호 정보가 손상됐어요. 백업 파일로 복원해 주세요.');
    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const pwb = new TextEncoder().encode(pw);
    try {
      if (window.crypto && crypto.subtle) {
        const key = await crypto.subtle.importKey('raw', pwb, 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
        return toHex(new Uint8Array(bits));
      }
    } catch (e) { /* 아래 대체 경로 사용 */ }
    await new Promise(r => setTimeout(r, 20));
    return toHex(pbkdf2Sha256(pwb, salt, 150000));
  },
  salt() {
    const a = new Uint8Array(16);
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') {
      throw new Error('안전한 난수 생성 기능을 사용할 수 없어요. 최신 브라우저 또는 HTTPS 환경에서 다시 시도해 주세요.');
    }
    window.crypto.getRandomValues(a);
    return toHex(a);
  },
  msg(t, ok) { const m = $('aMsg'); m.textContent = t; m.className = 'amsg' + (ok ? ' ok' : ''); },
  tab(which) {
    $('tabLogin').classList.toggle('on', which === 'login'); $('tabSignup').classList.toggle('on', which === 'signup');
    $('fLogin').classList.toggle('hidden', which !== 'login'); $('fSignup').classList.toggle('hidden', which !== 'signup');
    this.msg('');
    this.renderLocalAccounts();
    (which === 'login' ? $('liId') : $('suId')).focus();
  },
  renderLocalAccounts() {
    const box = $('localAccounts'), list = $('localAccountsList');
    if (!box || !list || !Store.data) return;
    list.replaceChildren();
    const users = Object.keys(Store.data.users || {}).map(key => ({ key, user: Store.data.users[key] }))
      .filter(item => item.user && typeof item.user.nick === 'string')
      .sort((a, b) => a.user.nick.localeCompare(b.user.nick, 'ko'));
    const show = !$('fLogin').classList.contains('hidden') && users.length > 0;
    box.classList.toggle('hidden', !show);
    if (!show) return;
    users.forEach(({ key, user }) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'local-account-item';
      button.setAttribute('aria-label', `${user.nick} 계정 ${user.id} 선택`);
      const avatar = document.createElement('span'); avatar.className = 'local-account-avatar'; avatar.textContent = (user.nick || user.id || '?').slice(0, 1);
      const label = document.createElement('span'); label.className = 'local-account-label';
      const nick = document.createElement('span'); nick.textContent = user.nick || user.id;
      const id = document.createElement('span'); id.className = 'local-account-id'; id.textContent = '@' + user.id;
      label.append(nick, id); button.append(avatar, label);
      button.addEventListener('click', () => { $('liId').value = user.id; $('liPw').value = ''; $('liPw').focus(); this.msg(''); });
      list.appendChild(button);
    });
  },
  init() {
    $('tabLogin').onclick = () => this.tab('login');
    $('tabSignup').onclick = () => this.tab('signup');
    $('fSignup').onsubmit = e => { e.preventDefault(); this.signup(); };
    $('fLogin').onsubmit = e => { e.preventDefault(); this.login(); };
    $('btnUi').onclick = () => Settings.open();
    $('btnBackup').onclick = () => Backup.export();
    $('btnRestore').onclick = () => Backup.pick();
    $('btnRestoreA').onclick = () => Backup.pick();
    $('bkFile').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) Backup.read(f); };
    $('btnLogout').onclick = async () => { if (await Modal.ask('로그아웃할까요?', '', '로그아웃')) { Store.clearSession(); App.show(); } };
  },
  async signup() {
    const id = $('suId').value.trim(), pw = $('suPw').value, pw2 = $('suPw2').value, nick = $('suNick').value.trim();
    if (!/^[A-Za-z0-9]{4,16}$/.test(id)) return this.msg('아이디는 영문·숫자 4~16자로 만들어 주세요.');
    if (pw.length < 6) return this.msg('비밀번호는 6자 이상이어야 해요.');
    if (pw !== pw2) return this.msg('비밀번호 확인이 일치하지 않아요.');
    if (!nick || nick.length > 12) return this.msg('닉네임을 1~12자로 입력해 주세요.');
    this.msg('계정을 만드는 중...', true);
    const key = id.toLowerCase();
    if (Store.data.users[key]) return this.msg('이미 사용 중인 아이디예요.');
    try {
      const salt = this.salt(), hash = await this.hash(pw, salt);
      const uiSel = document.querySelector('input[name=suUi]:checked');
      Store.data.users[key] = { id, nick, salt, hash, created: Date.now(), prefs: { ui: uiSel ? uiSel.value : 'normal' } };
      Store.migrate(Store.data.users[key]);
      Store.setSession(key, true);
      $('fSignup').reset(); App.show();
    } catch (e) { console.error(e); this.msg('계정을 만드는 중 오류가 났어요: ' + (e && e.message || e)); }
  },
  async login() {
    const id = $('liId').value.trim().toLowerCase(), pw = $('liPw').value, keep = $('liKeep').checked;
    if (!id || !pw) return this.msg('아이디와 비밀번호를 입력해 주세요.');
    this.msg('확인 중...', true);
    const f = Store.data.fails[id] || { n: 0, until: 0 };
    if (f.until > Date.now()) return this.msg(`로그인 시도가 너무 많아요. ${Math.ceil((f.until - Date.now()) / 1000)}초 뒤에 다시 시도해 주세요.`);
    const u = Store.data.users[id];
    let ok = false;
    try { ok = !!u && (await this.hash(pw, u.salt)) === u.hash; } catch (e) { console.error(e); return this.msg('로그인 중 오류가 났어요: ' + (e && e.message || e)); }
    if (!ok) {
      f.n++; if (f.n >= 5) { f.until = Date.now() + 60000; f.n = 0; }
      Store.data.fails[id] = f; Store.save();
      return this.msg('아이디 또는 비밀번호가 맞지 않아요.');
    }
    delete Store.data.fails[id];
    Store.setSession(id, keep);
    $('fLogin').reset(); $('liKeep').checked = true; App.show();
  }
};

// ---------- 백업 / 복원 ----------
const Backup = {
  VER: 1, MAX: 5 * 1024 * 1024,
  stamp(d) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; },
  games(u) { return GAMES.reduce((a, g) => { const s = u.stats[g]; return a + s.match.w + s.match.l + s.match.d + s.train.w + s.train.l + s.train.d; }, 0); },
  summary(u) {
    const tut = GAMES.reduce((a, g) => a + (u.tut[g] || []).length, 0);
    const last = u.log && u.log[0] ? new Date(u.log[0].date) : null;
    return `아이디 <b>@${esc(u.id)}</b> · 닉네임 <b>${esc(u.nick)}</b><br>대국·퍼즐 <b>${this.games(u)}판</b> · 튜토리얼 <b>${tut}개</b> 완료<br>마지막 기록: ${last ? last.toLocaleString('ko-KR') : '없음'}`;
  },
  export() {
    const u = Store.cur(); if (!u) return;
    const now = new Date();
    const data = { app: 'hansu', kind: 'backup', ver: this.VER, exported: now.toISOString(), user: JSON.parse(JSON.stringify(u)) };
    try {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `hansu_${u.id}_${this.stamp(now)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      u.lastBackup = Date.now(); Store.save(); Home.render();
      Modal.ask('💾 백업 파일을 저장했어요', `파일 이름: <b>${esc(a.download)}</b><br>다운로드 폴더를 확인해 주세요.<br><br>다른 PC·브라우저나 새 버전에서 <b>📂 불러오기</b>로 이어서 할 수 있어요.`, '확인', false, true);
    } catch (e) { console.error(e); Modal.ask('백업에 실패했어요', esc(e && e.message || e), '확인', false, true); }
  },
  notice(u) {
    const el = $('bkNotice'); if (!el) return;
    const n = this.games(u), old = !u.lastBackup || Date.now() - u.lastBackup > 7 * 864e5;
    if (n >= 3 && old) {
      el.innerHTML = `<div class="bknote"><span>💾 ${u.lastBackup ? '마지막 백업이 일주일 넘었어요.' : '아직 백업한 적이 없어요.'} 기록을 잃지 않게 백업해 두세요.</span><button class="primary" id="bkNow">지금 백업</button></div>`;
      $('bkNow').onclick = () => this.export();
    } else el.innerHTML = '';
  },
  pick() { $('bkFile').click(); },
  validate(d) {
    if (!d || typeof d !== 'object' || d.app !== 'hansu' || d.kind !== 'backup' || !d.user || typeof d.user !== 'object' || Array.isArray(d.user)) throw new Error('한수 백업 파일이 아니에요.');
    if (!Number.isInteger(Number(d.ver)) || Number(d.ver) > this.VER || Number(d.ver) < 1) throw new Error('지원하지 않는 백업 버전이에요.');
    const u = d.user;
    if (typeof u.id !== 'string' || !/^[A-Za-z0-9]{4,16}$/.test(u.id)) throw new Error('아이디 정보가 올바르지 않아요.');
    // A bad/missing password hash is handled as a password-reset restore, but
    // arbitrary nested data is never trusted by the UI.
    const hexSalt = typeof u.salt === 'string' && /^[0-9a-f]{32}$/i.test(u.salt);
    const hexHash = typeof u.hash === 'string' && /^[0-9a-f]{64}$/i.test(u.hash);
    const normalized = Object.assign({}, u, {
      id: u.id,
      nick: typeof u.nick === 'string' && u.nick.trim() ? u.nick.trim().slice(0, 12) : u.id,
      salt: hexSalt ? u.salt.toLowerCase() : null,
      hash: hexHash ? u.hash.toLowerCase() : null
    });
    return Store.migrate(normalized);
  },
  read(file) {
    if (file.size > this.MAX) { Modal.ask('불러올 수 없어요', '파일이 너무 커요. 한수 백업 파일이 맞는지 확인해 주세요.', '확인', false, true); return; }
    const r = new FileReader();
    r.onerror = () => Modal.ask('불러올 수 없어요', '파일을 읽지 못했어요.', '확인', false, true);
    r.onload = () => {
      let u;
      try { u = this.validate(JSON.parse(r.result)); }
      catch (e) { Modal.ask('불러올 수 없어요', esc(e instanceof SyntaxError ? '파일 형식이 올바르지 않아요.' : e.message), '확인', false, true); return; }
      this.confirm(u);
    };
    r.readAsText(file);
  },
  confirm(u) {
    const key = u.id.toLowerCase(), cur = Store.data.users[key];
    Store.migrate(u);
    const noPw = !u.hash;
    const m = $('modal');
    m.innerHTML = `<div class="mbox" style="width:min(440px,92vw)"><div class="mt">📂 백업 불러오기</div>
      <div class="rsum">${this.summary(u)}</div>
      ${cur ? `<div class="rsum" style="border-color:var(--loss)">⚠️ 이 브라우저에 <b>같은 아이디</b>가 있어요. 불러오면 지금 기록을 <b>백업 내용으로 바꿔요.</b><br>현재: ${this.games(cur)}판 · 백업: ${this.games(u)}판${this.games(cur) > this.games(u) ? '<br><b style="color:var(--loss)">지금 기록이 더 많아요!</b> 먼저 현재 계정을 백업해 두는 걸 추천해요.' : ''}</div>` : ''}
      <label class="l" style="text-align:left">${noPw ? '새 비밀번호 (필수, 6자 이상)' : '비밀번호를 잊었다면 새 비밀번호 (선택)'}</label>
      <input type="password" id="rsPw" maxlength="64" placeholder="${noPw ? '새 비밀번호' : '비워 두면 기존 비밀번호 그대로'}">
      <div class="amsg" id="rsMsg" style="text-align:left"></div>
      <div class="rbtns"><button id="rsNo">취소</button><button id="rsYes" class="${cur ? 'danger' : 'primary'}">${cur ? '바꿔서 불러오기' : '불러오기'}</button></div></div>`;
    m.classList.remove('hidden');
    const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
    $('rsNo').onclick = close;
    $('rsYes').onclick = async () => {
      const pw = $('rsPw').value, msg = t => { $('rsMsg').textContent = t; };
      if ((noPw || pw) && pw.length < 6) return msg('비밀번호는 6자 이상이어야 해요.');
      $('rsYes').disabled = true; msg('');
      try {
        if (pw) { u.salt = Auth.salt(); u.hash = await Auth.hash(pw, u.salt); }
        u.restoredAt = Date.now();
        const previousData = Store.data;
        const previousTabSession = SafeStore.sess.get('boardArena.session');
        const nextData = JSON.parse(JSON.stringify(previousData));
        nextData.users[key] = u;
        delete nextData.fails[key];
        nextData.session = key;
        Store.data = nextData;
        SafeStore.sess.del('boardArena.session');
        if (!Store.save() && SafeStore.persistent) {
          Store.data = previousData;
          if (previousTabSession) SafeStore.sess.set('boardArena.session', previousTabSession);
          throw new Error('브라우저 저장 공간이 가득 찼어요. 기존 기록은 변경하지 않았어요.');
        }
        close(); App.show();
        Modal.ask('✅ 불러오기 완료', `<b>${esc(u.nick)}</b>님의 기록을 이어서 할 수 있어요.${pw ? '<br>다음 로그인부터는 <b>새 비밀번호</b>를 써 주세요.' : ''}`, '시작하기', false, true);
      } catch (e) { console.error(e); $('rsYes').disabled = false; msg('불러오기에 실패했어요: ' + (e && e.message || e)); }
    };
    setTimeout(() => $('rsPw') && $('rsPw').focus(), 30);
  }
};

// ---------- 성장 기록: 레이팅 · 업적 · 학습 리포트 ----------
const ACH = [
  { id: 'first_win', icon: '🥇', name: '첫 승리', desc: '교육이나 대련에서 처음으로 이기기' },
  { id: 'tut_one', icon: '🎓', name: '첫 졸업', desc: '한 게임의 튜토리얼을 모두 끝내기' },
  { id: 'tut_all', icon: '📚', name: '네 가지 모두 배움', desc: '네 게임의 튜토리얼을 모두 끝내기' },
  { id: 'try_all', icon: '🧭', name: '탐험가', desc: '네 게임을 모두 한 판 이상 해보기' },
  { id: 'beat5', icon: '💪', name: '중급 돌파', desc: '대련에서 Lv.5 이상 AI 이기기' },
  { id: 'beat8', icon: '🔥', name: '고수 등극', desc: '대련에서 Lv.8 이상 AI 이기기' },
  { id: 'streak3', icon: '⚡', name: '3연승', desc: '같은 게임 대련에서 3번 연속 이기기' },
  { id: 'clean', icon: '💎', name: '깔끔한 승리', desc: '분석 결과 큰 실수 없이 이기기' },
  { id: 'sd_pure', icon: '🧩', name: '스도쿠 장인', desc: '힌트·실수 없이 9×9 스도쿠 완성' },
  { id: 'games10', icon: '🎯', name: '꾸준함', desc: '교육·대련 10판 하기' },
  { id: 'games50', icon: '🏆', name: '열정가', desc: '교육·대련 50판 하기' },
  { id: 'days3', icon: '📅', name: '3일 연속', desc: '3일 연속으로 한 판 이상 하기' }
];
const Progress = {
  aiRating: lv => 450 + lv * 150,
  rating(u, g) { const r = u.rating && u.rating[g]; return r ? r : { r: 800, n: 0 }; },
  rate(u, g, lv, result) {
    const cur = this.rating(u, g), opp = this.aiRating(lv), s = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
    const exp = 1 / (1 + Math.pow(10, (opp - cur.r) / 400)), K = cur.n < 10 ? 48 : 28;
    const nr = Math.max(100, Math.min(3000, Math.round(cur.r + K * (s - exp))));
    u.rating = u.rating || {}; u.rating[g] = { r: nr, n: cur.n + 1 };
    return { from: cur.r, to: nr };
  },
  dkey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; },
  days(u) { return [...new Set(u.log.filter(e => e.mode !== 'tutorial').map(e => this.dkey(new Date(e.date))))]; },
  streak(u) {
    const set = new Set(this.days(u)); let n = 0; const d = new Date();
    if (!set.has(this.dkey(d))) d.setDate(d.getDate() - 1);
    while (set.has(this.dkey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },
  unlock(u, id, out) { u.ach = u.ach || {}; if (u.ach[id]) return; u.ach[id] = Date.now(); out.push(ACH.find(a => a.id === id)); },
  check(u, ctx) {
    const out = [], games = u.log.filter(e => e.mode !== 'tutorial');
    if (games.some(e => e.result === 'win')) this.unlock(u, 'first_win', out);
    const tutDone = GAMES.filter(g => LESSONS[g].every((_, i) => u.tut[g].indexOf(i) >= 0)).length;
    if (tutDone >= 1) this.unlock(u, 'tut_one', out);
    if (tutDone === GAMES.length) this.unlock(u, 'tut_all', out);
    if (GAMES.every(g => games.some(e => e.game === g))) this.unlock(u, 'try_all', out);
    if (games.some(e => e.mode === 'match' && e.result === 'win' && e.level >= 5)) this.unlock(u, 'beat5', out);
    if (games.some(e => e.mode === 'match' && e.result === 'win' && e.level >= 8)) this.unlock(u, 'beat8', out);
    if (GAMES.some(g => { const m = u.log.filter(e => e.game === g && e.mode === 'match').slice(0, 3); return m.length === 3 && m.every(e => e.result === 'win'); })) this.unlock(u, 'streak3', out);
    if (games.length >= 10) this.unlock(u, 'games10', out);
    if (games.length >= 50) this.unlock(u, 'games50', out);
    if (this.streak(u) >= 3) this.unlock(u, 'days3', out);
    if (ctx && ctx.clean) this.unlock(u, 'clean', out);
    if (ctx && ctx.sdPure) this.unlock(u, 'sd_pure', out);
    if (out.length) Store.save();
    return out;
  },
  achHtml(list) { return list.map(a => `<div class="achnew">🏅 업적 달성 · ${a.icon} <b>${a.name}</b> <span>${a.desc}</span></div>`).join(''); },
  week(u, from, to) {
    const L = u.log.filter(e => e.mode !== 'tutorial' && e.date >= from && e.date < to);
    const acc = L.filter(e => typeof e.acc === 'number');
    return { n: L.length, w: L.filter(e => e.result === 'win').length, acc: acc.length ? Math.round(acc.reduce((a, e) => a + e.acc, 0) / acc.length) : null, bl: acc.length ? acc.reduce((a, e) => a + (e.bl || 0), 0) / acc.length : null, nAcc: acc.length, by: GAMES.map(g => L.filter(e => e.game === g).length) };
  },
  reportHtml(u) {
    const now = Date.now(), D = 864e5, a = this.week(u, now - 7 * D, now + D), b = this.week(u, now - 14 * D, now - 7 * D), kid = isKid();
    const trend = a.acc !== null && b.acc !== null ? (a.acc - b.acc >= 3 ? `<span class="w">▲ ${a.acc - b.acc}%p</span>` : b.acc - a.acc >= 3 ? `<span class="lo">▼ ${b.acc - a.acc}%p</span>` : '<span style="color:var(--sub)">비슷해요</span>') : '';
    const fav = a.n ? GAME_NAME[GAMES[a.by.indexOf(Math.max(...a.by))]] : '-';
    const st = this.streak(u);
    const ach = u.ach || {}, got = ACH.filter(x => ach[x.id]).length;
    const stats = kid
      ? `<div class="rpgrid"><div><b>${a.n}</b><span>이번 주 한 판</span></div><div><b>${a.w}</b><span>이긴 판</span></div><div><b>${st}일</b><span>연속으로 했어요</span></div><div><b>${got}개</b><span>받은 배지</span></div></div>`
      : `<div class="rpgrid"><div><b>${a.n}</b><span>최근 7일 대국·퍼즐</span></div><div><b>${a.n ? Math.round(a.w / a.n * 100) + '%' : '-'}</b><span>승률(완성률)</span></div><div><b>${a.acc !== null ? a.acc + '%' : '-'}</b><span>평균 정확도 ${trend}</span></div><div><b>${st}일</b><span>연속 학습 · 많이 한 게임 ${fav}</span></div></div>`;
    const badges = `<div class="achgrid">${ACH.map(x => `<div class="ach ${ach[x.id] ? 'on' : ''}" title="${x.desc}"><div class="ai">${ach[x.id] ? x.icon : '🔒'}</div><div class="an">${x.name}</div></div>`).join('')}</div>`;
    const note = a.acc !== null ? `<div class="rpnote">${kid ? `한 판에 조심할 수가 평균 <b>${a.bl.toFixed(1)}개</b> 있었어요.` : `판당 큰 실수 평균 <b>${a.bl.toFixed(1)}개</b> (분석된 ${a.nAcc}판 기준)`}${b.acc !== null ? ` · 지난주 정확도 ${b.acc}%` : ''}</div>` : `<div class="rpnote">${kid ? '연습하기·겨루기를 하면 여기에 실력 변화가 보여요!' : '교육·대련을 하면 대국 후 분석 결과로 정확도 추이가 쌓여요.'}</div>`;
    return stats + note + `<div class="rpsub">업적 ${got} / ${ACH.length}</div>` + badges;
  }
};
// ---------- 효과음 (외부 파일 없이 WebAudio로 합성 · 오프라인 동작) ----------
const Sound = {
  ctx: null,
  enabled() { const u = Store.cur(); return !u || u.prefs.sound !== false; },
  ac() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); } catch (e) { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  tone(a, f, t, dur, type, vol, f2) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  knock(a, t, freq, vol, dur) {
    const len = Math.max(1, Math.floor(a.sampleRate * dur)), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.4; g.gain.value = vol;
    s.buffer = buf; s.connect(bp); bp.connect(g); g.connect(a.destination); s.start(t);
  },
  play(kind) {
    if (!this.enabled()) return;
    const a = this.ac(); if (!a) return;
    const t = a.currentTime + 0.01, v = isKid() ? 0.22 : 0.16;
    try {
      switch (kind) {
        case 'move': this.knock(a, t, 1500, v * 4, 0.07); break;
        case 'stone': this.knock(a, t, 2400, v * 4.5, 0.05); this.knock(a, t + 0.005, 900, v * 2, 0.06); break;
        case 'capture': this.knock(a, t, 1300, v * 4, 0.07); this.tone(a, 240, t + 0.03, 0.16, 'triangle', v, 120); break;
        case 'lose': this.knock(a, t, 900, v * 3, 0.08); this.tone(a, 330, t + 0.04, 0.22, 'sine', v * 0.7, 200); break;
        case 'check': this.tone(a, 880, t, 0.11, 'square', v * 0.45); this.tone(a, 660, t + 0.13, 0.16, 'square', v * 0.45); break;
        case 'tick': this.tone(a, 1046, t, 0.08, 'sine', v * 0.8); break;
        case 'err': this.tone(a, 196, t, 0.18, 'sawtooth', v * 0.35, 150); break;
        case 'pass': this.tone(a, 520, t, 0.14, 'sine', v * 0.6, 440); break;
        case 'up': this.tone(a, 660, t, 0.1, 'sine', v); this.tone(a, 990, t + 0.1, 0.16, 'sine', v); break;
        case 'down': this.tone(a, 660, t, 0.1, 'sine', v * 0.8); this.tone(a, 494, t + 0.1, 0.16, 'sine', v * 0.8); break;
        case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(a, f, t + i * 0.11, i === 3 ? 0.45 : 0.14, 'triangle', v)); break;
        case 'loss': [392, 330, 262].forEach((f, i) => this.tone(a, f, t + i * 0.16, 0.24, 'sine', v * 0.8)); break;
        case 'draw': this.tone(a, 523, t, 0.18, 'sine', v); this.tone(a, 523, t + 0.2, 0.25, 'sine', v); break;
      }
    } catch (e) { /* 소리는 부가 기능 */ }
  }
};
// ---------- 설정 ----------
const Settings = {
  open() {
    const u = Store.cur(); if (!u) return;
    const m = $('modal');
    const tg = (id, on, label) => `<button id="${id}" class="${on ? 'on' : ''}">${label}</button>`;
    m.innerHTML = `<div class="mbox setbox" role="dialog" aria-label="설정"><div class="mt">⚙️ 설정</div>
      <div class="setsec"><div class="sett">🔊 효과음</div><div class="tog">${tg('stSndOn', u.prefs.sound !== false, '켜기')}${tg('stSndOff', u.prefs.sound === false, '끄기')}<button id="stSndTest">▶ 들어보기</button></div></div>
      <div class="setsec"><div class="sett">💬 알림 말풍선</div><div class="tog">${tg('stNtAll', u.prefs.notify === 'all', '모두')}${tg('stNtKey', u.prefs.notify === 'key', '중요한 것만')}${tg('stNtOff', u.prefs.notify === 'off', '끄기')}</div><div class="sethelp">잡기·장군 같은 알림을 얼마나 보여줄지 정해요. 끄더라도 판 위 표시와 기록은 그대로예요.</div></div>
      <div class="setsec"><div class="sett">🐢 AI 두는 속도</div><div class="tog">${tg('stSpFast', u.prefs.aiSpeed === 'fast', '빠르게')}${tg('stSpNorm', u.prefs.aiSpeed === 'normal', '보통')}${tg('stSpSlow', u.prefs.aiSpeed === 'slow', '천천히')}</div><div class="sethelp">AI 수가 너무 빨리 지나가 놓친다면 '천천히'를 골라 보세요.</div></div>
      <div class="setsec"><div class="sett">🎨 화면 스타일</div><div class="tog">${tg('stKid', u.prefs.ui === 'kid', '🧸 어린이용')}${tg('stNormal', u.prefs.ui !== 'kid', '🎯 일반')}</div></div>
      <div class="setsec"><div class="sett">✏️ 닉네임</div><div class="setrow"><input type="text" id="stNick" maxlength="12" value="${esc(u.nick)}" aria-label="새 닉네임"><button id="stNickSave" class="primary">저장</button></div></div>
      <div class="setsec"><div class="sett">🔑 비밀번호 바꾸기</div>
        <input type="password" id="stPwCur" maxlength="64" placeholder="지금 비밀번호" aria-label="지금 비밀번호" autocomplete="current-password">
        <input type="password" id="stPwNew" maxlength="64" placeholder="새 비밀번호 (6자 이상)" aria-label="새 비밀번호" autocomplete="new-password" style="margin-top:6px">
        <input type="password" id="stPwNew2" maxlength="64" placeholder="새 비밀번호 확인" aria-label="새 비밀번호 확인" autocomplete="new-password" style="margin-top:6px">
        <button id="stPwSave" style="width:100%;margin-top:6px">비밀번호 변경</button></div>
      <details class="setsec"><summary class="sett" style="cursor:pointer">🗑️ 이 기기에서 계정 삭제</summary>
        <div style="font-size:12.5px;color:var(--sub);margin:6px 0">계정과 모든 기록이 이 기기에서 지워져요. 되돌릴 수 없으니 먼저 <b>💾 백업</b>을 권장해요.</div>
        <input type="password" id="stDelPw" maxlength="64" placeholder="비밀번호 입력" aria-label="계정 삭제 확인용 비밀번호" autocomplete="current-password">
        <button id="stDel" class="danger" style="width:100%;margin-top:6px">계정 삭제</button></details>
      <div class="amsg" id="stMsg"></div>
      <div class="rbtns"><button id="stClose" class="primary">닫기</button></div></div>`;
    m.classList.remove('hidden');
    const msg = (t, ok) => { const e = $('stMsg'); e.textContent = t; e.className = 'amsg' + (ok ? ' ok' : ''); };
    const close = () => { m.classList.add('hidden'); m.innerHTML = ''; document.removeEventListener('keydown', key); App.show(); };
    const key = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    m.onclick = e => { if (e.target === m) close(); };
    $('stClose').onclick = close;
    const group = (ids, pick) => ids.forEach(([id]) => $(id).classList.toggle('on', id === pick));
    const setSnd = on => { u.prefs.sound = on; Store.save(); group([['stSndOn'], ['stSndOff']], on ? 'stSndOn' : 'stSndOff'); if (on) Sound.play('win'); };
    $('stSndOn').onclick = () => setSnd(true); $('stSndOff').onclick = () => setSnd(false);
    $('stSndTest').onclick = () => { if (u.prefs.sound === false) { msg('효과음이 꺼져 있어요.'); return; } Sound.play('capture'); setTimeout(() => Sound.play('win'), 350); };
    const NT = [['stNtAll', 'all'], ['stNtKey', 'key'], ['stNtOff', 'off']];
    NT.forEach(([id, v]) => { $(id).onclick = () => { u.prefs.notify = v; Store.save(); group(NT, id); if (v !== 'off') Notify.show({ kind: 'good', icon: '💬', title: '이렇게 알려 드려요', sub: v === 'all' ? '모든 알림' : '잡기·장군 같은 중요한 알림만', force: true }); }; });
    const SP = [['stSpFast', 'fast'], ['stSpNorm', 'normal'], ['stSpSlow', 'slow']];
    SP.forEach(([id, v]) => { $(id).onclick = () => { u.prefs.aiSpeed = v; Store.save(); group(SP, id); }; });
    const setUi = ui => { u.prefs.ui = ui; Store.save(); document.body.classList.toggle('kid', ui === 'kid'); group([['stKid'], ['stNormal']], ui === 'kid' ? 'stKid' : 'stNormal'); msg('화면 스타일을 바꿨어요.', true); };
    $('stKid').onclick = () => setUi('kid'); $('stNormal').onclick = () => setUi('normal');
    $('stNickSave').onclick = () => {
      const n = $('stNick').value.trim();
      if (!n || n.length > 12) return msg('닉네임을 1~12자로 입력해 주세요.');
      u.nick = n; Store.save(); msg('닉네임을 바꿨어요.', true);
    };
    $('stPwSave').onclick = async () => {
      const cur = $('stPwCur').value, n1 = $('stPwNew').value, n2 = $('stPwNew2').value;
      if (n1.length < 6) return msg('새 비밀번호는 6자 이상이어야 해요.');
      if (n1 !== n2) return msg('새 비밀번호 확인이 일치하지 않아요.');
      $('stPwSave').disabled = true; msg('확인 중...', true);
      try {
        if (!u.hash || (await Auth.hash(cur, u.salt)) !== u.hash) { $('stPwSave').disabled = false; return msg('지금 비밀번호가 맞지 않아요.'); }
        const salt = Auth.salt(), hash = await Auth.hash(n1, salt);
        u.salt = salt; u.hash = hash; Store.save();
        ['stPwCur', 'stPwNew', 'stPwNew2'].forEach(id => { $(id).value = ''; });
        msg('비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 써 주세요.', true);
      } catch (e) { msg('변경 중 오류가 났어요: ' + (e && e.message || e)); }
      $('stPwSave').disabled = false;
    };
    $('stDel').onclick = async () => {
      const pw = $('stDelPw').value;
      if (!pw) return msg('삭제하려면 비밀번호를 입력해 주세요.');
      try { if (!u.hash || (await Auth.hash(pw, u.salt)) !== u.hash) return msg('비밀번호가 맞지 않아요.'); }
      catch (e) { return msg('확인 중 오류가 났어요: ' + (e && e.message || e)); }
      const key2 = u.id.toLowerCase();
      document.removeEventListener('keydown', key);
      const ok = await Modal.ask('정말 삭제할까요?', `<b>${esc(u.nick)}</b>(@${esc(u.id)}) 계정과 모든 기록이 이 기기에서 지워져요.`, '삭제', true);
      if (!ok) { App.show(); return; }
      delete Store.data.users[key2]; delete Store.data.fails[key2];
      Store.clearSession(); App.show();
    };
  }
};
// ---------- 앱 화면 전환 ----------
const App = {
  init() {
    Store.load(); Auth.init(); Home.init(); this.show();
    if (!SafeStore.persistent) {
      const w = document.createElement('div');
      w.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99;background:#8f2f33;color:#fff;padding:9px 14px;font-size:13px;text-align:center';
      w.innerHTML = '⚠️ 지금 화면(미리보기 등)에서는 저장이 막혀 있어 <b>창을 닫으면 계정과 기록이 사라져요.</b> 파일을 <b>다운로드</b>한 뒤 크롬·엣지로 직접 열어 주세요.';
      document.body.appendChild(w);
    }
  },
  show() {
    const u = Store.cur();
    document.body.classList.toggle('kid', !!(u && u.prefs.ui === 'kid'));
    $('auth').classList.toggle('hidden', !!u); $('home').classList.toggle('hidden', !u);
    $('game').classList.add('hidden'); $('result').classList.add('hidden');
    if (u) Home.render(); else { Auth.tab(Object.keys(Store.data.users).length ? 'login' : 'signup'); }
  }
};

// ---------- 홈 ----------
const MODE_DESC = {
  tutorial: '규칙과 기물 움직임을 한 단계씩 배워요.',
  train: 'AI가 대국 중에도 내 수를 보고 레벨을 올리고 내려요. 힌트와 실수 경고가 있어요.',
  match: '레벨을 골라 AI와 진짜 승부를 해요. 힌트·무르기 없이 기록돼요.',
};
const MODE_DESC_SD = {
  tutorial: '스도쿠 규칙과 푸는 방법을 배워요.',
  train: '내 실력에 맞는 퍼즐이 나와요. 틀린 숫자 표시와 힌트가 있어요.',
  match: '레벨을 골라 도전해요. 힌트 없이 완성 시간이 기록돼요.',
};
const GAME_OPTS = {
  janggi: `<div><label class="l">내 진영</label><select data-o="human"><option value="0">초 (선)</option><option value="1">한 (후)</option></select></div>
    <div><label class="l">빅장</label><select data-o="bik"><option value="draw">무승부</option><option value="points">점수 판정</option></select></div>
    <div><label class="l">내 상차림</label><select data-o="pat"><option>마상마상</option><option>상마상마</option><option>마상상마</option><option>상마마상</option></select></div>
    <div><label class="l">AI 상차림</label><select data-o="aiPat"><option value="rand">무작위</option><option>마상마상</option><option>상마상마</option><option>마상상마</option><option>상마마상</option></select></div>`,
  chess: `<div><label class="l">내 색</label><select data-o="human"><option value="0">백 (선)</option><option value="8">흑 (후)</option><option value="r">무작위</option></select></div><div></div>`,
  go: `<div><label class="l">판 크기</label><select data-o="size"><option value="9">9 × 9</option><option value="13">13 × 13</option><option value="19">19 × 19</option></select></div>
    <div><label class="l">내 돌</label><select data-o="human"><option value="1">흑 (선)</option><option value="2">백 (후)</option></select></div>
    <div><label class="l">접바둑</label><select data-o="hcp"><option value="0">호선</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option></select></div>
    <div><label class="l">덤</label><select data-o="komi"><option value="auto">자동</option><option>7.5</option><option>6.5</option><option>0.5</option></select></div>`,
  sudoku: '',
};
const Home = {
  mode: { janggi: 'tutorial', chess: 'tutorial', go: 'tutorial', sudoku: 'tutorial' },
  init() {
    $('games').innerHTML = GAMES.map(g => `<div class="card gcard" data-g="${g}">
      <div class="bg">${GAME_BG[g]}</div><div class="icon">${GAME_ICON[g]}</div><h3>${GAME_NAME[g]}</h3>
      <div class="mtabs">${['tutorial', 'train', 'match'].map(m => `<button data-m="${m}">${mn(m)}</button>`).join('')}</div>
      <div class="mdesc"></div>
      <div class="pane-t"><ul class="tlist"></ul></div>
      <div class="pane-tr"><div class="tlvl"></div></div>
      <div class="pane-m"><label class="l">AI 레벨</label><div class="lvl">${Array.from({ length: 10 }, (_, i) => `<button data-v="${i + 1}">${i + 1}</button>`).join('')}</div></div>
      <div class="pane-o opts">${GAME_OPTS[g]}</div>
      <div class="pane-r hidden"></div>
      <div class="spacer"></div><button class="primary start">시작</button></div>`).join('');
    document.querySelectorAll('.gcard').forEach(card => {
      const g = card.dataset.g;
      card.querySelectorAll('.mtabs button').forEach(b => b.onclick = () => { this.mode[g] = b.dataset.m; this.paintCard(g); });
      card.querySelectorAll('.lvl button').forEach(b => b.onclick = () => { const u = Store.cur(); u.prefs.match[g] = +b.dataset.v; Store.save(); this.paintCard(g); });
      card.querySelector('.start').onclick = () => this.start(g);
    });
    $('btnHome').onclick = async () => {
      const saving = Shell.active && !Shell.ended && Shell.mode !== 'tutorial' && Shell.active.resumeData;
      if (saving) Shell.autosave();
      Shell.close();
      if (saving && Resume.get(Shell.game)) Home.flash('💾 대국을 저장했어요. 홈의 <b>▶ 이어하기</b>로 계속할 수 있어요.');
    };
  },
  paintCard(g) {
    const u = Store.cur(), card = document.querySelector(`.gcard[data-g="${g}"]`), m = this.mode[g];
    card.querySelectorAll('.mtabs button').forEach(b => { b.classList.toggle('on', b.dataset.m === m); b.textContent = mn(b.dataset.m); });
    card.querySelector('.mdesc').textContent = (g === 'sudoku' ? MODE_DESC_SD : MODE_DESC)[m];
    card.querySelector('.pane-t').classList.toggle('hidden', m !== 'tutorial');
    card.querySelector('.pane-tr').classList.toggle('hidden', m !== 'train');
    card.querySelector('.pane-m').classList.toggle('hidden', m !== 'match');
    card.querySelector('.pane-o').classList.toggle('hidden', m === 'tutorial' || !GAME_OPTS[g]);
    const done = u.tut[g], next = LESSONS[g].findIndex((_, i) => done.indexOf(i) < 0);
    card.querySelector('.tlist').innerHTML = LESSONS[g].map((l, i) => `<li data-i="${i}" class="${done.indexOf(i) >= 0 ? 'done' : ''} ${i === next ? 'next' : ''}"><span class="ck">${done.indexOf(i) >= 0 ? '✓' : i + 1}</span>${l.title}</li>`).join('');
    card.querySelectorAll('.tlist li').forEach(li => li.onclick = () => Tutorial.start(g, +li.dataset.i));
    card.querySelector('.tlvl').innerHTML = `시작 레벨: <b>Lv.${u.prefs.train[g]}</b><br><span style="color:var(--sub);font-size:12px">${g === 'sudoku' ? '완성하면 다음 퍼즐이 어려워지고, 포기하면 쉬워져요.' : '좋은 수를 두면 대국 중에 AI가 세지고, 실수하면 약해져요.'}</span>`;
    card.querySelectorAll('.lvl button').forEach(b => b.classList.toggle('on', +b.dataset.v === u.prefs.match[g]));
    const r = Resume.get(g), pr = card.querySelector('.pane-r');
    pr.classList.toggle('hidden', !r);
    if (r) {
      pr.innerHTML = `<button class="green resbtn">▶ 이어하기 <small>${mn(r.o.mode)} · Lv.${r.o.level} · ${g === 'sudoku' ? Resume.count(r) + '칸 채움' : Resume.count(r) + '수'} · ${Resume.ago(r.ts)}</small></button>`;
      pr.querySelector('.resbtn').onclick = () => Shell.open(g, Object.assign({}, r.o, { resume: r }));
    }
    const st = card.querySelector('.start');
    st.textContent = m === 'tutorial' ? (next < 0 ? '튜토리얼 처음부터 복습' : `레슨 ${next + 1} 시작`) : m === 'train' ? `교육 대국 시작 (Lv.${u.prefs.train[g]})` : `대련 시작 (Lv.${u.prefs.match[g]})`;
  },
  optsFor(g) {
    const card = document.querySelector(`.gcard[data-g="${g}"]`), o = {};
    card.querySelectorAll('[data-o]').forEach(s => o[s.dataset.o] = s.value);
    if (g === 'janggi') o.human = +o.human;
    if (g === 'chess') o.human = o.human === 'r' ? (Math.random() < .5 ? 0 : 8) : +o.human;
    if (g === 'go') { o.size = +o.size; o.human = +o.human; o.hcp = +o.hcp; }
    return o;
  },
  start(g) {
    const u = Store.cur(), m = this.mode[g];
    if (m === 'tutorial') { const next = LESSONS[g].findIndex((_, i) => u.tut[g].indexOf(i) < 0); Tutorial.start(g, next < 0 ? 0 : next); return; }
    const o = this.optsFor(g); o.mode = m; o.level = m === 'train' ? u.prefs.train[g] : u.prefs.match[g];
    if (Resume.get(g)) {
      Modal.ask('진행 중인 대국이 있어요', '새로 시작하면 저장된 대국은 사라져요.<br>계속하려면 <b>▶ 이어하기</b>를 눌러 주세요.', '새로 시작', true).then(ok => { if (ok) { Resume.clear(g); Shell.open(g, o); } });
      return;
    }
    Shell.open(g, o);
  },
  flash(html) {
    let el = $('homeFlash');
    if (!el) { el = document.createElement('div'); el.id = 'homeFlash'; el.className = 'hflash'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = html; el.classList.add('on');
    clearTimeout(this._ft); this._ft = setTimeout(() => el.classList.remove('on'), 3200);
  },
  render() {
    const u = Store.cur(); if (!u) return;
    $('hAv').textContent = u.nick.slice(0, 1).toUpperCase(); $('hNick').textContent = u.nick; $('hId').textContent = '@' + u.id;
    let rows = `<tr><th>게임</th><th>${mn('tutorial')}</th><th>${mn('train')} (시작 레벨)</th><th>${mn('match')} 전적</th><th>${mn('match')} 승률</th><th>이긴 최고 레벨</th><th>레이팅</th></tr>`;
    GAMES.forEach(g => {
      const tn = LESSONS[g].length, td = u.tut[g].length, tr = u.stats[g].train, ma = u.stats[g].match, mn = ma.w + ma.l + ma.d;
      const sd = g === 'sudoku';
      rows += `<tr><td><b>${GAME_NAME[g]}</b></td><td><span class="pbar"><i style="width:${td / tn * 100}%"></i></span>${td}/${tn}</td>
        <td>${sd ? `완성 <span class="w">${tr.w}</span>` : `<span class="w">${tr.w}</span>-<span class="lo">${tr.l}</span>-<span class="d">${tr.d}</span>`} · Lv.${u.prefs.train[g]}</td>
        <td>${sd ? `완성 <span class="w">${ma.w}</span> · 포기 <span class="lo">${ma.l}</span>` : `<span class="w">${ma.w}승</span> <span class="lo">${ma.l}패</span> <span class="d">${ma.d}무</span>`}</td>
        <td>${mn ? Math.round(ma.w / mn * 100) + '%' : '-'}</td><td>${ma.best ? 'Lv.' + ma.best : '-'}</td><td>${u.rating[g] ? `<b>${u.rating[g].r}</b>` : '<span style="color:var(--sub)">-</span>'}</td></tr>`;
    });
    $('recTable').innerHTML = rows;
    Backup.notice(u);
    $('styleGrid').innerHTML = GAMES.map(g => Style.card(g, u)).join('');
    $('reportBox').innerHTML = Progress.reportHtml(u);
    $('btnUi').textContent = '⚙️ 설정';
    GAMES.forEach(g => this.paintCard(g));
    const log = u.log.slice(0, 50);
    $('recentList').innerHTML = log.length ? log.map(e => {
      const dt = new Date(e.date), ds = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      const extra = e.mode === 'tutorial' ? '' : (e.endLevel && e.endLevel !== e.level ? `Lv.${e.level}→${e.endLevel}` : `Lv.${e.level}`);
      return `<li><span class="badge ${e.result}">${resLabel(e.game, e.result, e.mode)}</span><b style="min-width:42px">${GAME_NAME[e.game]}</b><span class="mbadge">${mn(e.mode)}</span><span style="color:var(--sub);min-width:38px">${extra}</span><span class="note">${esc(e.reason || '')}${e.moves ? ' · ' + e.moves + '수' : ''}${e.hints ? ' · 힌트 ' + e.hints : ''}</span><span style="color:#6d7487">${ds}</span></li>`;
    }).join('') : '<li style="color:var(--sub)">아직 기록이 없어요. 튜토리얼부터 시작해 볼까요?</li>';
  }
};

// ---------- 확인창 ----------
const Modal = {
  ask(title, sub, okLabel, danger, alertOnly, cancelLabel) {
    return new Promise(resolve => {
      const m = $('modal');
      m.innerHTML = `<div class="mbox"><div class="mt">${title}</div><div class="ms">${sub || ''}</div>
        <div class="rbtns">${alertOnly ? '' : `<button id="mNo">${cancelLabel || '취소'}</button>`}<button id="mYes" class="${danger ? 'danger' : 'primary'}">${okLabel || '확인'}</button></div></div>`;
      m.classList.remove('hidden');
      const done = v => { m.classList.add('hidden'); m.innerHTML = ''; document.removeEventListener('keydown', key); resolve(v); };
      const key = e => { if (e.key === 'Escape') done(false); if (e.key === 'Enter') { e.preventDefault(); done(true); } };
      document.addEventListener('keydown', key);
      $('mYes').onclick = () => done(true);
      if (!alertOnly) $('mNo').onclick = () => done(false);
      m.onclick = e => { if (e.target === m) done(false); };
      setTimeout(() => $('mYes') && $('mYes').focus(), 30);
    });
  }
};
const confirmResign = () => Modal.ask('기권할까요?', '이 판은 패배로 기록돼요.', '기권하기', true);

// ---------- 알림 말풍선 (v0.9): 판을 가리지 않는 상단 알림 + 순서대로 표시 ----------
// prio: 'feedback' = 내 행동에 대한 답(항상 표시) · 'major' = 중요한 대국 사건 · 'minor' = 작은 사건(설정 '모두'일 때만)
const Notify = {
  q: [], cur: null, timer: 0, shownAt: 0,
  level() { const u = Store.cur(); return u ? u.prefs.notify || 'all' : 'all'; },
  el() {
    let w = $('notify');
    if (!w) {
      w = document.createElement('div'); w.id = 'notify'; w.setAttribute('aria-hidden', 'true'); document.body.appendChild(w);
      const live = document.createElement('div'); live.id = 'notifyLive'; live.className = 'sr-only'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); document.body.appendChild(live);
    }
    return w;
  },
  // o: { kind: good|bad|warn|info, title, sub, chip(html), badge, prio, ms, force }
  show(o) {
    const lv = this.level(), prio = o.prio || 'feedback';
    if (!o.force && ((lv === 'off' && prio !== 'feedback') || (lv === 'key' && prio === 'minor'))) return;
    const live = $('notifyLive') || (this.el(), $('notifyLive'));
    if (live) live.textContent = [o.title, o.sub, o.badge].filter(Boolean).join(' · ').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '');
    // 같은 종류가 쌓이지 않게: 대기열에는 최신 1개만 유지, 바로 앞과 같은 알림은 무시
    if (this.cur && this.cur.title === o.title && this.cur.sub === o.sub) return;
    this.q = this.q.filter(x => x.prio === 'feedback').slice(-1); this.q.push(o);
    this.pump();
  },
  pump() {
    if (this.cur) {
      const minShow = 850, waited = Date.now() - this.shownAt;
      if (waited < minShow) { clearTimeout(this.timer); this.timer = setTimeout(() => this.next(), minShow - waited); }
      else this.next();
      return;
    }
    this.next();
  },
  next() {
    clearTimeout(this.timer);
    const o = this.q.shift(), w = this.el();
    if (!o) { const c = w.firstElementChild; if (c) { c.classList.add('out'); setTimeout(() => { if (!this.cur) w.innerHTML = ''; }, 220); } this.cur = null; return; }
    this.cur = o; this.shownAt = Date.now();
    w.innerHTML = `<div class="ncard ${o.kind || 'info'}">${o.chip ? `<div class="nchips">${o.chip}</div>` : ''}<div class="ntxt"><div class="nt">${o.title}${o.badge ? ` <span class="nbadge">${o.badge}</span>` : ''}</div>${o.sub ? `<div class="ns">${o.sub}</div>` : ''}</div></div>`;
    const u = Store.cur(), slow = u && u.prefs.aiSpeed === 'slow' ? 1.4 : 1;
    const ms = (o.ms || (o.kind === 'bad' || o.kind === 'warn' ? 2300 : 1800)) * slow;
    this.timer = setTimeout(() => { this.cur = null; this.next(); }, ms);
  },
  clear() { clearTimeout(this.timer); this.q = []; this.cur = null; const w = $('notify'); if (w) w.innerHTML = ''; }
};
// 게임별 기물 아이콘(알림용 작은 칩)
const Chip = {
  janggi(p) { const s = p >> 3, t = p & 7, H = { 0: ['', '楚', '士', '象', '馬', '車', '包', '卒'], 1: ['', '漢', '士', '象', '馬', '車', '包', '兵'] }; return `<span class="nchip jg s${s}">${H[s][t]}</span>`; },
  chess(p) { const G = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' }; return `<span class="nchip ch ${(p & 8) ? 'b' : 'w'}">${G[p & 7]}\uFE0E</span>`; },
  go(c, n) { return Array.from({ length: Math.min(n, 3) }, () => `<span class="nchip go c${c}"></span>`).join('') + (n > 3 ? `<span class="nmore">+${n - 3}</span>` : ''); },
  vs(a, b) { return `${a}<span class="narrow">→</span>${b}`; }
};
// ---------- 게임 셸 ----------
const Shell = {
  active: null, game: null, ended: false, opts: null, mode: null,
  open(game, opts) {
    Analysis.cancel(); Review.close(); Notify.clear(); this._openSeq = (this._openSeq || 0) + 1;
    this.game = game; this.opts = Object.assign({}, opts); delete this.opts.resume; this.mode = opts.mode; this.ended = false;
    const u = Store.cur();
    $('home').classList.add('hidden'); $('game').classList.remove('hidden'); $('result').classList.add('hidden');
    $('gTitle').textContent = GAME_NAME[game];
    $('gMode').textContent = mn(opts.mode) + (opts.mode === 'tutorial' ? ` ${opts.lesson + 1}/${LESSONS[game].length}` : '');
    $('gVs').innerHTML = opts.mode === 'tutorial' ? `<b>${esc(u.nick)}</b>` : game === 'sudoku' ? `<b>${esc(u.nick)}</b> · Lv.${opts.level}` : `<b>${esc(u.nick)}</b> vs <b>AI Lv.${opts.level}</b>`;
    ['gLog', 'gInfo', 'gExtra', 'gCoach', 'gLesson'].forEach(id => $(id).innerHTML = '');
    $('gLog').style.display = (game === 'sudoku' || opts.mode === 'tutorial') ? 'none' : '';
    const host = $('boardHost'); [...host.children].forEach(c => { if (c.id !== 'toast') c.remove(); });
    if (this.active) this.active.destroy();
    this.active = { go: GoGame, chess: ChessGame, janggi: JanggiGame, sudoku: SudokuGame }[game];
    if (opts.mode === 'tutorial') Tutorial.paint(game, opts.lesson);
    try { this.active.start(opts); }
    catch (e) {
      if (!opts.resume) throw e;
      console.error('이어하기 실패:', e);
      Resume.clear(game);
      this.open(game, Object.assign({}, opts, { resume: null }));
      this.toast('저장된 대국을 불러오지 못했어요', '새 대국으로 시작할게요', 'warn');
      return;
    }
    window.scrollTo(0, 0);
  },
  close() {
    Analysis.cancel(); Review.close(); Notify.clear();
    if (this.active) this.active.destroy();
    this.active = null; stopProg();
    $('game').classList.add('hidden'); $('result').classList.add('hidden'); $('home').classList.remove('hidden');
    Home.render();
  },
  moveCount() { return this.active && this.active.moveCount ? this.active.moveCount() : 0; },
  autosave() {
    if (!this.active || this.ended || this.mode === 'tutorial' || !this.active.resumeData) return;
    try { const d = this.active.resumeData(); if (d) Resume.put(this.game, d); } catch (e) { console.warn('자동 저장 실패', e); }
  },
  // 설정의 'AI 두는 속도'에 따라 AI 수 전후 대기 시간 조절
  aiDelay(ms) { const u = Store.cur(), s = u && u.prefs.aiSpeed; return s === 'fast' ? Math.round(ms * 0.4) : s === 'slow' ? Math.round(ms * 2.2) : ms; },
  canAnalyze() { return !!(this.active && this.active.review && this.mode !== 'tutorial' && this.active.review.len() > 0); },
  paintAnalysis() {
    const box = $('rAnalysis'), kid = isKid();
    if (Review.mod) { Review.paintList(); Review.go(Review.k); }
    if (!box) return;
    const st = Analysis.state;
    if (st === 'running') { box.innerHTML = `<div class="anh">🔍 ${kid ? '내가 둔 수를 살펴보는 중…' : '내 수를 분석하고 있어요…'} ${Math.round(Analysis.progress * 100)}%</div><div class="anbar"><i style="width:${Analysis.progress * 100}%"></i></div>`; return; }
    if (st === 'skipped') { box.innerHTML = `<div class="anh">📜 ${esc(Analysis.skip || '')}</div>`; return; }
    if (st !== 'done') { box.innerHTML = st === 'failed' ? '<div class="anh">분석을 완료하지 못했어요. 복기는 볼 수 있어요.</div>' : ''; return; }
    const S = Analysis.summary(), d = Analysis.data, q = S.q;
    if (!S.n) { box.innerHTML = `<div class="anh">${S.decided ? '처음부터 승부가 크게 기울어 평가할 수가 없었어요. 복기로 확인해 보세요.' : '분석할 내 수가 없었어요.'}</div>`; return; }
    if (this._logEntry) {
      const le = this._logEntry; this._logEntry = null;
      le.acc = S.acc; le.bl = q.blunder; le.sl = q.slip; Store.save();
      const uu = Store.cur();
      if (uu && le.result === 'win' && q.blunder === 0 && S.n >= 8) { const nw = Progress.check(uu, { clean: true }); if (nw.length && $('rAch')) $('rAch').insertAdjacentHTML('beforeend', Progress.achHtml(nw)); }
    }
    const mv = this.active.review.moves();
    const scene = i => { const a = d[i], c = CLS_INFO[a.cls]; return `<li><button class="anjump" data-k="${i + 1}">${mv[i].no}수째 <b>${esc(mv[i].txt)}</b></button> ${c.icon} ${kid ? c.k : c.n} <span style="color:var(--sub)">${kid ? '' : '(' + lossText(a) + ')'}</span>${a.bestTxt ? ` → ${kid ? '더 좋은 수' : '추천'} <b>${esc(a.bestTxt)}</b>` : ''}</li>`; };
    if (kid) {
      box.innerHTML = `<div class="anh">🔍 내가 둔 수 살펴보기</div><div class="anq">⭐ 좋은 수 <b>${q.good + q.ok}</b>개 · 🔎 조심할 수 <b>${q.slip + q.blunder}</b>개</div>` +
        (S.worst.length ? `<ul>${S.worst.slice(0, 2).map(scene).join('')}</ul><div class="anfoot">📜 복기 버튼을 누르면 더 좋은 수를 보여줄게!</div>` : '<div class="anfoot">큰 실수 없이 잘 뒀어! 👏</div>');
    } else {
      box.innerHTML = `<div class="anh">📊 내 수 분석 <span style="color:var(--sub);font-weight:500">· ${S.n}수 · 같은 기준(AI 레벨과 무관)</span></div>
        <div class="anq"><span class="q good">✅ 좋은 수 ${q.good}</span><span class="q ok">👌 무난 ${q.ok}</span><span class="q slip">⚠️ 아쉬움 ${q.slip}</span><span class="q blunder">❌ 큰 실수 ${q.blunder}</span><span class="q acc">정확도 <b>${S.acc}%</b></span></div>${S.decided ? `<div class="anfoot" style="margin-top:2px">승부가 크게 기운 뒤의 ${S.decided}수는 평가에서 뺐어요.</div>` : ''}` +
        (S.worst.length ? `<div class="anh2">결정적 장면</div><ul>${S.worst.map(scene).join('')}</ul>` : '<div class="anfoot">큰 실수 없이 두었어요. 👏</div>');
    }
    box.querySelectorAll('.anjump').forEach(b => b.onclick = () => { Review.open(); Review.go(+b.dataset.k); });
  },
  status(html, cls) { const s = $('gStatus'); s.className = cls || ''; s.innerHTML = html; },
  info(t) { $('gInfo').innerHTML = t; },
  // 코치 경고: 판을 가리지 않고 옆 패널에 표시. 기본(Enter)은 '다시 생각하기', 판을 누르면 취소
  coachAsk(title, html, goLabel, backLabel) {
    return new Promise(resolve => {
      const box = $('gCoach'), kid = isKid();
      box.innerHTML = `<div class="coach cwarn" role="alertdialog" aria-label="${esc(title)}"><div class="ct">${kid ? '🐯 호돌 선생님' : '🧑‍🏫 코치'} · ${title}</div><div>${html}</div>
        <div class="cwbtns"><button id="cwBack" class="primary">${backLabel || '다시 생각하기'}</button><button id="cwGo" class="ghost">${goLabel || '그래도 두기'}</button></div>
        <div class="cwhelp">판의 빨간 표시를 확인해 보세요 · 판을 누르면 다시 고를 수 있어요</div></div>`;
      let done = false;
      const host = $('boardHost');
      const fin = v => { if (done) return; done = true; document.removeEventListener('keydown', key); host.removeEventListener('pointerdown', tap, true); if (!v) box.innerHTML = ''; resolve(v); };
      const key = e => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); fin(false); } };
      const tap = e => { e.stopPropagation(); e.preventDefault(); fin(false); };
      document.addEventListener('keydown', key);
      host.addEventListener('pointerdown', tap, true);
      $('cwBack').onclick = () => fin(false); $('cwGo').onclick = () => fin(true);
      Sound.play('err');
      setTimeout(() => { if (!done) { $('cwBack') && $('cwBack').focus({ preventScroll: true }); box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 30);
    });
  },
  coach(html) { $('gCoach').innerHTML = html ? `<div class="coach"><div class="ct">${isKid() ? '🐯 호돌 선생님' : '🧑‍🏫 코치'}</div>${html}</div>` : ''; },
  log(html, cls) { const d = document.createElement('div'); d.className = cls || ''; d.innerHTML = html; $('gLog').appendChild(d); $('gLog').scrollTop = 1e9; },
  buttons(list) {
    const box = $('gBtns'); box.innerHTML = '';
    list.filter(Boolean).forEach(b => { const e = document.createElement('button'); e.textContent = b.label; e.id = b.id; if (b.cls) e.className = b.cls; e.onclick = b.on; box.appendChild(e); });
  },
  // (이전 버전 호환) 판 한가운데를 가리던 토스트 대신 상단 알림 사용
  toast(main, sub, kind, prio) { Notify.show({ title: main, sub, kind: kind || 'info', prio: prio || 'feedback' }); },
  // 대국 사건 알림 (게임 코드에서 호출)
  notify(o) { Notify.show(o); },
  // 대국 사건 효과음 (+ 휴대폰 진동: 장군·체크를 받거나 기물을 잃을 때만 짧게)
  sfx(kind) {
    Sound.play(kind);
    if ((kind === 'lose' || kind === 'check') && Sound.enabled() && navigator.vibrate) { try { navigator.vibrate(kind === 'check' ? [40, 60, 40] : 35); } catch (e) {} }
  },
  // 대국 종료 → 기록 → 피드백 → 결과 화면 (저장이 실패해도 결과는 반드시 표시)
  finish(result, reason, fb) {
    if (this.ended) return;
    this.ended = true; stopProg();
    const g = this.game, lv = this.opts.level, mode = this.mode, u = Store.cur();
    if (mode !== 'tutorial') Resume.clear(g);
    let stats = null, feed = '', sug = '', nextTrain = null;
    try { if (fb.style && mode !== 'tutorial') Style.add(g, fb.style); } catch (e) { console.error(e); }
    try { stats = Store.record(g, mode, result, { level: lv, endLevel: fb.endLevel || lv, reason, moves: fb.moves || 0, hints: fb.hints || 0, warns: fb.warns || 0 }); } catch (e) { console.error(e); }
    let rtLine = '', achList = [];
    try {
      if (mode === 'match' && stats) {
        const rr = Progress.rate(u, g, lv, result), d = rr.to - rr.from; Store.save();
        rtLine = `<div class="rrating">📈 ${GAME_NAME[g]} 레이팅 <b>${rr.from} → ${rr.to}</b> <span class="${d >= 0 ? 'w' : 'lo'}">(${d >= 0 ? '+' : ''}${d})</span></div>`;
      }
      achList = Progress.check(u, { sdPure: g === 'sudoku' && result === 'win' && fb.n === 9 && !fb.hints && !fb.mistakes });
    } catch (e) { console.error(e); }
    if (mode === 'train') {
      const t = u.prefs.train[g];
      if (fb.lvf !== undefined) nextTrain = Math.max(1, Math.min(10, Math.round(fb.lvf + (result === 'win' ? 0.5 : result === 'loss' ? -0.5 : 0))));
      else nextTrain = result === 'win' ? Math.min(10, lv + 1) : result === 'loss' ? Math.max(1, lv - 1) : lv;
      u.prefs.train[g] = nextTrain; Store.save();
    }
    try { feed = Feedback.make(g, mode, result, reason, fb, nextTrain); } catch (e) { console.error(e); feed = '<div>피드백을 만드는 중 문제가 생겼어요.</div>'; }
    this._sugLv = null;
    if (mode === 'match') {
      const rec = Store.recent(g, 'match', lv, 3);
      if (rec.length === 3 && rec.every(r => r === 'win') && lv < 10) { this._sugLv = lv + 1; sug = `<div class="rsug">🔥 Lv.${lv}에서 3연속 ${g === 'sudoku' ? '완성' : '승리'}! 한 단계 올려볼까요?</div>`; }
      else if (rec.length === 3 && rec.every(r => r === 'loss') && lv > 1) { this._sugLv = lv - 1; sug = `<div class="rsug">💪 Lv.${lv}가 조금 어려운 것 같아요. 교육 모드에서 연습하거나 한 단계 낮춰 볼까요?</div>`; }
    }
    const emoji = result === 'win' ? '🏆' : result === 'loss' ? (g === 'sudoku' ? '🧩' : '😤') : '🤝';
    const big = g === 'sudoku' ? (result === 'win' ? '완성!' : '포기') : (result === 'win' ? '승리!' : result === 'loss' ? '패배' : '무승부');
    const sd = g === 'sudoku';
    const recLine = !stats ? '<span style="color:var(--loss)">기록 저장에 실패했어요 (브라우저 저장 공간 확인 필요)</span>'
      : `${esc(u.nick)}님의 ${GAME_NAME[g]} ${mn(mode)} 기록: ` + (sd ? `<span class="w">완성 ${stats.w}</span> · <span class="lo">포기 ${stats.l}</span>` : `<span class="w">${stats.w}승</span> <span class="lo">${stats.l}패</span> <span class="d">${stats.d}무</span>`);
    const again = mode === 'train' ? `${mn('train')} Lv.${nextTrain}로 다시` : '다시 하기';
    $('result').innerHTML = `<div class="rbox"><div class="remoji">${emoji}</div><div class="rbig ${result}">${big}</div><div class="rreason">${esc(reason)}</div>
      <div class="rfeed"><h4>💬 AI의 한줄평</h4>${feed}</div>${this.canAnalyze() ? '<div id="rAnalysis" class="ranal"></div>' : ''}${sug}<div class="rrec">${recLine}</div>${rtLine}<div id="rAch">${Progress.achHtml(achList)}</div>
      <div class="rbtns"><button id="rReview">판 보기</button>${this._sugLv ? `<button id="rLv" class="green">Lv.${this._sugLv}로 하기</button>` : ''}<button id="rAgain" class="primary">${again}</button><button id="rHome">홈으로</button></div></div>`;
    // 마지막 수(외통·체크메이트 등)를 판에서 볼 수 있도록 결과 화면을 잠깐 늦게 띄움. 기권·포기는 바로 표시
    const quick = /기권|포기/.test(reason), delay = quick ? 0 : this.aiDelay(sd ? 700 : 1300);
    if (!quick && !sd) {
      const kid = isKid(), big2 = { win: kid ? '이겼어! 🎉' : '대국 종료 — 승리!', loss: kid ? '아쉽게 졌어' : '대국 종료 — 패배', draw: '대국 종료 — 무승부' }[result];
      Notify.clear(); Notify.show({ kind: result === 'win' ? 'good' : result === 'loss' ? 'bad' : 'info', title: big2, sub: esc(reason) + ' · 마지막 장면을 확인하세요', prio: 'feedback', ms: delay + 400 });
    }
    this.status(`🏁 ${resLabel(g, result, mode)} — ${esc(reason)}`, result === 'loss' ? 'alert' : '');
    const myOpen = this._openSeq = (this._openSeq || 0) + 1;
    const reveal = () => { if (this._openSeq !== myOpen || !this.active || !this.ended) return; $('result').classList.remove('hidden'); if (result === 'win') setTimeout(confetti, 250); };
    if (delay) setTimeout(reveal, delay); else reveal();
    $('rAgain').onclick = () => this.open(g, Object.assign({}, this.opts, mode === 'train' ? { level: nextTrain } : {}));
    $('rHome').onclick = () => this.close();
    if (this._sugLv) $('rLv').onclick = () => { u.prefs.match[g] = this._sugLv; Store.save(); this.open(g, Object.assign({}, this.opts, { level: this._sugLv })); };
    $('rReview').onclick = () => {
      if (this.canAnalyze()) { Review.open(); return; }
      $('result').classList.add('hidden'); this.status(`${resLabel(g, result, mode)} — ${esc(reason)}`, result === 'loss' ? 'alert' : '');
    };
    if (this.canAnalyze()) {
      $('rReview').textContent = '📜 복기';
      this._logEntry = u && u.log && u.log[0] && u.log[0].game === g ? u.log[0] : null;
      Analysis.start(this.active, () => this.paintAnalysis());
    }
    Sound.play(result === 'win' ? 'win' : result === 'loss' ? 'loss' : 'draw');
    if (!sd) this.log(`■ 종료: ${RES_LABEL[result]} (${esc(reason)})`, 'sys');
  }
};

// ---------- 튜토리얼 ----------
const Tutorial = {
  start(g, i) { Shell.open(g, { mode: 'tutorial', lesson: i, level: 0 }); },
  paint(g, i) {
    const l = LESSONS[g][i];
    $('gLesson').innerHTML = `<div class="lesson"><div class="lt">레슨 ${i + 1} / ${LESSONS[g].length}</div><h4>${l.title}</h4><div>${l.text}</div><div class="task">🎯 ${l.task}</div></div>`;
  },
  // 각 게임에서 목표를 달성하면 호출
  pass(g, i, extra) {
    if (Shell.ended) return;
    Shell.ended = true;
    const u = Store.cur(), first = u.tut[g].indexOf(i) < 0;
    if (first) { u.tut[g].push(i); Store.save(); }
    const all = LESSONS[g].every((_, k) => u.tut[g].indexOf(k) >= 0);
    if (first && all) Store.record(g, 'tutorial', 'win', { level: 0, reason: `튜토리얼 ${LESSONS[g].length}개 레슨 완료`, moves: 0 });
    const tAch = first ? Progress.check(u) : [];
    const hasNext = i + 1 < LESSONS[g].length;
    Shell.toast('정답! 🎉', '', 'good'); Sound.play('win');
    setTimeout(() => {
      $('result').innerHTML = `<div class="rbox"><div class="remoji">${all && first ? '🎓' : '⭐'}</div><div class="rbig win" style="font-size:44px">${all && first ? '튜토리얼 완료!' : '잘했어요!'}</div>
        <div class="rreason">레슨 ${i + 1} · ${LESSONS[g][i].title}</div>
        <div class="rfeed">${extra || '이번 레슨을 통과했어요.'}${all && first ? `<br><br><b>${GAME_NAME[g]}의 기본을 모두 배웠어요!</b> 이제 <b>교육</b> 모드에서 AI 코치와 함께 실제 대국을 해 보세요.` : ''}</div>${Progress.achHtml(tAch)}
        <div class="rbtns"><button id="tAgain">다시 하기</button>${hasNext ? '<button id="tNext" class="primary">다음 레슨 →</button>' : `<button id="tTrain" class="primary">교육 대국 하러 가기</button>`}<button id="tHome">홈으로</button></div></div>`;
      $('result').classList.remove('hidden');
      if (all && first) setTimeout(confetti, 200);
      $('tAgain').onclick = () => this.start(g, i);
      $('tHome').onclick = () => Shell.close();
      if (hasNext) $('tNext').onclick = () => this.start(g, i + 1);
      else $('tTrain').onclick = () => { Home.mode[g] = 'train'; Shell.close(); };
    }, 700);
  },
  fail(msg) {
    const L = Shell.game && LESSONS[Shell.game] && LESSONS[Shell.game][Shell.opts && Shell.opts.lesson];
    Shell.toast(isKid() ? '아까워! 다시 해 보자' : '다시 해볼까요?', `${msg || '목표와 다른 수예요'}${L ? `<br>🎯 ${L.task}` : ''}<br><span style="opacity:.8">막히면 💡 힌트를 눌러 보세요</span>`, 'warn');
    Sound.play('err');
  }
};

// ---------- 진행 막대 · 워커 ----------
let _prog = null;
function startProg(ms) {
  const bar = $('gProg').firstElementChild, t0 = Date.now();
  clearInterval(_prog);
  _prog = setInterval(() => { bar.style.width = Math.min(100, (Date.now() - t0) / ms * 100) + '%'; }, 80);
}
function stopProg() { clearInterval(_prog); const b = $('gProg') && $('gProg').firstElementChild; if (b) b.style.width = '0'; }
function makeWorker(tagId) {
  const paths = {
    srcJanggi: './workers/janggi-worker.js',
    srcChess: './workers/chess-worker.js',
    srcGo: './workers/go-worker.js'
  };
  try { return paths[tagId] ? new Worker(paths[tagId]) : null; }
  catch (e) { console.error('Worker 생성 실패:', e); return null; }
}
function engineCall(ctx, msg, fallback, timeMs, minMs) {
  return new Promise(resolve => {
    const id = ++ctx.reqId, t0 = Date.now(), worker = ctx.worker;
    let done = false;
    let cancelTimer = null;
    const clearCancel = () => { if (ctx.cancel === cancel) ctx.cancel = null; };
    const cancel = () => {
      if (done) return;
      done = true; clearTimeout(cancelTimer); clearCancel();
      if (id === ctx.reqId) stopProg();
      resolve(null);
    };
    ctx.cancel = cancel;
    const safeFallback = () => {
      try { return fallback(); }
      catch (error) { console.error('AI 대체 탐색 실패:', error); return null; }
    };
    const finish = r => {
      if (done) return; done = true; clearTimeout(cancelTimer); clearCancel();
      const wait = Math.max(0, (minMs || 0) - (Date.now() - t0));
      setTimeout(() => { if (id === ctx.reqId) stopProg(); resolve(id === ctx.reqId ? r : null); }, wait);
    };
    const failWorker = () => {
      if (done) return;
      // A previous game's worker must never terminate a worker created by a newer game.
      if (id !== ctx.reqId) { finish(null); return; }
      if (ctx.worker === worker) ctx.worker = null;
      try { if (worker) worker.terminate(); } catch (e) {}
      setTimeout(() => finish(safeFallback()), 10);
    };
    startProg(Math.max(timeMs > 6000 ? timeMs : 1500, minMs || 0));
    if (!worker) { setTimeout(() => { if (done) return; finish(id === ctx.reqId ? safeFallback() : null); }, 40); return; }
    worker.onmessage = e => { if (e.data && e.data.id === id) finish(e.data.res); };
    worker.onerror = e => { e.preventDefault && e.preventDefault(); failWorker(); };
    try { worker.postMessage(Object.assign({ id }, msg)); }
    catch (error) { console.warn('AI Worker 메시지 전송 실패:', error); failWorker(); return; }
    cancelTimer = setTimeout(() => { if (!done && id === ctx.reqId) failWorker(); }, Math.max(1000, Number(timeMs) || 3000) + 10000);
  });
}
// ---------- 보조 계산(코치·힌트)용 Worker: 화면이 멈추지 않도록 백그라운드에서 계산 ----------
function helperCall(ctx, key, src, msg, fallback, timeMs) {
  const safe = () => { try { return fallback(); } catch (e) { console.error('보조 계산 대체 실패:', e); return null; } };
  return new Promise(resolve => {
    let h = ctx[key];
    if (!h) {
      const w = makeWorker(src);
      if (!w) { setTimeout(() => resolve(safe()), 0); return; }
      h = ctx[key] = { w, pend: new Map(), n: 0 };
      const hh = h;
      w.onmessage = e => { const d = e.data, q = d && hh.pend.get(d.id); if (q) { hh.pend.delete(d.id); clearTimeout(q.t); q.resolve(d.res); } };
      w.onerror = e => {
        if (e && e.preventDefault) e.preventDefault();
        try { w.terminate(); } catch (x) {}
        if (ctx[key] === hh) ctx[key] = null;
        hh.pend.forEach(q => { clearTimeout(q.t); q.resolve(q.fb()); }); hh.pend.clear();
      };
    }
    const id = 'h' + (++h.n), hh = h;
    const t = setTimeout(() => { if (!hh.pend.has(id)) return; hh.pend.delete(id); resolve(safe()); }, (timeMs || 3000) + 5000);
    h.pend.set(id, { resolve, t, fb: safe });
    try { h.w.postMessage(Object.assign({ id }, msg)); }
    catch (e) { h.pend.delete(id); clearTimeout(t); resolve(safe()); }
  });
}
function helperStop(ctx, key) {
  const h = ctx[key]; if (!h) return;
  try { h.w.terminate(); } catch (e) {}
  h.pend.forEach(q => { clearTimeout(q.t); q.resolve(null); }); h.pend.clear();
  ctx[key] = null;
}
// ---------- 대국 후 분석 (AI 레벨과 무관하게 같은 기준으로 내 수를 평가) ----------
const CLS_INFO = {
  good: { n: '좋은 수', k: '좋은 수', icon: '✅', cls: 'good' },
  ok: { n: '무난한 수', k: '괜찮은 수', icon: '👌', cls: 'ok' },
  slip: { n: '아쉬운 수', k: '아까운 수', icon: '⚠️', cls: 'slip' },
  blunder: { n: '큰 실수', k: '조심할 수', icon: '❌', cls: 'blunder' }
};
function lossText(a) {
  if (!a) return '';
  if (a.unit === 'wr') return `승률 -${Math.round(a.loss * 100)}%p`;
  if (a.loss >= 1500) return '결정적 손해';
  return a.unit === 'pawn' ? `-${(a.loss / 100).toFixed(1)}폰` : `-${(a.loss / 100).toFixed(1)}점`;
}
const Analysis = {
  token: 0, workers: [], data: null, state: 'idle', progress: 0,
  cancel() { this.token++; this.workers.forEach(w => { try { w.terminate(); } catch (e) {} }); this.workers = []; this.state = 'idle'; },
  runPool(jobs, token, onProgress) {
    return new Promise(resolve => {
      const list = jobs.list, results = new Array(list.length);
      if (!list.length) { resolve(results); return; }
      let next = 0, done = 0, finished = false;
      const finish = () => { if (finished) return; finished = true; this.workers.forEach(w => { try { w.terminate(); } catch (e) {} }); this.workers = []; resolve(results); };
      const settle = (i, r) => { if (token !== this.token || finished) return; results[i] = r; done++; onProgress(done / list.length); if (done >= list.length) finish(); };
      const runLocal = i => setTimeout(() => {
        if (token !== this.token) return;
        let r = null; try { r = list[i].local(); } catch (e) { console.warn('분석 대체 계산 실패', e); }
        settle(i, r); pumpLocal();
      }, 0);
      const pumpLocal = () => { if (token !== this.token || finished) return; if (next < list.length) runLocal(next++); };
      const n = Math.max(1, Math.min(jobs.parallel || 1, list.length));
      let started = 0;
      for (let k = 0; k < n; k++) {
        const w = makeWorker(jobs.src);
        if (!w) break;
        started++; this.workers.push(w);
        let cur = -1, timer = null;
        const feed = () => {
          if (token !== this.token || finished) return;
          if (next >= list.length) return;
          cur = next++;
          clearTimeout(timer);
          timer = setTimeout(() => { try { w.terminate(); } catch (e) {} const i = cur; cur = -1; settle(i, null); pumpLocal(); }, 20000);
          try { w.postMessage(Object.assign({ id: 'an' + cur }, list[cur].msg)); } catch (e) { clearTimeout(timer); const i = cur; cur = -1; runLocal(i); }
        };
        w.onmessage = e => { if (!e.data || e.data.id !== 'an' + cur) return; clearTimeout(timer); const i = cur; cur = -1; settle(i, e.data.res); feed(); };
        w.onerror = e => { if (e.preventDefault) e.preventDefault(); clearTimeout(timer); try { w.terminate(); } catch (x) {} if (cur >= 0) { const i = cur; cur = -1; runLocal(i); } };
        feed();
      }
      if (!started) pumpLocal();
    });
  },
  async start(mod, onUpdate) {
    this.cancel();
    const token = this.token;
    this.data = null; this.state = 'running'; this.progress = 0;
    let jobs;
    try { jobs = mod.review.jobs(); } catch (e) { console.error(e); this.state = 'failed'; onUpdate(); return; }
    if (jobs.skip) { this.state = 'skipped'; this.skip = jobs.skip; onUpdate(); return; }
    if (!jobs.list.length) { this.state = 'empty'; onUpdate(); return; }
    const results = await this.runPool(jobs, token, p => { this.progress = p; onUpdate(); });
    if (token !== this.token) return;
    try { this.data = mod.review.judge(jobs, results); this.state = 'done'; }
    catch (e) { console.error('분석 결과 해석 실패', e); this.state = 'failed'; }
    onUpdate();
  },
  summary() {
    const d = this.data || {}, q = { good: 0, ok: 0, slip: 0, blunder: 0 }, all = Object.keys(d).map(Number), keys = all.filter(i => !d[i].decided);
    keys.forEach(i => q[d[i].cls]++);
    const n = keys.length, decided = all.length - keys.length, acc = n ? Math.round((q.good + q.ok * 0.8 + q.slip * 0.4) / n * 100) : 0;
    const worst = keys.filter(i => d[i].cls === 'blunder' || d[i].cls === 'slip').sort((a, b) => d[b].loss - d[a].loss).slice(0, 3);
    return { q, n, acc, worst, decided };
  }
};
// ---------- 복기 화면 ----------
const Review = {
  k: 0, mod: null, keyH: null,
  open() {
    const mod = Shell.active; if (!mod || !mod.review || !mod.review.len()) return;
    this.mod = mod; $('result').classList.add('hidden'); Notify.clear();
    const kid = isKid();
    $('gBtns').classList.add('rv'); document.body.classList.add('reviewing');
    Shell.buttons([
      { id: 'rvFirst', label: '⏮ 처음', on: () => this.go(0) },
      { id: 'rvPrev', label: '◀ 이전', on: () => this.go(this.k - 1) },
      { id: 'rvNext', label: '다음 ▶', cls: 'primary', on: () => this.go(this.k + 1) },
      { id: 'rvBad', label: kid ? '🔎 조심할 수' : '⚠️ 다음 실수', on: () => this.nextMistake() },
      { id: 'rvLast', label: '마지막 ⏭', on: () => this.go(mod.review.len()) },
      { id: 'rvRes', label: '결과 보기', on: () => { $('result').classList.remove('hidden'); } }
    ]);
    if (this.keyH) document.removeEventListener('keydown', this.keyH);
    this.keyH = e => {
      if (!this.mod || !$('result').classList.contains('hidden') || !$('modal').classList.contains('hidden')) return;
      if (e.key === 'ArrowLeft') { this.go(this.k - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { this.go(this.k + 1); e.preventDefault(); }
    };
    document.addEventListener('keydown', this.keyH);
    this.paintList();
    this.go(Math.min(1, mod.review.len()));
  },
  close() { if (this.keyH) document.removeEventListener('keydown', this.keyH); this.keyH = null; this.mod = null; $('gBtns').classList.remove('rv'); document.body.classList.remove('reviewing'); },
  paintList() {
    if (!this.mod) return;
    const mv = this.mod.review.moves(), d = Analysis.data || {}, kid = isKid();
    const head = Analysis.state === 'running' ? `<div class="rvnote">🔍 내 수 분석 중… ${Math.round(Analysis.progress * 100)}%</div>` : Analysis.state === 'skipped' ? `<div class="rvnote">${esc(Analysis.skip || '')}</div>` : '';
    $('gExtra').innerHTML = `<div class="card rvbox"><div class="wrl" style="margin-bottom:6px"><span><b>📜 복기</b> · ← → 키로 이동</span><span id="rvPos"></span></div>${head}<div class="rvlist" id="rvList">${mv.map((m, i) => {
      const a = d[i] && !d[i].decided ? d[i] : null, c = a ? CLS_INFO[a.cls] : null;
      return `<button class="rvm ${m.h ? 'me' : 'ai'} ${c ? 'c-' + c.cls : ''}" data-k="${i + 1}" title="${c ? (kid ? c.k : c.n) : ''}"><span class="rvn">${esc(m.lab)}</span>${esc(m.txt)}${c && a.cls !== 'good' && a.cls !== 'ok' ? ` <i>${c.icon}</i>` : ''}</button>`;
    }).join('')}</div></div>`;
    $('rvList').onclick = e => { const b = e.target.closest('.rvm'); if (b) this.go(+b.dataset.k); };
  },
  go(k) {
    if (!this.mod) return;
    const N = this.mod.review.len();
    k = Math.max(0, Math.min(N, k)); this.k = k;
    const d = Analysis.data || {}, a = k > 0 ? d[k - 1] : null;
    this.mod.review.show(k, a && a.best && a.cls !== 'good' ? a.best : 0);
    const mv = this.mod.review.moves(), kid = isKid();
    let html;
    if (k === 0) html = '처음 배치예요. <b>다음 ▶</b>을 눌러 한 수씩 넘겨 보세요.';
    else {
      const m = mv[k - 1];
      html = `<b>${m.no}수째 · ${m.h ? '내 수' : 'AI 수'}</b>: ${esc(m.txt)}`;
      if (a && a.decided) html += `<br><span style="color:var(--sub)">이미 승부가 크게 기운 뒤라 평가에서 뺐어요.</span>${a.best && a.cls !== 'good' ? `<br>💡 추천 수: <b>${esc(a.bestTxt)}</b>` : ''}`;
      else if (a) {
        const c = CLS_INFO[a.cls];
        html += `<br>${c.icon} <b>${kid ? c.k : c.n}</b>${a.cls === 'good' ? '' : ` <span style="color:var(--sub)">(${lossText(a)})</span>`}`;
        if (a.best && a.cls !== 'good') html += `<br>💡 ${kid ? '이렇게 두면 더 좋았어' : '추천 수'}: <b>${esc(a.bestTxt)}</b> <span style="color:var(--sub)">(파란 표시)</span>`;
      } else if (m.h && Analysis.state === 'running') html += '<br><span style="color:var(--sub)">분석 중이에요…</span>';
    }
    Shell.coach(html);
    Shell.status(`📜 복기 ${k} / ${N}`, '');
    const pos = $('rvPos'); if (pos) pos.textContent = `${k} / ${N}`;
    document.querySelectorAll('#rvList .rvm').forEach(b => b.classList.toggle('cur', +b.dataset.k === k));
    const cur = document.querySelector('#rvList .rvm.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
    if ($('rvPrev')) $('rvPrev').disabled = k <= 0;
    if ($('rvNext')) $('rvNext').disabled = k >= N;
  },
  nextMistake() {
    const d = Analysis.data || {};
    const idx = Object.keys(d).map(Number).filter(i => !d[i].decided && (d[i].cls === 'blunder' || d[i].cls === 'slip') && i + 1 > this.k).sort((a, b) => a - b)[0];
    if (idx === undefined) { Shell.toast(Analysis.state === 'running' ? '아직 분석 중이에요' : '더 이상 실수가 없어요', '', 'info'); return; }
    this.go(idx + 1);
  }
};
// ---------- 교육 모드: 대국 중 실력에 맞춰 AI 레벨 조절 ----------
// 사람이 둔 수마다 품질(좋음/보통/아쉬움/큰 실수)을 매겨 레벨 값을 올리고 내림
const Adapt = {
  STEP: { good: 0.34, ok: 0, slip: -0.4, blunder: -0.8 },
  init(G, base) { G.lvf = base; G.lvNow = base; G.lvPath = [base]; G.quality = { good: 0, ok: 0, slip: 0, blunder: 0 }; G.hintThisTurn = false; },
  // rank: 내 수보다 평가가 높은 후보 수의 개수(0 = 최선). 손실이 작아도 상위 3수 안이 아니면 '좋은 수'로 보지 않음
  classify(loss, th, rank) {
    if (loss <= th[0] && (rank === undefined || rank === null || rank < 3 || loss <= th[0] / 4)) return 'good';
    if (loss <= th[1]) return 'ok'; if (loss <= th[2]) return 'slip'; return 'blunder';
  },
  step(G, q) {
    if (!G || G.mode !== 'train' || !q) return;
    G.quality[q]++;
    let d = this.STEP[q];
    if (q === 'good' && G.hintThisTurn) d = 0;          // 힌트로 찾은 좋은 수는 레벨을 올리지 않음
    G.hintThisTurn = false;
    G.lvf = Math.max(1, Math.min(10, G.lvf + d));
    const nl = Math.round(G.lvf);
    if (nl !== G.lvNow) {
      const up = nl > G.lvNow; G.lvNow = nl; G.lvPath.push(nl); Sound.play(up ? 'up' : 'down');
      if (isKid()) Shell.toast(up ? `AI가 더 세졌어! ⬆` : `AI가 조금 쉬워졌어 ⬇`, up ? '네가 잘하고 있어서 그래!' : '천천히 해 보자', up ? 'good' : 'info', 'major');
      else Shell.toast(`AI 레벨 ${up ? '⬆' : '⬇'} Lv.${nl}`, up ? '좋은 수가 이어져서 더 세게 둘게요' : '조금 쉽게 둘게요', up ? 'good' : 'info', 'major');
      Shell.log(`· AI 레벨 ${up ? '상승' : '하락'} → Lv.${nl}`, 'sys');
    }
    this.paint(G);
  },
  html(G) { return `<div class="adapt"><div class="wrl"><span>🎚️ AI 레벨 <b id="adLv" style="color:var(--acc);font-size:15px">Lv.${G.lvNow}</b></span><span id="adQ"></span></div><div class="adbar"><i id="adBar" style="width:${(G.lvf - 1) / 9 * 100}%"></i></div><div class="wrl" style="margin-top:3px"><span>내 수를 보고 대국 중에 조절돼요</span><span>Lv.10</span></div></div>`; },
  paint(G) {
    const e = $('adLv'); if (!e) return;
    const u = Store.cur(); if (u && G.game !== 'sudoku') $('gVs').innerHTML = `<b>${esc(u.nick)}</b> vs <b>AI Lv.${G.lvNow}</b>`;
    e.textContent = `Lv.${G.lvNow}`; $('adBar').style.width = ((G.lvf - 1) / 9 * 100) + '%';
    const q = G.quality; $('adQ').textContent = `👍${q.good} · 😐${q.ok} · ⚠️${q.slip + q.blunder}`;
  }
};

// ---------- 기풍 · 성향 분석 ----------
const Style = {
  MIN: 3,
  add(g, st) {
    const u = Store.cur(); if (!u) return;
    const a = u.style[g] || (u.style[g] = { games: 0 });
    a.games++;
    Object.keys(st).forEach(k => {
      const v = st[k];
      if (typeof v === 'number') a[k] = (a[k] || 0) + v;
      else if (v && typeof v === 'object') { a[k] = a[k] || {}; Object.keys(v).forEach(kk => a[k][kk] = (a[k][kk] || 0) + v[kk]); }
    });
    Store.save();
  },
  top(obj, names) { let best = null, bv = 0; Object.keys(obj || {}).forEach(k => { if (obj[k] > bv && names[k]) { bv = obj[k]; best = k; } }); return best ? names[best] : null; },
  speed(a) { const t = a.thinkN ? a.think / a.thinkN : 0; return t < 4 ? ['⚡ 속공형', `한 수 평균 ${t.toFixed(1)}초`] : t > 15 ? ['🐢 신중형', `한 수 평균 ${t.toFixed(1)}초`] : ['⏱️ 보통 속도', `한 수 평균 ${t.toFixed(1)}초`]; },
  profile(g, a) {
    const chips = [], ev = [];
    if (g === 'janggi' || g === 'chess') {
      const aggr = a.moves ? (a.caps + a.checks) / a.moves : 0, adv = a.moves ? a.adv / a.moves : 0;
      chips.push(aggr >= 0.22 || adv >= 0.45 ? '⚔️ 공격형' : aggr <= 0.1 && adv < 0.3 ? '🛡️ 수비형' : '⚖️ 균형형');
      ev.push(`잡기·${g === 'janggi' ? '장군' : '체크'} ${Math.round(aggr * 100)}% · 전진 ${Math.round(adv * 100)}%`);
      const sp = this.speed(a); chips.push(sp[0]); ev.push(sp[1]);
      const fav = this.top(a.use, g === 'janggi' ? { 4: '마', 5: '차', 6: '포', 3: '상', 7: '졸' } : { 2: '나이트', 3: '비숍', 4: '룩', 5: '퀸', 1: '폰' });
      if (fav) chips.push(`❤️ ${fav} 애용`);
      if (g === 'janggi') { const p = this.top(a.pat, { '마상마상': '마상마상', '상마상마': '상마상마', '마상상마': '마상상마', '상마마상': '상마마상' }); if (p) ev.push(`자주 쓰는 상차림: ${p}`); }
      if (g === 'chess') {
        if (a.castled) ev.push(`캐슬링 ${a.castled}/${a.games}판 · 평균 ${Math.round(a.castleMove / a.castled)}수째`); else ev.push('아직 캐슬링을 한 판이 없어요');
        if (a.earlyQ / a.games >= 0.5) chips.push('👑 퀸 조기 출동');
      }
    } else if (g === 'go') {
      const contact = a.moves ? a.contact / a.moves : 0;
      chips.push(contact >= 0.5 ? '🔥 싸움형' : contact <= 0.3 ? '🌿 평화형' : '⚖️ 균형형');
      ev.push(`상대 돌에 붙여 두는 비율 ${Math.round(contact * 100)}%`);
      if (a.l3 + a.l4 >= 5) { chips.push(a.l4 > a.l3 ? '🏯 세력형' : '💰 실리형'); ev.push(`초반 3선 ${a.l3} · 4선 ${a.l4}`); }
      const sp = this.speed(a); chips.push(sp[0]); ev.push(sp[1]);
    } else {
      const memo = a.inputs ? a.memo / a.inputs : 0, mis = a.games ? a.mistakes / a.games : 0;
      chips.push(memo >= 0.2 ? '✏️ 메모 활용형' : '🧠 암산형');
      chips.push(mis <= 1 ? '🎯 정확형' : mis >= 4 ? '🏃 빠른 시도형' : '⚖️ 보통');
      ev.push(`메모 사용 ${Math.round(memo * 100)}% · 판당 실수 ${mis.toFixed(1)}개 · 평균 ${Math.round((a.sec || 0) / a.games / 60)}분`);
    }
    if (a.warns) { const h = a.heeded / a.warns; chips.push(h >= 0.7 ? '👀 위험 감지 우수' : h < 0.4 ? '🎲 과감한 선택' : '🙂 경고 반반'); ev.push(`코치 경고 ${a.warns}번 중 ${a.heeded}번 다시 생각`); }
    if (a.games && a.hints / a.games >= 3) chips.push('💡 힌트 활용형');
    return { chips, ev };
  },
  card(g, u) {
    const a = u.style[g];
    const head = `<h4>${GAME_ICON[g]} ${GAME_NAME[g]}</h4>`;
    if (!a || a.games < this.MIN) {
      const n = a ? a.games : 0;
      return `<div class="scard">${head}<div style="color:var(--sub)">${mn('train')}·${mn('match')} 모드로 <b>${this.MIN - n}판</b> 더 하면 분석돼요</div><div class="pbar" style="width:100%;margin-top:8px"><i style="width:${n / this.MIN * 100}%"></i></div></div>`;
    }
    const p = this.profile(g, a);
    return `<div class="scard">${head}<div>${p.chips.map(c => `<span class="chip">${c}</span>`).join('')}</div><div class="ev">${p.ev.join('<br>')}<br>근거: ${a.games}판 · ${a.moves || a.inputs || 0}${g === 'sudoku' ? '번 입력' : '수'}</div></div>`;
  }
};
// 사람 수 기록 공통
function stNew(extra) { return Object.assign({ moves: 0, caps: 0, checks: 0, adv: 0, think: 0, thinkN: 0, warns: 0, heeded: 0, hints: 0, use: {} }, extra || {}); }
function stThink(G) { if (G.turnT) { const t = (Date.now() - G.turnT) / 1000; if (t < 120) { G.st.think += t; G.st.thinkN++; } } }

// ---------- 피드백 ----------
const Feedback = {
  pick(a) { return a[Math.floor(Math.random() * a.length)]; },
  make(game, mode, result, reason, fb, nextTrain) {
    if (isKid()) return this.kid(game, mode, result, fb, nextTrain);
    if (game === 'sudoku') return this.sudoku(mode, result, fb, nextTrain);
    const lines = [], n = fb.moves || 0, lv = Shell.opts.level;
    if (/기권/.test(reason) && result === 'loss') lines.push(`${n}수에서 기권했어요. 어디서 흐름이 기울었는지 짚어볼게요.`);
    else if (result === 'win') lines.push(`${n}수 만에 AI Lv.${lv}을 이겼어요! 🎉`);
    else if (result === 'loss') lines.push(`${n}수 대국이었어요. 아래 분석에서 흐름이 바뀐 수를 확인해 보세요.`);
    else lines.push(`비긴 판이에요. ${n}수 동안 팽팽하게 맞섰어요.`);
    const ul = [];
    (fb.extra || []).forEach(x => ul.push(x));
    if (mode === 'train') {
      const parts = [];
      if (fb.hints) parts.push(`힌트 <b>${fb.hints}번</b>`);
      if (fb.warns) parts.push(`코치 경고 <b>${fb.warns}번</b> (그중 ${fb.heeded || 0}번은 다시 생각했어요)`);
      if (fb.undos) parts.push(`무르기 <b>${fb.undos}번</b>`);
      if (parts.length) ul.push('이번 판에서 쓴 도움: ' + parts.join(' · '));
      if (fb.warns && fb.heeded === fb.warns) ul.push('코치 경고를 모두 받아들였어요. 위험을 알아차리는 눈이 생기고 있어요 👀');
      else if (fb.warns >= 2 && (fb.heeded || 0) < fb.warns / 2) ul.push('경고를 무시하고 둔 수가 많았어요. 경고가 뜨면 상대가 무엇을 잡을 수 있는지 먼저 살펴보세요.');
      if (fb.lvPath && fb.lvPath.length > 1) ul.push(`<b>이번 판 AI 레벨 변화</b>: ${fb.lvPath.map(x => 'Lv.' + x).join(' → ')}`);
      if (fb.quality) { const q = fb.quality; ul.push(`<b>내 수 분석</b>: 좋은 수 ${q.good} · 보통 ${q.ok} · 아쉬운 수 ${q.slip} · 큰 실수 ${q.blunder}`); }
      ul.push(`<b>다음 ${mn('train')} 시작 레벨</b>: Lv.${nextTrain}`);
    }
    const tip = this.tip(game, result, reason);
    if (tip) ul.push(`<b>다음 판 팁</b>: ${tip}`);
    return `<div>${lines.join(' ')}</div><ul>${ul.map(x => `<li>${x}</li>`).join('')}</ul>`;
  },
  kid(game, mode, result, fb, nextTrain) {
    let stars = result === 'win' ? 3 : result === 'draw' ? 2 : 1;
    if (result === 'win' && (fb.hints || 0) > 2) stars = 2;
    const head = result === 'win' ? this.pick(['정말 잘했어! 최고야! 🎉', '멋지게 이겼어! 👏', '와, 대단해! 🌟'])
      : result === 'draw' ? '비겼어! 팽팽한 승부였어 🤝' : this.pick(['괜찮아! 다음엔 더 잘할 수 있어 💪', '아깝다! 한 번 더 해볼까? 😊']);
    const ul = [];
    const q = fb.quality;
    if (q && q.good) ul.push(`좋은 수를 <b>${q.good}번</b>이나 뒀어! ⭐`);
    if (fb.heeded) ul.push(`선생님 말을 듣고 <b>${fb.heeded}번</b> 다시 생각했어. 훌륭해! 👀`);
    if (game === 'sudoku' && result === 'win') ul.push(fb.mistakes ? `틀린 숫자 ${fb.mistakes}개를 고치면서 끝까지 해냈어!` : '하나도 안 틀리고 다 맞혔어!');
    if (fb.lvPath && fb.lvPath.length > 1 && fb.lvPath[fb.lvPath.length - 1] > fb.lvPath[0]) ul.push('네가 잘해서 AI가 점점 세졌어! 🔥');
    const tips = { janggi: '장을 지켜 주는 사(士)를 장 옆에 붙여 두자!', chess: '움직이기 전에 내 기물이 잡히지 않는지 한 번 더 보자!', go: '돌을 이어서 활로(숨구멍)를 많이 만들자!', sudoku: '가로줄, 세로줄, 상자를 차례대로 살펴보자!' };
    ul.push(`🐯 다음엔: ${tips[game]}`);
    if (mode === 'train' && nextTrain) ul.push(`다음 연습은 <b>Lv.${nextTrain}</b>이야!`);
    return `<div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><div><b>${head}</b></div><ul>${ul.map(x => `<li>${x}</li>`).join('')}</ul>`;
  },
  sudoku(mode, result, fb, nextTrain) {
    const ul = [], mm = Math.floor(fb.sec / 60), ss = String(fb.sec % 60).padStart(2, '0');
    const head = result === 'win'
      ? (fb.hints === 0 && fb.mistakes === 0 ? '힌트도 실수도 없이 완벽하게 풀었어요! 👏' : fb.hints === 0 ? '힌트 없이 스스로 완성했어요.' : '끝까지 완성했어요. 힌트를 잘 활용했어요.')
      : '이번 퍼즐은 여기서 멈췄어요. 막힌 지점을 짚어볼게요.';
    ul.push(`걸린 시간 <b>${mm}:${ss}</b> · 힌트 <b>${fb.hints}번</b> · 틀린 입력 <b>${fb.mistakes}번</b>`);
    ul.push(`이 퍼즐에 필요한 기술: <b>${fb.techName}</b>`);
    if (fb.hintTechs && fb.hintTechs.length) ul.push(`힌트를 받은 기술: ${fb.hintTechs.join(', ')} — 다음엔 이 기술을 먼저 떠올려 보세요.`);
    if (fb.mistakes >= 3) ul.push('숫자를 넣기 전에 같은 줄·상자에 이미 있는지 한 번 더 확인하면 실수가 줄어요.');
    if (result === 'loss' && fb.filled !== undefined) ul.push(`빈칸 ${fb.total}개 중 <b>${fb.filled}개</b>를 채웠어요.`);
    if (mode === 'train') ul.push(`<b>다음 교육 퍼즐</b>: Lv.${nextTrain}`);
    ul.push(`<b>다음 팁</b>: ${fb.n === 9 ? '어려워지면 메모 모드로 후보 숫자를 적어 두고, 후보가 하나 남은 칸부터 채워 보세요.' : '가로줄 → 세로줄 → 상자 순서로 빠진 숫자를 찾아보세요.'}`);
    return `<div>${head}</div><ul>${ul.map(x => `<li>${x}</li>`).join('')}</ul>`;
  },
  tip(game, result, reason) {
    if (game === 'janggi') {
      if (/외통/.test(reason) && result === 'loss') return '궁성 안 사(士)가 흩어지면 차·포 연계 공격에 약해져요. 사 두 개를 장 옆에 붙여 두세요.';
      if (/빅장/.test(reason)) return '빅장 규칙을 활용하면 불리한 판을 무승부로 돌릴 수 있어요.';
      if (result === 'loss') return this.pick(['상대 포가 넘을 다리(기물)가 생기는 순간을 조심하세요.', '차를 너무 일찍 깊이 들여보내면 고립되기 쉬워요.', '졸을 하나씩 전진시켜 마·상의 길을 열어주는 게 기본이에요.']);
      return '레벨을 올려서 한 번 더 도전해 보세요!';
    }
    if (game === 'chess') {
      if (/체크메이트/.test(reason) && result === 'loss') return '킹 앞 폰을 함부로 밀지 말고, 캐슬링을 일찍 해서 킹을 안전하게 두세요.';
      if (/스테일메이트/.test(reason)) return '크게 이기고 있을 때는 상대 킹에게 움직일 칸을 남겨 두세요.';
      if (result === 'loss') return this.pick(['수를 두기 전에 "상대가 체크/잡기/위협할 수 있는 수"를 먼저 확인하세요.', '중앙(e4·d4)을 먼저 차지하고 나이트·비숍을 빨리 전개하세요.', '같은 기물을 오프닝에서 두 번 움직이는 건 손해예요.']);
      return '다음엔 레벨을 올려서 더 깊은 수읽기와 붙어보세요.';
    }
    if (game === 'go') {
      if (result === 'loss') return this.pick(['약한 돌을 먼저 살리고 공격하세요. 두 집을 만드는 게 우선이에요.', '큰 자리(귀→변→중앙)를 먼저 차지해 보세요.', '단수에 몰린 돌을 무리하게 끌고 나가면 손해가 커져요(축 주의).']);
      return '형세 판단 버튼으로 중간중간 집 계산을 해보면 더 안정적으로 이길 수 있어요.';
    }
    return '';
  }
};

function confetti() {
  const c = $('confetti'), x = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight; c.classList.remove('hidden');
  const cols = ['#e0a84a', '#2fbf71', '#3b82f6', '#ef4444', '#f5f5f5', '#a855f7'];
  const ps = Array.from({ length: 160 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, s: 5 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0] }));
  let f = 0;
  (function step() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += .03; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (++f < 220) requestAnimationFrame(step); else { c.classList.add('hidden'); x.clearRect(0, 0, c.width, c.height); }
  })();
}
function boardPx(ratio) {
  const wide = innerWidth > 900;
  const w = wide ? innerWidth - 410 : innerWidth - 32;
  const h = innerHeight - 90;
  return Math.max(280, Math.floor(Math.min(w, h * (1 / (ratio || 1)), 820)));
}