import { TrailscanMap } from './map.js'
import { analyze, whenReady } from './wasm.js'

export const QUERY_TEMPLATES = [
  { value: 'peaks', label: 'Peaks' },
  { value: 'hiking', label: 'Hiking (peaks, huts, lakes, saddles, ...)' },
  { value: 'village', label: 'Villages' },
  { value: 'cycling', label: 'Cycling (villages, saddles, viewpoints)' },
  { value: 'supplies', label: 'Supplies (water, food, shops)' },
]

// Resolves the current theme, mapping legacy stored values ("light"/"dark")
// to the actual daisyUI theme names used by the CSS.
function resolveTheme(stored) {
  if (stored === 'trailscan-dark' || stored === 'dark') return 'trailscan-dark'
  if (stored === 'trailscan-light' || stored === 'light') return 'trailscan-light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'trailscan-dark'
    : 'trailscan-light'
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[c])
}

// Builds an annotated GPX by injecting <wpt> elements for the given
// features into the original GPX XML, right before the closing </gpx> tag.
function buildAnnotatedGpx(originalGpxText, features) {
  const waypoints = features
    .map(
      (f) => `  <wpt lat="${f.lat}" lon="${f.lon}">
    <name>${escapeXml(f.name || f.type)}</name>
    <type>${escapeXml(f.type)}</type>
  </wpt>`,
    )
    .join('\n')

  return originalGpxText.replace(/<\/gpx>\s*$/, `${waypoints}\n</gpx>\n`)
}

export function trailscanApp() {
  return {
    sidebarOpen: true,
    theme: 'trailscan-light',
    wasmReady: false,
    status: 'idle', // idle | loading | error | done
    error: '',
    dragOver: false,

    fileName: '',
    gpxText: '',

    options: {
      querytemplate: 'peaks',
      max_distance: 50,
      max_elevation_diff: 30,
      simplify_gpx: true,
    },
    queryTemplates: QUERY_TEMPLATES,

    track: null,
    features: [],
    selectedFeature: null,

    map: null,

    init() {
      this.theme = resolveTheme(localStorage.getItem('trailscan-theme'))
      this.applyTheme(this.theme)

      this.map = new TrailscanMap(this.$refs.map)
      whenReady().then(() => {
        this.wasmReady = true
      })
    },

    toggleTheme() {
      this.applyTheme(this.theme === 'trailscan-dark' ? 'trailscan-light' : 'trailscan-dark')
    },

    applyTheme(theme) {
      this.theme = theme
      document.documentElement.dataset.theme = theme
      localStorage.setItem('trailscan-theme', theme)
    },

    onFileSelected(file) {
      if (!file) return

      this.fileName = file.name
      this.status = 'idle'
      this.error = ''
      this.selectedFeature = null

      const reader = new FileReader()
      reader.onload = () => {
        this.gpxText = reader.result
      }
      reader.readAsText(file)
    },

    onDrop(event) {
      const file = event.dataTransfer?.files?.[0]
      this.onFileSelected(file)
    },

    clearFile() {
      this.fileName = ''
      this.gpxText = ''
      this.status = 'idle'
      this.error = ''
      this.track = null
      this.features = []
      this.selectedFeature = null
      this.map?.clearFeatures()
      this.map?.clearTrack()
    },

    get canLoadFeatures() {
      return this.wasmReady && !!this.gpxText && this.status !== 'loading'
    },

    async loadFeatures() {
      if (!this.canLoadFeatures) return

      this.status = 'loading'
      this.error = ''
      this.selectedFeature = null

      try {
        const result = await analyze(this.gpxText, this.options)

        this.track = result.track
        this.features = (result.features ?? []).map((f) => ({ ...f, included: true }))

        await this.map.loadTrack(this.gpxText)
        this.map.setFeatures(this.features)

        this.status = 'done'
      } catch (err) {
        this.status = 'error'
        this.error = err?.message ?? String(err)
      }
    },

    toggleFeature(feature) {
      this.map.setFeatureVisible(feature.num, feature.included)
    },

    selectFeature(feature) {
      this.selectedFeature = feature.num
      this.map.highlightFeature(feature.num)
    },

    exportGpx() {
      const included = this.features.filter((f) => f.included)
      const gpx = buildAnnotatedGpx(this.gpxText, included)

      const blob = new Blob([gpx], { type: 'application/gpx+xml' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = this.fileName.replace(/\.gpx$/i, '') + '.annotated.gpx'
      a.click()

      URL.revokeObjectURL(url)
    },

    typeBadge(type) {
      const t = String(type ?? '').toLowerCase()
      if (/peak|summit|mountain|alp/.test(t)) return 'badge-warning'
      if (/hut|shelter|cabin|hostel|camp/.test(t)) return 'badge-error'
      if (/lake|spring|water|river|stream|fountain|well/.test(t)) return 'badge-info'
      if (/saddle|pass|col/.test(t)) return 'badge-success'
      if (/village|town|city|hamlet|suburb|borough/.test(t)) return 'badge-secondary'
      if (/viewpoint|view|panorama/.test(t)) return 'badge-accent'
      if (/shop|cafe|restaurant|food|supply|supermarket|bakery|fuel|pharmacy|bank|atm|post/.test(t))
        return 'badge-neutral'
      return 'badge-ghost'
    },
  }
}
