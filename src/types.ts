export type Patient = {
  id: string
  first_name: string
  last_name: string
  dni: string
  phone: string
  age?: number
  birth_date?: string
  footwear: string
  diseases: string
  medications: string
  allergies: string
}

export type MedicalRecord = {
  id: string
  diagnosis: string
  treatment: string
  observations: string
  visit_date: string
  before_image_url: string
  after_image_url: string
}

export type Cobro = {
  id: string
  paciente_id: string | null
  monto: number
  monto_total: number
  monto_entregado: number
  saldo_pendiente: number
  fecha: string
  estado: "cobrado" | "parcial" | "pendiente"
  descripcion: string | null
  metodo_pago: string | null
  created_at: string
  patients?: { first_name: string; last_name: string }
}

export type Pago = {
  id: string
  cobro_id: string
  monto: number
  metodo_pago: string | null
  fecha: string
  created_at: string
}

export type Gasto = {
  id: string
  monto: number
  fecha: string
  categoria: "insumos" | "alquiler" | "servicios" | "otros"
  descripcion: string | null
  created_at: string
}

export type Appointment = {
  id: string
  patient_id?: string
  appointment_date: string
  appointment_time: string
  status: string
  notes: string
  patients?: {
    first_name: string
    last_name: string
  }
}
