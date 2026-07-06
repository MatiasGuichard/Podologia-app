import { supabase } from "./supabase"

/**
 * Marca un turno como "Completado" si ya tiene un cobro registrado (cobros.turno_id),
 * sea total o parcial. La ficha clínica no es requisito: puede cargarse antes, después,
 * o nunca, sin bloquear el cierre del turno. Si todavía no hay ningún cobro, no hace nada —
 * el turno sigue en "En atención" hasta que se registre un pago o se fuerce el cierre
 * manualmente (ver finalizarTurnoSinCompletar).
 */
export async function completarTurnoSiCorresponde(turnoId: string): Promise<void> {
  const { data } = await supabase.from("cobros").select("id").eq("turno_id", turnoId).limit(1)
  const tieneCobro = (data?.length ?? 0) > 0

  if (!tieneCobro) return

  await supabase.from("appointments").update({ status: "Completado" }).eq("id", turnoId)
}

/** Cierra el turno como "Completado" sin exigir ficha ni cobro. */
export async function finalizarTurnoSinCompletar(turnoId: string) {
  return supabase.from("appointments").update({ status: "Completado" }).eq("id", turnoId)
}
