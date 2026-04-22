import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-lg rounded-lg border bg-card p-6 text-card-foreground shadow">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Terjadi kesalahan</h2>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Aplikasi menemui masalah tak terduga. Data Anda di cloud (Supabase) tetap aman.
            </p>
            <pre className="mt-3 max-h-48 overflow-auto rounded bg-muted p-3 text-xs">
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => location.reload()}>Muat Ulang</Button>
              <Button
                variant="outline"
                onClick={() =>
                  this.setState({ hasError: false, error: null })
                }
              >
                Coba Lagi
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
