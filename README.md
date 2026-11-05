# General Tools Store — Secure Starter

This starter implements a black-and-white extension store with controlled distribution.

## Security measures included

- Private package directory (not static/public)
- Short-lived HMAC-signed download URLs
- SHA-256 package hashes
- Mandatory license acknowledgement before ticket issuance
- Strict Content-Security-Policy and other browser security headers
- No server secrets in frontend code
- Browser detection
- Firefox signed-XPI flow support
- Hook for a custom Chromium installation API
- No fake automatic installation in unsupported browsers

## Important limitation

A browser extension runs on the user's machine. Client-side HTML/JS/CSS and packaged extension code can ultimately be inspected after installation. This project does not claim otherwise.

For valuable proprietary logic:
1. Keep secrets and private keys on the server.
2. Keep sensitive business logic behind authenticated APIs where technically appropriate.
3. Never embed API secrets in the extension.
4. Sign releases and verify hashes.
5. Keep third-party licenses and notices intact.

## Run locally

Requires Node.js 18+.

```bash
# macOS/Linux
export DOWNLOAD_SIGNING_SECRET="replace-with-a-long-random-secret"
node server.js

# Windows PowerShell
$env:DOWNLOAD_SIGNING_SECRET="replace-with-a-long-random-secret"
node server.js
```

Open http://localhost:3000

## Add your packages

Put packages in `private_packages/` and update `catalog.json`.

Suggested:
- `general-tools-chromium.crx`
- `general-tools-firefox.xpi` (must be signed by Mozilla for normal Firefox release installs)
- `general-tools.zip`

Set the corresponding `available` values in `catalog.json`.

## Custom Chromium integration

The frontend checks for:

```js
window.GeneralToolsBrowser.installExtension({
  url,
  sha256,
  name,
  version
})
```

Your custom Chromium build must implement that trusted browser-side bridge itself. The website cannot create this privileged API.

The browser implementation should:
- require a user gesture;
- show native permissions before installation;
- download only over HTTPS;
- verify the package hash and/or signature;
- reject packages from untrusted origins;
- never silently install extensions.

## Firefox

For standard Firefox, self-hosted extensions must be signed by Mozilla. A signed `.xpi` can be hosted on your site and served with `Content-Type: application/x-xpinstall`.

## Chrome official

A normal public website cannot silently install an extension into official Chrome. The site therefore presents only a legitimate download/manual path unless your own Chromium exposes the trusted install bridge.

## Production notes

Use HTTPS.
Set a strong `DOWNLOAD_SIGNING_SECRET`.
Add reverse-proxy/server rate limiting.
Store packages in private object storage if possible.
Add logging and abuse detection without collecting unnecessary personal data.


## Current bundled extension

This deployment package already includes:
`private_packages/general-tools.zip`

It is the uploaded General Tools Extension v1.0.0 package.
CRX and Firefox XPI are intentionally disabled until valid signed packages are supplied.

## Render deploy

1. Put this project in a PRIVATE GitHub repository.
2. In Render, choose New > Web Service.
3. Connect the private repository.
4. Runtime: Node.
5. Build command: leave empty (or `npm install`).
6. Start command: `npm start`.
7. Instance type: Free.
8. Add environment variable `DOWNLOAD_SIGNING_SECRET` with a long random value
   (or use the provided render.yaml Blueprint, which generates one).
9. Deploy.

Do not make the repository public if your goal is to avoid exposing the extension archive.


## 2026 visual redesign

This release includes the original General Tools artwork and favicon extracted from the extension itself, animated editorial landing page, About and proposals sections, FAQ, mobile menu, responsive catalog, and accessibility preferences. The proposal cards explicitly describe future concepts, not active functionality.

Static brand assets are served from `public/assets/`; their source is the bundled extension package. The protected download flow and proprietary license remain unchanged.


## Version 1.1.0
The protected package `private_packages/general-tools.zip` contains General Tools Extension v1.1.0 in English. The catalog has been updated to match. Supports unified stopwatch and WASD layout.
