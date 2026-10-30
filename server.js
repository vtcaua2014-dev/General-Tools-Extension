const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const SECRET = process.env.DOWNLOAD_SIGNING_SECRET || "CHANGE-ME-IN-PRODUCTION";
const PUBLIC = path.join(__dirname, "public");
const PACKAGES = path.join(__dirname, "private_packages");
const CATALOG_PATH = path.join(__dirname, "catalog.json");
const LICENSE_VERSION = "1.0";

// Bind the inline stylesheet to a strict CSP hash, so the first paint works
// even when a browser has stale CSS cached from an older deployment.
const HTML_SHELL = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
const STYLE_MATCH = HTML_SHELL.match(/<style id="gt-critical-styles">([\s\S]*?)<\/style>/);
if (!STYLE_MATCH) throw new Error("Inline stylesheet is missing from index.html");
const INLINE_CSS_HASH = crypto.createHash("sha256").update(STYLE_MATCH[1]).digest("base64");

if (SECRET === "CHANGE-ME-IN-PRODUCTION") {
  console.warn("[SECURITY] Set DOWNLOAD_SIGNING_SECRET in production.");
}

const mime = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".txt":"text/plain; charset=utf-8",
  ".png":"image/png",
  ".xpi":"application/x-xpinstall",
  ".crx":"application/x-chrome-extension",
  ".zip":"application/zip"
};

function headers(extra={}) {
  return {
    "X-Content-Type-Options":"nosniff",
    "X-Frame-Options":"DENY",
    "Referrer-Policy":"no-referrer",
    "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":`default-src 'self'; script-src 'self'; style-src 'self' 'sha256-${INLINE_CSS_HASH}'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
    "Cross-Origin-Resource-Policy":"same-origin",
    "Cross-Origin-Opener-Policy":"same-origin",
    ...extra
  };
}

function json(res, status, obj) {
  res.writeHead(status, headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}));
  res.end(JSON.stringify(obj));
}

function safeCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG_PATH,"utf8"));
}

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function packageFor(ext, browser) {
  if (browser === "firefox" && ext.packages.firefox?.available) return ext.packages.firefox.file;
  if (["chrome","edge","opera"].includes(browser) && ext.packages.customChromium?.available) {
    return ext.packages.customChromium.file;
  }
  return ext.packages.generic?.file || null;
}

function serveStatic(req, res, pathname) {
  const map = {
    "/": "index.html",
    "/index.html": "index.html",
    "/styles.css": "styles.css",
    "/app.js": "app.js",
    "/assets/general-tools-logo.png": "assets/general-tools-logo.png",
    "/assets/general-tools-icon.png": "assets/general-tools-icon.png",
    "/assets/favicon.png": "assets/favicon.png",
    "/LICENSE.txt": "LICENSE.txt",
    "/SECURITY.html": "SECURITY.html"
  };
  const fileName = map[pathname];
  if (!fileName) return false;
  const filePath = path.join(PUBLIC, fileName);
  const ext = path.extname(filePath);
  res.writeHead(200, headers({
    "Content-Type": mime[ext] || "application/octet-stream",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache"
  }));
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer((req,res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (u.pathname === "/api/catalog" && req.method === "GET") {
    return json(res,200,safeCatalog().map(({packages,...rest}) => ({...rest,packages})));
  }

  if (u.pathname === "/api/download-ticket" && req.method === "POST") {
    if (req.headers["x-license-accepted"] !== "1") {
      return json(res,403,{error:"License acceptance required."});
    }

    let body="";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 10_000) req.destroy();
    });
    req.on("end", () => {
      let parsed={};
      try { parsed = JSON.parse(body || "{}"); } catch {}
      if (parsed.licenseVersion !== LICENSE_VERSION) {
        return json(res,400,{error:"Current license version must be accepted."});
      }

      const id = u.searchParams.get("id");
      const browser = u.searchParams.get("browser") || "unknown";
      const ext = safeCatalog().find(x => x.id === id);
      if (!ext) return json(res,404,{error:"Extension not found."});

      const fileName = packageFor(ext,browser);
      if (!fileName) return json(res,404,{error:"No compatible package is available."});

      const filePath = path.join(PACKAGES,path.basename(fileName));
      if (!fs.existsSync(filePath)) {
        return json(res,409,{error:"Package is not yet uploaded to the private package directory."});
      }

      const exp = Date.now() + 2 * 60 * 1000;
      const payload = `${id}|${path.basename(fileName)}|${exp}`;
      const sig = sign(payload);
      const hash = sha256File(filePath);
      const url = `/api/package?id=${encodeURIComponent(id)}&file=${encodeURIComponent(path.basename(fileName))}&exp=${exp}&sig=${sig}`;
      return json(res,200,{url,sha256:hash,expiresAt:exp});
    });
    return;
  }

  if (u.pathname === "/api/package" && req.method === "GET") {
    const id = u.searchParams.get("id") || "";
    const file = path.basename(u.searchParams.get("file") || "");
    const exp = Number(u.searchParams.get("exp") || 0);
    const sig = u.searchParams.get("sig") || "";
    if (!id || !file || !exp || !sig || Date.now() > exp) {
      return json(res,403,{error:"Download ticket is invalid or expired."});
    }

    const payload = `${id}|${file}|${exp}`;
    const expected = sign(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) {
      return json(res,403,{error:"Invalid signature."});
    }

    const ext = safeCatalog().find(x => x.id === id);
    if (!ext) return json(res,404,{error:"Extension not found."});

    const allowedFiles = Object.values(ext.packages || {}).map(x => x?.file).filter(Boolean);
    if (!allowedFiles.includes(file)) return json(res,403,{error:"Package is not authorized for this extension."});

    const filePath = path.join(PACKAGES,file);
    if (!fs.existsSync(filePath)) return json(res,404,{error:"Package not found."});

    const fileExt = path.extname(file);
    res.writeHead(200,headers({
      "Content-Type": mime[fileExt] || "application/octet-stream",
      "Content-Disposition": fileExt === ".xpi" ? `inline; filename="${file}"` : `attachment; filename="${file}"`,
      "Cache-Control":"private, no-store",
      "Content-Length":fs.statSync(filePath).size
    }));
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (serveStatic(req,res,u.pathname)) return;
  res.writeHead(404,headers({"Content-Type":"text/plain; charset=utf-8"}));
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`General Tools Store running on http://localhost:${PORT}`);
});
