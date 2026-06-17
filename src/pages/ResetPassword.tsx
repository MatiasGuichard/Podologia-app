import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Button } from "../components/ui/button"
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react"

function ResetPassword() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    setError("")
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return }
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError("No se pudo actualizar la contraseña. Intentá de nuevo."); return }
    setDone(true)
    setTimeout(() => navigate("/login", { replace: true }), 2500)
  }

  const inputClass = "border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-white to-gray-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-slate-900">
      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-8 w-full max-w-sm shadow-xl shadow-gray-200/60 dark:shadow-none">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold dark:text-white">Podología</h1>
            <p className="text-sm text-gray-500">Nueva contraseña</p>
          </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="font-medium dark:text-white">¡Contraseña actualizada!</p>
            <p className="text-sm text-gray-500">Redirigiendo al inicio de sesión...</p>
          </div>
        ) : !ready ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="h-8 w-8 rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100 animate-spin" />
            <p className="text-sm text-gray-500">Verificando enlace...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium dark:text-white">Nueva contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                autoFocus
                className={inputClass}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError("") }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium dark:text-white">Confirmar contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                className={inputClass}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); if (error) setError("") }}
                onKeyDown={(e) => e.key === "Enter" && handleReset()}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button onClick={handleReset} disabled={loading}>
              {loading ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </div>
        )}

      </div>
    </div>
  )
}

export default ResetPassword
