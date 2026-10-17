/// <reference types="vite/client" />
import { createRoot } from 'react-dom/client';
import { BuryTheClickPedal } from './pedals/bury-the-click/BuryTheClickPedal.tsx';
import './style.css';

createRoot(document.getElementById('app')!).render(<BuryTheClickPedal />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
