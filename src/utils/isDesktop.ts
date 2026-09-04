// Deteccao confiavel de runtime Desktop (Tauri / Localhost instalavel)
export const isDesktop = typeof window !== 'undefined' && (
  '__TAURI_INTERNALS__' in window ||
  '__TAURI__' in window ||
  window.location.protocol === 'tauri:' ||
  window.location.protocol === 'asset:' ||
  window.location.protocol === 'file:' ||
  window.location.hostname === 'tauri.localhost'
);
