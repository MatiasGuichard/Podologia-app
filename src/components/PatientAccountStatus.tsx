import { DollarSign } from "lucide-react"
import { Card } from "./ui/card"
import type { Cobro } from "../types"
import { formatDate } from "../lib/dateUtils"
import { fmt } from "../lib/currencyUtils"

type Props = {
  cobros: Cobro[]
  isLoading: boolean
  onPagoAdicional: (cobro: Cobro) => void
}

export function PatientAccountStatus({ cobros, isLoading, onPagoAdicional }: Props) {
  if (isLoading) {
    return (
      <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  if (cobros.length === 0) {
    return (
      <Card className="p-8 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col items-center text-center gap-2">
        <DollarSign className="h-10 w-10 text-green-300 dark:text-green-700" />
        <p className="text-green-600 dark:text-green-400 font-medium">Sin deuda pendiente</p>
        <p className="text-sm text-gray-400">No hay cobros registrados para este paciente.</p>
      </Card>
    )
  }

  const totalAdeudado = cobros.reduce((s, c) => s + c.saldo_pendiente, 0)

  return (
    <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex flex-col divide-y dark:divide-zinc-800">
        {cobros.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {c.estado === "cobrado" && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                    Cobrado
                  </span>
                )}
                {c.estado === "parcial" && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                    Pago parcial
                  </span>
                )}
                {c.estado === "pendiente" && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                    Pendiente
                  </span>
                )}
                <span className="text-sm text-gray-500">{formatDate(c.fecha)}</span>
                {c.metodo_pago && (
                  <span className="text-xs text-gray-400 border dark:border-zinc-700 rounded-full px-2 py-0.5">{c.metodo_pago}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                <span>Total: <span className="font-medium">{fmt(c.monto_total)}</span></span>
                <span>Entregado: <span className="font-medium">{fmt(c.monto_entregado)}</span></span>
                {c.saldo_pendiente > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-500 font-medium">
                    Saldo: {fmt(c.saldo_pendiente)}
                  </span>
                )}
              </div>
            </div>
            {(c.estado === "parcial" || c.estado === "pendiente") && (
              <button
                onClick={() => onPagoAdicional(c)}
                className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
              >
                Registrar pago
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t dark:border-zinc-800 flex items-center justify-between">
        {totalAdeudado <= 0 ? (
          <p className="text-sm font-medium text-green-600 dark:text-green-400">Sin deuda pendiente</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-500">Total adeudado</p>
            <p className="text-base font-bold text-yellow-600 dark:text-yellow-400">{fmt(totalAdeudado)}</p>
          </>
        )}
      </div>
    </Card>
  )
}
