import { useEffect, useReducer, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ChevronLeft, ChevronRight, Loader2, ClipboardList, CalendarOff, ImagePlus, Calendar, Trash2 } from "lucide-react"
import Toast from "../components/Toast"
import ConfirmDialog from "../components/ConfirmDialog"
import { supabase } from "../lib/supabase"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
import type { Patient, MedicalRecord, Appointment } from "../types"
import { getStatusStyles } from "../lib/statusStyles"
import { formatDate, calcAge } from "../lib/dateUtils"
import { getStoragePath } from "../lib/storageUtils"
import ErrorBanner from "../components/ErrorBanner"
import { useToast } from "../hooks/useToast"

type FormErrors = { diagnosis?: string; treatment?: string }

type State = {
  patient: Patient | null
  records: MedicalRecord[]
  appointments: Appointment[]
  currentPage: number
  isLoadingPatient: boolean
  isLoadingRecords: boolean
  isLoadingAppointments: boolean
  errorMessage: string
  form: {
    open: boolean
    visitDate: string
    diagnosis: string
    treatment: string
    observations: string
    beforeImage: File | null
    afterImage: File | null
    errors: FormErrors
    editingRecordId: string | null
    editingRecord: MedicalRecord | null
  }
}

type Action =
  | { type: "PATIENT_LOADED"; payload: Patient }
  | { type: "PATIENT_ERROR" }
  | { type: "RECORDS_LOADING" }
  | { type: "RECORDS_LOADED"; payload: MedicalRecord[] }
  | { type: "RECORDS_ERROR" }
  | { type: "APPOINTMENTS_LOADED"; payload: Appointment[] }
  | { type: "APPOINTMENTS_ERROR" }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "SET_PAGE"; payload: number }
  | { type: "SET_FIELD"; field: "diagnosis" | "treatment" | "observations" | "visitDate"; value: string }
  | { type: "SET_BEFORE_IMAGE"; payload: File }
  | { type: "SET_AFTER_IMAGE"; payload: File }
  | { type: "SET_FORM_ERRORS"; payload: FormErrors }
  | { type: "CLEAR_FORM_ERROR"; field: "diagnosis" | "treatment" }
  | { type: "OPEN_DIALOG" }
  | { type: "EDIT_RECORD"; payload: MedicalRecord }
  | { type: "RESET_FORM" }
  | { type: "RESET_STATE" }

const initialForm: State["form"] = {
  open: false,
  visitDate: "",
  diagnosis: "",
  treatment: "",
  observations: "",
  beforeImage: null,
  afterImage: null,
  errors: {},
  editingRecordId: null,
  editingRecord: null,
}

const initialState: State = {
  patient: null,
  records: [],
  appointments: [],
  currentPage: 1,
  isLoadingPatient: true,
  isLoadingRecords: true,
  isLoadingAppointments: true,
  errorMessage: "",
  form: initialForm,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "PATIENT_LOADED":
      return { ...state, patient: action.payload, isLoadingPatient: false }
    case "PATIENT_ERROR":
      return { ...state, isLoadingPatient: false }
    case "RECORDS_LOADING":
      return { ...state, records: [], isLoadingRecords: true }
    case "RECORDS_LOADED":
      return { ...state, records: action.payload, isLoadingRecords: false }
    case "RECORDS_ERROR":
      return { ...state, isLoadingRecords: false }
    case "APPOINTMENTS_LOADED":
      return { ...state, appointments: action.payload, isLoadingAppointments: false }
    case "APPOINTMENTS_ERROR":
      return { ...state, isLoadingAppointments: false }
    case "SET_ERROR":
      return { ...state, errorMessage: action.payload }
    case "CLEAR_ERROR":
      return { ...state, errorMessage: "" }
    case "SET_PAGE":
      return { ...state, currentPage: action.payload }
    case "SET_FIELD":
      return { ...state, form: { ...state.form, [action.field]: action.value } }
    case "SET_BEFORE_IMAGE":
      return { ...state, form: { ...state.form, beforeImage: action.payload } }
    case "SET_AFTER_IMAGE":
      return { ...state, form: { ...state.form, afterImage: action.payload } }
    case "SET_FORM_ERRORS":
      return { ...state, form: { ...state.form, errors: action.payload } }
    case "CLEAR_FORM_ERROR":
      return { ...state, form: { ...state.form, errors: { ...state.form.errors, [action.field]: undefined } } }
    case "OPEN_DIALOG":
      return {
        ...state,
        form: {
          ...initialForm,
          open: true,
          visitDate: new Date().toISOString().split("T")[0],
        },
      }
    case "EDIT_RECORD":
      return {
        ...state,
        form: {
          ...initialForm,
          open: true,
          visitDate: action.payload.visit_date,
          diagnosis: action.payload.diagnosis,
          treatment: action.payload.treatment,
          observations: action.payload.observations,
          editingRecordId: action.payload.id,
          editingRecord: action.payload,
        },
      }
    case "RESET_FORM":
      return { ...state, form: initialForm }
    case "RESET_STATE":
      return initialState
    default:
      return state
  }
}

