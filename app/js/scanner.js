// Camera barcode scanner. Uses the browser's BarcodeDetector when it can read
// EAN codes (Chrome on Android/Mac), otherwise the built-in JS decoder.
import { scanGray, rgbaToGray, isValidCode, normalizeCode } from './barcode.js';

const FORMATS = ['ean_13', 'ean_8', 'upc_a'];

async function nativeDetector() {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = FORMATS.filter((f) => supported.includes(f));
    return formats.length ? new window.BarcodeDetector({ formats }) : null;
  } catch { return null; }
}

// Opens the scanner dialog. Resolves with a 13/8-digit code, or null if closed.
export function scanBarcode(dialog, t) {
  return new Promise((resolve) => {
    let stream = null;
    let timer = null;
    let done = false;
    const seen = new Map();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    dialog.innerHTML = `
      <div class="scanner">
        <div class="scan-view">
          <video playsinline muted autoplay></video>
          <div class="scan-guide"><span></span></div>
          <p class="scan-msg">${t('scanHint')}</p>
        </div>
        <form class="scan-manual">
          <label>${t('typeCode')}
            <div class="row"><input name="code" inputmode="numeric" pattern="[0-9 ]*" autocomplete="off" placeholder="8001234567890">
            <button class="btn">OK</button></div>
          </label>
          <p class="scan-err"></p>
        </form>
        <button type="button" class="btn ghost scan-close" autofocus>${t('cancel')}</button>
      </div>`;
    const video = dialog.querySelector('video');
    const msg = dialog.querySelector('.scan-msg');
    const err = dialog.querySelector('.scan-err');

    const finish = (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      if (dialog.open) dialog.close();
      resolve(code);
    };

    dialog.querySelector('.scan-close').onclick = () => finish(null);
    dialog.oncancel = (e) => { e.preventDefault(); finish(null); };
    dialog.querySelector('.scan-manual').onsubmit = (e) => {
      e.preventDefault();
      const code = normalizeCode(e.target.code.value);
      if (isValidCode(code)) finish(code);
      else err.textContent = t('invalidCode');
    };

    const accept = (code, needed) => {
      code = normalizeCode(code);
      if (!isValidCode(code)) return false;
      const n = (seen.get(code) || 0) + 1;
      seen.set(code, n);
      if (n < needed) return false;
      if (navigator.vibrate) navigator.vibrate(60);
      finish(code);
      return true;
    };

    dialog.showModal();

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = t('noCamera'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (e) {
        msg.textContent = t(e && e.name === 'NotAllowedError' ? 'cameraDenied' : 'noCamera');
        dialog.querySelector('input[name=code]').focus();
        return;
      }
      if (done) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoplay attribute covers it */ }
      const detector = await nativeDetector();

      const tick = async () => {
        if (done) return;
        if (video.readyState >= 2 && video.videoWidth) {
          try {
            if (detector) {
              const found = await detector.detect(video);
              for (const b of found) if (accept(b.rawValue, 1)) return;
            } else {
              const scale = Math.min(1, 960 / video.videoWidth);
              const w = Math.round(video.videoWidth * scale);
              const h = Math.round(video.videoHeight * scale);
              canvas.width = w; canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const gray = rgbaToGray(ctx.getImageData(0, 0, w, h).data, w, h);
              const r = scanGray(gray, w, h, { lines: 15 });
              // the JS decoder must see the same code twice before it counts
              if (r && accept(r.code, r.n >= 3 ? 1 : 2)) return;
            }
          } catch { /* keep trying */ }
        }
        timer = setTimeout(tick, detector ? 150 : 90);
      };
      tick();
    })();
  });
}
