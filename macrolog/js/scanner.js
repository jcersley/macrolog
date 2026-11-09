// Camera barcode scanning. Safari has no BarcodeDetector, so decoding runs
// through ZXing compiled to WebAssembly (vendored in /vendor, works offline).

const FORMATS = ['EAN13', 'EAN8', 'UPCA', 'UPCE'];
const READ_OPTIONS = { formats: FORMATS, tryHarder: true, tryRotate: true, tryInvert: false, tryDownscale: true, maxNumberOfSymbols: 1 };

let zxingPromise = null;

export function loadZXing() {
  if (zxingPromise) return zxingPromise;
  zxingPromise = new Promise((resolve, reject) => {
    if (window.ZXingWASM) return resolve(window.ZXingWASM);
    const script = document.createElement('script');
    script.src = new URL('../vendor/zxing-reader.js', import.meta.url).href;
    script.onload = () => resolve(window.ZXingWASM);
    script.onerror = () => reject(new Error('The barcode reader could not be loaded.'));
    document.head.appendChild(script);
  }).then(async (Z) => {
    const wasmUrl = new URL('../vendor/zxing_reader.wasm', import.meta.url).href;
    await Z.prepareZXingModule({
      overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      fireImmediately: true,
    });
    return Z;
  });
  zxingPromise.catch(() => {
    zxingPromise = null;
  });
  return zxingPromise;
}

export function describeCameraError(err) {
  const name = err?.name || '';
  if (!window.isSecureContext) return 'The camera only works on a secure (https) page.';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access is blocked. On iPhone, open Settings, find Safari (or this app), and allow the camera. Then reopen the app.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is in use by another app. Close it and try again.';
  return err?.message || 'The camera could not be started.';
}

export class BarcodeScanner {
  constructor(video, { onDetect }) {
    this.video = video;
    this.onDetect = onDetect;
    this.running = false;
    this.stopped = false;
    this.stream = null;
  }

  async start() {
    const Z = await loadZXing();
    if (this.stopped) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = new Error('This browser does not support camera access.');
      e.name = 'NotFoundError';
      throw e;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    // The person may have left the scan screen while the permission prompt was open.
    if (this.stopped) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    this.video.srcObject = stream;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play();
    if (this.stopped) return;
    this.running = true;
    this.loop(Z);
  }

  get canTorch() {
    const track = this.stream?.getVideoTracks?.()[0];
    return !!track?.getCapabilities?.().torch;
  }

  async setTorch(on) {
    const track = this.stream?.getVideoTracks?.()[0];
    if (track) await track.applyConstraints({ advanced: [{ torch: on }] });
  }

  async loop(Z) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    while (this.running) {
      const started = performance.now();
      const v = this.video;
      if (v.readyState >= 2 && v.videoWidth) {
        // Read a wide band through the middle, where the on-screen guide is.
        const cw = Math.round(v.videoWidth * 0.92);
        const ch = Math.round(v.videoHeight * 0.5);
        const sx = Math.round((v.videoWidth - cw) / 2);
        const sy = Math.round((v.videoHeight - ch) / 2);
        const scale = Math.min(1, 960 / cw);
        canvas.width = Math.round(cw * scale);
        canvas.height = Math.round(ch * scale);
        ctx.drawImage(v, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
        try {
          const results = await Z.readBarcodes(ctx.getImageData(0, 0, canvas.width, canvas.height), READ_OPTIONS);
          const hit = results.find((r) => r.isValid && r.text);
          if (hit && this.running) {
            this.running = false;
            this.stop();
            this.onDetect(hit.text, hit.format);
            return;
          }
        } catch {
          // A bad frame is not fatal; try the next one.
        }
      }
      const wait = Math.max(0, 90 - (performance.now() - started));
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  stop() {
    this.running = false;
    this.stopped = true;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }
}

// Fallback for when live scanning struggles: read a barcode from a photo.
export async function decodeImageFile(file) {
  const Z = await loadZXing();
  const results = await Z.readBarcodesFromImageFile(file, { ...READ_OPTIONS, tryInvert: true });
  const hit = results.find((r) => r.isValid && r.text);
  return hit ? hit.text : null;
}
