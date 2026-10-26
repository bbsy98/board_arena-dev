// 앱 버전: index.html · service-worker.js · package.json 과 같아야 함 (tests/static-integrity.cjs 검사)
var APP_VERSION = '1.0.0';
// ===== 공통 10단계 설정 (화면에는 Lv.N만 표시) =====
const LEVELS = {
  board: {
    1: { exact: 1, maxDepth: 2, noQ: 1, blunder: 0.40, margin: 900, pool: 5, timeMs: 4000 },
    2: { exact: 1, maxDepth: 2, noQ: 1, blunder: 0.15, margin: 400, pool: 3, timeMs: 4000 },
    3: { exact: 1, maxDepth: 2, blunder: 0.30, margin: 400, pool: 4, timeMs: 5000 },
    4: { exact: 1, maxDepth: 2, blunder: 0.05, margin: 150, pool: 2, timeMs: 5000 },
    5: { exact: 1, maxDepth: 3, blunder: 0.22, margin: 300, pool: 3, timeMs: 6000 },
    6: { maxDepth: 3, timeMs: 6000 },
    7: { maxDepth: 4, timeMs: 8000 },
    8: { maxDepth: 5, timeMs: 8000 },
    9: { maxDepth: 7, timeMs: 8000 },
    10: { timeMs: 10000 },
  },
  go: {
    1: { maxSims: 150, blunder: 0.30, pool: 5 }, 2: { maxSims: 300, blunder: 0.15, pool: 4 }, 3: { maxSims: 600, blunder: 0.05, pool: 3 },
    4: { maxSims: 1200 }, 5: { maxSims: 2500 }, 6: { maxSims: 5000 }, 7: { maxSims: 10000 },
    8: { time: 4000 }, 9: { time: 9000 }, 10: { time: 18000 },
  },
  // 교육 모드: 한 수의 손실 기준 [좋음, 보통, 아쉬움] (넘으면 큰 실수). 바둑은 승률 하락폭
  adapt: { janggi: [40, 150, 300], chess: [25, 100, 250], go: [0.04, 0.10, 0.18] },
  // 코치용 판정 (교육 모드 경고·힌트)
  coach: { exact: 1, maxDepth: 2, noJitter: 1, wantAll: 1, timeMs: 1500 },
};
if (typeof module !== 'undefined') module.exports = LEVELS;