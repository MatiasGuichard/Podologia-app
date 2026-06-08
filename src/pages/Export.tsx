import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Download, Users, CalendarDays, ClipboardList, Loader2 } from "lucide-react"
import type { Patient, Appointment } from "../types"
import Toast from "../components/Toast"
import { useToast } from "../hooks/useToast"

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`
  const csv = [
    headers.map(escape).join(","),
    ...rows.map(row => row.map(escape).join(",")),
  ].join("\n")

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type MedicalRecordRow = {
  id: string
  visit_date: string
  diagnosis: string
  treatment: string
  observations: string
  patient_id: string
}

function Export() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [records, setRecords] = useState<MedicalRecordRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const { toast, showToast, clearToast } = useToast()

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const [pRes, aRes, rRes] = await Promise.all([
        supabase.from("patients").select("*").order("last_name"),
        supabase.from("appointments").select("*, patients(first_name, last_name)").order("appointment_date"),
        supabase.from("medical_records").select("id, visit_date, diagnosis, treatment, observations, patient_id").order("visit_date"),
      ])
      setPatients(pRes.data || [])
      setAppointments(aRes.data || [])
      setRecords(rRes.data || [])
      setIsLoading(false)
    }
    load()
  }, [])

  async function exportPatients() {
    setExporting("patients")
    const headers = ["Apellido", "Nombre", "DNI", "Fecha Nac.", "Teléfono", "Calzado", "Enfermedades", "Medicamentos", "Alergias"]
    const rows = patients.map(p => [
      p.last_name,
      p.first_name,
      p.dni ?? "",
      p.birth_date ?? "",
      p.phone ?? "",
      p.footwear ?? "",
      p.diseases ?? "",
      p.medications ?? "",
      p.allergies ?? "",
    ])
    downloadCSV("pacientes.csv", headers, rows)
    showToast(`${patients.length} pacientes exportados.`, "success")
    setExporting(null)
  }

  async function exportAppointments() {
    setExporting("appointments")
    const headers = ["Fecha", "Horario", "Paciente", "Estado", "Notas"]
    const rows = appointments.map(a => [
      a.appointment_date,
      a.appointment_time,
      `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim(),
      a.status,
      a.notes ?? "",
    ])
    downloadCSV("turnos.csv", headers, rows)
    showToast(`${appointments.length} turnos exportados.`, "success")
    setExporting(null)
  }

  async function exportRecords() {
    setExporting("records")

    // Build patient lookup map
    const patientMap = Object.fromEntries(
      patients.map(p => [p.id, `${p.first_name} ${p.last_name}`])
    )

    const headers = ["Fecha visita", "Paciente", "Diagnóstico", "Tratamiento", "Observaciones"]
    const rows = records.map(r => [
      r.visit_date,
      patientMap[r.patient_id] ?? "",
      r.diagnosis ?? "",
      r.treatment ?? "",
      r.observations ?? "",
    ])
    downloadCSV("historial-clinico.csv", headers, rows)
    showToast(`${records.length} consultas exportadas.`, "success")
    setExporting(null)
  }

  const exportItems = [
    {
      key: "patients",
      icon: Users,
      title: "Pacientes",
      description: "Nombre, DNI, contacto, enfermedades, medicamentos y alergias.",
      count: patients.length,
      label: "pacientes",
      onExport: exportPatients,
    },
    {
      key: "appointments",
      icon: CalendarDays,
      title: "Turnos",
      description: "Fecha, horario, paciente, estado y notas de cada turno.",
      count: appointments.length,
      label: "turnos",
      onExport: exportAppointments,
    },
    {
      key: "records",
      icon: ClipboardList,
      title: "Historial clínico",
      description: "Fecha de visita, diagnóstico, tratamiento y observaciones.",
      count: records.length,
      label: "consultas",
      onExport: exportRecords,
    },
  ]

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}

      <div className="mb-8">
        <h1 className="text-4xl font-bold">Exportar</h1>
        <p className="text-gray-500 mt-2">Descargá los datos del consultorio en formato CSV</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 max-w-3xl">
        {exportItems.map(({ key, icon: Icon, title, description, count, label, onExport }) => (
          <Card key={key} className="p-6 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-5 w-5 text-gray-400" />
                <h2 className="font-semibold">{title}</h2>
              </div>
              <p className="text-sm text-gray-500">{description}</p>
            </div>

            <div className="mt-auto flex items-center justify-between">
              {isLoading ? (
                <span className="text-sm text-gray-400">Cargando...</span>
              ) : (
                <span className="text-sm text-gray-400">
                  {count} {label}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading || count === 0 || exporting !== null}
                onClick={onExport}
              >
                {exporting === key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-6 max-w-xl">
        Los archivos CSV se abren con Excel, Google Sheets o cualquier editor de planillas. El BOM Unicode garantiza que los caracteres en español se muestren correctamente.
      </p>
    </div>
  )
}

export default Export
