import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app'
import { initializeTheme } from './app/theme'
import { AuthProvider } from './features/auth/AuthProvider'
import { ActionAuthorizationProvider } from './features/auth/ActionAuthorizationProvider'
import { createAppQueryClient } from './app/queryClient'
import './style.css'
import './audit.css'
import './theme.css'

initializeTheme()

const queryClient = createAppQueryClient()

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ActionAuthorizationProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        </ActionAuthorizationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
