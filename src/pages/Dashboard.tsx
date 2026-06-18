import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Users, ClipboardList, CalendarDays, DollarSign, Loader2 } from "lucide-react"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog"
import { supabase } from "../lib/supabase"
import { parseMontoPositivo, parseMonto } from "../lib/montoUtils"
import { fmt } from "../lib/currencyUtils"
import type { Appointment, Cobro } from "../types"
import { formatDate } from "../lib/dateUtils"
import ErrorBanner from "../components/ErrorBanner"
import ConsultationDialog from "../components/ConsultationDialog"
import PagoAdicionalDialog from "../components/PagoAdicionalDialog"

function Dashboard() {
  const [patientsCount, setPatientsCount] = useState(0)
  const [recordsCount, setRecordsCount] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [nextConfirmed, setNextConfirmed] = useState<Appointment | null>(null)
  const [inAttentionNow, setInAttentionNow] = useState<Appointment | null>(null)
  const [completedToday, setCompletedToday] = useState<Appointment[]>([])
  const [cobrosHoy, setCobrosHoy] = useState<Cobro[]>([])
  const [elapsedMin, setElapsedMin] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  // Consultation dialog
  const [consultingAppointment, setConsultingAppointment] = useState<Appointment | null>(null)

  // Cobro modal (crear nuevo cobro)
  const [cobroAppointment, setCobroAppointment] = useState<Appointment | null>(null)
  const [cobroMontoTotal, setCobroMontoTotal] = useState("")
  const [cobroMontoEntregado, setCobroMontoEntregado] = useState("")
  const [cobroMetodo, setCobroMetodo] = useState("Efectivo")
  const [cobroDescripcion, setCobroDescripcion] = useState("")
  const [cobroError, setCobroError] = useState("")
  const [isSubmittingCobro, setIsSubmittingCobro] = useState(false)

  // Pago adicional (sobre cobro existente)
  const [pagoAdicionalCobro, setPagoAdicionalCobro] = useState<Cobro | null>(null)

  async function getStats(silent = false) {
    if (!silent) setIsLoading(true)
    setErrorMessage("")

    const today = new Date().toISOString().split("T")[0]

    const [patientsRes, recordsRes, todayRes, inAttentionRes, nextRes, completedRes, cobrosRes] =
      await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("medical_records").select("*", { count: "exact", head: true }),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("appointment_date", today),
        supabase
          .from("appointments")
          .select("*, patients(first_name, last_name)")
          .eq("appointment_date", today)
          .eq("status", "En atención")
          .order("appointment_time", { ascending: true })
          .limit(1),
        supabase
          .from("appointments")
          .select("*, patients(first_name, last_name)")
          .gte("appointment_date", today)
          .eq("status", "Confirmado")
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true })
          .limit(1),
        supabase
          .from("appointments")
          .select("*, patients(first_name, last_name)")
          .eq("appointment_date", today)
          .eq("status", "Completado")
          .order("appointment_time", { ascending: true }),
        supabase
          .from("cobros")
          .select("*, patients(first_name, last_name)")
          .eq("fecha", today),
      ])

    if (patientsRes.error || recordsRes.error || todayRes.error || inAttentionRes.error || nextRes.error || completedRes.error) {
      setErrorMessage("No se pudieron cargar las estadísticas. Verificá tu conexión.")
      setIsLoading(false)
      return
    }

    setPatientsCount(patientsRes.count || 0)
    setRecordsCount(recordsRes.count || 0)
    setTodayCount(todayRes.count || 0)
    setInAttentionNow(inAttentionRes.data?.[0] ?? null)
    setNextConfirmed(nextRes.data?.[0] ?? null)
    setCompletedToday(completedRes.data ?? [])
    setCobrosHoy(cobrosRes.error ? [] : (cobrosRes.data as Cobro[] ?? []))
    setIsLoading(false)
  }

  useEffect(() => {
    getStats()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        getStats(true)
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cobros" }, () => {
        getStats(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!inAttentionNow) { setElapsedMin(0); return }
    const today = new Date().toISOString().split("T")[0]
    const start = new Date(today + "T" + inAttentionNow.appointment_time).getTime()
    const calc = () => Math.max(0, Math.floor((Date.now() - start) / 60_000))
    setElapsedMin(calc())
    const id = setInterval(() => setElapsedMin(calc()), 30_000)
    return () => clearInterval(id)
  }, [inAttentionNow])

  function openCobroModal(apt: Appointment) {
    const fecha = new Date(apt.appointment_date + "T12:00:00")
      .toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
    setCobroAppointment(apt)
    setCobroMontoTotal("")
    setCobroMontoEntregado("")
    setCobroMetodo("Efectivo")
    setCobroDescripcion(`Consulta · ${apt.patients?.first_name} ${apt.patients?.last_name} · ${fecha}`)
    setCobroError("")
  }

  async function confirmarCobro() {
    if (!cobroAppointment) return
    const totalNum = parseMontoPositivo(cobroMontoTotal)
    const entregadoNum = parseMonto(cobroMontoEntregado)

    if (totalNum === null) { setCobroError("Ingresá el monto total de la consulta"); return }
    if (entregadoNum === null) { setCobroError("Ingresá el monto entregado"); return }
    if (entregadoNum > totalNum) { setCobroError("El monto entregado no puede superar el total"); return }

    setIsSubmittingCobro(true)
    const today = new Date().toISOString().split("T")[0]
    const estado = entregadoNum >= totalNum ? "cobrado" : entregadoNum > 0 ? "parcial" : "pendiente"

    const [cobroRes, apptRes] = await Promise.all([
      supabase.from("cobros").insert({
        paciente_id: cobroAppointment.patient_id,
        monto: entregadoNum,
        monto_total: totalNum,
        monto_entregado: entregadoNum,
        fecha: today,
        estado,
        descripcion: cobroDescripcion || null,
        metodo_pago: cobroMetodo,
      }),
      supabase.from("appointments")
        .update({ status: "Completado" })
        .eq("id", cobroAppointment.id),
    ])

    setIsSubmittingCobro(false)

    if (cobroRes.error) {
      setCobroError(
        cobroRes.error.code === "42P01"
          ? "La tabla de cobros no existe. Ejecutá la migración SQL primero."
          : "No se pudo registrar el cobro."
      )
      return
    }
    if (apptRes.error) {
      setCobroError("Cobro registrado, pero no se pudo actualizar el turno.")
      return
    }

    setCobroAppointment(null)
    getStats(true)
  }

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"
  })()
  const todayLabel = new Date()
    .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase())

  return (
    <div className="max-w-6xl mx-auto">

      <ConsultationDialog
        appointment={consultingAppointment}
        onClose={() => setConsultingAppointment(null)}
        onSaved={() => getStats(true)}
      />

      <PagoAdicionalDialog
        cobro={pagoAdicionalCobro}
        onClose={() => setPagoAdicionalCobro(null)}
        onSaved={() => getStats(true)}
      />

      {/* Cobro modal */}
      <Dialog open={cobroAppointment !== null} onOpenChange={(v) => { if (!v) setCobroAppointment(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            {cobroAppointment && (
              <p className="text-sm text-gray-500 mt-1">
                {cobroAppointment.patients?.first_name} {cobroAppointment.patients?.last_name}
                {" · "}
                {formatDate(cobroAppointment.appointment_date)}
              </p>
            )}
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">

            {/* Monto total */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Monto total de la consulta <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">$</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  aria-label="Monto total de la consulta" autoFocus
                  className="border rounded-lg p-3 pl-7 w-full dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={cobroMontoTotal}
                  onChange={(e) => { setCobroMontoTotal(e.target.value); if (cobroError) setCobroError("") }}
                />
              </div>
            </div>

            {/* Monto entregado */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Monto entregado <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">$</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  aria-label="Monto entregado por el paciente"
                  className="border rounded-lg p-3 pl-7 w-full dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={cobroMontoEntregado}
                  onChange={(e) => { setCobroMontoEntregado(e.target.value); if (cobroError) setCobroError("") }}
                />
              </div>
              {cobroError && <p className="text-red-500 text-sm">{cobroError}</p>}
            </div>

            {/* Saldo pendiente calculado */}
            {cobroMontoTotal && cobroMontoEntregado && (() => {
              const total = parseMontoPositivo(cobroMontoTotal) ?? 0
              const entregado = parseMonto(cobroMontoEntregado) ?? 0
              const saldo = total - entregado
              if (total === 0) return null
              return (
                <div className={`rounded-lg p-3 text-sm font-medium border ${
                  saldo <= 0
                    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                    : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400"
                }`}>
                  {saldo <= 0
                    ? "Pagado completo"
                    : `Pago parcial — queda ${fmt(saldo)} pendiente`
                  }
                </div>
              )
            })()}

            {/* Método de pago */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Método de pago</label>
              <select
                aria-label="Método de pago"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={cobroMetodo}
                onChange={(e) => setCobroMetodo(e.target.value)}
              >
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
              </select>
            </div>

            {/* Descripción */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Descripción</label>
              <input
                type="text" aria-label="Descripción del cobro"
                className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                value={cobroDescripcion}
                onChange={(e) => setCobroDescripcion(e.target.value)}
              />
            </div>

            <div className="flex gap-3 mt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCobroAppointment(null)} disabled={isSubmittingCobro}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                onClick={confirmarCobro}
                disabled={isSubmittingCobro}
              >
                {isSubmittingCobro
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                  : "Confirmar cobro"
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-zinc-800 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500 dark:text-blue-400" />
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
              <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-zinc-800 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-violet-500 dark:text-violet-400" />
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
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-zinc-800 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              </div>
            </div>
            {isLoading
              ? <div className="h-10 w-16 mt-4 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              : <h2 className="text-4xl font-bold mt-4">{todayCount}</h2>
            }
          </Card>
        </Link>

      </div>

      {/* En atención ahora */}
      {!isLoading && inAttentionNow && (
        <div className="mb-4 rounded-xl border-2 border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 px-5 py-4 flex items-center gap-4">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">En atención ahora</p>
            <Link
              to={`/patients/${inAttentionNow.patient_id}`}
              className="font-bold text-base text-violet-900 dark:text-violet-100 hover:underline underline-offset-2 truncate block leading-tight mt-0.5"
            >
              {inAttentionNow.patients?.first_name} {inAttentionNow.patients?.last_name}
            </Link>
            <p className="text-sm text-violet-700 dark:text-violet-300 mt-0.5">
              {inAttentionNow.appointment_time.slice(0, 5)}
              {elapsedMin > 0 && <span className="ml-1 opacity-70">· hace {elapsedMin} min</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setConsultingAppointment(inAttentionNow)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span>Completar ficha</span>
            </button>
            <button
              onClick={() => openCobroModal(inAttentionNow)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
            >
              <DollarSign className="h-4 w-4 shrink-0" />
              <span>Cobrar</span>
            </button>
          </div>
        </div>
      )}

      {/* Próximo turno */}
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

        {!isLoading && !nextConfirmed && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">No hay turnos confirmados próximos.</p>
            <Link
              to="/appointments"
              className="shrink-0 text-sm font-medium border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Agendar turno
            </Link>
          </div>
        )}

        {!isLoading && nextConfirmed && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-gray-500 dark:text-gray-400 select-none">
                {`${nextConfirmed.patients?.first_name?.charAt(0) ?? ""}${nextConfirmed.patients?.last_name?.charAt(0) ?? ""}`.toUpperCase()}
              </div>
              <div className="min-w-0">
                <Link to={`/patients/${nextConfirmed.patient_id}`} className="font-semibold text-base hover:underline underline-offset-2 block truncate">
                  {nextConfirmed.patients?.first_name} {nextConfirmed.patients?.last_name}
                </Link>
                <p className="text-gray-500 text-sm mt-0.5">
                  {formatDate(nextConfirmed.appointment_date, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {" — "}
                  {nextConfirmed.appointment_time}
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

      {/* Turnos completados de hoy */}
      <Card className="p-6 mt-4 dark:bg-zinc-900 dark:border-zinc-800">
        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-4">
          Turnos completados de hoy
        </p>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-zinc-700 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-2/5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                  <div className="h-3 w-1/5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                </div>
                <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-zinc-700 animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && completedToday.length === 0 && (
          <p className="text-gray-400 text-sm">Aún no hay turnos completados hoy.</p>
        )}

        {!isLoading && completedToday.length > 0 && (
          <div className={`space-y-2 ${completedToday.length > 3 ? "max-h-[220px] overflow-y-auto pr-1" : ""}`}>
            {completedToday.map((apt) => {
              const cobro = apt.patient_id
                ? cobrosHoy.find(c => c.paciente_id === apt.patient_id) ?? null
                : null
              const estadoCobro = cobro?.estado ?? null
              return (
                <div key={apt.id} className="flex items-center gap-3 py-1">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 select-none">
                    {`${apt.patients?.first_name?.charAt(0) ?? ""}${apt.patients?.last_name?.charAt(0) ?? ""}`.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/patients/${apt.patient_id}`}
                      className="text-sm font-semibold hover:underline underline-offset-2 truncate block"
                    >
                      {apt.patients?.first_name} {apt.patients?.last_name}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                      {apt.appointment_time.slice(0, 5)}
                    </p>
                  </div>

                  {estadoCobro === "cobrado" && (
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                      Cobrado
                    </span>
                  )}

                  {estadoCobro === "parcial" && (
                    <>
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                        Pago parcial
                      </span>
                      <button
                        onClick={() => setPagoAdicionalCobro(cobro)}
                        className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white transition-colors"
                      >
                        Registrar pago
                      </button>
                    </>
                  )}

                  {(estadoCobro === null || estadoCobro === "pendiente") && (
                    <>
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                        Sin cobrar
                      </span>
                      {cobro ? (
                        <button
                          onClick={() => setPagoAdicionalCobro(cobro)}
                          className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white transition-colors"
                        >
                          Registrar pago
                        </button>
                      ) : (
                        <button
                          onClick={() => openCobroModal(apt)}
                          className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                        >
                          Cobrar
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

    </div>
  )
}

export default Dashboard
