import { useState } from "react"

type ToastState = { message: string; type: "success" | "error" } | null

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null)

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type })
  }

  function clearToast() {
    setToast(null)
  }

  return { toast, showToast, clearToast }
}
