/* General Tools Store — interactive website, no external dependencies. */
(() => {
  'use strict';

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const state = { browser: detectBrowser(), catalog: [], pending: null };
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function detectBrowser() {
    const ua = navigator.userAgent;
    const brands = (navigator.userAgentData?.brands || []).map(x => x.brand.toLowerCase());
    const isBrand = x => brands.some(b => b.includes(x));
    if (/Firefox\//i.test(ua)) return 'firefox';
    if (/Edg\//i.test(ua) || isBrand('microsoft edge')) return 'edge';
    if (/OPR\//i.test(ua) || isBrand('opera')) return 'opera';
    if (/CriOS\//i.test(ua)) return 'chrome-ios';
    if (/Chrome\//i.test(ua) || isBrand('google chrome') || isBrand('chromium')) return 'chrome';
    if (/Safari\//i.test(ua)) return 'safari';
    return 'unknown';
  }

  const browserName = { chrome: 'CHROME / CHROMIUM', 'chrome-ios': 'CHROME ON IOS', firefox: 'FIREFOX', edge: 'MICROSOFT EDGE', opera: 'OPERA', safari: 'SAFARI', unknown: 'UNKNOWN BROWSER' };
  $('#browserPill').textContent = `BROWSER: ${browserName[state.browser]}`;

  function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 4800);
  }

  // A trusted custom Chromium must provide its own native bridge AND a compatible signed package.
  function capability(ext) {
    const pkgs = ext.packages || {};
    const bridge = window.GeneralToolsBrowser?.installExtension;
    if (typeof bridge === 'function' && pkgs.customChromium?.available && location.protocol === 'https:') {
      return { label: 'Add to browser', mode: 'custom', browser: 'customChromium', available: true,
        note: 'Native installation is provided by this custom Chromium browser. You will be asked to approve permissions.' };
    }
    if (state.browser === 'firefox' && pkgs.firefox?.available && location.protocol === 'https:') {
      return { label: 'Install on Firefox', mode: 'xpi', browser: 'firefox', available: true,
        note: 'Firefox will request confirmation for a Mozilla-signed XPI extension.' };
    }
    if (['chrome','edge','opera'].includes(state.browser) && pkgs.generic?.available) {
      return { label: 'Download for Chromium', mode: 'zip', browser: state.browser, available: true,
        note: 'Download the ZIP and install manually through your browser’s extensions page. No automatic installation.' };
    }
    if (state.browser === 'firefox') {
      return { label: 'Firefox build unavailable', mode: 'none', browser: 'firefox', available: false,
        note: 'A signed Firefox XPI is not currently available. This Chromium package should not be presented as a Firefox installation.' };
    }
    return { label: 'Not available for this browser', mode: 'none', browser: state.browser, available: false,
      note: 'This browser does not currently have a supported General Tools package.' };
  }

  function render(items) {
    const grid = $('#extensionGrid');
    grid.replaceChildren();
    $('#catalogCount').textContent = String(items.length).padStart(2,'0') + (items.length === 1 ? ' EXTENSION' : ' EXTENSIONS');
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'no-results';
      empty.textContent = 'No results match your search. Try “General Tools”.';
      grid.appendChild(empty);
      return;
    }
    for (const ext of items) {
      const action = capability(ext);
      const card = document.createElement('article');
      card.className = 'extension-card reveal is-visible';
      card.innerHTML = `
        <div class="extension-visual">
          <span class="extension-no">FEATURED / ${escapeHtml(ext.id).toUpperCase()}</span>
          <img src="/assets/general-tools-logo.png" alt="General Tools original brand artwork" width="300" height="300" loading="lazy">
          <span class="extension-visual-bottom">INDEPENDENT EDITION ↗</span>
        </div>
        <div class="extension-info">
          <div class="extension-topline"><span class="pill"><span class="status-dot"></span> AVAILABLE · FREE</span><span class="extension-version">V${escapeHtml(ext.version)}</span></div>
          <h3>${escapeHtml(ext.name)}</h3>
          <p>${escapeHtml(ext.description)}</p>
          <div class="extension-tags"><span>BROWSER UTILITIES</span><span>PRODUCTIVITY</span><span>GAME TOOLS</span></div>
          <div class="extension-actions"><button type="button" class="button button-dark install-btn" ${action.available ? '' : 'disabled'}>${escapeHtml(action.label)} <span>↗</span></button><button type="button" class="secondary-action guide-btn">${action.mode === 'zip' ? 'How to install ↗' : 'Learn more ↗'}</button></div>
          <p class="compat-note">${escapeHtml(action.note)}</p>
        </div>`;
      $('.install-btn', card).addEventListener('click', () => openLicense(ext, action));
      $('.guide-btn', card).addEventListener('click', () => action.mode === 'zip' ? $('#installGuide').showModal() : $('#faq').scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' }));
      grid.appendChild(card);
    }
  }

  async function loadCatalog() {
    try {
      const res = await fetch('/api/catalog', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) throw new Error('Catalog temporarily unavailable');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Unexpected catalog format');
      state.catalog = data;
      render(data);
    } catch (err) {
      $('#extensionGrid').textContent = `Unable to load the extension catalog. ${err.message}`;
      toast('The catalog is temporarily unavailable. Please refresh the page.');
    }
  }

  function openLicense(ext, action) {
    state.pending = { ext, action };
    $('#acceptLicense').checked = false;
    $('#continueDownload').disabled = true;
    $('#modalStatus').textContent = '';
    $('#modalBrowser').textContent = action.mode === 'zip' ? 'MANUAL INSTALLATION / CHROMIUM' : 'SUPPORTED BROWSER INSTALLATION';
    $('#licenseDialog').showModal();
  }
  $('#closeLicense').addEventListener('click', () => $('#licenseDialog').close());
  $('#cancelLicense').addEventListener('click', () => $('#licenseDialog').close());
  $('#acceptLicense').addEventListener('change', e => $('#continueDownload').disabled = !e.target.checked);
  $('#closeGuide').addEventListener('click', () => $('#installGuide').close());
  $('#gotIt').addEventListener('click', () => $('#installGuide').close());

  $('#continueDownload').addEventListener('click', async () => {
    if (!state.pending || !$('#acceptLicense').checked) return;
    const { ext, action } = state.pending;
    const button = $('#continueDownload');
    button.disabled = true;
    button.firstChild.textContent = 'Preparing… ';
    try {
      const request = await fetch(`/api/download-ticket?id=${encodeURIComponent(ext.id)}&browser=${encodeURIComponent(action.browser)}`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-License-Accepted': '1' },
        body: JSON.stringify({ licenseVersion: '1.0' })
      });
      const payload = await request.json();
      if (!request.ok) throw new Error(payload.error || 'Unable to create a download link.');
      if (!payload.url || !payload.url.startsWith('/api/package?')) throw new Error('Unexpected download URL.');
      $('#licenseDialog').close();
      if (action.mode === 'custom' && typeof window.GeneralToolsBrowser?.installExtension === 'function') {
        await window.GeneralToolsBrowser.installExtension({ url: new URL(payload.url, location.origin).href, sha256: payload.sha256, name: ext.name, version: ext.version });
        toast('Installation request sent to your browser. Confirm any permission prompts.');
      } else {
        window.location.assign(payload.url);
        if (action.mode === 'zip') toast('ZIP download requested. Use “How to install” for the manual steps.');
        else toast('Firefox will ask you to confirm installation.');
      }
    } catch (err) {
      $('#modalStatus').textContent = err.message;
      toast('Download unavailable. Please try again.');
    } finally {
      button.disabled = !$('#acceptLicense').checked;
      button.firstChild.textContent = 'Continue ';
    }
  });

  $('#search').addEventListener('input', e => {
    const query = e.target.value.trim().toLowerCase();
    render(state.catalog.filter(x => (x.name + ' ' + x.description + ' ' + x.category).toLowerCase().includes(query)));
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
      e.preventDefault(); $('#search').focus(); $('#discover').scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  });

  const nav = $('#primaryNav');
  $('#menuToggle').addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    $('#menuToggle').setAttribute('aria-expanded', String(open));
    $('#menuToggle').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open'); $('#menuToggle').setAttribute('aria-expanded', 'false');
  }));

  const updateScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    $('#scrollProgress').style.width = (max ? (scrollY / max) * 100 : 0) + '%';
    $('#siteHeader').classList.toggle('scrolled', scrollY > 30);
  };
  window.addEventListener('scroll', updateScroll, { passive:true });
  updateScroll();

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: .11, rootMargin: '0px 0px -25px 0px' });
    document.querySelectorAll('.reveal').forEach(x => observer.observe(x));
  } else document.querySelectorAll('.reveal').forEach(x => x.classList.add('is-visible'));

  const art = $('#heroArt');
  if (!prefersReducedMotion && matchMedia('(pointer: fine)').matches) {
    let raf = null;
    art.addEventListener('pointermove', e => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = art.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - .5;
        const y = (e.clientY - rect.top) / rect.height - .5;
        art.style.setProperty('--tilt-x', `${(x * 10).toFixed(2)}deg`);
        art.style.setProperty('--tilt-y', `${(-y * 10).toFixed(2)}deg`);
      });
    });
    art.addEventListener('pointerleave', () => { art.style.removeProperty('--tilt-x'); art.style.removeProperty('--tilt-y'); });
  }

  loadCatalog();
})();
