import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import type { Appointment } from "../types"

async function fetchAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(`*, patients(first_name, last_name)`)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
  if (error) throw error
  return data ?? []
}

export function useAppointments() {
  return useQuery({
    queryKey: ["appointments"],
    queryFn: fetchAppointments,
  })
}
