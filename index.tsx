
import { installNativeBackend } from './services/nativeBackend';

// MUST run before anything else so all /api requests inside the
// Capacitor APK are routed to the public backend.
installNativeBackend();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { runOneTimeCacheReset } from './services/cacheReset';

// One-time local cache cleanup after the app update (runs once per device,
// clears only cache entries — auth/profiles/settings are untouched).
runOneTimeCacheReset();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