const RECORDS_PER_PAGE = 5

function PatientDetail() {

  const { id } = useParams()
  const [state, dispatch] = useReducer(reducer, initialState)
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)
  const { toast, showToast, clearToast } = useToast()
  const [apptDialogOpen, setApptDialogOpen] = useState(false)
  const [apptDate, setApptDate] = useState("")
  const [apptTime, setApptTime] = useState("")
  const [apptNotes, setApptNotes] = useState("")
  const [apptErrors, setApptErrors] = useState<{ date?: string; time?: string }>({})
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false)
  const [isSubmittingAppt, setIsSubmittingAppt] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const {
    patient,
    records,
    appointments,
    currentPage,
    isLoadingPatient,
    isLoadingRecords,
    isLoadingAppointments,
    errorMessage,
    form,
  } = state

  async function getPatient() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      dispatch({ type: "SET_ERROR", payload: "No se pudo cargar el paciente." })
      dispatch({ type: "PATIENT_ERROR" })
      return
    }

    dispatch({ type: "PATIENT_LOADED", payload: data })
  }

  async function getRecords() {
    dispatch({ type: "RECORDS_LOADING" })

    const { data, error } = await supabase
      .from("medical_records")
      .select("*")
      .eq("patient_id", id)
      .order("visit_date", { ascending: false })

    if (error) {
      dispatch({ type: "SET_ERROR", payload: "No se pudo cargar el historial clínico." })
      dispatch({ type: "RECORDS_ERROR" })
      return
    }

    dispatch({ type: "RECORDS_LOADED", payload: data || [] })
  }

  async function getAppointments() {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", id)
      .order("appointment_date", { ascending: false })

    if (error) {
      dispatch({ type: "APPOINTMENTS_ERROR" })
      return
    }

    dispatch({ type: "APPOINTMENTS_LOADED", payload: data || [] })
  }

  async function uploadImage(file: File | null): Promise<string | null> {
    if (!file) return null

    const fileName = `${Date.now()}-${file.name}`

    const { error } = await supabase.storage
      .from("clinical-images")
      .upload(fileName, file)

    if (error) {
      dispatch({ type: "SET_ERROR", payload: "No se pudo subir la imagen." })
      return null
    }

    const { data } = supabase.storage.from("clinical-images").getPublicUrl(fileName)
    return data.publicUrl
  }

  function validateForm(): boolean {
    const errors: FormErrors = {}

    if (!form.diagnosis.trim())
      errors.diagnosis = "El diagnóstico es obligatorio"

    if (!form.treatment.trim())
      errors.treatment = "El tratamiento es obligatorio"

    if (Object.keys(errors).length > 0) {
      dispatch({ type: "SET_FORM_ERRORS", payload: errors })
      return false
    }

    return true
  }

  async function createRecord() {
    if (!validateForm()) return
    setIsSubmittingRecord(true)

    const beforeImageUrl = await uploadImage(form.beforeImage)
    const afterImageUrl = await uploadImage(form.afterImage)

    const { error } = await supabase.from("medical_records").insert({
      patient_id: id,
      visit_date: form.visitDate || new Date().toISOString().split("T")[0],
      diagnosis: form.diagnosis,
      treatment: form.treatment,
      observations: form.observations,
      before_image_url: beforeImageUrl,
      after_image_url: afterImageUrl,
    })
    setIsSubmittingRecord(false)

    if (error) {
      dispatch({ type: "SET_ERROR", payload: "No se pudo guardar la consulta." })
      return
    }

    dispatch({ type: "RESET_FORM" })
    dispatch({ type: "SET_PAGE", payload: 1 })
    showToast("Consulta guardada.", "success")
    getRecords()
  }

  async function updateRecord() {
    if (!validateForm()) return
    setIsSubmittingRecord(true)

    const beforeImageUrl = form.beforeImage
      ? await uploadImage(form.beforeImage)
      : form.editingRecord?.before_image_url ?? null

    const afterImageUrl = form.afterImage
      ? await uploadImage(form.afterImage)
      : form.editingRecord?.after_image_url ?? null

    const { error } = await supabase
      .from("medical_records")
      .update({
        visit_date: form.visitDate,
        diagnosis: form.diagnosis,
        treatment: form.treatment,
        observations: form.observations,
        before_image_url: beforeImageUrl,
        after_image_url: afterImageUrl,
      })
      .eq("id", form.editingRecordId)
    setIsSubmittingRecord(false)

    if (error) {
      dispatch({ type: "SET_ERROR", payload: "No se pudieron guardar los cambios." })
      return
    }

    dispatch({ type: "RESET_FORM" })
    showToast("Consulta actualizada.", "success")
    getRecords()
  }

  async function createAppointment() {
    const errors: typeof apptErrors = {}
    if (!apptDate) errors.date = "La fecha es obligatoria"
    if (!apptTime) errors.time = "El horario es obligatorio"
    if (Object.keys(errors).length > 0) {
      setApptErrors(errors)
      return
    }
    setApptErrors({})
    setIsSubmittingAppt(true)

    const { error } = await supabase.from("appointments").insert({
      patient_id: id,
      appointment_date: apptDate,
      appointment_time: apptTime,
      notes: apptNotes,
    })
    setIsSubmittingAppt(false)

    if (error) {
      showToast("No se pudo guardar el turno.", "error")
      return
    }

    setApptDialogOpen(false)
    setApptDate("")
    setApptTime("")
    setApptNotes("")
    showToast("Turno agendado.", "success")
    getAppointments()
  }

  async function confirmDeleteRecord() {
    if (!deletingRecordId) return

    const record = records.find((r) => r.id === deletingRecordId)
    const recordId = deletingRecordId
    setDeletingRecordId(null)

    if (record) {
      const paths = [
        getStoragePath(record.before_image_url),
        getStoragePath(record.after_image_url),
      ].filter((p): p is string => p !== null)

      if (paths.length > 0) {
        await supabase.storage.from("clinical-images").remove(paths)
      }
    }

    const { error } = await supabase
      .from("medical_records")
      .delete()
      .eq("id", recordId)

    if (error) {
      showToast("No se pudo eliminar la consulta.", "error")
      return
    }

    showToast("Consulta eliminada.", "success")
    getRecords()
  }

  useEffect(() => {
    if (!lightboxUrl) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [lightboxUrl])

  useEffect(() => {
    dispatch({ type: "RESET_STATE" })
    Promise.all([getPatient(), getRecords(), getAppointments()])
  }, [id])

  if (isLoadingPatient) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 w-64 rounded-lg bg-gray-200 dark:bg-zinc-800 animate-pulse" />
        <div className="h-64 rounded-2xl bg-gray-200 dark:bg-zinc-800 animate-pulse" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-800 dark:bg-red-950">
          <p className="text-red-700 dark:text-red-400 font-medium">
            No se pudo cargar el paciente. Verificá tu conexión e intentá de nuevo.
          </p>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(records.length / RECORDS_PER_PAGE)

  return (
    <div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={clearToast} />
      )}

      <ConfirmDialog
        open={deletingRecordId !== null}
        title="¿Eliminar esta consulta?"
        description="Se eliminarán también las imágenes asociadas."
        onConfirm={confirmDeleteRecord}
        onCancel={() => setDeletingRecordId(null)}
      />

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Vista completa"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            aria-label="Cerrar imagen"
            className="absolute top-4 right-4 text-white text-2xl font-bold hover:opacity-70 leading-none"
            onClick={() => setLightboxUrl(null)}
          >
            ✕
          </button>
        </div>
      )}

      <Link
        to="/patients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white mb-6 transition-colors border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800"
      >
        <ChevronLeft size={15} />
        Volver a pacientes
      </Link>

      <ErrorBanner message={errorMessage} onClose={() => dispatch({ type: "CLEAR_ERROR" })} />

      <Card className="p-6">

        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xl font-bold text-gray-500 dark:text-gray-400 select-none">
            {`${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              {patient.first_name} {patient.last_name}
            </h1>
            <div className="flex gap-6 mt-1">
              <p className="text-gray-500">DNI: {patient.dni}</p>
              {patient.phone && (
                <p className="text-gray-500">Tel: {patient.phone}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 divide-y divide-gray-100 dark:divide-zinc-800">

          <div className="grid grid-cols-2 gap-8 py-3">
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Edad</p>
              <p className="font-medium">
                {patient.birth_date
                  ? `${calcAge(patient.birth_date)} años`
                  : patient.age
                    ? `${patient.age} años`
                    : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Calzado</p>
              <p className="font-medium">{patient.footwear || "-"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 py-3">
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Enfermedades</p>
              {patient.diseases
                ? <div className="flex flex-wrap gap-1 mt-1">
                    {patient.diseases.split(", ").filter(Boolean).map((d) => (
                      <span key={d} className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-0.5 text-sm">{d}</span>
                    ))}
                  </div>
                : <p className="font-medium">-</p>
              }
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Medicamentos</p>
              {patient.medications
                ? <div className="flex flex-wrap gap-1 mt-1">
                    {patient.medications.split(", ").filter(Boolean).map((m) => (
                      <span key={m} className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-0.5 text-sm">{m}</span>
                    ))}
                  </div>
                : <p className="font-medium">-</p>
              }
            </div>
          </div>

          <div className="py-3">
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Alergias</p>
            <p className="font-medium">{patient.allergies || "-"}</p>
          </div>

        </div>

      </Card>

      <div className="mt-8">

        <div className="flex items-center justify-between mb-4">

          <h2 className="text-2xl font-bold flex items-center gap-2">
            Historial Clínico
            {!isLoadingRecords && (
              <span className="text-sm font-medium text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">
                {records.length}
              </span>
            )}
          </h2>

          <Dialog
            open={form.open}
            onOpenChange={(val) => {
              if (!val) dispatch({ type: "RESET_FORM" })
              else dispatch({ type: "OPEN_DIALOG" })
            }}
          >

            <DialogTrigger asChild>
              <Button>Nueva Consulta</Button>
            </DialogTrigger>

            <DialogContent>

              <DialogHeader>
                <DialogTitle>
                  {form.editingRecordId ? "Editar Consulta" : "Nueva Consulta"}
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-col gap-4 mt-4">

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Fecha de visita</label>
                  <input
                    type="date"
                    aria-label="Fecha de visita"
                    className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    value={form.visitDate}
                    onChange={(e) =>
                      dispatch({ type: "SET_FIELD", field: "visitDate", value: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <textarea
                    placeholder="Diagnóstico *"
                    aria-label="Diagnóstico"
                    autoFocus
                    className={`border rounded-lg p-4 min-h-[120px] dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${form.errors.diagnosis ? "border-red-500" : "dark:border-zinc-700"}`}
                    value={form.diagnosis}
                    onChange={(e) => {
                      dispatch({ type: "SET_FIELD", field: "diagnosis", value: e.target.value })
                      if (form.errors.diagnosis)
                        dispatch({ type: "CLEAR_FORM_ERROR", field: "diagnosis" })
                    }}
                  />
                  {form.errors.diagnosis && (
                    <p className="text-red-500 text-sm">{form.errors.diagnosis}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <textarea
                    placeholder="Tratamiento *"
                    aria-label="Tratamiento"
                    className={`border rounded-lg p-4 min-h-[120px] dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${form.errors.treatment ? "border-red-500" : "dark:border-zinc-700"}`}
                    value={form.treatment}
                    onChange={(e) => {
                      dispatch({ type: "SET_FIELD", field: "treatment", value: e.target.value })
                      if (form.errors.treatment)
                        dispatch({ type: "CLEAR_FORM_ERROR", field: "treatment" })
                    }}
                  />
                  {form.errors.treatment && (
                    <p className="text-red-500 text-sm">{form.errors.treatment}</p>
                  )}
                </div>

                <textarea
                  placeholder="Observaciones"
                  aria-label="Observaciones"
                  className="border rounded-lg p-4 min-h-[120px] dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={form.observations}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "observations", value: e.target.value })
                  }
                />

                <div className="grid grid-cols-2 gap-4 mt-4">

                  <label className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      aria-label="Foto antes del tratamiento"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (!file.type.startsWith("image/")) {
                          showToast("Solo se permiten imágenes.", "error")
                          return
                        }
                        dispatch({ type: "SET_BEFORE_IMAGE", payload: file })
                      }}
                    />
                    <ImagePlus className="h-6 w-6 text-gray-400" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Foto ANTES</p>
                      {form.beforeImage
                        ? <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[110px]">{form.beforeImage.name}</p>
                        : <p className="text-xs text-gray-400">Seleccionar imagen</p>
                      }
                    </div>
                  </label>

                  <label className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      aria-label="Foto después del tratamiento"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (!file.type.startsWith("image/")) {
                          showToast("Solo se permiten imágenes.", "error")
                          return
                        }
                        dispatch({ type: "SET_AFTER_IMAGE", payload: file })
                      }}
                    />
                    <ImagePlus className="h-6 w-6 text-gray-400" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Foto DESPUÉS</p>
                      {form.afterImage
                        ? <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[110px]">{form.afterImage.name}</p>
                        : <p className="text-xs text-gray-400">Seleccionar imagen</p>
                      }
                    </div>
                  </label>

                </div>

                <Button onClick={form.editingRecordId ? updateRecord : createRecord} disabled={isSubmittingRecord}>
                  {isSubmittingRecord ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                  ) : (
                    form.editingRecordId ? "Guardar Cambios" : "Guardar Consulta"
                  )}
                </Button>

              </div>

            </DialogContent>

          </Dialog>

        </div>

        <div className="grid gap-4">

          {isLoadingRecords && (
            <>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-32 rounded-xl bg-gray-200 dark:bg-zinc-800 animate-pulse"
                />
              ))}
            </>
          )}

          {!isLoadingRecords && records.length === 0 && (
            <Card className="p-10 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col items-center text-center gap-3">
              <ClipboardList className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
              <p className="text-gray-500">Todavía no hay consultas clínicas.</p>
              <Button variant="outline" onClick={() => dispatch({ type: "OPEN_DIALOG" })}>
                Registrar primera consulta
              </Button>
            </Card>
          )}

          {!isLoadingRecords && records
            .slice(
              (currentPage - 1) * RECORDS_PER_PAGE,
              currentPage * RECORDS_PER_PAGE
            )
            .map((record) => (

            <Card key={record.id} className="p-6 dark:bg-zinc-900 dark:border-zinc-800">

              <div className="flex items-start justify-between mb-4">

                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(record.visit_date)}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => dispatch({ type: "EDIT_RECORD", payload: record })}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    onClick={() => setDeletingRecordId(record.id)}
                    aria-label="Eliminar consulta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

              </div>

              <div className="divide-y divide-gray-100 dark:divide-zinc-800">

                <div className="pb-4">
                  <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Diagnóstico</p>
                  <p className="text-gray-700 dark:text-gray-300">{record.diagnosis}</p>
                </div>

                <div className="py-4">
                  <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Tratamiento</p>
                  <p className="text-gray-700 dark:text-gray-300">{record.treatment}</p>
                </div>

                {(record.observations || record.before_image_url || record.after_image_url) && (
                  <div className="pt-4">
                    {record.observations && (
                      <>
                        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Observaciones</p>
                        <p className="text-gray-700 dark:text-gray-300">{record.observations}</p>
                      </>
                    )}

                    {(record.before_image_url || record.after_image_url) && (
                      <div className="flex gap-4 mt-4 flex-wrap">

                        {record.before_image_url && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Antes</p>
                            <img
                              src={record.before_image_url}
                              alt="Antes"
                              className="w-48 h-48 object-cover rounded-xl border cursor-zoom-in hover:opacity-90 transition-opacity"
                              onClick={() => setLightboxUrl(record.before_image_url!)}
                            />
                          </div>
                        )}

                        {record.after_image_url && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Después</p>
                            <img
                              src={record.after_image_url}
                              alt="Después"
                              className="w-48 h-48 object-cover rounded-xl border cursor-zoom-in hover:opacity-90 transition-opacity"
                              onClick={() => setLightboxUrl(record.after_image_url!)}
                            />
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )}

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
              onClick={() => dispatch({ type: "SET_PAGE", payload: currentPage - 1 })}
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
              onClick={() => dispatch({ type: "SET_PAGE", payload: currentPage + 1 })}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

      </div>

      <div className="mt-8">

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Turnos
            {!isLoadingAppointments && (
              <span className="text-sm font-medium text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">
                {appointments.length}
              </span>
            )}
          </h2>

          <Dialog
            open={apptDialogOpen}
            onOpenChange={(val) => {
              setApptDialogOpen(val)
              if (!val) { setApptDate(""); setApptTime(""); setApptNotes(""); setApptErrors({}) }
              else { setApptDate(new Date().toISOString().split("T")[0]) }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">Nuevo Turno</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Turno</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Fecha <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    aria-label="Fecha del turno"
                    className={`border rounded-lg p-3 dark:bg-zinc-800 dark:text-white ${apptErrors.date ? "border-red-500" : "dark:border-zinc-700"}`}
                    value={apptDate}
                    onChange={(e) => { setApptDate(e.target.value); setApptErrors((p) => ({ ...p, date: undefined })) }}
                  />
                  {apptErrors.date && <p className="text-red-500 text-sm">{apptErrors.date}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-500">Horario <span className="text-red-400">*</span></label>
                  <input
                    type="time"
                    aria-label="Horario del turno"
                    className={`border rounded-lg p-3 dark:bg-zinc-800 dark:text-white ${apptErrors.time ? "border-red-500" : "dark:border-zinc-700"}`}
                    value={apptTime}
                    onChange={(e) => { setApptTime(e.target.value); setApptErrors((p) => ({ ...p, time: undefined })) }}
                  />
                  {apptErrors.time && <p className="text-red-500 text-sm">{apptErrors.time}</p>}
                </div>
                <input
                  type="text"
                  placeholder="Notas (opcional)"
                  aria-label="Notas del turno"
                  className="border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  value={apptNotes}
                  onChange={(e) => setApptNotes(e.target.value)}
                />
                <Button onClick={createAppointment} disabled={isSubmittingAppt}>
                  {isSubmittingAppt ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Turno"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">

          {isLoadingAppointments && (
            <>
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-gray-200 dark:bg-zinc-800 animate-pulse"
                />
              ))}
            </>
          )}

          {!isLoadingAppointments && appointments.length === 0 && (
            <Card className="p-10 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col items-center text-center gap-3">
              <CalendarOff className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
              <p className="text-gray-500">No hay turnos registrados.</p>
              <Button variant="outline" onClick={() => { setApptDialogOpen(true); setApptDate(new Date().toISOString().split("T")[0]) }}>
                Agendar primer turno
              </Button>
            </Card>
          )}

          {!isLoadingAppointments && appointments.map((appointment) => (
            <Card key={appointment.id} className="p-4 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    {formatDate(appointment.appointment_date)}
                    {" — "}
                    {appointment.appointment_time}
                  </div>
                  {appointment.notes && (
                    <p className="text-sm text-gray-500 mt-1">{appointment.notes}</p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-xl text-sm border font-medium ${getStatusStyles(appointment.status)}`}>
                  {appointment.status}
                </span>
              </div>
            </Card>
          ))}

        </div>

      </div>

    </div>
  )
}

export default PatientDetail
