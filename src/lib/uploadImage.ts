import { supabase } from "./supabase"

export async function uploadClinicalImage(
  file: File | null,
  onError?: (msg: string) => void
): Promise<string | null> {
  if (!file) return null
  const fileName = `${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from("clinical-images").upload(fileName, file)
  if (error) {
    onError?.("No se pudo subir la imagen.")
    return null
  }
  const { data } = supabase.storage.from("clinical-images").getPublicUrl(fileName)
  return data.publicUrl
}
