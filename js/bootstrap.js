(() => {
  'use strict';
  let latestError = '';
  function showError(message) {
    latestError = String(message || 'unknown').slice(0, 12000);
    if (document.getElementById('appErrorBar')) return;
    const bar = document.createElement('div');
    bar.id = 'appErrorBar';
    bar.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:9999;padding:11px 12px;border-radius:10px;background:#8f2f33;color:white;font:13px/1.45 sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)';
    const text = document.createElement('span');
    text.textContent = '오류가 발생했어요. 새로고침해도 계속되면 오류 정보를 복사해 주세요.';
    const copy = document.createElement('button');
    copy.textContent = '오류 정보 복사'; copy.style.marginLeft = '10px';
    copy.onclick = async () => {
      const report = ['한수 v' + (window.APP_VERSION || '?') + ' 오류', location.href, navigator.userAgent, latestError].join('\n');
      try { await navigator.clipboard.writeText(report); copy.textContent = '복사됨'; }
      catch (_) { prompt('아래 내용을 복사해 주세요.', report); }
    };
    const close = document.createElement('button'); close.textContent='닫기'; close.style.marginLeft='6px'; close.onclick=()=>bar.remove();
    bar.append(text, copy, close); document.body.appendChild(bar);
  }
  window.addEventListener('error', e => {
    const stack = e.error && e.error.stack ? '\n' + e.error.stack : '';
    showError((e.message || 'unknown') + ' @ ' + (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || '') + stack);
  });
  window.addEventListener('unhandledrejection', e => {
    const reason = e.reason;
    showError(String(reason && reason.message || reason || 'Promise rejection') + (reason && reason.stack ? '\n' + reason.stack : ''));
  });
  window.addEventListener('storage', e => {
    if (e.key === 'boardArena.v3' && document.visibilityState === 'visible') {
      const n = document.createElement('div');
      n.style.cssText='position:fixed;left:12px;right:12px;bottom:76px;z-index:90;padding:11px;border-radius:10px;background:#263247;color:#fff;text-align:center';
      n.textContent='다른 탭에서 기록이 변경됐어요. 안전하게 반영하려면 이 페이지를 새로고침해 주세요.';
      n.onclick=()=>location.reload(); document.body.appendChild(n); setTimeout(()=>n.remove(),8000);
    }
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
  }
})();