import { useEffect, useState } from "react"

import { useParams } from "react-router-dom"

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

type Patient = {
  id: string
  first_name: string
  last_name: string
  dni: number
  phone: string

  age: number

  footwear: string
  diseases: string
  medications: string
  allergies: string

}

type MedicalRecord = {
  id: string
  diagnosis: string
  treatment: string
  observations: string
  visit_date: string
  before_image_url: string
  after_image_url: string
}

function PatientDetail() {

  const { id } = useParams()

  const [patient, setPatient] = useState<Patient | null>(null)

  const [records, setRecords] = useState<MedicalRecord[]>([])

  const [diagnosis, setDiagnosis] = useState("")
  const [treatment, setTreatment] = useState("")
  const [observations, setObservations] = useState("")
  const [beforeImage, setBeforeImage] = useState<File | null>(null)

  const [afterImage, setAfterImage] = useState<File | null>(null)


  const [open, setOpen] = useState(false)

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)

  async function getPatient() {

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.log(error)
      return
    }

    setPatient(data)
  }

  async function getRecords() {

    const { data, error } = await supabase
      .from("medical_records")
      .select("*")
      .eq("patient_id", id)
      .order("visit_date", {
        ascending: false
      })

    if (error) {
      console.log(error)
      return
    }

    setRecords(data || [])
  }

    async function uploadImage(
      file: File | null
    ) {

      if (!file) return null

      const fileName =
        `${Date.now()}-${file.name}`

      const { error } = await supabase
        .storage
        .from("clinical-images")
        .upload(fileName, file)

      if (error) {

        console.log(error)

        return null
      }

      const { data } = supabase
        .storage
        .from("clinical-images")
        .getPublicUrl(fileName)

      return data.publicUrl
    }

  async function createRecord() {
        const beforeImageUrl =
      await uploadImage(beforeImage)

    const afterImageUrl =
      await uploadImage(afterImage)

    const { error } = await supabase
      .from("medical_records")
      .insert({
        patient_id: id,

        diagnosis: diagnosis,
        treatment: treatment,
        observations: observations,

        before_image_url:
          beforeImageUrl,

        after_image_url:
          afterImageUrl,
      })

    if (error) {
      console.log(error)
      return
    }

    resetForm()

    getRecords()
  }

  async function updateRecord() {

    const { error } = await supabase
      .from("medical_records")
      .update({
        diagnosis: diagnosis,
        treatment: treatment,
        observations: observations,
      })
      .eq("id", editingRecordId)

    if (error) {
      console.log(error)
      return
    }

    resetForm()

    getRecords()
  }

  async function deleteRecord(recordId: string) {

  const confirmed = confirm(
    "¿Eliminar esta consulta?"
  )

  if (!confirmed) return

  const { error } = await supabase
    .from("medical_records")
    .delete()
    .eq("id", recordId)

  if (error) {
    console.log(error)
    return
  }

  getRecords()
}

  function resetForm() {
    setDiagnosis("")
    setTreatment("")
    setObservations("")

    setEditingRecordId(null)

    setOpen(false)
  }

  function handleEdit(record: MedicalRecord) {

    setDiagnosis(record.diagnosis)
    setTreatment(record.treatment)
    setObservations(record.observations)

    setEditingRecordId(record.id)

    setOpen(true)
  }

  useEffect(() => {

  async function loadData() {

    await getPatient()
    await getRecords()

  }

  loadData()

}, [])

  if (!patient) {
    return (
      <div className="p-10">
        Cargando paciente...
      </div>
    )
  }

  return (
    <div className="p-10">

      <Card className="p-8">

        <h1 className="text-4xl font-bold">
          {patient.first_name} {patient.last_name}
        </h1>

        <p className="text-gray-500 mt-4">
          DNI: {patient.dni}
        </p>

        <div className="grid grid-cols-2 gap-4 mt-6">

        <Card className="p-4 dark:bg-zinc-900 dark:border-zinc-800">

          <p className="text-sm text-gray-500">
            Edad
          </p>

          <p className="font-semibold mt-1">
            {patient.age || "-"}
          </p>

        </Card>

        <Card className="p-4 dark:bg-zinc-900 dark:border-zinc-800">

          <p className="text-sm text-gray-500">
            Calzado
          </p>

          <p className="font-semibold mt-1">
            {patient.footwear || "-"}
          </p>

        </Card>

        <Card className="p-4 dark:bg-zinc-900 dark:border-zinc-800">

          <p className="text-sm text-gray-500">
            Enfermedades
          </p>

          <p className="font-semibold mt-1">
            {patient.diseases || "-"}
          </p>

        </Card>

        <Card className="p-4 dark:bg-zinc-900 dark:border-zinc-800">

          <p className="text-sm text-gray-500">
            Medicamentos
          </p>

          <p className="font-semibold mt-1">
            {patient.medications || "-"}
          </p>

        </Card>

        <Card className="p-4 dark:bg-zinc-900 dark:border-zinc-800 col-span-2">

          <p className="text-sm text-gray-500">
            Alergias
          </p>

          <p className="font-semibold mt-1">
            {patient.allergies || "-"}
          </p>

        </Card>

      </div>  

      </Card>

      <div className="mt-8">

        <div className="flex items-center justify-between mb-4">

          <h2 className="text-2xl font-bold">
            Historial Clínico
          </h2>

          <Dialog
            open={open}
            onOpenChange={setOpen}
          >

            <DialogTrigger asChild>

              <Button>
                Nueva Consulta
              </Button>

            </DialogTrigger>

            <DialogContent>

              <DialogHeader>

                <DialogTitle>

                  {editingRecordId
                    ? "Editar Consulta"
                    : "Nueva Consulta"}

                </DialogTitle>

              </DialogHeader>

              <div className="flex flex-col gap-4 mt-4">

                <textarea
                  placeholder="Diagnóstico"
                  className="border rounded-lg p-4 min-h-[120px]"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />

                <textarea
                  placeholder="Tratamiento"
                  className="border rounded-lg p-4 min-h-[120px]"
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                />

                <textarea
                  placeholder="Observaciones"
                  className="border rounded-lg p-4 min-h-[120px]"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-4 mt-4">

                <label
                  className="
                    border-2 border-dashed rounded-xl p-6
                    flex flex-col items-center justify-center
                    cursor-pointer
                  "
                >

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {

                      if (!e.target.files?.[0]) return

                      setBeforeImage(
                        e.target.files[0]
                      )

                    }}
                  />

                  <p className="font-medium">
                    📷 Foto ANTES
                  </p>

                  {beforeImage && (

                    <p className="text-sm mt-2">

                      {beforeImage.name}

                    </p>

                  )}

                </label>

                <label
                  className="
                    border-2 border-dashed rounded-xl p-6
                    flex flex-col items-center justify-center
                    cursor-pointer
                  "
                >

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {

                      if (!e.target.files?.[0]) return

                      setAfterImage(
                        e.target.files[0]
                      )

                    }}
                  />

                  <p className="font-medium">
                    📷 Foto DESPUÉS
                  </p>

                  {afterImage && (

                    <p className="text-sm mt-2">

                      {afterImage.name}

                    </p>

                  )}

                </label>

              </div>

                <Button
                  onClick={
                    editingRecordId
                      ? updateRecord
                      : createRecord
                  }
                >

                  {editingRecordId
                    ? "Guardar Cambios"
                    : "Guardar Consulta"}

                </Button>

              </div>

            </DialogContent>

          </Dialog>

        </div>

        <div className="grid gap-4">

          {records.length === 0 && (
            <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">
              Todavía no hay consultas clínicas.
            </Card>
          )}

          {records.map((record) => (

            <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">

              <div className="flex items-start justify-between mb-4">

                <p className="text-sm text-gray-500">
                  {new Date(record.visit_date)
                    .toLocaleDateString("es-AR")}
                </p>

                <div className="flex gap-2">

                <Button
                    variant="outline"
                    onClick={() => handleEdit(record)}
                >
                    Editar
                </Button>

                <Button
                    variant="destructive"
                    onClick={() => deleteRecord(record.id)}
                >
                    Eliminar
                </Button>

</div>

              </div>

              <div className="space-y-4">

                <div>
                  <p className="font-semibold">
                    Diagnóstico
                  </p>

                  <p className="text-gray-600">
                    {record.diagnosis}
                  </p>
                </div>

                <div>
                  <p className="font-semibold">
                    Tratamiento
                  </p>

                  <p className="text-gray-600">
                    {record.treatment}
                  </p>
                </div>

                <div>
                  <p className="font-semibold">
                    Observaciones
                  </p>

                  <p className="text-gray-600">
                    {record.observations}
                    
                    <div className="flex gap-4 mt-4 flex-wrap">

                    {record.before_image_url && (

                      <div>

                        <p className="text-sm text-gray-500 mb-2">

                          Antes

                        </p>

                        <img
                          src={record.before_image_url}
                          alt="Antes"
                          className="
                            w-75
                            h-75
                            object-cover
                            rounded-xl
                            border
                          "
                        />

                      </div>

                    )}

                    {record.after_image_url && (

                      <div>

                        <p className="text-sm text-gray-500 mb-2">

                          Después

                        </p>

                        <img
                          src={record.after_image_url}
                          alt="Después"
                          className="
                            w-75
                            h-75
                            object-cover
                            rounded-xl
                            border
                          "
                        />

                      </div>

                    )}

                  </div>

                    
                  </p>
                </div>

              </div>

            </Card>

          ))}

        </div>

      </div>

    </div>
  )
}

export default PatientDetail