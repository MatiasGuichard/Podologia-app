import { useEffect, useState } from "react"
import { Loader2, Users, Trash2, Search, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react"

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
import ErrorBanner from "../components/ErrorBanner"
import { getStoragePath } from "../lib/storageUtils"
import { useToast } from "../hooks/useToast"
import { calcAge } from "../lib/dateUtils"
import { useDebounce } from "../hooks/useDebounce"

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
  const { toast, showToast, clearToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  const formHasContent = !!(firstName || lastName || dni || birthDate || phone || footwear || selectedDiseases.length || selectedMedications.length || allergies)
  const formChanged = editingPatient !== null && (
    firstName !== editingPatient.first_name ||
    lastName !== editingPatient.last_name ||
    dni !== (editingPatient.dni ?? "") ||
    birthDate !== (editingPatient.birth_date ?? "") ||
    phone !== (editingPatient.phone ?? "") ||
    footwear !== (editingPatient.footwear ?? "") ||
    selectedDiseases.join(", ") !== (editingPatient.diseases ?? "") ||
    selectedMedications.join(", ") !== (editingPatient.medications ?? "") ||
    allergies !== (editingPatient.allergies ?? "")
  )
  const isDirty = editingPatient ? formChanged : formHasContent

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

    const { data: { session } } = await supabase.auth.getSession()

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
      user_id: session?.user.id,
    }

    setIsSubmitting(true)

    if (editingPatient) {
      const { error } = await supabase
        .from("patients")
        .update(patientData)
        .eq("id", editingPatient.id)

      setIsSubmitting(false)
      if (error) {
        showToast("No se pudo actualizar el paciente.", "error")
        return
      }
      showToast("Paciente actualizado.", "success")
    } else {
      const { error } = await supabase.from("patients").insert(patientData)

      setIsSubmitting(false)
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
      fullName.includes(debouncedSearch.toLowerCase()) ||
      String(patient.dni).includes(debouncedSearch)
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
        <Toast message={toast.message} type={toast.type} onClose={clearToast} />
      )}

      <ConfirmDialog
        open={deletingPatientId !== null}
        title="¿Eliminar paciente?"
        description="Esta acción no se puede deshacer. Se eliminarán también todas sus consultas."
        onConfirm={confirmDeletePatient}
        onCancel={() => setDeletingPatientId(null)}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="¿Descartar cambios?"
        description="Tenés cambios sin guardar. Si salís ahora, se perderán."
        onConfirm={() => { setConfirmLeave(false); setOpen(false); clearForm() }}
        onCancel={() => setConfirmLeave(false)}
      />

      <div className="flex items-center justify-between mb-8">

        <div>
          <h1 className="text-4xl font-bold">Pacientes</h1>
          <p className="text-gray-500 mt-2">
            {isLoading
              ? "Cargando..."
              : search && filteredPatients.length !== patients.length
                ? `${filteredPatients.length} de ${patients.length} pacientes`
                : `${patients.length} paciente${patients.length !== 1 ? "s" : ""} registrado${patients.length !== 1 ? "s" : ""}`
            }
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(val) => {
            if (!val && isDirty) {
              setConfirmLeave(true)
              return
            }
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

              <div className="grid grid-cols-2 gap-3">

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Nombre <span className="text-red-400">*</span></label>
                  <input
                    placeholder="Ej: María"
                    aria-label="Nombre"
                    autoFocus
                    className={`border p-3 rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.firstName ? "border-red-500" : ""}`}
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value)
                      if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }))
                    }}
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-sm">{errors.firstName}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Apellido <span className="text-red-400">*</span></label>
                  <input
                    placeholder="Ej: González"
                    aria-label="Apellido"
                    className={`border p-3 rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.lastName ? "border-red-500" : ""}`}
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value)
                      if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }))
                    }}
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-sm">{errors.lastName}</p>
                  )}
                </div>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">DNI <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Ej: 30456789"
                    aria-label="DNI"
                    className={`border p-3 rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${errors.dni ? "border-red-500" : ""}`}
                    value={dni}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "")
                      setDni(val)
                      if (errors.dni) setErrors((prev) => ({ ...prev, dni: undefined }))
                    }}
                  />
                  {errors.dni && (
                    <p className="text-red-500 text-sm">{errors.dni}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Fecha de nacimiento</label>
                  <input
                    type="date"
                    aria-label="Fecha de nacimiento"
                    className="border p-3 rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>

              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Teléfono</label>
                <input
                  type="tel"
                  placeholder="Ej: 11 1234-5678"
                  aria-label="Teléfono"
                  className="border p-3 rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Tipo de calzado</label>
                <select
                  aria-label="Tipo de calzado"
                  className="border p-3 rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={footwear}
                  onChange={(e) => setFootwear(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {FOOTWEAR_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Enfermedades</label>
                <div className="flex flex-wrap gap-2">
                  {DISEASE_OPTIONS.map((disease) => {
                    const selected = selectedDiseases.includes(disease)
                    return (
                      <button
                        key={disease}
                        type="button"
                        onClick={() => toggleDisease(disease)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          selected
                            ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-black dark:border-zinc-100"
                            : "bg-white text-gray-600 border-gray-200 hover:border-zinc-400 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:border-zinc-400"
                        }`}
                      >
                        {disease}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Medicamentos</label>
                <div className="flex flex-wrap gap-2">
                  {MEDICATION_OPTIONS.map((med) => {
                    const selected = selectedMedications.includes(med)
                    return (
                      <button
                        key={med}
                        type="button"
                        onClick={() => toggleMedication(med)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          selected
                            ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-black dark:border-zinc-100"
                            : "bg-white text-gray-600 border-gray-200 hover:border-zinc-400 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:border-zinc-400"
                        }`}
                      >
                        {med}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Alergias</label>
                <input
                  placeholder="Ej: penicilina, látex"
                  aria-label="Alergias"
                  className="border p-3 rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                />
              </div>

              <Button onClick={savePatient} disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                ) : (
                  editingPatient ? "Guardar Cambios" : "Guardar Paciente"
                )}
              </Button>

            </div>
          </DialogContent>
        </Dialog>

      </div>

      <ErrorBanner message={errorMessage} onClose={() => setErrorMessage("")} />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar paciente por nombre o DNI..."
          aria-label="Buscar paciente por nombre o DNI"
          className="border rounded-lg p-3 pl-9 pr-10 w-full dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setCurrentPage(1)
          }}
        />
        {search && (
          <button
            aria-label="Limpiar búsqueda"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            onClick={() => { setSearch(""); setCurrentPage(1) }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid gap-4">

        {isLoading && (
          <>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                  <div className="h-3 w-1/5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                </div>
              </div>
            ))}
          </>
        )}

        {!isLoading && filteredPatients.length === 0 && (
          <Card className="p-10 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col items-center text-center gap-3">
            <Users className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
            <p className="text-gray-500">
              {search
                ? `No se encontraron pacientes para "${search}".`
                : "Todavía no hay pacientes registrados."}
            </p>
            {!search && (
              <Button variant="outline" onClick={() => setOpen(true)}>
                Agregar primer paciente
              </Button>
            )}
          </Card>
        )}

        {!isLoading && paginatedPatients.map((patient) => (
          <Card key={patient.id} className="p-4 dark:bg-zinc-900 dark:border-zinc-800 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">

              <Link to={`/patients/${patient.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-gray-500 dark:text-gray-400 select-none">
                  {`${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {patient.first_name} {patient.last_name}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-gray-500">DNI: {patient.dni}</p>
                    {patient.birth_date && (
                      <p className="text-sm text-gray-400">· {calcAge(patient.birth_date)} años</p>
                    )}
                    {patient.phone && (
                      <p className="text-sm text-gray-400">· {patient.phone}</p>
                    )}
                  </div>
                  {patient.diseases && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {patient.diseases.split(", ").filter(Boolean).map((d) => (
                        <span key={d} className="text-xs bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 rounded-full px-2 py-0.5">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => openEditDialog(patient)}
                  aria-label="Editar paciente"
                >
                  <Pencil className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  onClick={() => setDeletingPatientId(patient.id)}
                  aria-label="Eliminar paciente"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

            </div>
          </Card>
        ))}

      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm text-gray-500 min-w-[60px] text-center">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

    </div>
  )
}

export default Patients
