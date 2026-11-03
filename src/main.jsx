import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { StoreProvider } from './lib/store.jsx'
import App from './App.jsx'
import './index.css'

// The service worker makes Nudged installable and opens it from a tapped notification.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <StoreProvider>
      {/* Framer Motion ignores the CSS reduced-motion rule, so tell it directly. */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </StoreProvider>
  </BrowserRouter>,
)
