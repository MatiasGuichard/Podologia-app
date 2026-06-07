import { useEffect } from "react"
import { CheckCircle2, XCircle } from "lucide-react"

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

  const isSuccess = type === "success"
  const styles = isSuccess
    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
    : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${styles}`}>
      {isSuccess
        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
        : <XCircle className="h-4 w-4 shrink-0" />
      }
      <span>{message}</span>
      <button onClick={onClose} className="shrink-0 ml-1 hover:opacity-70">✕</button>
    </div>
  )
}

export default Toast
