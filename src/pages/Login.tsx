import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Button } from "../components/ui/button"
import { Activity } from "lucide-react"

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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-zinc-950">

      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-8 w-full max-w-sm shadow-sm">

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

          <input
            type="email"
            placeholder="Email"
            aria-label="Email"
            className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Contraseña"
            aria-label="Contraseña"
            className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />

          {error && (
            <p className="text-red-500 text-sm">
              {error}
            </p>
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
