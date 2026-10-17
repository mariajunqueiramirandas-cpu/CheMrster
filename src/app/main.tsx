import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';
import './styles/tutor.css';
import './styles/progress.css';
import './styles/board.css';
import './styles/canvas.css';
import './styles/settings.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
