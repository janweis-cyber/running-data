import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { seedIfEmpty } from './db/seed'
import { startSync } from './sync/sync'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

seedIfEmpty().then(() => startSync())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
