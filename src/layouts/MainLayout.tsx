import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom"
import { Suspense } from "react"

import {
  LayoutDashboard,
  Users,
  Activity,
  Moon,
  Sun,
  CalendarDays,
  LogOut,
  Loader2,
  Menu,
  X,
  BarChart2,
  Download,
  SlidersHorizontal,
  Wallet,
} from "lucide-react"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { loadSettings } from "../lib/settings"

function MainLayout() {

  const location = useLocation()
  const [dark, setDark] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [clinicName, setClinicName] = useState(() => loadSettings().clinicName)
  const [doctorName, setDoctorName] = useState(() => loadSettings().doctorName)

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from("profiles")
        .select("clinic_name, doctor_name")
        .eq("id", session.user.id)
        .single()
      if (!data) return
      setClinicName(data.clinic_name)
      setDoctorName(data.doctor_name)
    }
    loadProfile()
  }, [])

  useEffect(() => {
    function onSettingsUpdate() {
      const s = loadSettings()
      setClinicName(s.clinicName)
      setDoctorName(s.doctorName)
    }
    window.addEventListener("clinic-settings-updated", onSettingsUpdate)
    return () => window.removeEventListener("clinic-settings-updated", onSettingsUpdate)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem("dark-mode")
    if (saved === "true") {
      setDark(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  function toggleDarkMode() {
    const newValue = !dark
    setDark(newValue)
    localStorage.setItem("dark-mode", String(newValue))
    if (newValue) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  const menu = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Pacientes", path: "/patients", icon: Users },
    { label: "Turnos", path: "/appointments", icon: CalendarDays },
  ]

  const secondaryMenu = [
    { label: "Estadísticas",  path: "/statistics",  icon: BarChart2 },
    { label: "Financieras",   path: "/financieras",  icon: Wallet },
    { label: "Exportar",      path: "/export",       icon: Download },
    { label: "Configuración", path: "/settings",     icon: SlidersHorizontal },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-background transition-colors">

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-60 max-w-[85vw]
          bg-white dark:bg-zinc-900 border-r dark:border-zinc-800
          p-6 flex flex-col transition-colors
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:z-auto
        `}
      >

        <div className="mb-10 flex items-center justify-between">

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
              <Activity size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold dark:text-white">{clinicName}</h1>
              <p className="text-sm text-gray-500">Sistema Clínico</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              {dark
                ? <Sun size={18} className="text-white" />
                : <Moon size={18} />
              }
            </button>

            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              <X size={18} className="dark:text-white" />
            </button>
          </div>

        </div>

        <nav className="flex flex-col gap-1">
          {menu.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 p-3 rounded-xl transition
                  ${active
                    ? "bg-black text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white"
                  }
                `}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}

          <div className="h-px bg-gray-100 dark:bg-zinc-800 my-2" />

          {secondaryMenu.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 p-3 rounded-xl transition
                  ${active
                    ? "bg-black text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white"
                  }
                `}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto">
          <CardUser doctorName={doctorName} />
        </div>

      </aside>

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden text-black dark:text-white transition-colors">

        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
          >
            <Menu size={20} className="dark:text-white" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-xl bg-black text-white flex items-center justify-center">
              <Activity size={14} />
            </div>
            <span className="font-bold dark:text-white">{clinicName}</span>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            aria-label="Cambiar tema"
          >
            {dark
              ? <Sun size={18} className="text-white" />
              : <Moon size={18} className="text-gray-500" />
            }
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <Suspense fallback={
            <div className="flex h-full items-center justify-center py-24">
              <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100 animate-spin" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>

      </main>

    </div>
  )
}

function CardUser({ doctorName }: { doctorName: string }) {

  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? "")
    })
  }, [])

  async function handleLogout() {
    setIsLoggingOut(true)
    await supabase.auth.signOut()
    navigate("/login")
  }

  return (
    <div>
      <div className="h-px bg-gray-100 dark:bg-zinc-800 mb-4" />
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300 select-none">
          {email.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium dark:text-white truncate">{email}</p>
          <p className="text-xs text-gray-400">{doctorName || "Podólogo"}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Cerrar sesión"
        >
          {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
        </button>
      </div>
    </div>
  )
}

export default MainLayout
