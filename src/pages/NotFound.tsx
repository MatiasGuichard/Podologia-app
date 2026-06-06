import { Link } from "react-router-dom"

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-8xl font-bold text-gray-200 dark:text-zinc-700">404</h1>
      <p className="text-xl font-semibold mt-4">Página no encontrada</p>
      <p className="text-gray-500 mt-2">La URL que ingresaste no existe.</p>
      <Link
        to="/"
        className="mt-6 text-sm underline text-gray-500 hover:text-black dark:hover:text-white transition"
      >
        Volver al Dashboard
      </Link>
    </div>
  )
}

export default NotFound
