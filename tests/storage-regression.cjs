'use strict';
// Exercises the actual Store/Backup logic in a minimal VM without a DOM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function memoryStorage() {
  const data = Object.create(null);
  return {
    getItem: k => Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null,
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
    _data: data
  };
}
const localStorage = memoryStorage(), sessionStorage = memoryStorage();
const testConsole = Object.assign({}, console, { warn: () => {} });
const context = vm.createContext({
  window: { localStorage, sessionStorage }, console: testConsole, setTimeout, clearTimeout, setInterval, clearInterval,
  Date, Math, JSON, Object, Array, Number, String, RegExp, Uint8Array, Uint32Array, TextEncoder,
  Blob, URL, Intl, Map, Set, Promise
});
vm.runInContext(fs.readFileSync(require.resolve('../js/lessons.js'), 'utf8'), context);
const core = fs.readFileSync(require.resolve('../js/core.js'), 'utf8') + '\n;globalThis.__test = { Store, Backup, Adapt, Progress, Resume };';
vm.runInContext(core, context);
const { Store, Backup, Adapt, Progress, Resume } = context.__test;

// Corrupt JSON must not crash startup or leave an unusable root object.
localStorage.setItem('boardArena.v3', '{bad json');
Store.load();
assert.deepEqual(Object.keys(Store.data.users), []);
assert.ok(Store.data.fails && typeof Store.data.fails === 'object');

// Malformed persisted nested values must be normalized before use/rendering.
localStorage.setItem('boardArena.v3', JSON.stringify({
  users: {
    tester: {
      id: 'Tester', nick: '<img src=x onerror=alert(1)>', salt: '0'.repeat(32), hash: 'a'.repeat(64),
      prefs: { ui: 'evil', match: { chess: '<script>' }, train: { go: 99 } },
      stats: { chess: { match: { w: '<img>', l: 2, d: 0, best: '<svg>' } } },
      tut: { chess: [0, 1, -1, 999, 'x'] },
      log: [
        { game: 'chess', mode: 'match', result: 'win', date: 1, reason: '<img onerror=alert(1)>', level: 2, moves: 'bad' },
        { game: 'bad', mode: 'match', result: 'win' },
        { game: 'chess', mode: 'broken', result: 'win' }
      ],
      style: { chess: { games: '<script>', moves: 12, use: { '2': 4, '<img>': 99 } } }
    }
  }, session: 'missing', fails: { tester: { n: 'bad', until: '<script>' } }
}));
Store.load();
const user = Store.data.users.tester;
assert.ok(user, 'valid user key should be preserved');
assert.equal(user.prefs.ui, 'normal');
assert.equal(user.prefs.match.chess, 2);
assert.equal(user.prefs.train.go, 10);
assert.equal(user.stats.chess.match.w, 0);
assert.equal(user.stats.chess.match.l, 2);
assert.equal(user.stats.chess.match.best, 0);
assert.equal(user.log.length, 1, 'invalid log entries should be removed');
assert.equal(user.log[0].reason, '<img onerror=alert(1)>', 'text is preserved for HTML escaping at render time');
assert.equal(user.log[0].moves, 0);
assert.equal(user.style.chess.games, 0);
assert.equal(user.style.chess.moves, 12);
assert.equal(user.style.chess.use['2'], 4);
assert.equal(user.style.chess.use['<img>'], undefined);
assert.equal(Store.data.session, null, 'stale session should be discarded');

// Backup import is normalized too; arbitrary counters and unsupported records cannot reach HTML templates.
const restored = Backup.validate({ app: 'hansu', kind: 'backup', ver: 1, user: {
  id: 'Tester', nick: '<script>alert(1)</script>', stats: { chess: { match: { w: '<svg onload=x>' } } },
  log: [{ game: 'chess', mode: 'match', result: 'win', reason: '<script>', date: 1 }, { game: 'bad', mode: 'match', result: 'win' }]
} });
assert.equal(restored.stats.chess.match.w, 0);
assert.equal(restored.log.length, 1);
assert.equal(restored.hash, null, 'missing/invalid password hash should require password reset on restore');
assert.throws(() => Backup.validate({ app: 'hansu', kind: 'backup', ver: 99, user: { id: 'Tester' } }));

