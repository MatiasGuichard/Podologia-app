import { useEffect, useState } from "react"
import {
  Loader2, Trash2, Pencil, Wallet, TrendingDown, TrendingUp,
  ChevronLeft, ChevronRight, X, Receipt,
} from "lucide-react"
import { supabase } from "../lib/supabase"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog"
import Toast from "../components/Toast"
import ConfirmDialog from "../components/ConfirmDialog"
import ErrorBanner from "../components/ErrorBanner"
import PagoAdicionalDialog from "../components/PagoAdicionalDialog"
import { useToast } from "../hooks/useToast"
import type { Patient, Cobro, Gasto, Pago } from "../types"

const CATEGORIAS = ["insumos", "alquiler", "servicios", "otros"] as const

type HistorialItem =
  | { kind: "cobro"; data: Cobro }
  | { kind: "gasto"; data: Gasto }
  | { kind: "pago"; data: Pago; cobro: Cobro | null }

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n)
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

const inputClass = "border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 w-full"

// ── Main component ─────────────────────────────────────────────────────────────

function Financieras() {
  const [cobros, setCobros]     = useState<Cobro[]>([])
  const [gastos, setGastos]     = useState<Gasto[]>([])
  const [pagos, setPagos]       = useState<Pago[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const { toast, showToast, clearToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingItem, setDeletingItem] = useState<{ id: string; kind: "cobro" | "gasto" } | null>(null)

  const now = new Date()
  const thisMonth = monthKey(now)

  // Historial filters
  const [filterMonth, setFilterMonth]   = useState(thisMonth)
  const [filterType, setFilterType]     = useState<"todos" | "cobro" | "gasto" | "pago">("todos")
  const [filterEstado, setFilterEstado] = useState<"todos" | "cobrado" | "parcial" | "pendiente">("todos")

  // Pagos historial dialog (para ver los pagos de un cobro)
  const [histPagosCobro, setHistPagosCobro] = useState<Cobro | null>(null)

  // Pago adicional dialog
  const [pagoAdicionalCobro, setPagoAdicionalCobro] = useState<Cobro | null>(null)

  // Create cobro
  const [createCobroOpen, setCreateCobroOpen] = useState(false)
  const [cPacienteId, setCPacienteId]     = useState("")
  const [cMontoTotal, setCMontoTotal]     = useState("")
  const [cMontoEntregado, setCMontoEntregado] = useState("")
  const [cFecha, setCFecha]               = useState(() => now.toISOString().split("T")[0])
  const [cDescripcion, setCDescripcion]   = useState("")
  const [cMetodo, setCMetodo]             = useState("Efectivo")
  const [cErrors, setCErrors]             = useState<Record<string, string>>({})

  // Create gasto
  const [createGastoOpen, setCreateGastoOpen] = useState(false)
  const [gMonto, setGMonto]           = useState("")
  const [gFecha, setGFecha]           = useState(() => now.toISOString().split("T")[0])
  const [gCategoria, setGCategoria]   = useState<typeof CATEGORIAS[number]>("insumos")
  const [gDescripcion, setGDescripcion] = useState("")
  const [gErrors, setGErrors]           = useState<Record<string, string>>({})

  // Edit cobro
  const [editingCobro, setEditingCobro]     = useState<Cobro | null>(null)
  const [ecMontoTotal, setEcMontoTotal]     = useState("")
  const [ecMontoEntregado, setEcMontoEntregado] = useState("")
  const [ecFecha, setEcFecha]               = useState("")
  const [ecEstado, setEcEstado]             = useState<Cobro["estado"]>("cobrado")
  const [ecDescripcion, setEcDescripcion]   = useState("")
  const [ecPacienteId, setEcPacienteId]     = useState("")
  const [ecMetodo, setEcMetodo]             = useState("")

  // Edit gasto
  const [editingGasto, setEditingGasto] = useState<Gasto | null>(null)
  const [egMonto, setEgMonto]           = useState("")
  const [egFecha, setEgFecha]           = useState("")
  const [egCategoria, setEgCategoria]   = useState<typeof CATEGORIAS[number]>("insumos")
  const [egDescripcion, setEgDescripcion] = useState("")

  // ─── Data loading ─────────────────────────────────────────────────────────

  async function loadAll() {
    setErrorMessage("")
    const [cRes, gRes, pRes, pagosRes] = await Promise.all([
      supabase.from("cobros").select("*, patients(first_name, last_name)").order("fecha", { ascending: false }),
      supabase.from("gastos").select("*").order("fecha", { ascending: false }),
      supabase.from("patients").select("id, first_name, last_name").order("first_name"),
      supabase.from("pagos").select("*").order("created_at", { ascending: false }),
    ])
    if (cRes.error) setErrorMessage("No se pudieron cargar los cobros. Verificá tu conexión.")
    if (gRes.error) setErrorMessage("No se pudieron cargar los gastos. Verificá tu conexión.")
    setCobros((cRes.data as Cobro[]) || [])
    setGastos(gRes.data || [])
    setPatients((pRes.data as Patient[]) || [])
    setPagos((pagosRes.data as Pago[]) || [])
  }

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      await loadAll()
      setIsLoading(false)
    }
    init()
  }, [])

  // ─── CRUD cobros ──────────────────────────────────────────────────────────

  async function createCobro() {
    const errs: Record<string, string> = {}
    if (!cMontoTotal || isNaN(Number(cMontoTotal)) || Number(cMontoTotal) <= 0) errs.montoTotal = "Ingresá el monto total"
    if (!cMontoEntregado || isNaN(Number(cMontoEntregado)) || Number(cMontoEntregado) < 0) errs.montoEntregado = "Ingresá el monto entregado"
    if (Number(cMontoEntregado) > Number(cMontoTotal)) errs.montoEntregado = "No puede superar el monto total"
    if (!cFecha) errs.fecha = "La fecha es obligatoria"
    if (Object.keys(errs).length > 0) { setCErrors(errs); return }
    setCErrors({})
    setIsSubmitting(true)

    const montoTotal = Number(cMontoTotal)
    const montoEntregado = Number(cMontoEntregado)
    const estado: Cobro["estado"] =
      montoEntregado >= montoTotal ? "cobrado" : montoEntregado > 0 ? "parcial" : "pendiente"

    const { error } = await supabase.from("cobros").insert({
      paciente_id: cPacienteId || null,
      monto: montoEntregado,
      monto_total: montoTotal,
      monto_entregado: montoEntregado,
      fecha: cFecha,
      estado,
      descripcion: cDescripcion || null,
      metodo_pago: cMetodo || null,
    })
    setIsSubmitting(false)
    if (error) { showToast("No se pudo guardar el cobro.", "error"); return }
    showToast("Cobro registrado.", "success")
    setCreateCobroOpen(false)
    resetCobroForm()
    await loadAll()
  }

  function resetCobroForm() {
    setCPacienteId(""); setCMontoTotal(""); setCMontoEntregado("")
    setCFecha(new Date().toISOString().split("T")[0]); setCDescripcion(""); setCMetodo("Efectivo"); setCErrors({})
  }

  function openEditCobro(c: Cobro) {
    setEditingCobro(c)
    setEcMontoTotal(String(c.monto_total))
    setEcMontoEntregado(String(c.monto_entregado))
    setEcFecha(c.fecha)
    setEcEstado(c.estado)
    setEcDescripcion(c.descripcion || "")
    setEcPacienteId(c.paciente_id || "")
    setEcMetodo(c.metodo_pago || "")
  }

  async function saveCobro() {
    if (!editingCobro) return
    const montoTotal = Number(ecMontoTotal)
    const montoEntregado = Number(ecMontoEntregado)
    if (!ecMontoTotal || isNaN(montoTotal) || montoTotal <= 0) { showToast("Monto total inválido.", "error"); return }
    if (isNaN(montoEntregado) || montoEntregado < 0) { showToast("Monto entregado inválido.", "error"); return }
    if (montoEntregado > montoTotal) { showToast("El entregado no puede superar el total.", "error"); return }
    setIsSubmitting(true)
    const { error } = await supabase.from("cobros").update({
      monto: montoEntregado,
      monto_total: montoTotal,
      monto_entregado: montoEntregado,
      fecha: ecFecha,
      estado: ecEstado,
      descripcion: ecDescripcion || null,
      paciente_id: ecPacienteId || null,
      metodo_pago: ecMetodo || null,
    }).eq("id", editingCobro.id)
    setIsSubmitting(false)
    if (error) { showToast("No se pudo actualizar.", "error"); return }
    showToast("Cobro actualizado.", "success")
    setEditingCobro(null)
    await loadAll()
  }

  // ─── CRUD gastos ──────────────────────────────────────────────────────────

  async function createGasto() {
    const errs: Record<string, string> = {}
    if (!gMonto || isNaN(Number(gMonto)) || Number(gMonto) <= 0) errs.monto = "Ingresá un monto válido"
    if (!gFecha) errs.fecha = "La fecha es obligatoria"
    if (Object.keys(errs).length > 0) { setGErrors(errs); return }
    setGErrors({})
    setIsSubmitting(true)
    const { error } = await supabase.from("gastos").insert({
      monto: Number(gMonto), fecha: gFecha, categoria: gCategoria, descripcion: gDescripcion || null,
    })
    setIsSubmitting(false)
    if (error) { showToast("No se pudo guardar el gasto.", "error"); return }
    showToast("Gasto registrado.", "success")
    setCreateGastoOpen(false)
    resetGastoForm()
    await loadAll()
  }

  function resetGastoForm() {
    setGMonto(""); setGFecha(new Date().toISOString().split("T")[0])
    setGCategoria("insumos"); setGDescripcion(""); setGErrors({})
  }

  function openEditGasto(g: Gasto) {
    setEditingGasto(g); setEgMonto(String(g.monto)); setEgFecha(g.fecha)
    setEgCategoria(g.categoria); setEgDescripcion(g.descripcion || "")
  }

  async function saveGasto() {
    if (!editingGasto) return
    const monto = Number(egMonto)
    if (!egMonto || isNaN(monto) || monto <= 0) { showToast("Monto inválido.", "error"); return }
    setIsSubmitting(true)
    const { error } = await supabase.from("gastos").update({
      monto, fecha: egFecha, categoria: egCategoria, descripcion: egDescripcion || null,
    }).eq("id", editingGasto.id)
    setIsSubmitting(false)
    if (error) { showToast("No se pudo actualizar.", "error"); return }
    showToast("Gasto actualizado.", "success")
    setEditingGasto(null)
    await loadAll()
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deletingItem) return
    const { id, kind } = deletingItem
    setDeletingItem(null)
    if (kind === "cobro") setCobros(prev => prev.filter(c => c.id !== id))
    else setGastos(prev => prev.filter(g => g.id !== id))
    const { error } = await supabase.from(kind === "cobro" ? "cobros" : "gastos").delete().eq("id", id)
    if (error) { showToast("No se pudo eliminar.", "error"); await loadAll() }
    else showToast(`${kind === "cobro" ? "Cobro" : "Gasto"} eliminado.`, "success")
  }

  // ─── Computed ─────────────────────────────────────────────────────────────

  // Dinero real recibido (suma monto_entregado de todos los cobros)
  const totalCobrado   = cobros.reduce((s, c) => s + c.monto_entregado, 0)
  const totalGastos    = gastos.reduce((s, g) => s + g.monto, 0)
  const caja           = totalCobrado - totalGastos
  // Deuda total (saldo pendiente de parciales + pendientes)
  const deudaPendiente = cobros.filter(c => c.estado === "parcial" || c.estado === "pendiente").reduce((s, c) => s + c.saldo_pendiente, 0)

  const cobradoEsteMes = cobros
    .filter(c => c.fecha.startsWith(thisMonth))
    .reduce((s, c) => s + c.monto_entregado, 0)
  const egresoEsteMes  = gastos
    .filter(g => g.fecha.startsWith(thisMonth))
    .reduce((s, g) => s + g.monto, 0)
  const progressPct    = cobradoEsteMes > 0 ? Math.min((egresoEsteMes / cobradoEsteMes) * 100, 100) : 0

  // ─── Historial ────────────────────────────────────────────────────────────

  const historial: HistorialItem[] = [
    ...cobros
      .filter(c => {
        const mMatch = !filterMonth || c.fecha.startsWith(filterMonth)
        const tMatch = filterType === "todos" || filterType === "cobro"
        const eMatch = filterEstado === "todos" || c.estado === filterEstado
        return mMatch && tMatch && eMatch
      })
      .map(c => ({ kind: "cobro" as const, data: c })),
    ...gastos
      .filter(g => {
        const mMatch = !filterMonth || g.fecha.startsWith(filterMonth)
        const tMatch = filterType === "todos" || filterType === "gasto"
        const eMatch = filterEstado === "todos"
        return mMatch && tMatch && eMatch
      })
      .map(g => ({ kind: "gasto" as const, data: g })),
    ...pagos
      .filter(p => {
        const pagoDate = (p.created_at || p.fecha || "").split("T")[0]
        const mMatch = !filterMonth || pagoDate.startsWith(filterMonth)
        const tMatch = filterType === "todos" || filterType === "pago"
        const eMatch = filterEstado === "todos"
        return mMatch && tMatch && eMatch
      })
      .map(p => ({
        kind: "pago" as const,
        data: p,
        cobro: cobros.find(c => c.id === p.cobro_id) ?? null,
      })),
  ].sort((a, b) => {
    const dA = a.kind === "pago" ? (a.data.created_at || a.data.fecha) : a.data.fecha
    const dB = b.kind === "pago" ? (b.data.created_at || b.data.fecha) : b.data.fecha
    return dB.localeCompare(dA)
  })

  // ─── Evolución mensual (últimos 6 meses) ─────────────────────────────────

  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { key: monthKey(d), label: d.toLocaleDateString("es-AR", { month: "short" }) }
  })

  const evolucion = last6.map(({ key, label }) => {
    const cobradoM = cobros.filter(c => c.fecha.startsWith(key)).reduce((s, c) => s + c.monto_entregado, 0)
    const egresosM = gastos.filter(g => g.fecha.startsWith(key)).reduce((s, g) => s + g.monto, 0)
    return { label, cobrado: cobradoM, egresos: egresosM, neta: cobradoM - egresosM }
  })

  const maxEvo = Math.max(...evolucion.map(e => Math.max(e.cobrado, e.egresos, Math.abs(e.neta))), 1)
  const BAR_H  = 80

  // ─── Month nav ────────────────────────────────────────────────────────────

  function prevMonth() {
    const [y, m] = filterMonth.split("-").map(Number)
    setFilterMonth(monthKey(new Date(y, m - 2, 1)))
  }
  function nextMonth() {
    const [y, m] = filterMonth.split("-").map(Number)
    setFilterMonth(monthKey(new Date(y, m, 1)))
  }

  const isActiveFilter = filterType !== "todos" || filterEstado !== "todos"

  // Pagos del cobro en el dialog de historial
  const histPagos = histPagosCobro
    ? pagos.filter(p => p.cobro_id === histPagosCobro.id)
    : []

  // Create cobro — saldo calculado en tiempo real
  const cSaldo = (parseFloat(cMontoTotal) || 0) - (parseFloat(cMontoEntregado) || 0)
  const cSaldoVisible = cMontoTotal !== "" && cMontoEntregado !== ""

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto">

      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}

      <ConfirmDialog
        open={deletingItem !== null}
        title={`¿Eliminar este ${deletingItem?.kind === "cobro" ? "cobro" : "gasto"}?`}
        description="Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        onCancel={() => setDeletingItem(null)}
      />

      {/* Pago adicional */}
      <PagoAdicionalDialog
        cobro={pagoAdicionalCobro}
        onClose={() => setPagoAdicionalCobro(null)}
        onSaved={loadAll}
      />

      {/* Historial de pagos de un cobro */}
      <Dialog open={histPagosCobro !== null} onOpenChange={v => { if (!v) setHistPagosCobro(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Historial de pagos</DialogTitle>
            {histPagosCobro && (
              <p className="text-sm text-gray-500 mt-1">
                {histPagosCobro.patients
                  ? `${histPagosCobro.patients.first_name} ${histPagosCobro.patients.last_name} · `
                  : ""}
                {histPagosCobro.fecha} · Total {fmt(histPagosCobro.monto_total)}
              </p>
            )}
          </DialogHeader>
          {histPagos.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No hay pagos adicionales registrados.</p>
          ) : (
            <div className="flex flex-col divide-y dark:divide-zinc-800 mt-2">
              {histPagos.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3 gap-3">
                  <div>
                    <p className="text-sm font-medium">{fmt(p.monto)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(p.fecha || p.created_at).toLocaleDateString("es-AR", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                      {p.metodo_pago && ` · ${p.metodo_pago}`}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    +{fmt(p.monto)}
                  </span>
                </div>
              ))}
              {histPagosCobro && (
                <div className="pt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total entregado</span>
                  <span className="font-semibold">{fmt(histPagosCobro.monto_entregado)}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Cobro ── */}
      <Dialog open={editingCobro !== null} onOpenChange={v => { if (!v) setEditingCobro(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar cobro</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Paciente</label>
              <select className={inputClass} value={ecPacienteId} onChange={e => setEcPacienteId(e.target.value)}>
                <option value="">Sin paciente</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Monto total <span className="text-red-400">*</span></label>
                <input type="number" min="0" step="any" placeholder="0" className={inputClass} value={ecMontoTotal} onChange={e => setEcMontoTotal(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Monto entregado <span className="text-red-400">*</span></label>
                <input type="number" min="0" step="any" placeholder="0" className={inputClass} value={ecMontoEntregado} onChange={e => setEcMontoEntregado(e.target.value)} />
              </div>
            </div>
            {ecMontoTotal && ecMontoEntregado && (() => {
              const saldo = Number(ecMontoTotal) - Number(ecMontoEntregado)
              return (
                <p className={`text-sm font-medium ${saldo <= 0 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                  {saldo <= 0 ? "Pagado completo" : `Saldo pendiente: ${fmt(saldo)}`}
                </p>
              )
            })()}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Fecha <span className="text-red-400">*</span></label>
              <input type="date" className={inputClass} value={ecFecha} onChange={e => setEcFecha(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Estado</label>
              <select className={inputClass} value={ecEstado} onChange={e => setEcEstado(e.target.value as Cobro["estado"])}>
                <option value="cobrado">Cobrado</option>
                <option value="parcial">Pago parcial</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Método de pago</label>
              <select className={inputClass} value={ecMetodo} onChange={e => setEcMetodo(e.target.value)}>
                <option value="">—</option>
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Descripción</label>
              <input type="text" placeholder="Opcional..." className={inputClass} value={ecDescripcion} onChange={e => setEcDescripcion(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline"
                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 border-red-200 dark:border-red-900"
                onClick={() => { setEditingCobro(null); setDeletingItem({ id: editingCobro!.id, kind: "cobro" }) }}>
                <Trash2 className="h-4 w-4 mr-1.5" />Eliminar
              </Button>
              <Button className="flex-1" onClick={saveCobro} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Gasto ── */}
      <Dialog open={editingGasto !== null} onOpenChange={v => { if (!v) setEditingGasto(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar gasto</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Monto <span className="text-red-400">*</span></label>
              <input type="number" min="0" step="any" placeholder="0" className={inputClass} value={egMonto} onChange={e => setEgMonto(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Fecha <span className="text-red-400">*</span></label>
              <input type="date" className={inputClass} value={egFecha} onChange={e => setEgFecha(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Categoría</label>
              <select className={inputClass} value={egCategoria} onChange={e => setEgCategoria(e.target.value as typeof CATEGORIAS[number])}>
                {CATEGORIAS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Descripción</label>
              <input type="text" placeholder="Opcional..." className={inputClass} value={egDescripcion} onChange={e => setEgDescripcion(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline"
                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 border-red-200 dark:border-red-900"
                onClick={() => { setEditingGasto(null); setDeletingItem({ id: editingGasto!.id, kind: "gasto" }) }}>
                <Trash2 className="h-4 w-4 mr-1.5" />Eliminar
              </Button>
              <Button className="flex-1" onClick={saveGasto} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Financieras</h1>
          <p className="text-gray-500 mt-2 capitalize">{monthLabel(thisMonth)}</p>
        </div>
        <div className="flex items-center gap-2">

          <Dialog open={createGastoOpen} onOpenChange={v => { setCreateGastoOpen(v); if (!v) resetGastoForm() }}>
            <DialogTrigger asChild>
              <Button variant="outline">+ Gasto</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo Gasto</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Monto <span className="text-red-400">*</span></label>
                  <input type="number" min="0" step="any" autoFocus placeholder="0"
                    className={`${inputClass} ${gErrors.monto ? "border-red-500" : ""}`}
                    value={gMonto} onChange={e => { setGMonto(e.target.value); setGErrors(p => ({ ...p, monto: "" })) }} />
                  {gErrors.monto && <p className="text-red-500 text-sm">{gErrors.monto}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Fecha <span className="text-red-400">*</span></label>
                  <input type="date"
                    className={`${inputClass} ${gErrors.fecha ? "border-red-500" : ""}`}
                    value={gFecha} onChange={e => { setGFecha(e.target.value); setGErrors(p => ({ ...p, fecha: "" })) }} />
                  {gErrors.fecha && <p className="text-red-500 text-sm">{gErrors.fecha}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Categoría</label>
                  <select className={inputClass} value={gCategoria} onChange={e => setGCategoria(e.target.value as typeof CATEGORIAS[number])}>
                    {CATEGORIAS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Descripción</label>
                  <input type="text" placeholder="Opcional..." className={inputClass} value={gDescripcion} onChange={e => setGDescripcion(e.target.value)} />
                </div>
                <Button onClick={createGasto} disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Gasto"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={createCobroOpen} onOpenChange={v => { setCreateCobroOpen(v); if (!v) resetCobroForm() }}>
            <DialogTrigger asChild>
              <Button>+ Cobro</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo Cobro</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Paciente</label>
                  <select className={inputClass} value={cPacienteId} onChange={e => setCPacienteId(e.target.value)}>
                    <option value="">Sin paciente</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-500">Monto total <span className="text-red-400">*</span></label>
                    <input type="number" min="0" step="any" autoFocus placeholder="0"
                      className={`${inputClass} ${cErrors.montoTotal ? "border-red-500" : ""}`}
                      value={cMontoTotal} onChange={e => { setCMontoTotal(e.target.value); setCErrors(p => ({ ...p, montoTotal: "" })) }} />
                    {cErrors.montoTotal && <p className="text-red-500 text-sm">{cErrors.montoTotal}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-500">Monto entregado <span className="text-red-400">*</span></label>
                    <input type="number" min="0" step="any" placeholder="0"
                      className={`${inputClass} ${cErrors.montoEntregado ? "border-red-500" : ""}`}
                      value={cMontoEntregado} onChange={e => { setCMontoEntregado(e.target.value); setCErrors(p => ({ ...p, montoEntregado: "" })) }} />
                    {cErrors.montoEntregado && <p className="text-red-500 text-sm">{cErrors.montoEntregado}</p>}
                  </div>
                </div>
                {cSaldoVisible && (
                  <div className={`rounded-lg p-3 text-sm font-medium border ${
                    cSaldo <= 0
                      ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                      : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400"
                  }`}>
                    {cSaldo <= 0 ? "Pagado completo" : `Pago parcial — queda ${fmt(cSaldo)} pendiente`}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Fecha <span className="text-red-400">*</span></label>
                  <input type="date"
                    className={`${inputClass} ${cErrors.fecha ? "border-red-500" : ""}`}
                    value={cFecha} onChange={e => { setCFecha(e.target.value); setCErrors(p => ({ ...p, fecha: "" })) }} />
                  {cErrors.fecha && <p className="text-red-500 text-sm">{cErrors.fecha}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Método de pago</label>
                  <select className={inputClass} value={cMetodo} onChange={e => setCMetodo(e.target.value)}>
                    <option value="">—</option>
                    <option>Efectivo</option>
                    <option>Transferencia</option>
                    <option>Tarjeta</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Descripción</label>
                  <input type="text" placeholder="Opcional..." className={inputClass} value={cDescripcion} onChange={e => setCDescripcion(e.target.value)} />
                </div>
                <Button onClick={createCobro} disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Cobro"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      <ErrorBanner message={errorMessage} onClose={() => setErrorMessage("")} />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

            <Card className="p-5 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm text-gray-500">Caja disponible</span>
              </div>
              <p className={`text-2xl font-bold ${caja >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                {fmt(caja)}
              </p>
              <p className="text-xs text-gray-400 mt-1">recibido total − egresos</p>
            </Card>

            <Card
              className="p-5 dark:bg-zinc-900 dark:border-zinc-800 cursor-pointer hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors"
              onClick={() => { setFilterType("cobro"); setFilterEstado("todos") }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-50 dark:bg-yellow-950/40 flex items-center justify-center">
                  <Receipt className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <span className="text-sm text-gray-500">Deuda pendiente</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{fmt(deudaPendiente)}</p>
              <p className="text-xs text-gray-400 mt-1">parcial + pendiente</p>
            </Card>

            <Card className="p-5 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm text-gray-500">Cobrado este mes</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(cobradoEsteMes)}</p>
              <p className="text-xs text-gray-400 mt-1 capitalize">{monthLabel(thisMonth)}</p>
            </Card>

            <Card className="p-5 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
                </div>
                <span className="text-sm text-gray-500">Egresos este mes</span>
              </div>
              <p className="text-2xl font-bold text-red-500 dark:text-red-400">{fmt(egresoEsteMes)}</p>
              {cobradoEsteMes > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 mb-1">{Math.round(progressPct)}% de lo cobrado</p>
                  <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progressPct > 80 ? "bg-red-500" : progressPct > 50 ? "bg-amber-400" : "bg-emerald-400"}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </Card>

          </div>

          {/* ── Evolución mensual ── */}
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800 mb-6">
            <h2 className="font-semibold mb-6">Evolución mensual — últimos 6 meses</h2>
            <div className="flex items-end gap-3" style={{ height: `${BAR_H + 36}px` }}>
              {evolucion.map(({ label, cobrado, egresos, neta }) => {
                const cH = cobrado > 0    ? Math.max(Math.round((cobrado          / maxEvo) * BAR_H), 4) : 2
                const gH = egresos > 0    ? Math.max(Math.round((egresos          / maxEvo) * BAR_H), 4) : 2
                const nH = Math.abs(neta) > 0 ? Math.max(Math.round((Math.abs(neta) / maxEvo) * BAR_H), 4) : 2
                return (
                  <div key={label} className="flex-1 flex flex-col items-center">
                    <div
                      className="flex items-end gap-0.5 w-full border-b border-gray-100 dark:border-zinc-800 pb-1"
                      style={{ height: `${BAR_H + 16}px` }}
                    >
                      <div title={`Cobrado: ${fmt(cobrado)}`} style={{ height: cH }} className="flex-1 rounded-t bg-emerald-400 dark:bg-emerald-500 transition-all" />
                      <div title={`Egresos: ${fmt(egresos)}`} style={{ height: gH }} className="flex-1 rounded-t bg-red-400 dark:bg-red-500 transition-all" />
                      <div title={`Neta: ${fmt(neta)}`} style={{ height: nH }} className={`flex-1 rounded-t transition-all ${neta >= 0 ? "bg-sky-400 dark:bg-sky-500" : "bg-orange-400 dark:bg-orange-500"}`} />
                    </div>
                    <span className="text-xs text-gray-400 capitalize mt-1.5">{label}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {[
                { color: "bg-emerald-400", label: "Cobrado" },
                { color: "bg-red-400",     label: "Egresos" },
                { color: "bg-sky-400",     label: "Neta positiva" },
                { color: "bg-orange-400",  label: "Neta negativa" },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
                  <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
                  {label}
                </span>
              ))}
            </div>
          </Card>

          {/* ── Historial ── */}
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">

            <div className="flex items-center flex-wrap gap-3 mb-6">
              <h2 className="font-semibold mr-auto">Historial</h2>

              <div className="flex items-center gap-1 border dark:border-zinc-700 rounded-lg overflow-hidden">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Mes anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm px-2 capitalize whitespace-nowrap">{monthLabel(filterMonth)}</span>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Mes siguiente">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as typeof filterType)}
                className="border rounded-lg p-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none"
              >
                <option value="todos">Todos</option>
                <option value="cobro">Solo cobros</option>
                <option value="gasto">Solo gastos</option>
                <option value="pago">Solo pagos adicionales</option>
              </select>

              <select
                value={filterEstado}
                disabled={filterType === "gasto" || filterType === "pago"}
                onChange={e => setFilterEstado(e.target.value as typeof filterEstado)}
                className="border rounded-lg p-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none disabled:opacity-40"
              >
                <option value="todos">Todos los estados</option>
                <option value="cobrado">Cobrado</option>
                <option value="parcial">Pago parcial</option>
                <option value="pendiente">Pendiente</option>
              </select>

              {isActiveFilter && (
                <button
                  onClick={() => { setFilterType("todos"); setFilterEstado("todos") }}
                  className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  aria-label="Limpiar filtros"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {historial.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No hay movimientos para este período.</p>
            ) : (
              <div className="flex flex-col divide-y dark:divide-zinc-800">
                {historial.map(item => {

                  if (item.kind === "cobro") {
                    const c = item.data
                    const patName = c.patients ? `${c.patients.first_name} ${c.patients.last_name}` : null
                    const tienePagos = pagos.some(p => p.cobro_id === c.id)
                    return (
                      <div key={`cobro-${c.id}`} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
                              Cobro
                            </span>
                            {c.estado === "parcial" && (
                              <span className="shrink-0 text-xs font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-full px-2 py-0.5">
                                Pago parcial
                              </span>
                            )}
                            {c.estado === "pendiente" && (
                              <span className="shrink-0 text-xs font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-full px-2 py-0.5">
                                Pendiente
                              </span>
                            )}
                            {patName && <span className="text-sm text-gray-700 dark:text-zinc-200">{patName}</span>}
                            {c.metodo_pago && <span className="text-sm text-gray-400">{c.metodo_pago}</span>}
                            {c.descripcion && <span className="text-sm text-gray-400 truncate">{c.descripcion}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <p className="text-xs text-gray-400">{c.fecha}</p>
                            {c.monto_total > 0 && (
                              <p className="text-xs text-gray-400">
                                Total: {fmt(c.monto_total)}
                                {c.saldo_pendiente > 0 && (
                                  <span className="ml-2 text-yellow-600 dark:text-yellow-500">
                                    · Saldo: {fmt(c.saldo_pendiente)}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`text-base font-semibold shrink-0 ${
                          c.estado === "cobrado" ? "text-emerald-600 dark:text-emerald-400"
                          : "text-yellow-600 dark:text-yellow-400"
                        }`}>
                          +{fmt(c.monto_entregado)}
                        </span>
                        <div className="flex gap-1 shrink-0 items-center">
                          {(c.estado === "parcial" || c.estado === "pendiente") && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 text-xs text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950 px-2"
                              onClick={() => setPagoAdicionalCobro(c)}
                            >
                              + Pago
                            </Button>
                          )}
                          {tienePagos && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-black dark:hover:text-white"
                              onClick={() => setHistPagosCobro(c)}
                              title="Ver historial de pagos"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-black dark:hover:text-white" onClick={() => openEditCobro(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => setDeletingItem({ id: c.id, kind: "cobro" })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  if (item.kind === "pago") {
                    const p = item.data
                    const cobro = item.cobro
                    const patName = cobro?.patients
                      ? `${cobro.patients.first_name} ${cobro.patients.last_name}`
                      : null
                    return (
                      <div key={`pago-${p.id}`} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="shrink-0 text-xs font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-full px-2 py-0.5">
                              Pago parcial
                            </span>
                            {patName && <span className="text-sm text-gray-700 dark:text-zinc-200">{patName}</span>}
                            {p.metodo_pago && <span className="text-sm text-gray-400">{p.metodo_pago}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-400">
                              {new Date(p.fecha || p.created_at).toLocaleDateString("es-AR")}
                            </p>
                            {cobro && (
                              <p className="text-xs text-gray-400">· Cobro del {cobro.fecha}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-base font-semibold shrink-0 text-emerald-600 dark:text-emerald-400">
                          +{fmt(p.monto)}
                        </span>
                      </div>
                    )
                  }

                  // gasto
                  const g = item.data
                  return (
                    <div key={`gasto-${g.id}`} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-full px-2 py-0.5">
                            Gasto
                          </span>
                          <span className="shrink-0 text-xs text-gray-400 capitalize border dark:border-zinc-700 rounded-full px-2 py-0.5">
                            {g.categoria}
                          </span>
                          {g.descripcion && <span className="text-sm text-gray-400 truncate">{g.descripcion}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{g.fecha}</p>
                      </div>
                      <span className="text-base font-semibold shrink-0 text-red-500 dark:text-red-400">
                        −{fmt(g.monto)}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-black dark:hover:text-white" onClick={() => openEditGasto(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => setDeletingItem({ id: g.id, kind: "gasto" })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

        </>
      )}
    </div>
  )
}

export default Financieras
