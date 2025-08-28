/* MindQuantum — Thebe UX enhancements (per‑cell Run + banner)
   - Adds a prominent banner with Activate/Run All
   - Overlays a small Run button on each code cell
   - On first click, auto-activates Thebe and then runs the cell
   The script uses public hooks provided by sphinx-thebe/Jupyter Book:
   - Calls window.initThebeSBT() to bootstrap Thebe
   - Clicks the standard .thebelab-run-button to execute cells
*/
(function () {
  const lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  const isZH = lang.startsWith('zh');
  const T = isZH ? {
    banner: '本页示例可在线运行。',
    activate: '激活',
    runAll: '全部运行',
    runCell: '运行此单元',
    starting: '正在启动内核…',
    ready: '已就绪',
    error: '启动失败'
  } : {
    banner: 'This page is runnable in your browser.',
    activate: 'Activate',
    runAll: 'Run all',
    runCell: 'Run cell',
    starting: 'Starting kernel…',
    ready: 'Ready',
    error: 'Failed to start'
  };

  let thebeBooting = false;
  let thebeReady = false;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function waitFor(testFn, { timeout = 30000, interval = 100 } = {}) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      const timer = setInterval(() => {
        try {
          if (testFn()) {
            clearInterval(timer);
            resolve(true);
          } else if (performance.now() - start > timeout) {
            clearInterval(timer);
            reject(new Error('timeout'));
          }
        } catch (e) {
          clearInterval(timer);
          reject(e);
        }
      }, interval);
    });
  }

  function getRunnableCells() {
    // Only notebook code cells with visible code input
    const cells = $all('.bd-article .cell.docutils.container').filter((cell) => {
      if (cell.closest('.thebe-ignored')) return false;
      const input = cell.querySelector('.cell_input');
      if (!input) return false;
      return !!(input.querySelector('.highlight') || input.querySelector('pre'));
    });
    return cells;
  }

  function ensureBanner() {
    const article = $('.bd-article');
    if (!article) return;
    const hasCells = getRunnableCells().length > 0;
    const existing = $('.mq-thebe-banner');
    if (!hasCells) { if (existing) existing.remove(); return; }
    if (existing) return;
    const banner = document.createElement('div');
    banner.className = 'mq-thebe-banner';
    banner.innerHTML = `
      <div class="mq-text">${T.banner} <span class="thebe-status" aria-live="polite"></span></div>
      <div class="mq-actions">
        <button class="mq-btn mq-btn-primary mq-activate" aria-label="${T.activate}"><i class="fas fa-rocket"></i> ${T.activate}</button>
        <button class="mq-btn mq-run-all" aria-label="${T.runAll}"><i class="fas fa-play"></i> ${T.runAll}</button>
        <button class="mq-dismiss" aria-label="Dismiss">✕</button>
      </div>`;
    article.insertBefore(banner, article.firstChild);
    banner.querySelector('.mq-activate').addEventListener('click', () => activateThebe());
    banner.querySelector('.mq-run-all').addEventListener('click', () => runAll());
    banner.querySelector('.mq-dismiss').addEventListener('click', () => banner.remove());
    updateBannerStatus();
  }

  function updateBannerStatus(state) {
    const el = $('.mq-thebe-banner .thebe-status');
    if (!el) return;
    let text = '';
    if (state === 'starting' || thebeBooting) text = T.starting;
    else if (state === 'error') text = T.error;
    else if (thebeReady) text = `(${T.ready})`;
    el.textContent = text;
  }

  function attachRunButtons() {
    // Attach to notebook code input areas only
    const cells = getRunnableCells();
    for (const cell of cells) {
      if (cell.querySelector('.mq-run-btn')) continue;
      // Skip ignored regions
      if (cell.closest('.thebe-ignored')) continue;
      const input = cell.querySelector('.cell_input') || cell;
      if (input.querySelector('.mq-run-btn')) continue;
      const btn = document.createElement('button');
      btn.className = 'mq-run-btn' + (input.querySelector('.copybtn') ? '' : ' mq-no-copy');
      btn.setAttribute('aria-label', T.runCell);
      btn.setAttribute('data-tooltip', T.runCell);
      btn.innerHTML = '<i class="fas fa-play mq-icon" aria-hidden="true"></i>';
      btn.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        runCell(cell, btn);
      });
      input.appendChild(btn);
    }
  }

  function clickThebeRunInCell(cell) {
    // After activation, sphinx-thebe injects a .thebelab-run-button per cell
    const run = cell.querySelector('button.thebelab-run-button');
    if (run) {
      run.click();
      return true;
    }
    return false;
  }

  async function runCell(cell, uiBtn) {
    if (uiBtn) uiBtn.classList.add('is-busy');
    try {
      if (clickThebeRunInCell(cell)) return;
      await activateThebe();
      await waitFor(() => !!cell.querySelector('button.thebelab-run-button'), { timeout: 60000, interval: 100 });
      clickThebeRunInCell(cell);
    } catch (e) {
      console.warn('Run cell failed:', e);
      updateBannerStatus('error');
    } finally {
      if (uiBtn) uiBtn.classList.remove('is-busy');
    }
  }

  async function runAll() {
    try {
      await activateThebe();
      const runs = $all('button.thebelab-run-button');
      for (const btn of runs) {
        btn.click();
        await new Promise((r) => setTimeout(r, 50));
      }
    } catch (e) {
      console.warn('Run all failed:', e);
      updateBannerStatus('error');
    }
  }

  async function activateThebe() {
    if (thebeReady) return;
    if (thebeBooting) {
      await waitFor(() => !!document.querySelector('button.thebelab-run-button'), { timeout: 60000, interval: 100 });
      thebeReady = true; updateBannerStatus('ready');
      return;
    }
    thebeBooting = true; updateBannerStatus('starting');
    try {
      if (typeof window.initThebeSBT === 'function') {
        window.initThebeSBT();
      } else {
        const btn = $('.btn-launch-thebe');
        if (btn) btn.click();
      }
      await waitFor(() => !!document.querySelector('button.thebelab-run-button'), { timeout: 60000, interval: 100 });
      thebeReady = true; thebeBooting = false; updateBannerStatus('ready');
    } catch (e) {
      thebeBooting = false; thebeReady = false; updateBannerStatus('error');
      throw e;
    }
  }

  function init() {
    ensureBanner();
    attachRunButtons();
    // Observe late-loaded content or re-renders (e.g., Thebe bootstrap)
    const mo = new MutationObserver(() => { attachRunButtons(); ensureBanner(); });
    mo.observe(document.body, { subtree: true, childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
