// Camera barcode scanner. Uses the browser's BarcodeDetector where it exists (Android Chrome);
// elsewhere (iPhone Safari) loads a pinned ZXing-based BarcodeDetector ponyfill from the CDN.
import { html, useEffect, useRef, useState } from './core.js'

const PONYFILL = 'https://cdn.jsdelivr.net/npm/barcode-detector@3.2.2/dist/iife/ponyfill.js'
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
const SCAN_EVERY_MS = 200

let ponyfillPromise = null
function loadPonyfill() {
  ponyfillPromise = ponyfillPromise || new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = PONYFILL
    s.crossOrigin = 'anonymous'
    s.onload = () => (window.BarcodeDetectionAPI?.BarcodeDetector ? resolve(window.BarcodeDetectionAPI.BarcodeDetector) : reject(new Error('no detector')))
    s.onerror = () => reject(new Error('load failed'))
    document.head.appendChild(s)
  }).catch(err => { ponyfillPromise = null; throw err })
  return ponyfillPromise
}

async function makeDetector() {
  const Native = window.BarcodeDetector
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats()
      const formats = FORMATS.filter(f => supported.includes(f))
      if (formats.length) return new Native({ formats })
    } catch { /* fall through to the ponyfill */ }
  }
  const Pony = await loadPonyfill()
  return new Pony({ formats: FORMATS })
}

export const cameraAvailable = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export function Scanner({ onCode }) {
  const video = useRef(null)
  const [status, setStatus] = useState('Starting the camera…')
  useEffect(() => {
    let stream = null, timer = null, stopped = false
    const stop = () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()) }
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped) return stop()
        video.current.srcObject = stream
        await video.current.play()
        setStatus('Loading the scanner…')
        const detector = await makeDetector()
        if (stopped) return
        setStatus('Point the camera at the barcode')
        const tick = async () => {
          if (stopped) return
          try {
            const codes = video.current?.readyState >= 2 ? await detector.detect(video.current) : []
            const hit = codes.find(c => /^\d{8,14}$/.test(c.rawValue))
            if (hit) { navigator.vibrate?.(60); stop(); onCode(hit.rawValue); return }
          } catch { /* a bad frame; keep going */ }
          timer = setTimeout(tick, SCAN_EVERY_MS)
        }
        tick()
      } catch (err) {
        if (stopped) return
        stop()
        setStatus(err?.name === 'NotAllowedError' ? 'Camera access was blocked. Allow it in your browser settings, or type the barcode below.'
          : err?.message === 'load failed' ? 'Couldn’t load the scanner (it needs a connection the first time). Type the barcode below.'
          : 'Couldn’t start the camera. Type the barcode below.')
      }
    })()
    return stop
  }, [])
  return html`<div class="scanner">
    <video ref=${video} muted playsinline autoplay></video>
    <div class="scanner-frame" aria-hidden="true"></div>
    <p class="small muted center" role="status">${status}</p>
  </div>`
}
