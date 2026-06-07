type Props = {
  message: string
  onClose: () => void
}

function ErrorBanner({ message, onClose }: Props) {
  if (!message) return null
  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
      <span>{message}</span>
      <button onClick={onClose} className="shrink-0 font-bold hover:opacity-70">✕</button>
    </div>
  )
}

export default ErrorBanner
