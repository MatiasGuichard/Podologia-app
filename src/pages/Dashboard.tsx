import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Users, ClipboardList, CalendarDays, CalendarCheck2, DollarSign, Loader2, Play } from "lucide-react"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog"
import { supabase } from "../lib/supabase"
import { parseMontoPositivo, parseMonto } from "../lib/montoUtils"
import { calcularEstadoCobro } from "../lib/cobroUtils"
import { loadSettings } from "../lib/settings"
import { fmt } from "../lib/currencyUtils"
import type { Appointment, Cobro } from "../types"
import { formatDate, todayStr } from "../lib/dateUtils"
import ErrorBanner from "../components/ErrorBanner"
import ConsultationDialog from "../components/ConsultationDialog"
import ConfirmDialog from "../components/ConfirmDialog"
import PagoAdicionalDialog from "../components/PagoAdicionalDialog"
import { completarTurnoSiCorresponde, finalizarTurnoSinCompletar } from "../lib/turnoCompletion"

async function fetchDashboardStats() {
  const today = todayStr()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

  const [patientsRes, todayRes, inAttentionRes, nextRes, completedMonthRes] =
    await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
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
        .gte("appointment_date", monthStart)
        .lte("appointment_date", monthEnd)
        .eq("status", "Completado")
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false }),
    ])

  if (patientsRes.error || todayRes.error || inAttentionRes.error || nextRes.error || completedMonthRes.error) {
    throw new Error("No se pudieron cargar las estadísticas.")
  }

  const inAttentionNow = (inAttentionRes.data?.[0] ?? null) as Appointment | null

  const [inAttentionRecordRes, inAttentionCobroRes] = inAttentionNow
    ? await Promise.all([
        supabase.from("medical_records").select("id").eq("turno_id", inAttentionNow.id).limit(1),
        supabase.from("cobros").select("*, patients(first_name, last_name)").eq("turno_id", inAttentionNow.id).limit(1),
      ])
    : [null, null]

  const completedMonth = (completedMonthRes.data ?? []) as Appointment[]
  const completedMonthIds = completedMonth.map(a => a.id)

  const cobrosMonthRes = completedMonthIds.length > 0
    ? await supabase.from("cobros").select("*, patients(first_name, last_name)").in("turno_id", completedMonthIds)
    : null

  return {
    patientsCount:        patientsRes.count ?? 0,
    todayCount:           todayRes.count ?? 0,
    inAttentionNow,
    inAttentionHasRecord: (inAttentionRecordRes?.data?.length ?? 0) > 0,
    inAttentionCobro:     (inAttentionCobroRes?.data?.[0] ?? null) as Cobro | null,
    nextConfirmed:        (nextRes.data?.[0] ?? null) as Appointment | null,
    completedMonth,
    cobrosMonth:          (cobrosMonthRes?.error ? [] : cobrosMonthRes?.data ?? []) as Cobro[],
  }
}

