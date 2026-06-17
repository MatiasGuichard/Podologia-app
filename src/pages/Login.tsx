import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Button } from "../components/ui/button"
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true })
    })
  }, [navigate])

  async function handleLogin() {
    setError("")
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError("Email o contraseña incorrectos")
      return
    }

    navigate("/")
  }

  async function handleForgotPassword() {
    setError("")
    if (!email) { setError("Ingresá tu email primero"); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError("No se pudo enviar el email. Verificá la dirección."); return }
    setForgotSent(true)
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
            <p className="text-sm text-gray-500">
              {forgotMode ? "Recuperar contraseña" : "Sistema Clínico"}
            </p>
          </div>
        </div>

        {forgotSent ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="font-medium dark:text-white">Revisá tu email</p>
            <p className="text-sm text-gray-500">
              Te enviamos un enlace a <span className="font-medium">{email}</span> para restablecer tu contraseña.
            </p>
            <button
              onClick={() => { setForgotMode(false); setForgotSent(false) }}
              className="mt-2 text-sm text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : forgotMode ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              Ingresá tu email y te mandamos un enlace para restablecer tu contraseña.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium dark:text-white">Email</label>
              <input
                type="email"
                placeholder="tu@email.com"
                aria-label="Email"
                autoFocus
                className={inputClass}
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError("") }}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button onClick={handleForgotPassword} disabled={loading}>
              {loading ? "Enviando..." : "Enviar instrucciones"}
            </Button>
            <button
              onClick={() => { setForgotMode(false); setError("") }}
              className="text-sm text-center text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium dark:text-white">Email</label>
              <input
                type="email"
                placeholder="tu@email.com"
                aria-label="Email"
                autoFocus
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium dark:text-white">Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                aria-label="Contraseña"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button onClick={handleLogin} disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
            <button
              onClick={() => { setForgotMode(true); setError("") }}
              className="text-sm text-center text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        )}

      </div>

    </div>
  )
}

export default Login
