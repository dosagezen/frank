
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// ─── Tratamento de chunks desatualizados após novo deploy ───────────────────
// Quando o Vite faz um novo build, os nomes dos arquivos mudam (ex: page-abc.js).
// Se o navegador ainda tem a versão antiga em cache e tenta carregar um chunk
// que não existe mais no servidor, ocorre o erro "Failed to fetch dynamically
// imported module". A solução é detectar esse erro e recarregar a página uma vez.

const RELOAD_KEY = '__chunk_reload_attempted__';

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  const isChunkError =
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Unable to preload CSS');

  if (isChunkError) {
    const alreadyAttempted = sessionStorage.getItem(RELOAD_KEY);
    if (!alreadyAttempted) {
      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    }
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg =
    (reason instanceof Error ? reason.message : String(reason ?? '')) || '';

  const isChunkError =
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Unable to preload CSS') ||
    msg.includes('dynamically imported module');

  if (isChunkError) {
    event.preventDefault();
    const alreadyAttempted = sessionStorage.getItem(RELOAD_KEY);
    if (!alreadyAttempted) {
      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    }
  }
});

// Limpa a flag de reload ao carregar com sucesso
// (garante que futuros erros reais também sejam tratados)
window.addEventListener('load', () => {
  sessionStorage.removeItem(RELOAD_KEY);
});
// ────────────────────────────────────────────────────────────────────────────

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(<App />);
