# TextQR

Convert text to QR codes and back, entirely on your device. A small web app that installs as an offline PWA, plus a command-line tool that shares the same core.

- **Text to QR**: live preview, error-correction level, size, margin, colours; download PNG or SVG, or copy the PNG to the clipboard.
- **QR to text**: drop, choose, or paste an image; or scan live with the camera. Editable result, copy button, and an open-link button for web URLs.
- **Private by design**: no server, no uploads, no CDN. The QR decoder's WebAssembly binary is bundled and cached for offline use.
- **CLI**: `textqr encode` and `textqr decode` for scripts and pipelines.

The original plan is in [PROPOSAL.md](PROPOSAL.md). All five milestones are complete.

## Quick start

```bash
npm install
npm run dev        # web app at http://localhost:5173
```

Production build and preview (the service worker only runs in the built app):

```bash
npm run build
npm run preview    # http://localhost:4173
```

## Command-line tool

Build it once, then run it with `npm run cli -- ...` or link it as `textqr`:

```bash
npm run build:cli
npm link           # optional: puts `textqr` on your PATH
```

Examples:

```bash
textqr encode "https://example.com"                 # draws the code in the terminal
textqr encode "hello" -o hello.png                  # PNG file (size grows automatically for large codes)
textqr encode "hello" -o hello.svg --ec H           # SVG with high error correction
echo "piped text" | textqr encode -o piped.png      # text from stdin
textqr encode "x" -o - -f png > raw.png             # raw PNG bytes on stdout

textqr decode photo.jpg                             # prints the decoded text, one line per code
textqr decode photo.jpg --json                      # [{ "text": "...", "format": "QRCode" }]
cat photo.png | textqr decode                       # image bytes from stdin
```

Exit codes: `0` success, `1` error (bad arguments, unreadable file, text too long), `2` no QR code found.

Run `textqr --help` for every option.

## Development

```bash
npm test           # Vitest: capacity, encode, decode round-trips, history, camera errors, CLI
npm run typecheck  # tsc across app, CLI, and config
npm run build      # web app to dist/
npm run build:cli  # CLI to dist-cli/textqr.js
```

## Layout

```
src/core/        encode, decode, capacity, history. Pure TypeScript, no DOM or React.
src/ui/          React components, theme, camera scanner, history hook, wasm setup.
cli/             Command-line tool over src/core (main.ts is testable; textqr.ts is the entry).
tests/           Vitest suites.
public/          PWA icons and favicon (generated with a small Pillow script).
vite.config.ts   Web app build with the PWA plugin.
vite.cli.config.ts  CLI bundle.
```

Key points:

- `src/core` has no browser dependencies, which is what lets the CLI and the Node test suite reuse it.
- `src/ui/decoder.ts` points zxing-wasm at the locally bundled `.wasm` file. Without it the library fetches from jsDelivr.
- The encoder enforces at least 3 pixels per module. A maximum-size code has 177 modules per side, and decoders fail below about 2 px per module.

## Privacy

- After the first load the app makes no network requests.
- Scan history is off by default. When on, it lives in this browser's localStorage only, and turning it off deletes it.
- The theme choice is stored in localStorage.

## Browser notes

- Camera access needs a secure context: `https://` or `localhost`. On plain `http://` the camera button explains this and file upload still works.
- iOS Safari needs a tap to start the camera; the "Scan with camera" button provides it.
- Copy PNG appears only where the browser supports writing images to the clipboard (Chrome, Edge, Safari). Firefox users can download instead.
- Camera scanning has been verified with a synthetic video stream. Real-device testing on iOS and Android is still recommended.

## Deploying

The live app is at **https://kodence.github.io/TextQR/**, published by the GitHub Actions workflow in `.github/workflows/deploy.yml` on every push to `main`. The workflow runs the tests, builds with `BASE_PATH=/TextQR/`, and uploads `dist/` to GitHub Pages.

To host elsewhere, run `npm run build` (set `BASE_PATH` if the site is not at the domain root) and serve `dist/` from any static host over https. The service worker precaches everything, including the 1 MB decoder, so first load is heavier and every later load is instant and offline-capable.

## Libraries

- [qrcode](https://github.com/soldair/node-qrcode) for encoding (MIT)
- [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) for decoding (MIT, wraps ZXing-C++)
- Vite, React, TypeScript, vite-plugin-pwa, Vitest

## License

MIT. See [LICENSE](LICENSE).
