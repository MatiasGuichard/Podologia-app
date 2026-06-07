import { Link } from "react-router-dom"
import { Button } from "../components/ui/button"
import { SearchX } from "lucide-react"

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
        <SearchX className="h-8 w-8 text-gray-400 dark:text-zinc-500" />
      </div>
      <div>
        <h1 className="text-6xl font-bold text-gray-200 dark:text-zinc-700">404</h1>
        <p className="text-xl font-semibold mt-2">Página no encontrada</p>
        <p className="text-gray-500 mt-1 text-sm">La URL que ingresaste no existe.</p>
      </div>
      <Link to="/">
        <Button variant="outline">Volver al Dashboard</Button>
      </Link>
    </div>
  )
}

export default NotFound
