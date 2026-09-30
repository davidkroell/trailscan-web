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

// TrailscanMap owns all Leaflet state (map, track layer, feature markers).
// It is driven imperatively from Alpine state and never mirrored into it.
export class TrailscanMap {
  constructor(container) {
    this.map = L.map(container).setView([47.0, 13.0], 8)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map)

    this.trackLayer = null
    this.markersByNum = new Map()
  }

  loadTrack(gpxText) {
    return new Promise((resolve, reject) => {
      if (this.trackLayer) {
        this.map.removeLayer(this.trackLayer)
        this.trackLayer = null
      }

      const blob = new Blob([gpxText], { type: 'application/gpx+xml' })
      const url = URL.createObjectURL(blob)

      this.trackLayer = new L.GPX(url, { async: true })
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

  setFeatures(features) {
    this.clearFeatures()

    for (const feature of features) {
      const marker = L.marker([feature.lat, feature.lon]).bindPopup(
        `<strong>${feature.name || feature.type}</strong><br>${feature.type}`,
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
