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
  const [dni, setDni] = useState("")

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

  async function createPatient() {
    const { error } = await supabase
      .from("patients")
      .insert({
        first_name: firstName,
        last_name: lastName,
        dni: dni,
      })

    if (error) {
      console.log(error)
      return
    }

    setFirstName("")
    setLastName("")
    setDni("")

    getPatients()
  }

  useEffect(() => {
    getPatients()
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

        <Dialog>

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
                placeholder="DNI"
                className="border p-3 rounded-lg"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
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
         <Link to={`/patients/${patient.id}`}>

          <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">

          <h2 className="text-2xl font-semibold">
               {patient.first_name} {patient.last_name}
          </h2>

          <p className="text-gray-500 mt-2">
               DNI: {patient.dni}
          </p>

          </Card>

</Link>
        ))}

      </div>

    </div>
  )
}

export default Patients