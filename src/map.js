import L from 'leaflet'
import 'leaflet-gpx'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Leaflet's default marker icon URLs are relative and break once bundled;
// point them at the actual bundled asset URLs instead.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const OSM_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
}

const TRACK_COLORS = {
  light: '#6331fb', // electric indigo — visible on light tiles
  dark: '#88f9c0', // tropical mint — visible on dark tiles
}

// Escapes user-controlled data before it is inserted into HTML (Leaflet
// popups / divIcons accept raw HTML). Feature names and types originate from
// OSM data, which is editable by anyone, so this must never be omitted.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c])
}

// TrailscanMap owns all Leaflet state (map, track layer, feature markers).
// It is driven imperatively from Alpine state and never mirrored into it.
export class TrailscanMap {
  constructor(container, theme = 'light') {
    this.theme = theme
    this.map = L.map(container, { zoomControl: false }).setView([47.0, 13.0], 8)
    L.control.zoom({ position: 'bottomright' }).addTo(this.map)

    this.tileLayer = L.tileLayer(OSM_TILES.url, OSM_TILES.options)
    this.tileLayer.addTo(this.map)

    this.trackLayer = null
    this.markersByNum = new Map()
  }

  setTheme(theme) {
    this.theme = theme
  }

  loadTrack(gpxText) {
    return new Promise((resolve, reject) => {
      if (this.trackLayer) {
        this.map.removeLayer(this.trackLayer)
        this.trackLayer = null
      }

      const blob = new Blob([gpxText], { type: 'application/gpx+xml' })
      const url = URL.createObjectURL(blob)

      this.trackLayer = new L.GPX(url, {
        async: true,
        polyline_options: {
          color: TRACK_COLORS[this.theme] ?? TRACK_COLORS.light,
          weight: 5,
          opacity: 0.9,
        },
        markers: { startIcon: false, endIcon: false },
        gpx_options: { parseElements: ['track'] },
      })
        .on('loaded', (e) => {
          URL.revokeObjectURL(url)
          this.map.fitBounds(e.target.getBounds())
          resolve()
        })
        .on('error', (e) => {
          URL.revokeObjectURL(url)
          reject(e.error ?? new Error('failed to load GPX track'))
        })
        .addTo(this.map)
    })
  }

  clearTrack() {
    if (this.trackLayer) {
      this.map.removeLayer(this.trackLayer)
      this.trackLayer = null
    }
  }

  setFeatures(features) {
    this.clearFeatures()

    for (const feature of features) {
      const marker = L.marker([feature.lat, feature.lon], {
        icon: featureIcon(feature.num),
        riseOnHover: true,
      }).bindPopup(
        `<strong>${escapeHtml(feature.name || feature.type)}</strong><span style="opacity:.7">${escapeHtml(feature.type)}</span>`,
      )
      this.markersByNum.set(feature.num, marker)
      marker.addTo(this.map)
    }
  }

  clearFeatures() {
    for (const marker of this.markersByNum.values()) {
      this.map.removeLayer(marker)
    }
    this.markersByNum.clear()
  }

  setFeatureVisible(num, visible) {
    const marker = this.markersByNum.get(num)
    if (!marker) return

    if (visible && !this.map.hasLayer(marker)) {
      marker.addTo(this.map)
    } else if (!visible && this.map.hasLayer(marker)) {
      this.map.removeLayer(marker)
    }
  }

  highlightFeature(num) {
    const marker = this.markersByNum.get(num)
    if (!marker) return

    if (!this.map.hasLayer(marker)) {
      marker.addTo(this.map)
    }
    this.map.panTo(marker.getLatLng())
    marker.openPopup()
  }
}

function featureIcon(num) {
  return L.divIcon({
    className: '',
    html: `<div class="trail-marker"><span>${escapeHtml(num)}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  })
}
