import { useEffect } from "react"

type Props = {
  message: string
  type: "success" | "error"
  onClose: () => void
}

function Toast({ message, type, onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [message, onClose])

  const styles = type === "success"
    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
    : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-4 rounded-xl border px-4 py-3 text-sm shadow-lg ${styles}`}>
      <span>{message}</span>
      <button onClick={onClose} className="shrink-0 font-bold hover:opacity-70">✕</button>
    </div>
  )
}

export default Toast
