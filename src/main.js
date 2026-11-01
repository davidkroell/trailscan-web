import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import './style.css'
import Alpine from 'alpinejs'
import { trailscanApp } from './app.js'

Alpine.data('trailscanApp', trailscanApp)

window.Alpine = Alpine
Alpine.start()
