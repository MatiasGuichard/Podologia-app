import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Button } from "../components/ui/button"
import { Activity, AlertCircle } from "lucide-react"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true })
    })
  }, [navigate])

  async function handleLogin() {
    setError("")
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError("Email o contraseña incorrectos")
      return
    }

    navigate("/")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-white to-gray-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">

      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-8 w-full max-w-sm shadow-xl shadow-gray-200/60 dark:shadow-none">

        <div className="flex items-center gap-3 mb-8">

          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
            <Activity size={20} />
          </div>

          <div>
            <h1 className="text-xl font-bold dark:text-white">
              Podología
            </h1>
            <p className="text-sm text-gray-500">
              Sistema Clínico
            </p>
          </div>

        </div>

        <div className="flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium dark:text-white">Email</label>
            <input
              type="email"
              placeholder="tu@email.com"
              aria-label="Email"
              autoFocus
              className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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
              className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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

        </div>

      </div>

    </div>
  )
}

export default Login