function Dashboard() {
  const queryClient = useQueryClient()

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["dashboard", todayStr()],
    queryFn: fetchDashboardStats,
    staleTime: 0,
  })

  const patientsCount        = stats?.patientsCount        ?? 0
  const todayCount           = stats?.todayCount           ?? 0
  const inAttentionNow       = stats?.inAttentionNow       ?? null
  const inAttentionHasRecord = stats?.inAttentionHasRecord ?? false
  const inAttentionCobro     = stats?.inAttentionCobro     ?? null
  const nextConfirmed        = stats?.nextConfirmed        ?? null
  const completedMonth       = stats?.completedMonth       ?? []
  const cobrosMonth          = stats?.cobrosMonth          ?? []

  const [elapsedMin, setElapsedMin] = useState(0)
  const [actionError, setActionError] = useState("")

  // Consultation dialog
  const [consultingAppointment, setConsultingAppointment] = useState<Appointment | null>(null)
  const [isStartingApt, setIsStartingApt] = useState(false)

  // Cobro modal
  const [cobroAppointment, setCobroAppointment] = useState<Appointment | null>(null)
  const [cobroMontoTotal, setCobroMontoTotal] = useState("")
  const [cobroMontoEntregado, setCobroMontoEntregado] = useState("")
  const [cobroMetodo, setCobroMetodo] = useState("Efectivo")
  const [cobroDescripcion, setCobroDescripcion] = useState("")
  const [cobroError, setCobroError] = useState("")
  const [isSubmittingCobro, setIsSubmittingCobro] = useState(false)

  // Pago adicional (cobro parcial del turno en atención)
  const [pagoAdicionalCobro, setPagoAdicionalCobro] = useState<Cobro | null>(null)

  // Finalizar sin completar
  const [finalizingTurno, setFinalizingTurno] = useState<Appointment | null>(null)
  const [isFinalizing, setIsFinalizing] = useState(false)

  // Completados del mes
  const [completadosMesOpen, setCompletadosMesOpen] = useState(false)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cobros" }, invalidate)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Elapsed time for "En atención"
  useEffect(() => {
    if (!inAttentionNow) { setElapsedMin(0); return }
    const today = todayStr()
    const start = new Date(today + "T" + inAttentionNow.appointment_time).getTime()
    const calc = () => Math.max(0, Math.floor((Date.now() - start) / 60_000))
    setElapsedMin(calc())
    const id = setInterval(() => setElapsedMin(calc()), 30_000)
    return () => clearInterval(id)
  }, [inAttentionNow])

  function openCobroModal(apt: Appointment) {
    const fecha = new Date(apt.appointment_date + "T12:00:00")
      .toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
    const defaultPrice = loadSettings().consultationPrice
    setCobroAppointment(apt)
    setCobroMontoTotal(defaultPrice)
    setCobroMontoEntregado(defaultPrice)
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
    const today = todayStr()

    const { data: existingCobro, error: existingError } = await supabase
      .from("cobros")
      .select("id")
      .eq("turno_id", cobroAppointment.id)
      .limit(1)

    if (existingError) console.error("[cobros] Error al verificar cobro existente:", existingError)

    if (existingCobro && existingCobro.length > 0) {
      setCobroError("Este turno ya tiene un cobro registrado. Usá el botón de Pago Adicional para registrar otro pago.")
      setIsSubmittingCobro(false)
      return
    }

    const estado = calcularEstadoCobro(totalNum, entregadoNum)

    const { error: insertError } = await supabase.from("cobros").insert({
      paciente_id: cobroAppointment.patient_id,
      turno_id: cobroAppointment.id,
      monto: entregadoNum,
      monto_total: totalNum,
      monto_entregado: entregadoNum,
      fecha: today,
      estado,
      descripcion: cobroDescripcion || null,
      metodo_pago: cobroMetodo,
    })

    if (insertError) {
      setIsSubmittingCobro(false)
      setCobroError(
        insertError.code === "42P01"
          ? "La tabla de cobros no existe. Ejecutá la migración SQL primero."
          : "No se pudo registrar el cobro."
      )
      return
    }

    await completarTurnoSiCorresponde(cobroAppointment.id)
    setIsSubmittingCobro(false)
    setCobroAppointment(null)
    invalidate()
  }

  async function confirmFinalizarSinCompletar() {
    if (!finalizingTurno) return
    setIsFinalizing(true)
    const { error } = await finalizarTurnoSinCompletar(finalizingTurno.id)
    setIsFinalizing(false)
    if (error) { setActionError("No se pudo finalizar el turno."); return }
    setFinalizingTurno(null)
    invalidate()
  }

  async function iniciarTurno(apt: Appointment) {
    setIsStartingApt(true)
    const { error } = await supabase.from("appointments").update({ status: "En atención" }).eq("id", apt.id)
    setIsStartingApt(false)
    if (error) {
      setActionError("No se pudo iniciar el turno. Verificá tu conexión.")
    } else {
      invalidate()
    }
  }

  const today = todayStr()

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"
  })()
  const todayLabel = new Date()
    .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase())

  const errorMessage = isError
    ? "No se pudieron cargar las estadísticas. Verificá tu conexión."
    : actionError

  return (
    <div className="max-w-6xl mx-auto">

      <ConsultationDialog
        appointment={consultingAppointment}
        onClose={() => setConsultingAppointment(null)}
        onSaved={invalidate}
      />

      <PagoAdicionalDialog
        cobro={pagoAdicionalCobro}
        onClose={() => setPagoAdicionalCobro(null)}
        onSaved={async () => {
          if (pagoAdicionalCobro?.turno_id) await completarTurnoSiCorresponde(pagoAdicionalCobro.turno_id)
          invalidate()
        }}
      />

      <ConfirmDialog
        open={finalizingTurno !== null}
        title="¿Finalizar turno sin completar?"
        description="El turno pasará a Completado aunque falte la ficha clínica o el cobro. Podés cargarlos después desde el turno."
        confirmLabel="Finalizar"
        loading={isFinalizing}
        onConfirm={confirmFinalizarSinCompletar}
        onCancel={() => setFinalizingTurno(null)}
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
                  {saldo <= 0 ? "Pagado completo" : `Pago parcial — queda ${fmt(saldo)} pendiente`}
                </div>
              )
            })()}

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
        <h1 className="text-2xl sm:text-4xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-2">{greeting} — {todayLabel}</p>
      </div>

      <ErrorBanner message={errorMessage} onClose={() => setActionError("")} />

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
              : <h2 className="text-3xl sm:text-4xl font-bold mt-4">{patientsCount}</h2>
            }
          </Card>
        </Link>

        <button type="button" onClick={() => setCompletadosMesOpen(true)} className="block text-left">
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <p className="text-gray-500">Completados este mes</p>
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-zinc-800 flex items-center justify-center">
                <CalendarCheck2 className="h-5 w-5 text-teal-500 dark:text-teal-400" />
              </div>
            </div>
            {isLoading
              ? <div className="h-10 w-16 mt-4 rounded-lg bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              : <h2 className="text-3xl sm:text-4xl font-bold mt-4">{completedMonth.length}</h2>
            }
          </Card>
        </button>

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
              : <h2 className="text-3xl sm:text-4xl font-bold mt-4">{todayCount}</h2>
            }
          </Card>
        </Link>

      </div>

      {/* En atención ahora */}
      {!isLoading && inAttentionNow && (
        <div className="mb-4 rounded-xl border-2 border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
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
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              {!inAttentionHasRecord && (
                <button
                  onClick={() => setConsultingAppointment(inAttentionNow)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  <span>Completar ficha</span>
                </button>
              )}
              {inAttentionCobro?.estado !== "cobrado" && (
                <button
                  onClick={() => inAttentionCobro
                    ? setPagoAdicionalCobro(inAttentionCobro)
                    : openCobroModal(inAttentionNow)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                >
                  <DollarSign className="h-4 w-4 shrink-0" />
                  <span>{inAttentionCobro ? "Registrar pago" : "Cobrar"}</span>
                </button>
              )}
            </div>
            <button
              onClick={() => setFinalizingTurno(inAttentionNow)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 underline underline-offset-2 transition-colors"
            >
              Finalizar sin completar
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="flex items-center gap-2 sm:shrink-0">
              {nextConfirmed.appointment_date === today && (
                <button
                  onClick={() => iniciarTurno(nextConfirmed)}
                  disabled={isStartingApt}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-60"
                >
                  {isStartingApt
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Play className="h-4 w-4 shrink-0" />
                  }
                  <span>Iniciar</span>
                </button>
              )}
              <Link
                to="/appointments"
                className="shrink-0 text-sm text-gray-500 hover:text-black dark:hover:text-white underline transition"
              >
                Ver todos
              </Link>
            </div>
          </div>
        )}
      </Card>

      {/* Turnos completados este mes */}
      <Dialog open={completadosMesOpen} onOpenChange={setCompletadosMesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Turnos completados este mes</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 mt-2 max-h-[60vh] overflow-y-auto pr-1">
            {completedMonth.length === 0 && (
              <p className="text-gray-400 text-sm">Todavía no hay turnos completados este mes.</p>
            )}
            {completedMonth.map((apt) => {
              const cobro = cobrosMonth.find(c => c.turno_id === apt.id) ?? null
              const estadoCobro = cobro?.estado ?? null
              return (
                <div key={apt.id} className="flex items-center gap-3 py-2 border-b last:border-b-0 dark:border-zinc-800">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 select-none">
                    {`${apt.patients?.first_name?.charAt(0) ?? ""}${apt.patients?.last_name?.charAt(0) ?? ""}`.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/patients/${apt.patient_id}`}
                      className="text-sm font-semibold hover:underline underline-offset-2 truncate block"
                      onClick={() => setCompletadosMesOpen(false)}
                    >
                      {apt.patients?.first_name} {apt.patients?.last_name}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                      {formatDate(apt.appointment_date)} — {apt.appointment_time.slice(0, 5)}
                    </p>
                  </div>
                  {estadoCobro === "cobrado" && (
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                      Cobrado
                    </span>
                  )}
                  {estadoCobro === "parcial" && (
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                      Pago parcial
                    </span>
                  )}
                  {(estadoCobro === null || estadoCobro === "pendiente") && (
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                      Sin cobrar
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default Dashboard
