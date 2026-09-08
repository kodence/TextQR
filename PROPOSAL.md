# TextQR — Proposal

A small, privacy-first app that converts text to QR codes and reads QR codes back into text.
Everything runs on the user's device. No server, no uploads.

## 1. Goals

- **Text → QR**: type or paste text, see a live QR preview, download or copy it.
- **QR → Text**: read a QR code from an image file, the clipboard, or the camera, and get the text back.
- Works offline once loaded. Installable as a PWA.
- Handles Unicode correctly (UTF-8) and warns when text exceeds QR capacity.

Non-goals for v1: other barcode formats, accounts, cloud sync, batch generation.

## 2. Platform decision

| Option | Pros | Cons |
|---|---|---|
| **Web PWA (recommended)** | One codebase for desktop and mobile, camera via `getUserMedia`, zero install, easy to share | Camera needs HTTPS (localhost is fine for dev) |
| .NET WPF/WinUI desktop | Native Windows feel, ZXing.Net is mature | Windows only, camera integration is fiddly |
| Python CLI (qrcode + pyzbar) | Fastest to script | No camera UI, pyzbar needs a native zbar DLL on Windows |

Recommendation: **Vite + React + TypeScript PWA**, with a thin **Node CLI** that reuses the same core module for scripting.

## 3. Libraries

| Concern | Library | Why |
|---|---|---|
| Encode | `qrcode` (node-qrcode) | Mature, MIT, renders to canvas, PNG, and SVG; works in browser and Node |
| Decode | `zxing-wasm` | Port of ZXing C++; far more tolerant of rotation, blur, low contrast, and inverted codes than `jsQR`; works in browser and Node (good for tests) |
| UI | React + TypeScript, Vite | Standard tooling, fast dev loop |
| PWA | `vite-plugin-pwa` | Service worker and manifest with no hand-rolled config |
| Tests | Vitest | Round-trip encode → decode tests run headless in Node |

## 4. Features

### Text → QR
- Text area with live preview (debounced).
- Character and byte counter with capacity warning. Byte-mode limits: 2953 (L), 2331 (M), 1663 (Q), 1273 (H).
- Options: error-correction level (L/M/Q/H, default M), size, quiet-zone margin, foreground/background colour.
- Export: download PNG, download SVG, copy PNG to clipboard.
- Detects when input looks like a URL, Wi-Fi config, or vCard and shows the type (v1 is display only; v2 could add templates).

### QR → Text
- Input sources: drag-and-drop image, file picker, paste image from clipboard, live camera (rear camera preferred on mobile).
- Camera mode scans continuously and stops on first hit, with a "scan again" button.
- Result shown in an editable text box with copy button. If it is a URL, show an "open" link.
- Optional scan history stored in `localStorage` (toggle off by default).

### Shared
- Light and dark theme.
- Keyboard shortcuts: Ctrl+Enter to generate, Ctrl+V anywhere on decode tab to paste image.
- Offline after first load.

## 5. Architecture

```
TextQR/
  src/
    core/
      encode.ts        # text -> { dataUrl | svg | Uint8Array }, capacity check
      decode.ts        # ImageData | Blob | File -> string[]
      capacity.ts      # byte limits per EC level
    ui/
      App.tsx
      EncodePanel.tsx
      DecodePanel.tsx
      CameraScanner.tsx
      hooks/useCamera.ts
    main.tsx
  cli/
    textqr.ts          # textqr encode "hello" -o out.png ; textqr decode in.png
  tests/
    roundtrip.test.ts  # encode -> decode for ASCII, CJK, emoji, max length
  public/manifest.webmanifest
  index.html
  vite.config.ts
  package.json
```

`core/` has no DOM or React dependency, so the CLI and tests import it directly.

## 6. Edge cases to handle

- **Unicode**: encode as UTF-8 bytes. Most readers assume UTF-8 for byte mode, which matches phone camera behaviour.
- **Over capacity**: block generation and show how many bytes over. v2 option: split into numbered parts ("1/3: …") since structured-append is poorly supported by phone readers.
- **Multiple codes in one image**: `zxing-wasm` returns all hits. Show each as a separate result.
- **Camera permission denied or no camera**: fall back to file upload with a clear message.
- **iOS Safari**: needs `playsinline` on the video element and a user gesture to start the stream.
- **WASM loading under Vite**: configure the wasm asset path so the service worker caches it for offline use.

## 7. Milestones

| # | Deliverable | Effort |
|---|---|---|
| 1 | Scaffold, core encode module, Encode panel with PNG/SVG download | 0.5 day |
| 2 | Core decode module, Decode panel with file/drop/paste | 0.5 day |
| 3 | Camera scanning | 0.5 day |
| 4 | PWA, theming, clipboard copy, history, capacity warnings | 1 day |
| 5 | Round-trip tests, CLI, README | 0.5 day |

Total: about 3 working days for a polished v1.

## 8. Risks

- Camera behaviour differs across browsers. Mitigation: test on Chrome, Edge, Safari iOS early (milestone 3).
- `zxing-wasm` is ~1 MB. Acceptable for a PWA that caches it. If bundle size matters more than robustness, swap to `jsQR` (~50 KB) behind the same `decode.ts` interface.
- Clipboard image paste requires a secure context and user permission on some browsers. File upload is always the fallback.

## 9. Open questions

1. Web PWA is the recommendation. Confirm, or prefer a native Windows app?
2. Is the multi-part split for long text needed in v1, or is a capacity warning enough?
3. Should scan history exist at all, given the privacy-first positioning?
