import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <main className="mx-auto max-w-xl space-y-5 p-12">
          <h1 className="text-3xl">Something went wrong</h1>
          <p>Please reload IndyTeer to try again.</p>
          <button
            className="rounded-lg bg-gold px-5 py-3 font-semibold"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </main>
      )
    return this.props.children
  }
}
