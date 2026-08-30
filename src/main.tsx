import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Deteccao dinamica de ambiente desktop (Tauri / Localhost / Arquivo local)
const isDesktopEnv = typeof window !== 'undefined' && (
  '__TAURI_INTERNALS__' in window ||
  '__TAURI__' in window ||
  window.location.protocol === 'tauri:' ||
  window.location.protocol === 'asset:' ||
  window.location.protocol === 'file:' ||
  window.location.hostname === 'tauri.localhost'
);

if (isDesktopEnv && (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/')) {
  window.location.hash = '/admin/login';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

