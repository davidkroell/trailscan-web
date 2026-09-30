import { TrailscanMap } from './map.js'
import { analyze, whenReady } from './wasm.js'

export const QUERY_TEMPLATES = [
  { value: 'peaks', label: 'Peaks' },
  { value: 'hiking', label: 'Hiking (peaks, huts, lakes, saddles, ...)' },
  { value: 'village', label: 'Villages' },
  { value: 'cycling', label: 'Cycling (villages, saddles, viewpoints)' },
  { value: 'supplies', label: 'Supplies (water, food, shops)' },
]

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
    wasmReady: false,
    status: 'idle', // idle | loading | error | done
    error: '',

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

    map: null,

    init() {
      this.map = new TrailscanMap(this.$refs.map)
      whenReady().then(() => {
        this.wasmReady = true
      })
    },

    onFileSelected(file) {
      if (!file) return

      this.fileName = file.name
      this.status = 'idle'
      this.error = ''

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

    get canLoadFeatures() {
      return this.wasmReady && !!this.gpxText && this.status !== 'loading'
    },

    async loadFeatures() {
      if (!this.canLoadFeatures) return

      this.status = 'loading'
      this.error = ''

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
  }
}
