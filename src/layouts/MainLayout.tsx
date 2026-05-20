import {
  Link,
  Outlet,
  useLocation,
} from "react-router-dom"

import {
  LayoutDashboard,
  Users,
  Activity,
  Moon,
  Sun,
  CalendarDays,
} from "lucide-react"

import { useEffect, useState } from "react"

function MainLayout() {

  const location = useLocation()

  const [dark, setDark] = useState(false)

  useEffect(() => {

    const saved =
      localStorage.getItem("dark-mode")

    if (saved === "true") {
      setDark(true)
      document.documentElement.classList.add("dark")
    }

  }, [])

  function toggleDarkMode() {

    const newValue = !dark

    setDark(newValue)

    localStorage.setItem(
      "dark-mode",
      String(newValue)
    )

    if (newValue) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  const menu = [
    {
      label: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
    },
    {
      label: "Pacientes",
      path: "/patients",
      icon: Users,
    },

    {
      label: "Turnos",
      path: "/appointments",
      icon: CalendarDays,
    },

  ]

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-zinc-950 transition-colors">

      <aside className="w-72 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800 p-6 flex flex-col transition-colors">

        <div className="mb-10 flex items-center justify-between">

          <div className="flex items-center gap-3">

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

          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
          >

            {dark
              ? <Sun size={18} className="text-white" />
              : <Moon size={18} />
            }

          </button>

        </div>

        <nav className="flex flex-col gap-2">

          {menu.map((item) => {

            const Icon = item.icon

            const active =
              location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3
                  p-3 rounded-xl transition
                  ${
                    active
                      ? "bg-black text-white"
                      : "hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-white"
                  }
                `}
              >

                <Icon size={20} />

                <span className="font-medium">
                  {item.label}
                </span>

              </Link>
            )
          })}

        </nav>

        <div className="mt-auto">

          <CardUser />

        </div>

      </aside>

      <main className="flex-1 p-8 text-black dark:text-white transition-colors">

        <Outlet />

      </main>

    </div>
  )
}

function CardUser() {

  return (
    <div className="border dark:border-zinc-800 rounded-2xl p-4 bg-white dark:bg-zinc-900 transition-colors">

      <p className="font-semibold dark:text-white">
        Matías
      </p>

      <p className="text-sm text-gray-500">
        Podólogo
      </p>

    </div>
  )
}

export default MainLayout