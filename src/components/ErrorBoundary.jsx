import { Component } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-fin-bg flex items-center justify-center p-6">
          <div className="glass-panel p-8 max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-fin-down/15 flex items-center justify-center mx-auto">
              <AlertCircle size={24} className="text-fin-down" />
            </div>
            <h1 className="text-lg font-bold text-fin-text">
              Something went wrong
            </h1>
            <p className="text-sm text-fin-muted leading-relaxed">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-fin-muted/60 font-mono bg-fin-dark/60 rounded-lg p-3 break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <RefreshCw size={14} />
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
