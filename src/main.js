import './style.css'
import Alpine from 'alpinejs'
import { trailscanApp } from './app.js'

Alpine.data('trailscanApp', trailscanApp)

window.Alpine = Alpine
Alpine.start()
