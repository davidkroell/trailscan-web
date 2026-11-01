// Loads the Go WASM module and exposes a promise-based analyze() call.
// This is the only place that talks to window.trailscan directly.

let readyPromise = null

function loadGoWasm() {
  if (readyPromise) return readyPromise

  readyPromise = new Promise((resolve, reject) => {
    window.addEventListener('trailscan:ready', () => resolve(), { once: true })

    const script = document.createElement('script')
    script.src = 'wasm_exec.js'
    script.onload = () => {
      const go = new window.Go()
      WebAssembly.instantiateStreaming(fetch('trailscan.wasm'), go.importObject)
        .then((result) => go.run(result.instance))
        .catch(reject)
    }
    script.onerror = () => reject(new Error('failed to load wasm_exec.js'))
    document.head.appendChild(script)
  })

  return readyPromise
}

export async function analyze(gpxText, options) {
  await loadGoWasm()
  const resultJSON = await window.trailscan.analyze(gpxText, JSON.stringify(options))
  return JSON.parse(resultJSON)
}

export function whenReady() {
  return loadGoWasm()
}
