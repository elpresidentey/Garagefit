import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event('gf:sw-update'));
  },
});

(window as unknown as { __gfUpdateSW?: (reload: boolean) => void }).__gfUpdateSW = (reload: boolean) => updateSW(reload);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
