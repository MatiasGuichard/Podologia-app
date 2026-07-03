import { supabase } from "./supabase"

/**
 * Marca un turno como "Completado" solo si ya tiene ficha clínica (medical_records.turno_id)
 * Y un cobro con estado "cobrado" (cobros.turno_id). Si falta alguno, no hace nada —
 * el turno sigue en "En atención" hasta que se cumplan ambas condiciones o se fuerce
 * el cierre manualmente (ver finalizarSinCompletar).
 */
export async function completarTurnoSiCorresponde(turnoId: string): Promise<void> {
  const [recordRes, cobroRes] = await Promise.all([
    supabase.from("medical_records").select("id").eq("turno_id", turnoId).limit(1),
    supabase.from("cobros").select("estado").eq("turno_id", turnoId).limit(1),
  ])

  const tieneFicha = (recordRes.data?.length ?? 0) > 0
  const tieneCobro = cobroRes.data?.[0]?.estado === "cobrado"

  if (!tieneFicha || !tieneCobro) return

  await supabase.from("appointments").update({ status: "Completado" }).eq("id", turnoId)
}

/** Cierra el turno como "Completado" sin exigir ficha ni cobro. */
export async function finalizarTurnoSinCompletar(turnoId: string) {
  return supabase.from("appointments").update({ status: "Completado" }).eq("id", turnoId)
}
