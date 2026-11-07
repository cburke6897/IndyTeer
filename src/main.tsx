import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './application/ErrorBoundary'
const root = createRoot(document.getElementById('root')!)
// Must match src/lib/supabase.ts, which requires exactly these two variables.
const configured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!configured) {
  root.render(
    <main className="mx-auto max-w-2xl space-y-5 p-12">
      <h1 className="text-3xl">Welcome to IndyTeer</h1>
      <p>Connect your Supabase project to start the app.</p>
      <p>
        Copy .env.example to .env.local, set the project URL and publishable key, and restart the
        development server. See README.md for database setup.
      </p>
    </main>,
  )
} else {
  void import('./App.tsx')
    .then(({ default: App }) =>
      root.render(
        <StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </StrictMode>,
      ),
    )
    .catch(() => {
      root.render(
        <main className="mx-auto max-w-2xl space-y-5 p-12">
          <h1 className="text-3xl">IndyTeer could not start</h1>
          <p>Check your project configuration, then reload the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-gold px-5 py-3 font-semibold"
          >
            Reload
          </button>
        </main>,
      )
    })
}
