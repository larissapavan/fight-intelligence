import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-3 py-8">
          <div className="surface-card w-full max-w-md rounded-[20px] p-5 text-center">
            <div className="mx-auto inline-flex rounded-xl bg-[#E81B23]/10 p-3 text-[#FF6B6B]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-3 text-2xl font-bold uppercase tracking-[0.03em] text-[#FFFFFF]">Something went wrong</h1>
            <p className="mt-2 text-sm leading-6 text-[#999999]">
              An unexpected error interrupted this page. Reloading usually fixes it.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="primary-action mx-auto mt-4 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