// Persistent login must clear a stale sessionStorage login, because it takes precedence in sessionId().
Store.data.users.tester = user;
Store.data.users.other = Object.assign({}, user, { id: 'Other' });
sessionStorage.setItem('boardArena.session', 'other');
Store.setSession('tester', true);
assert.equal(sessionStorage.getItem('boardArena.session'), null);
assert.equal(Store.sessionId(), 'tester');
sessionStorage.setItem('boardArena.session', 'deleteduser');
assert.equal(Store.sessionId(), 'tester', 'invalid tab session must fall back to valid persistent session');
assert.equal(sessionStorage.getItem('boardArena.session'), null);

// v0.8+: 이어하기 · 레이팅 · 업적 · 분석 결과 · 환경설정도 정규화
const v8 = Store.migrate({
  id: 'Tester', nick: 'x', prefs: { notify: '<x>', aiSpeed: 'warp' },
  resume: {
    chess: { o: { mode: 'match', level: 99, human: 8, evil: '<script>' }, moves: [1, 2], ts: 5 },
    janggi: { o: { mode: 'evil' }, moves: [] },
    go: { o: { mode: 'train', size: 77, komi: '<script>' }, moves: ['x'] },
    sudoku: { o: { mode: 'train', level: 3 }, pz: { n: 4 } }
  },
  rating: { chess: { r: 99999, n: 'x' }, go: { r: 'bad' } },
  ach: { first_win: 123, hacked: 1 },
  log: [{ game: 'chess', mode: 'match', result: 'win', date: 1, acc: 150, bl: -3 }, { game: 'go', mode: 'match', result: 'loss', date: 2 }]
});
assert.equal(v8.prefs.sound, true, 'sound defaults to on');
assert.equal(v8.prefs.notify, 'all'); assert.equal(v8.prefs.aiSpeed, 'normal');
assert.deepEqual(Object.keys(v8.resume).sort(), ['chess', 'sudoku'], 'invalid resume entries are dropped');
assert.equal(v8.resume.chess.o.level, 10); assert.equal(v8.resume.chess.o.human, 8); assert.equal(v8.resume.chess.o.evil, undefined);
assert.equal(v8.rating.chess.r, 3000); assert.equal(v8.rating.chess.n, 0); assert.equal(v8.rating.go, undefined);
assert.deepEqual(Object.keys(v8.ach), ['first_win']);
assert.equal(v8.log[0].acc, 100); assert.equal(v8.log[0].bl, 0); assert.equal(v8.log[1].acc, undefined);
assert.equal(Resume.cleanOpts('go', { mode: 'match', size: '13', hcp: 1, komi: 6.5 }).komi, '6.5');
assert.equal(Resume.cleanOpts('janggi', { mode: 'match', pat: 'x' }).pat, '마상마상');
const th = [40, 150, 300];
assert.equal(Adapt.classify(30, th, 1), 'good');
assert.equal(Adapt.classify(30, th, 6), 'ok', 'small loss but far from best candidates is not "good"');
assert.equal(Adapt.classify(5, th, 9), 'good');
assert.equal(Adapt.classify(400, th, 0), 'blunder');
const ru = { rating: {} };
const up = Progress.rate(ru, 'chess', 5, 'win'); assert.ok(up.to > up.from);
const dn = Progress.rate(ru, 'chess', 1, 'loss'); assert.ok(dn.to < dn.from);
console.log('PASS: resume/rating/achievement/analysis/preference normalization');
console.log('PASS: move classification and rating rules');
console.log('PASS: corrupted storage recovery and schema normalization');
console.log('PASS: backup data validation and invalid-record filtering');
console.log('PASS: persistent-login session precedence regression');