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
