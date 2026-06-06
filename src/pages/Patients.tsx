import { useEffect, useState } from "react"

import { supabase } from "../lib/supabase"

import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Link } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
import type { Patient } from "../types"
import Toast from "../components/Toast"
import ConfirmDialog from "../components/ConfirmDialog"
import { getStoragePath } from "../lib/storageUtils"

const ITEMS_PER_PAGE = 10

const DISEASE_OPTIONS = [
  "Tiroides",
  "Hipertensión",
  "Diabetes Mellitus 1",
  "Diabetes Mellitus 2",
]

const MEDICATION_OPTIONS = [
  "Anticoagulados",
  "Metformina",
]

const FOOTWEAR_OPTIONS = [
  "Ojota",
  "Zapatillas",
  "Zapatillas deportivas",
  "Botines de seguridad",
  "Botines deportivos",
  "Botas",
]

function splitValues(str: string): string[] {
  return str ? str.split(", ").filter(Boolean) : []
}

function Patients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [dni, setDni] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [phone, setPhone] = useState("")
  const [footwear, setFootwear] = useState("")
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([])
  const [selectedMedications, setSelectedMedications] = useState<string[]>([])
  const [allergies, setAllergies] = useState("")

  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; dni?: string }>({})
  const [errorMessage, setErrorMessage] = useState("")
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type })
  }

  function toggleDisease(value: string) {
    setSelectedDiseases((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    )
  }

  function toggleMedication(value: string) {
    setSelectedMedications((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value]
    )
  }

  async function getPatients() {
    setIsLoading(true)

    const { data, error } = await supabase.from("patients").select("*").order("last_name", { ascending: true })

    if (error) {
      setErrorMessage("No se pudieron cargar los pacientes. Verificá tu conexión.")
      setIsLoading(false)
      return
    }

    setPatients(data || [])
    setIsLoading(false)
  }

  function clearForm() {
    setFirstName("")
    setLastName("")
    setDni("")
    setBirthDate("")
    setPhone("")
    setFootwear("")
    setSelectedDiseases([])
    setSelectedMedications([])
    setAllergies("")
    setErrors({})
    setEditingPatient(null)
  }

  function openEditDialog(patient: Patient) {
    setEditingPatient(patient)
    setFirstName(patient.first_name)
    setLastName(patient.last_name)
    setDni(patient.dni ?? "")
    setBirthDate(patient.birth_date ?? "")
    setPhone(patient.phone ?? "")
    setFootwear(patient.footwear ?? "")
    setSelectedDiseases(splitValues(patient.diseases ?? ""))
    setSelectedMedications(splitValues(patient.medications ?? ""))
    setAllergies(patient.allergies ?? "")
    setOpen(true)
  }

  async function confirmDeletePatient() {
    if (!deletingPatientId) return

    const { data: records } = await supabase
      .from("medical_records")
      .select("before_image_url, after_image_url")
      .eq("patient_id", deletingPatientId)

    if (records && records.length > 0) {
      const paths = records
        .flatMap((r) => [r.before_image_url, r.after_image_url])
        .map(getStoragePath)
        .filter((p): p is string => p !== null)

      if (paths.length > 0) {
        await supabase.storage.from("clinical-images").remove(paths)
      }
    }

    const { error } = await supabase
      .from("patients")
      .delete()
      .eq("id", deletingPatientId)

    setDeletingPatientId(null)

    if (error) {
      showToast("No se pudo eliminar el paciente.", "error")
      return
    }

    showToast("Paciente eliminado.", "success")
    getPatients()
  }

  async function savePatient() {
    const newErrors: typeof errors = {}

    if (!firstName.trim())
      newErrors.firstName = "El nombre es obligatorio"

    if (!lastName.trim())
      newErrors.lastName = "El apellido es obligatorio"

    if (!dni) {
      newErrors.dni = "El DNI es obligatorio"
    } else if (dni.length < 7 || dni.length > 8) {
      newErrors.dni = "El DNI debe tener 7 u 8 dígitos"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})

    const patientData = {
      first_name: firstName,
      last_name: lastName,
      dni: dni || null,
      birth_date: birthDate || null,
      phone,
      footwear,
      diseases: selectedDiseases.join(", "),
      medications: selectedMedications.join(", "),
      allergies,
    }

    if (editingPatient) {
      const { error } = await supabase
        .from("patients")
        .update(patientData)
        .eq("id", editingPatient.id)

      if (error) {
        showToast("No se pudo actualizar el paciente.", "error")
        return
      }
      showToast("Paciente actualizado.", "success")
    } else {
      const { error } = await supabase.from("patients").insert(patientData)

      if (error) {
        showToast("No se pudo crear el paciente.", "error")
        return
      }
      showToast("Paciente creado.", "success")
    }

    getPatients()
    clearForm()
    setOpen(false)
  }

  useEffect(() => {
    getPatients()
  }, [])

  const filteredPatients = patients.filter((patient) => {
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase()
    return (
      fullName.includes(search.toLowerCase()) ||
      String(patient.dni).includes(search)
    )
  })

  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE)
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <ConfirmDialog
        open={deletingPatientId !== null}
        title="¿Eliminar paciente?"
        description="Esta acción no se puede deshacer. Se eliminarán también todas sus consultas."
        onConfirm={confirmDeletePatient}
        onCancel={() => setDeletingPatientId(null)}
      />

      <div className="flex items-center justify-between mb-8">

        <div>
          <h1 className="text-4xl font-bold">Pacientes</h1>
          <p className="text-gray-500 mt-2">Gestión de pacientes</p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(val) => {
            setOpen(val)
            if (!val) clearForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>Nuevo Paciente</Button>
          </DialogTrigger>

          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPatient ? "Editar paciente" : "Crear paciente"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 mt-4">

              <input
                placeholder="Nombre"
                aria-label="Nombre"
                className={`border p-3 rounded-lg ${errors.firstName ? "border-red-500" : ""}`}
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value)
                  if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }))
                }}
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm -mt-2">{errors.firstName}</p>
              )}

              <input
                placeholder="Apellido"
                aria-label="Apellido"
                className={`border p-3 rounded-lg ${errors.lastName ? "border-red-500" : ""}`}
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value)
                  if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }))
                }}
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm -mt-2">{errors.lastName}</p>
              )}

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="DNI"
                aria-label="DNI"
                className={`border p-3 rounded-lg ${errors.dni ? "border-red-500" : ""}`}
                value={dni}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "")
                  setDni(val)
                  if (errors.dni) setErrors((prev) => ({ ...prev, dni: undefined }))
                }}
              />
              {errors.dni && (
                <p className="text-red-500 text-sm -mt-2">{errors.dni}</p>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Fecha de nacimiento</label>
                <input
                  type="date"
                  aria-label="Fecha de nacimiento"
                  className="border p-3 rounded-lg"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>

              <input
                type="tel"
                placeholder="Teléfono"
                aria-label="Teléfono"
                className="border p-3 rounded-lg"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <select
                aria-label="Tipo de calzado"
                className="border p-3 rounded-lg"
                value={footwear}
                onChange={(e) => setFootwear(e.target.value)}
              >
                <option value="">Tipo de calzado</option>
                {FOOTWEAR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>

              <div className="border rounded-lg p-3">
                <p className="text-sm text-gray-500 mb-2">Enfermedades</p>
                <div className="flex flex-col gap-2">
                  {DISEASE_OPTIONS.map((disease) => (
                    <label key={disease} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDiseases.includes(disease)}
                        onChange={() => toggleDisease(disease)}
                      />
                      <span className="text-sm">{disease}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border rounded-lg p-3">
                <p className="text-sm text-gray-500 mb-2">Medicamentos</p>
                <div className="flex flex-col gap-2">
                  {MEDICATION_OPTIONS.map((med) => (
                    <label key={med} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMedications.includes(med)}
                        onChange={() => toggleMedication(med)}
                      />
                      <span className="text-sm">{med}</span>
                    </label>
                  ))}
                </div>
              </div>

              <input
                placeholder="Alergias"
                aria-label="Alergias"
                className="border p-3 rounded-lg"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
              />

              <Button onClick={savePatient}>
                {editingPatient ? "Guardar Cambios" : "Guardar Paciente"}
              </Button>

            </div>
          </DialogContent>
        </Dialog>

      </div>

      {errorMessage && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")} className="shrink-0 font-bold hover:opacity-70">✕</button>
        </div>
      )}

      <input
        type="text"
        placeholder="Buscar paciente por nombre o DNI..."
        aria-label="Buscar paciente por nombre o DNI"
        className="border rounded-lg p-3 mb-4 w-full"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setCurrentPage(1)
        }}
      />

      <div className="grid gap-4">

        {isLoading && (
          <>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-200 dark:bg-zinc-800 animate-pulse" />
            ))}
          </>
        )}

        {!isLoading && filteredPatients.length === 0 && (
          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
            <p className="text-gray-500 text-center">
              {search
                ? `No se encontraron pacientes para "${search}".`
                : "No hay pacientes registrados aún."}
            </p>
          </Card>
        )}

        {!isLoading && paginatedPatients.map((patient) => (
          <Card key={patient.id} className="p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center justify-between">

              <Link to={`/patients/${patient.id}`} className="flex-1">
                <h2 className="text-lg font-semibold">
                  {patient.first_name} {patient.last_name}
                </h2>
                <p className="text-sm text-gray-500">DNI: {patient.dni}</p>
              </Link>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-9 px-4 text-sm"
                  onClick={() => openEditDialog(patient)}
                >
                  Editar
                </Button>

                <Button
                  variant="destructive"
                  className="h-9 px-4 text-sm"
                  onClick={() => setDeletingPatientId(patient.id)}
                >
                  Eliminar
                </Button>
              </div>

            </div>
          </Card>
        ))}

      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Anterior
          </Button>

          <span className="text-sm text-gray-500">
            Página {currentPage} de {totalPages}
          </span>

          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

    </div>
  )
}

export default Patients
