import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ApiError } from './api'
import App from './App.tsx'

// Any 401 (e.g. the session cookie expired or the token was rotated) re-checks /me,
// which swaps the app for the login screen.
function onError(error: Error, queryKey?: readonly unknown[]) {
  // /me answering 401 is how we learn we're logged out; re-checking it would loop forever.
  if (error instanceof ApiError && error.status === 401 && queryKey?.[0] !== 'me') {
    void queryClient.invalidateQueries({ queryKey: ['me'] })
  }
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error, query) => onError(error, query.queryKey) }),
  mutationCache: new MutationCache({
    // A rejected login is a wrong token, not an expired session; the form shows the error.
    onError: (error, _vars, _ctx, mutation) => mutation.options.mutationKey?.[0] !== 'login' && onError(error),
  }),
  defaultOptions: {
    queries: {
      // Client errors (401, 404, 422...) won't fix themselves; only retry network/server failures.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 3,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
