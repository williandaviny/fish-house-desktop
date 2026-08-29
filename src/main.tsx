import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Injetado pelo Vite em tempo de build — true somente no app desktop (Tauri)
declare const __TAURI_BUILD__: boolean;

// Antes do React montar: força o hash para /admin/pdv no app desktop
// Isso garante que HashRouter inicie na rota correta independente do que o Tauri abrir
if (__TAURI_BUILD__ && !window.location.hash.startsWith('#/admin')) {
  window.location.hash = '/admin/pdv';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
