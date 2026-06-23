import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import type { Patient } from "../types"

async function fetchPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("first_name")
  if (error) throw error
  return data ?? []
}

export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: fetchPatients,
    staleTime: 5 * 60 * 1000,
  })
}
