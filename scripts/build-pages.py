#!/usr/bin/env python3
"""Build the static GitHub Pages edition. The Render backend stays unchanged."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_pages_site"
SOURCE = ROOT / "public"
ZIP = ROOT / "private_packages" / "general-tools.zip"
CATALOG = ROOT / "catalog.json"

def once(s, old, new):
    if s.count(old) != 1:
        raise RuntimeError(f"Expected exactly one {old!r}; found {s.count(old)}")
    return s.replace(old, new, 1)

def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    if len(catalog) != 1 or catalog[0]["id"] != "general-tools" or catalog[0]["packages"]["generic"]["file"] != ZIP.name:
        raise RuntimeError("Unexpected release catalog")
    with zipfile.ZipFile(ZIP) as z:
        if z.testzip() is not None:
            raise RuntimeError("Extension ZIP is corrupt")
        manifests = [n for n in z.namelist() if n.endswith("manifest.json")]
        if len(manifests) != 1:
            raise RuntimeError("Release ZIP must contain exactly one extension manifest")
        version = json.loads(z.read(manifests[0]))["version"]
    if version != catalog[0]["version"]:
        raise RuntimeError(f"Extension v{version} differs from catalog v{catalog[0]['version']}")
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SOURCE, OUT)
    shutil.copy2(CATALOG, OUT / "catalog.json")
    notices = ROOT / "THIRD_PARTY_NOTICES.txt"
    if notices.is_file():
        shutil.copy2(notices, OUT / notices.name)
    (OUT / ".nojekyll").touch()
    (OUT / "downloads").mkdir()
    shutil.copy2(ZIP, OUT / "downloads" / ZIP.name)
    digest = hashlib.sha256(ZIP.read_bytes()).hexdigest()
    (OUT / "downloads" / "SHA256SUMS.txt").write_text(f"{digest}  {ZIP.name}\n", encoding="ascii")

    html = (OUT / "index.html").read_text(encoding="utf-8")
    # GitHub Pages uses a project subdirectory, not the domain root.
    html = re.sub(r'((?:href|src|content)=")/(assets/|app\.js|styles\.css|LICENSE\.txt|SECURITY\.html)', r'\1\2', html)
    html = once(html, "Our store uses temporary download links and publishes clear installation guidance", "This GitHub Pages edition uses direct HTTPS downloads, public checksums and clear installation guidance")
    html = once(html, "Server-side SHA-256 hash and signed, expiring download links.", "Public SHA-256 checksum and HTTPS download, without a signing server.")
    html = once(html, "Downloads are provided through a temporary, protected link.", "Downloads are public ZIP files hosted on GitHub Pages.")
    (OUT / "index.html").write_text(html, encoding="utf-8")

    js = (OUT / "app.js").read_text(encoding="utf-8")
    js = once(js, "fetch('/api/catalog',", "fetch('catalog.json',")
    js = js.replace('src="/assets/general-tools-logo.png"', 'src="assets/general-tools-logo.png"')
    start = js.find('      const request = await fetch(' + chr(96) + '/api/download-ticket')
    end = js.find("    } catch (err) {\n      $('#modalStatus').textContent = err.message;", start)
    if start < 0 or end < 0:
        raise RuntimeError("Could not locate the Render-only download request block")
    static_download = """      // Static GitHub Pages: public ZIP download after license acknowledgement.
      if (action.mode !== 'zip' || ext.id !== 'general-tools' ||
          ext.packages?.generic?.available !== true ||
          ext.packages.generic.file !== 'general-tools.zip') {
        throw new Error('Only the Chromium ZIP is available from this static site.');
      }
      $('#licenseDialog').close();
      const download = document.createElement('a');
      download.href = 'downloads/general-tools.zip';
      download.download = 'general-tools-' + ext.version + '.zip';
      document.body.appendChild(download);
      download.click();
      download.remove();
      toast('General Tools ZIP requested. Extract it and choose Load unpacked in Chromium.');
"""
    js = js[:start] + static_download + js[end:]
    (OUT / "app.js").write_text(js, encoding="utf-8")

    security = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>General Tools Store | GitHub Pages Security</title>
<style>body{margin:0;background:#fafaf8;color:#141414;font:16px/1.7 system-ui,Arial,sans-serif}header,main,footer{max-width:850px;margin:auto;padding:22px}header{border-bottom:1px solid #ddd}a{color:inherit}main{padding-top:55px;padding-bottom:80px}h1{letter-spacing:-.06em;line-height:1.1;font-size:clamp(35px,7vw,62px)}h2{margin-top:35px}p{color:#4c4c4c}code{background:#eee;padding:2px 5px;border-radius:4px}</style>
</head><body><header><a href="index.html">GENERAL TOOLS STORE</a></header><main>
<p>GITHUB PAGES EDITION</p><h1>Transparent, static distribution.</h1>
<p>Downloads are public files hosted on GitHub Pages over HTTPS, not temporary signed links. Accepting the license in the browser is an acknowledgement, not access control.</p>
<h2>Verify the ZIP</h2><p>Download <a href="downloads/general-tools.zip">General Tools v2.0</a> and compare its SHA-256 hash against <a href="downloads/SHA256SUMS.txt">SHA256SUMS.txt</a>. The checksum is published alongside the ZIP; it does not independently authenticate the source.</p>
<h2>Install in Chromium</h2><p>Extract the ZIP, open <code>chrome://extensions</code>, enable Developer mode and select <b>Load unpacked</b>. This site does not auto-install extensions.</p>
<h2>Security and licensing</h2><p>This site has no server API or private signing keys. Review the <a href="LICENSE.txt">license</a> and <a href="THIRD_PARTY_NOTICES.txt">third-party notices</a>.</p>
</main><footer><a href="index.html">Back to General Tools Store</a></footer></body></html>"""
    (OUT / "SECURITY.html").write_text(security, encoding="utf-8")
    if '"/assets/' in html or "/api/download-ticket" in js or "fetch('/api/catalog'" in js:
        raise RuntimeError("An absolute asset path or backend API call remains")
    print(f"General Tools {version} GitHub Pages build OK; SHA256={digest}")

if __name__ == "__main__":
    main()
