
const state = {
  browser: detectBrowser(),
  pending: null,
  catalog: []
};

function detectBrowser() {
  const ua = navigator.userAgent;
  const brands = navigator.userAgentData?.brands?.map(b => b.brand.toLowerCase()) || [];
  const has = (x) => brands.some(b => b.includes(x));

  if (has("firefox") || /Firefox\//i.test(ua)) return "firefox";
  if (has("microsoft edge") || /Edg\//i.test(ua)) return "edge";
  if (has("opera") || /OPR\//i.test(ua)) return "opera";
  if (has("google chrome") || /Chrome\//i.test(ua)) return "chrome";
  if (/Safari\//i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua)) return "safari";
  return "unknown";
}

function browserLabel(b) {
  return ({
    firefox: "Firefox",
    edge: "Microsoft Edge",
    opera: "Opera",
    chrome: "Google Chrome / Chromium",
    safari: "Safari",
    unknown: "Unknown browser"
  })[b];
}

async function loadCatalog() {
  const res = await fetch("/api/catalog", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Could not load catalog");
  state.catalog = await res.json();
  render(state.catalog);
}

function actionFor(ext) {
  const p = ext.packages || {};
  if (state.browser === "firefox" && p.firefox?.available) {
    return {
      label: "Install in Firefox",
      mode: "direct-xpi",
      note: "Firefox can install a Mozilla-signed XPI from this site after user confirmation."
    };
  }

  if (state.browser === "chrome" || state.browser === "edge" || state.browser === "opera") {
    if (p.customChromium?.available && window.GeneralToolsBrowser?.installExtension) {
      return {
        label: "Add to Browser",
        mode: "custom-chromium",
        note: "Direct installation is available because this browser exposes the General Tools installation API."
      };
    }
    return {
      label: "Download Package",
      mode: "download",
      note: "This browser does not allow a normal website to silently install this package. No automatic installation will be simulated."
    };
  }

  return {
    label: "Download Package",
    mode: "download",
    note: "Direct installation is not available for this browser."
  };
}

function render(items) {
  const grid = document.querySelector("#extensionGrid");
  grid.innerHTML = "";
  if (!items.length) {
    grid.innerHTML = `<p class="muted">No extensions found.</p>`;
    return;
  }

  for (const ext of items) {
    const action = actionFor(ext);
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="icon">${escapeHtml(ext.shortName || "EXT")}</div>
      <h3>${escapeHtml(ext.name)}</h3>
      <div class="meta">${escapeHtml(ext.category)} · v${escapeHtml(ext.version)}</div>
      <div class="desc">${escapeHtml(ext.description)}</div>
      <div class="card-actions">
        <button class="btn primary install-btn">${escapeHtml(action.label)}</button>
        <button class="btn secondary details-btn">Details</button>
      </div>
      <div class="notice">${escapeHtml(action.note)}</div>
    `;
    card.querySelector(".install-btn").addEventListener("click", () => begin(ext, action));
    card.querySelector(".details-btn").addEventListener("click", () => {
      alert(`${ext.name}\nVersion ${ext.version}\n\nSHA-256 hashes are verified by the server before a protected package is served.`);
    });
    grid.appendChild(card);
  }
}

function begin(ext, action) {
  state.pending = { ext, action };
  const dialog = document.querySelector("#licenseDialog");
  const check = document.querySelector("#acceptLicense");
  check.checked = false;
  document.querySelector("#continueDownload").disabled = true;
  dialog.showModal();
}

document.querySelector("#acceptLicense").addEventListener("change", (e) => {
  document.querySelector("#continueDownload").disabled = !e.target.checked;
});

document.querySelector("#continueDownload").addEventListener("click", async () => {
  if (!state.pending) return;
  const { ext, action } = state.pending;
  document.querySelector("#licenseDialog").close();

  try {
    const ticketRes = await fetch(`/api/download-ticket?id=${encodeURIComponent(ext.id)}&browser=${encodeURIComponent(state.browser)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Accepted": "1" },
      body: JSON.stringify({ licenseVersion: "1.0" })
    });
    if (!ticketRes.ok) throw new Error((await ticketRes.json()).error || "Could not create download ticket");
    const ticket = await ticketRes.json();

    if (action.mode === "custom-chromium" && window.GeneralToolsBrowser?.installExtension) {
      await window.GeneralToolsBrowser.installExtension({
        url: ticket.url,
        sha256: ticket.sha256,
        name: ext.name,
        version: ext.version
      });
      return;
    }

    // For Firefox, navigating to a Mozilla-signed XPI allows Firefox to show its native install confirmation.
    // For other browsers, this is an ordinary protected download.
    window.location.href = ticket.url;
  } catch (err) {
    alert(`Unable to continue: ${err.message}`);
  }
});

document.querySelector("#search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  render(state.catalog.filter(x =>
    x.name.toLowerCase().includes(q) ||
    x.description.toLowerCase().includes(q) ||
    x.category.toLowerCase().includes(q)
  ));
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}

document.querySelector("#browserPill").textContent = `Detected: ${browserLabel(state.browser)}`;
loadCatalog().catch(err => {
  document.querySelector("#extensionGrid").innerHTML =
    `<p class="muted">Failed to load catalog: ${escapeHtml(err.message)}</p>`;
});
