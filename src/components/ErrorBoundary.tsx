import { Component, type ReactNode } from "react"

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-4 text-center">
          <p className="text-5xl select-none">⚠️</p>
          <h1 className="text-xl font-semibold">Algo salió mal</h1>
          <p className="text-sm text-gray-500 max-w-sm">
            Ocurrió un error inesperado. Por favor, recargá la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Recargar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
