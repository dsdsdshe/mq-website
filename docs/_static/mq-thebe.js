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
    ready: '已激活',
    error: '启动失败'
  } : {
    banner: 'This page is runnable in your browser.',
    activate: 'Activate',
    runAll: 'Run all',
    runCell: 'Run cell',
    starting: 'Starting kernel…',
    ready: 'Activated',
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
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Thebe interactive controls');
    banner.innerHTML = `
      <div class="mq-text">${T.banner} <span class="thebe-status" aria-live="polite" aria-atomic="true"></span></div>
      <div class="mq-actions" role="group">
        <button class="mq-btn mq-btn-primary mq-activate" aria-label="${T.activate}">
          <i class="fas fa-rocket" aria-hidden="true"></i> ${T.activate}
        </button>
        <button class="mq-btn mq-run-all" aria-label="${T.runAll}">
          <i class="fas fa-play" aria-hidden="true"></i> ${T.runAll}
        </button>
        <button class="mq-dismiss" aria-label="Dismiss" title="Dismiss">✕</button>
      </div>`;
    
    article.insertBefore(banner, article.firstChild);
    
    // Add keyboard support
    banner.querySelector('.mq-activate').addEventListener('click', () => activateThebe());
    banner.querySelector('.mq-activate').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateThebe();
      }
    });
    
    banner.querySelector('.mq-run-all').addEventListener('click', () => runAll());
    banner.querySelector('.mq-run-all').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        runAll();
      }
    });
    
    banner.querySelector('.mq-dismiss').addEventListener('click', () => {
      banner.style.animation = 'fadeOutUp 0.3s ease-out forwards';
      setTimeout(() => banner.remove(), 300);
    });
    
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
    
    // Update button states
    const activateBtn = $('.mq-thebe-banner .mq-activate');
    const runAllBtn = $('.mq-thebe-banner .mq-run-all');
    if (activateBtn && runAllBtn) {
      if (thebeReady) {
        activateBtn.disabled = true;
        activateBtn.style.opacity = '0.5';
        runAllBtn.disabled = false;
        runAllBtn.style.opacity = '1';
      } else if (thebeBooting) {
        activateBtn.disabled = true;
        runAllBtn.disabled = true;
        activateBtn.style.opacity = '0.5';
        runAllBtn.style.opacity = '0.5';
      }
    }
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
      btn.className = 'mq-run-btn';
      btn.setAttribute('aria-label', T.runCell);
      btn.setAttribute('title', T.runCell); // Add title for native tooltip like copy button
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      
      // Use SVG icon for consistency with copy button - hollow triangle
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" class="mq-icon" aria-hidden="true">
          <path d="M8 5v14l11-7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
        </svg>`;
      
      // Add click handler
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        runCell(cell, btn);
      });
      
      // Add keyboard support
      btn.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          ev.stopPropagation();
          runCell(cell, btn);
        }
      });
      
      // Add focus management
      btn.addEventListener('focus', () => {
        btn.style.opacity = '1';
      });
      
      btn.addEventListener('blur', () => {
        if (!input.matches(':hover')) {
          btn.style.opacity = '0';
        }
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
    if (uiBtn) {
      uiBtn.classList.add('is-busy');
      uiBtn.setAttribute('aria-busy', 'true');
      // Change icon to spinner
      uiBtn.innerHTML = `
        <svg viewBox="0 0 24 24" class="mq-icon fa-spin" aria-hidden="true">
          <path d="M12 2A10 10 0 1 0 22 12h-2a8 8 0 1 1-8-8V2Z" fill="currentColor"/>
        </svg>`;
    }
    
    try {
      if (clickThebeRunInCell(cell)) {
        // If already activated, wait a bit for execution to complete
        await new Promise(r => setTimeout(r, 500));
      } else {
        await activateThebe();
        await waitFor(() => !!cell.querySelector('button.thebelab-run-button'), { timeout: 60000, interval: 100 });
        clickThebeRunInCell(cell);
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      console.warn('Run cell failed:', e);
      updateBannerStatus('error');
    } finally {
      if (uiBtn) {
        uiBtn.classList.remove('is-busy');
        uiBtn.setAttribute('aria-busy', 'false');
        // Restore play icon - hollow triangle
        uiBtn.innerHTML = `
          <svg viewBox="0 0 24 24" class="mq-icon" aria-hidden="true">
            <path d="M8 5v14l11-7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
          </svg>`;
      }
    }
  }

  async function runAll() {
    try {
      await activateThebe();
      const runs = $all('button.thebelab-run-button');
      
      // Visual feedback for batch execution
      const runButtons = $all('.mq-run-btn');
      runButtons.forEach(btn => {
        btn.classList.add('is-busy');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" class="mq-icon fa-spin" aria-hidden="true">
            <path d="M12 2A10 10 0 1 0 22 12h-2a8 8 0 1 1-8-8V2Z" fill="currentColor"/>
          </svg>`;
      });
      
      // Execute cells with a slight delay between each
      for (let i = 0; i < runs.length; i++) {
        runs[i].click();
        await new Promise((r) => setTimeout(r, 100));
        
        // Update individual button state with checkmark
        if (runButtons[i]) {
          runButtons[i].classList.remove('is-busy');
          runButtons[i].innerHTML = `
            <svg viewBox="0 0 24 24" class="mq-icon" aria-hidden="true">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
            </svg>`;
          setTimeout(() => {
            runButtons[i].innerHTML = `
              <svg viewBox="0 0 24 24" class="mq-icon" aria-hidden="true">
                <path d="M8 5v14l11-7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
              </svg>`;
          }, 1000);
        }
      }
    } catch (e) {
      console.warn('Run all failed:', e);
      updateBannerStatus('error');
    } finally {
      // Reset all buttons
      const runButtons = $all('.mq-run-btn');
      runButtons.forEach(btn => {
        btn.classList.remove('is-busy');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" class="mq-icon" aria-hidden="true">
            <path d="M8 5v14l11-7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
          </svg>`;
      });
    }
  }

  async function activateThebe() {
    if (thebeReady) return;
    if (thebeBooting) {
      await waitFor(() => !!document.querySelector('button.thebelab-run-button'), { timeout: 60000, interval: 100 });
      thebeReady = true;
      updateBannerStatus('ready');
      return;
    }
    
    thebeBooting = true;
    updateBannerStatus('starting');
    
    try {
      if (typeof window.initThebeSBT === 'function') {
        window.initThebeSBT();
      } else {
        const btn = $('.btn-launch-thebe');
        if (btn) btn.click();
      }
      await waitFor(() => !!document.querySelector('button.thebelab-run-button'), { timeout: 60000, interval: 100 });
      thebeReady = true;
      thebeBooting = false;
      updateBannerStatus('ready');
      
      // Add success animation to banner
      const banner = $('.mq-thebe-banner');
      if (banner) {
        banner.style.animation = 'pulse 0.5s ease-out';
        setTimeout(() => {
          banner.style.animation = '';
        }, 500);
      }
    } catch (e) {
      thebeBooting = false;
      thebeReady = false;
      updateBannerStatus('error');
      throw e;
    }
  }

  function init() {
    ensureBanner();
    attachRunButtons();
    
    // Observe late-loaded content or re-renders (e.g., Thebe bootstrap)
    const mo = new MutationObserver(() => {
      attachRunButtons();
      ensureBanner();
    });
    mo.observe(document.body, { subtree: true, childList: true });
    
    // Add style for fadeOutUp animation
    if (!document.getElementById('mq-thebe-animations')) {
      const style = document.createElement('style');
      style.id = 'mq-thebe-animations';
      style.textContent = `
        @keyframes fadeOutUp {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-10px);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();