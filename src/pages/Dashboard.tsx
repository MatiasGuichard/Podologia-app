import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Users, ClipboardList, CalendarDays } from "lucide-react"
import { Card } from "../components/ui/card"
import { supabase } from "../lib/supabase"
import type { Appointment } from "../types"
import { formatDate } from "../lib/dateUtils"
import ErrorBanner from "../components/ErrorBanner"

function Dashboard() {
  const [patientsCount, setPatientsCount] = useState(0)
  const [recordsCount, setRecordsCount] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  async function getStats() {
    setIsLoading(true)
    setErrorMessage("")

    const today = new Date().toISOString().split("T")[0]

    const [patientsRes, recordsRes, todayRes, nextRes] = await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase.from("medical_records").select("*", { count: "exact", head: true }),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("appointment_date", today),
      supabase
        .from("appointments")
        .select("*, patients(first_name, last_name)")
        .gte("appointment_date", today)
        .neq("status", "Cancelado")
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(1),
    ])

    if (patientsRes.error || recordsRes.error || todayRes.error || nextRes.error) {
      setErrorMessage("No se pudieron cargar las estadísticas. Verificá tu conexión.")
      setIsLoading(false)
      return
    }

    setPatientsCount(patientsRes.count || 0)
    setRecordsCount(recordsRes.count || 0)
    setTodayCount(todayRes.count || 0)
    setNextAppointment(nextRes.data?.[0] ?? null)
    setIsLoading(false)
  }

  useEffect(() => {
    getStats()
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"
  })()
  const todayLabel = new Date()
    .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase())

  return (
    <div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-2">{greeting} — {todayLabel}</p>
      </div>

      <ErrorBanner message={errorMessage} onClose={() => setErrorMessage("")} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        <Link to="/patients" className="block">
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <p className="text-gray-500">Pacientes</p>
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            {isLoading
              ? <div className="h-10 w-16 mt-4 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              : <h2 className="text-4xl font-bold mt-4">{patientsCount}</h2>
            }
          </Card>
        </Link>

        <Link to="/patients" className="block">
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <p className="text-gray-500">Consultas</p>
              <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-violet-500" />
              </div>
            </div>
            {isLoading
              ? <div className="h-10 w-16 mt-4 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              : <h2 className="text-4xl font-bold mt-4">{recordsCount}</h2>
            }
          </Card>
        </Link>

        <Link to="/appointments" className="block">
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <p className="text-gray-500">Turnos hoy</p>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            {isLoading
              ? <div className="h-10 w-16 mt-4 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              : <h2 className="text-4xl font-bold mt-4">{todayCount}</h2>
            }
          </Card>
        </Link>

      </div>

      <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-4">Próximo turno</p>

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              <div className="h-3 w-3/5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
            </div>
          </div>
        )}

        {!isLoading && !nextAppointment && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">No hay turnos próximos agendados.</p>
            <Link
              to="/appointments"
              className="shrink-0 text-sm font-medium border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Agendar turno
            </Link>
          </div>
        )}

        {!isLoading && nextAppointment && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-gray-500 dark:text-gray-400 select-none">
                {`${nextAppointment.patients?.first_name?.charAt(0) ?? ""}${nextAppointment.patients?.last_name?.charAt(0) ?? ""}`.toUpperCase()}
              </div>
              <div className="min-w-0">
                <Link to={`/patients/${nextAppointment.patient_id}`} className="font-semibold text-base hover:underline underline-offset-2 block truncate">
                  {nextAppointment.patients?.first_name} {nextAppointment.patients?.last_name}
                </Link>
                <p className="text-gray-500 text-sm mt-0.5">
                  {formatDate(nextAppointment.appointment_date, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {" — "}
                  {nextAppointment.appointment_time}
                </p>
              </div>
            </div>
            <Link
              to="/appointments"
              className="shrink-0 text-sm text-gray-500 hover:text-black dark:hover:text-white underline transition"
            >
              Ver todos
            </Link>
          </div>
        )}
      </Card>

    </div>
  )
}

export default Dashboard
