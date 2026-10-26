'use strict';
/* Hansu v1.0: theme, accessibility, mobile UX and runtime resilience. */
(() => {
  const KEY = 'hansu_v1_ui';
  const defaults = { theme: 'system', fontScale: 100, motion: true, coordinates: true };
  const safe = {
    read() { try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) { return { ...defaults }; } },
    write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (_) { return false; } }
  };
  let prefs = safe.read();
  const valid = () => {
    if (!['system','dark','light'].includes(prefs.theme)) prefs.theme = 'system';
    prefs.fontScale = Math.max(90, Math.min(120, Number(prefs.fontScale) || 100));
    prefs.motion = prefs.motion !== false;
    prefs.coordinates = prefs.coordinates !== false;
  };
  function apply() {
    valid();
    const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.fontSize = `${prefs.fontScale}%`;
    document.body.classList.toggle('reduce-motion', !prefs.motion);
    document.body.classList.toggle('hide-coordinates', !prefs.coordinates);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#14161c' : '#eef2f7';
  }
  function save() { safe.write(prefs); apply(); }
  function button(id, on, label) { return `<button type="button" id="${id}" class="${on ? 'on' : ''}">${label}</button>`; }
  function bindChoice(ids, active, valueSetter) {
    ids.forEach(id => { const el = document.getElementById(id); if (!el) return; el.onclick = () => { valueSetter(id); ids.forEach(x => document.getElementById(x)?.classList.toggle('on', x === id)); save(); }; });
  }
  function extendSettings() {
    const box = document.querySelector('#modal .setbox');
    if (!box || box.querySelector('#v1Settings')) return;
    const closeRow = box.querySelector('.mactions') || box.lastElementChild;
    const section = document.createElement('div');
    section.id = 'v1Settings';
    section.innerHTML = `
      <div class="setsec"><div class="sett">🌓 화면 테마</div><div class="tog">
        ${button('v1ThemeSystem', prefs.theme === 'system', '시스템')}${button('v1ThemeDark', prefs.theme === 'dark', '다크')}${button('v1ThemeLight', prefs.theme === 'light', '라이트')}
      </div></div>
      <div class="setsec"><div class="sett">🔎 글자 크기</div><div class="tog">
        ${button('v1Font90', prefs.fontScale === 90, '작게')}${button('v1Font100', prefs.fontScale === 100, '보통')}${button('v1Font110', prefs.fontScale === 110, '크게')}${button('v1Font120', prefs.fontScale === 120, '매우 크게')}
      </div></div>
      <div class="setsec"><div class="sett">✨ 움직임 효과</div><div class="tog">
        ${button('v1MotionOn', prefs.motion, '켜기')}${button('v1MotionOff', !prefs.motion, '줄이기')}
      </div><div class="sethelp">어지럽거나 기기가 느리면 움직임을 줄이세요.</div></div>
      <div class="setsec"><div class="sett">🔢 판 좌표</div><div class="tog">
        ${button('v1CoordOn', prefs.coordinates, '표시')}${button('v1CoordOff', !prefs.coordinates, '숨김')}
      </div></div>
      <div class="setsec"><div class="sett">⛶ 전체 화면</div><button type="button" id="v1Fullscreen">전체 화면 전환</button></div>`;
    box.insertBefore(section, closeRow);
    bindChoice(['v1ThemeSystem','v1ThemeDark','v1ThemeLight'], null, id => prefs.theme = ({v1ThemeSystem:'system',v1ThemeDark:'dark',v1ThemeLight:'light'})[id]);
    bindChoice(['v1Font90','v1Font100','v1Font110','v1Font120'], null, id => prefs.fontScale = Number(id.slice(6)));
    bindChoice(['v1MotionOn','v1MotionOff'], null, id => prefs.motion = id === 'v1MotionOn');
    bindChoice(['v1CoordOn','v1CoordOff'], null, id => prefs.coordinates = id === 'v1CoordOn');
    document.getElementById('v1Fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch (e) { console.warn('전체 화면을 사용할 수 없습니다.', e); } };
  }
  function installErrorBoundary() {
    window.addEventListener('error', e => console.error('[한수 v1.0 오류]', e.error || e.message));
    window.addEventListener('unhandledrejection', e => { console.error('[한수 v1.0 비동기 오류]', e.reason); e.preventDefault(); });
  }
  function installMobileUX() {
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { const modal = document.getElementById('modal'); if (modal && !modal.classList.contains('hidden')) modal.classList.add('hidden'); } });
    document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) b.classList.add('tap'); setTimeout(() => b?.classList.remove('tap'), 160); }, { passive: true });
  }
  valid(); apply(); installErrorBoundary(); installMobileUX();
  new MutationObserver(extendSettings).observe(document.getElementById('modal'), { childList: true, subtree: true });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (prefs.theme === 'system') apply(); });
  addEventListener('DOMContentLoaded', () => { apply(); extendSettings(); });
})();
