import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { supabase } from "../lib/supabase"
import type { Cobro } from "../types"

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n)
}

const inputClass =
  "border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 w-full"

type Props = {
  cobro: Cobro | null
  onClose: () => void
  onSaved: () => void
}

export default function PagoAdicionalDialog({ cobro, onClose, onSaved }: Props) {
  const [monto, setMonto] = useState("")
  const [metodo, setMetodo] = useState("Efectivo")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const saldoPendiente = cobro?.saldo_pendiente ?? 0
  const patientName = cobro?.patients
    ? `${cobro.patients.first_name} ${cobro.patients.last_name}`
    : null

  async function confirmar() {
    if (!cobro) return
    const montoNum = parseFloat(monto)
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      setError("Ingresá un monto válido")
      return
    }
    if (montoNum > saldoPendiente + 0.001) {
      setError(`No puede superar el saldo pendiente (${fmt(saldoPendiente)})`)
      return
    }

    setIsSaving(true)
    const newEntregado = cobro.monto_entregado + montoNum
    const newEstado =
      newEntregado >= cobro.monto_total - 0.001 ? "cobrado"
      : newEntregado > 0 ? "parcial"
      : "pendiente"

    const [pagoRes, cobroRes] = await Promise.all([
      supabase.from("pagos").insert({ cobro_id: cobro.id, monto: montoNum, metodo_pago: metodo }),
      supabase.from("cobros").update({
        monto_entregado: newEntregado,
        monto: newEntregado,
        estado: newEstado,
      }).eq("id", cobro.id),
    ])
    setIsSaving(false)

    if (pagoRes.error || cobroRes.error) {
      setError("No se pudo registrar el pago.")
      return
    }

    setMonto("")
    setMetodo("Efectivo")
    setError("")
    onClose()
    onSaved()
  }

  function handleClose() {
    setMonto("")
    setMetodo("Efectivo")
    setError("")
    onClose()
  }

  return (
    <Dialog open={cobro !== null} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago adicional</DialogTitle>
        </DialogHeader>

        {cobro && (
          <div className="flex flex-col gap-4 mt-2">
            <div className="rounded-lg bg-gray-50 dark:bg-zinc-800/60 p-3 flex flex-col gap-1 text-sm">
              {patientName && <p className="font-medium">{patientName}</p>}
              <p className="text-gray-500">
                Consulta del{" "}
                {new Date(cobro.fecha + "T12:00:00").toLocaleDateString("es-AR", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </p>
              <p className="text-gray-500">
                Monto total:{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {fmt(cobro.monto_total)}
                </span>
              </p>
              <p className="text-gray-500">
                Ya entregado:{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {fmt(cobro.monto_entregado)}
                </span>
              </p>
            </div>

            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-3">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Saldo pendiente: {fmt(saldoPendiente)}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">
                Monto a pagar ahora <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">$</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00" autoFocus
                  className="border rounded-lg p-3 pl-7 w-full dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={monto}
                  onChange={(e) => { setMonto(e.target.value); if (error) setError("") }}
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-500">Método de pago</label>
              <select className={inputClass} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
              </select>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleClose} disabled={isSaving}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                onClick={confirmar}
                disabled={isSaving}
              >
                {isSaving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                  : "Confirmar pago"
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
