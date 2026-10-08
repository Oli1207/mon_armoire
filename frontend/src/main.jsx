import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './utils/installPrompt';   // doit être chargé tout de suite : l'invitation d'installation n'est émise qu'une fois
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
