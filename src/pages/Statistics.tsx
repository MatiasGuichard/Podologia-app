import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { Card } from "../components/ui/card"
import { Users, CalendarDays, ClipboardList, TrendingUp } from "lucide-react"
import { formatDate } from "../lib/dateUtils"
import ErrorBanner from "../components/ErrorBanner"
import { usePatients } from "../hooks/usePatients"
import { useAppointments } from "../hooks/useAppointments"

function Statistics() {
  const { data: patients = [], isLoading: loadingPatients, isError: patientsError } = usePatients()
  const { data: appointments = [], isLoading: loadingAppointments, isError: appointmentsError } = useAppointments()
  const [recordsCount, setRecordsCount] = useState(0)
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [recordsError, setRecordsError] = useState(false)

  const isLoading = loadingPatients || loadingAppointments || loadingRecords
  const hasError = patientsError || appointmentsError || recordsError

  useEffect(() => {
    async function loadRecords() {
      setLoadingRecords(true)
      setRecordsError(false)
      const { count, error } = await supabase
        .from("medical_records")
        .select("*", { count: "exact", head: true })
      setLoadingRecords(false)
      if (error) { setRecordsError(true); return }
      setRecordsCount(count || 0)
    }
    loadRecords()
  }, [])

  const today = useMemo(() => new Date().toISOString().split("T")[0], [])
  const thisMonth = useMemo(() => today.substring(0, 7), [today])

  const statusCount = useMemo(() =>
    appointments.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1
      return acc
    }, {}),
    [appointments]
  )

  const statusItems = useMemo(() => [
    { label: "Pendiente",  count: statusCount["Pendiente"]  || 0, color: "bg-yellow-400" },
    { label: "Confirmado", count: statusCount["Confirmado"] || 0, color: "bg-blue-400" },
    { label: "Completado", count: statusCount["Completado"] || 0, color: "bg-emerald-400" },
    { label: "Cancelado",  count: statusCount["Cancelado"]  || 0, color: "bg-red-400" },
  ], [statusCount])

  const last6Months = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    return {
      key: d.toISOString().substring(0, 7),
      label: d.toLocaleDateString("es-AR", { month: "short" }),
    }
  }), [])

  const aptsByMonth = useMemo(() => last6Months.map(({ key, label }) => ({
    label,
    count: appointments.filter(a => a.appointment_date.startsWith(key)).length,
  })), [last6Months, appointments])

  const maxBarHeight = 80
  const maxApts = useMemo(() => Math.max(...aptsByMonth.map(m => m.count), 1), [aptsByMonth])

  const topDiseases = useMemo(() => {
    const diseaseCount: Record<string, number> = {}
    patients.forEach(p => {
      if (p.diseases) {
        p.diseases.split(", ").filter(Boolean).forEach(d => {
          diseaseCount[d] = (diseaseCount[d] || 0) + 1
        })
      }
    })
    return Object.entries(diseaseCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [patients])

  const maxDisease = useMemo(() => Math.max(...topDiseases.map(d => d[1]), 1), [topDiseases])

  const completedThisMonth = useMemo(() =>
    appointments.filter(
      a => a.status === "Completado" && a.appointment_date.startsWith(thisMonth)
    ).length,
    [appointments, thisMonth]
  )

  const nextApt = useMemo(() =>
    appointments
      .filter(a => a.appointment_date >= today && a.status !== "Cancelado")
      .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.appointment_time.localeCompare(b.appointment_time))[0],
    [appointments, today]
  )

  if (isLoading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Estadísticas</h1>
          <p className="text-gray-500 mt-2">Cargando...</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Estadísticas</h1>
        <p className="text-gray-500 mt-2">Resumen del consultorio</p>
      </div>

      {hasError && (
        <ErrorBanner
          message="No se pudieron cargar algunos datos. Verificá tu conexión."
          onClose={() => setRecordsError(false)}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-zinc-800 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-500">Pacientes</span>
          </div>
          <p className="text-3xl font-bold">{patients.length}</p>
        </Card>

        <Card className="p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-zinc-800 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <span className="text-sm text-gray-500">Turnos</span>
          </div>
          <p className="text-3xl font-bold">{appointments.length}</p>
        </Card>

        <Card className="p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-zinc-800 flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <span className="text-sm text-gray-500">Consultas</span>
          </div>
          <p className="text-3xl font-bold">{recordsCount}</p>
        </Card>

        <Card className="p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-zinc-800 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-orange-500 dark:text-orange-400" />
            </div>
            <span className="text-sm text-gray-500">Completados este mes</span>
          </div>
          <p className="text-3xl font-bold">{completedThisMonth}</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="font-semibold mb-6">Turnos por mes</h2>
          <div
            className="flex items-end gap-1 px-1 border-b border-gray-100 dark:border-zinc-800"
            style={{ height: `${maxBarHeight + 24}px` }}
          >
            {aptsByMonth.map(({ label, count }) => {
              const barPx = count > 0 ? Math.max(Math.round((count / maxApts) * maxBarHeight), 6) : 2
              return (
                <div key={label} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                  {count > 0 && (
                    <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">{count}</span>
                  )}
                  <div
                    className="w-full rounded-t-md bg-zinc-800 dark:bg-zinc-300 transition-all"
                    style={{ height: `${barPx}px` }}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex gap-1 mt-2 px-1">
            {aptsByMonth.map(({ label }) => (
              <div key={label} className="flex-1 text-center">
                <span className="text-xs text-gray-400 capitalize">{label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="font-semibold mb-6">Turnos por estado</h2>
          {appointments.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos aún.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {statusItems.map(({ label, count, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${color}`} />
                      <span className="text-sm text-gray-600 dark:text-zinc-300">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{count}</span>
                      <span className="text-xs text-gray-400 w-9 text-right">
                        {appointments.length > 0 ? `${Math.round((count / appointments.length) * 100)}%` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all`}
                      style={{ width: `${(count / appointments.length) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="font-semibold mb-6">Enfermedades más frecuentes</h2>
          {topDiseases.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos aún.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {topDiseases.map(([disease, count]) => (
                <div key={disease}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-600 dark:text-zinc-300">{disease}</span>
                    <span className="text-sm font-medium">{count} pac.</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-500 dark:bg-zinc-400 transition-all"
                      style={{ width: `${(count / maxDisease) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="font-semibold mb-4">Próximo turno</h2>
          {nextApt ? (
            <div className="flex flex-col gap-1">
              <p className="text-xl font-semibold">
                {nextApt.patients?.first_name} {nextApt.patients?.last_name}
              </p>
              <p className="text-gray-500 capitalize">
                {formatDate(nextApt.appointment_date, { weekday: "long", day: "numeric", month: "long" })}
                {" — "}
                {nextApt.appointment_time}
              </p>
              {nextApt.notes && (
                <p className="text-sm text-gray-400 mt-1">{nextApt.notes}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No hay turnos próximos agendados.</p>
          )}
        </Card>

      </div>
    </div>
  )
}

export default Statistics
