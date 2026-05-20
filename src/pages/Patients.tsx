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

type Patient = {
  id: string
  first_name: string
  last_name: string
  dni: string
}

function Patients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [dni, setDni] = useState<number | "">("")
  const [age, setAge] = useState<number | "">("")
  const [footwear, setFootwear] = useState("")
  const [diseases, setDiseases] = useState("")
  const [medications, setMedications] = useState("")
  const [allergies, setAllergies] = useState("")
  const [open, setOpen] = useState(false)
  

  async function getPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")

    if (error) {
      console.log(error)
      return
    }

    setPatients(data || [])
  }

async function deletePatient(
  patientId: string
) {

  const confirmDelete =
    confirm(
      "¿Eliminar paciente?"
    )

  if (!confirmDelete) return

  const { error } = await supabase
    .from("patients")
    .delete()
    .eq("id", patientId)

  if (error) {
    console.log(error)
    return
  }

  getPatients()
}

async function createPatient() {

  const { data, error } = await supabase
    .from("patients")
    .insert({
      first_name: firstName,
      last_name: lastName,

      dni:
        dni === ""
          ? null
          : dni,

      age:
        age === ""
          ? null
          : age,

      footwear: footwear,
      diseases: diseases,
      medications: medications,
      allergies: allergies,
    })

  console.log(data)
  console.log(error)

  if (error) {
    return
  }

  getPatients()

  setFirstName("")
  setLastName("")
  setDni("")
  setAge("")
  setFootwear("")
  setDiseases("")
  setMedications("")
  setAllergies("")

  setOpen(false)

  
}

  useEffect(() => {

  async function loadPatients() {

    await getPatients()

  }

  loadPatients()

}, [])
  
  const filteredPatients = patients.filter((patient) => {

  const fullName =
    `${patient.first_name} ${patient.last_name}`
      .toLowerCase()

  return (
    fullName.includes(search.toLowerCase()) ||
    patient.dni.includes(search)
  )
})

  return (
    <div className="p-10">

      <div className="flex items-center justify-between mb-8">

        <div>
          <h1 className="text-4xl font-bold">
            Pacientes
          </h1>

          <p className="text-gray-500 mt-2">
            Gestión de pacientes
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={setOpen}
        >
          <DialogTrigger asChild>
            <Button>
              Nuevo Paciente
            </Button>
          </DialogTrigger>

          <DialogContent>

            <DialogHeader>
              <DialogTitle>
                Crear paciente
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 mt-4">

              <input
                placeholder="Nombre"
                className="border p-3 rounded-lg"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />

              <input
                placeholder="Apellido"
                className="border p-3 rounded-lg"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />

              <input
                type="number"
                placeholder="DNI"
                className="border p-3 rounded-lg"
                value={dni}
                onChange={(e) =>
                  setDni(
                  e.target.value === ""
                    ? ""
                    : Number(e.target.value)
                  )
                }
              />

              <input
                type="number"
                placeholder="Edad"
                className="border p-3 rounded-lg"
                value={age}
                onChange={(e) =>
                  setAge(
                    e.target.value === ""
                      ? ""
                      : Number(e.target.value)
                  )
                }
              />

              <select
                  className="border p-3 rounded-lg"
                  value={footwear}
                  onChange={(e) =>
                    setFootwear(e.target.value)
                  }
                >

                    <option value="">
                      Tipo de calzado
                    </option>

                    <option value="Ojota">
                      Ojota
                    </option>

                    <option value="Zapatillas">
                      Zapatillas
                    </option>

                    <option value="Zapatillas deportivas">
                      Zapatillas deportivas
                    </option>

                    <option value="Botines de seguridad">
                      Botines de seguridad
                    </option>

                    <option value="Botines deportivos">
                      Botines deportivos
                    </option>

                    <option value="Botas">
                      Botas
                    </option>

                </select>

                <select
                  className="border p-3 rounded-lg"
                  value={diseases}
                  onChange={(e) =>
                    setDiseases(e.target.value)
                  }
                >

                  <option value="">
                    Enfermedades
                  </option>

                  <option value="Tiroides">
                    Tiroides
                  </option>

                  <option value="Hipertensión">
                    Hipertensión
                  </option>

                  <option value="Diabetes Mellitus 1">
                    Diabetes Mellitus 1
                  </option>

                  <option value="Diabetes Mellitus 2">
                    Diabetes Mellitus 2
                  </option>

                </select>

                <select
                  className="border p-3 rounded-lg"
                  value={medications}
                  onChange={(e) =>
                    setMedications(e.target.value)
                  }
                >

                  <option value="">
                    Medicamentos
                  </option>

                  <option value="Anticoagulados">
                    Anticoagulados
                  </option>

                  <option value="Metformina">
                    Metformina
                  </option>

                </select>

                <input
                  placeholder="Alergias"
                  className="border p-3 rounded-lg"
                  value={allergies}
                  onChange={(e) =>
                    setAllergies(e.target.value)
                  }
                />


              <Button onClick={createPatient}>
                Guardar Paciente
              </Button>

            </div>

          </DialogContent>

        </Dialog>

      </div>

      <input
        type="text"
        placeholder="Buscar paciente por nombre o DNI..."
        className="border rounded-lg p-3 mb-4 w-full"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid gap-4">

        {filteredPatients.map((patient) => (
        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">

  <Link to={`/patients/${patient.id}`}>

    <h2 className="text-2xl font-semibold">

      {patient.first_name}
      {" "}
      {patient.last_name}

    </h2>

    <p className="text-gray-500 mt-2">

      DNI: {patient.dni}

    </p>

  </Link>

  <Button
    className="bg-red-500 hover:bg-red-600 mt-4"
    onClick={() =>
      deletePatient(patient.id)
    }
  >
    Eliminar
  </Button>

</Card>
        ))}

      </div>

    </div>
  )
}

export default Patients