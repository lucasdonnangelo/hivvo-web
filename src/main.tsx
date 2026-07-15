import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initSentry } from './lib/observability'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css';
import './styles/tokens.css'
import './index.css'

// Antes de tudo: um erro na criação do QueryClient ou no render inicial só é
// capturado se o Sentry já estiver de pé. Sem VITE_SENTRY_DSN é no-op.
initSentry()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 min
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Envolve o App inteiro (inclusive layouts e AuthInitializer): erro de
            render vira relatório + tela de recuperação, nunca tela branca. */}
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
