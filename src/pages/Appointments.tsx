import { useEffect, useState } from "react"

import { supabase } from "../lib/supabase"

import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"

type Patient = {
  id: string
  first_name: string
  last_name: string
}

type Appointment = {
  id: string
  appointment_date: string
  appointment_time: string
  status: string
  notes: string

  patients: {
    first_name: string
    last_name: string
  }
}

function getStatusStyles(status: string) {

  switch (status) {

    case "Pendiente":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"

    case "Confirmado":
      return "bg-blue-100 text-blue-800 border-blue-200"

    case "Completado":
      return "bg-green-100 text-green-800 border-green-200"

    case "Cancelado":
      return "bg-red-100 text-red-800 border-red-200"

    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

function Appointments() {

  const [patients, setPatients] = useState<Patient[]>([])

  const [appointments, setAppointments] = useState<Appointment[]>([])

  const [patientId, setPatientId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")

  async function getPatients() {

    const { data } = await supabase
      .from("patients")
      .select("*")
      .order("first_name")

    setPatients(data || [])
  }

  async function getAppointments() {

    const { data } = await supabase
      .from("appointments")
      .select(`
        *,
        patients (
          first_name,
          last_name
        )
      `)
      .order("appointment_date", {
        ascending: true,
      })

    setAppointments(data || [])
  }

  async function createAppointment() {

    if (!patientId || !date || !time) {
      return
    }

    const { error } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        appointment_date: date,
        appointment_time: time,
        notes: notes,
      })

    if (error) {
      console.log(error)
      return
    }

    setPatientId("")
    setDate("")
    setTime("")
    setNotes("")

    getAppointments()
  }

  async function updateStatus(
  appointmentId: string,
  status: string
) {

  const { error } = await supabase
    .from("appointments")
    .update({
      status: status,
    })
    .eq("id", appointmentId)

  if (error) {
    console.log(error)
    return
  }

  getAppointments()
}

  useEffect(() => {
    getPatients()
    getAppointments()
  }, [])

  return (
    <div>

      <div className="mb-8">

        <h1 className="text-4xl font-bold">
          Turnos
        </h1>

        <p className="text-gray-500 mt-2">
          Gestión de agenda clínica
        </p>

      </div>

      <Card className="p-6 mb-8 dark:bg-zinc-900 dark:border-zinc-800">

        <h2 className="text-2xl font-bold mb-6">
          Nuevo Turno
        </h2>

        <div className="grid grid-cols-2 gap-4">

          <select
            className="border rounded-lg p-3 bg-transparent"
            value={patientId}
            onChange={(e) =>
              setPatientId(e.target.value)
            }
          >

            <option value="">
              Seleccionar paciente
            </option>

            {patients.map((patient) => (

              <option
                key={patient.id}
                value={patient.id}
              >

                {patient.first_name} {patient.last_name}

              </option>

            ))}

          </select>

          <input
            type="date"
            className="border rounded-lg p-3 bg-transparent"
            value={date}
            onChange={(e) =>
              setDate(e.target.value)
            }
          />

          <input
            type="time"
            className="border rounded-lg p-3 bg-transparent"
            value={time}
            onChange={(e) =>
              setTime(e.target.value)
            }
          />

          <input
            type="text"
            placeholder="Notas"
            className="border rounded-lg p-3 bg-transparent"
            value={notes}
            onChange={(e) =>
              setNotes(e.target.value)
            }
          />

        </div>

        <Button
          className="mt-4"
          onClick={createAppointment}
        >
          Guardar Turno
        </Button>

      </Card>

      <div className="grid gap-4">

        {appointments.map((appointment) => (

          <Card
            key={appointment.id}
            className="p-6 dark:bg-zinc-900 dark:border-zinc-800"
          >

            <div className="flex justify-between items-start">

              <div>

                <h2 className="text-xl font-bold">

                  {appointment.patients.first_name}
                  {" "}
                  {appointment.patients.last_name}

                </h2>

                <p className="text-gray-500 mt-1">

                  {new Date(
                    appointment.appointment_date
                  ).toLocaleDateString("es-AR")}

                  {" - "}

                  {appointment.appointment_time}

                </p>

              </div>

             <select
                className={`
                    px-3 py-2 rounded-xl text-sm border
                    font-medium outline-none
                    ${getStatusStyles(appointment.status)}
                `}
                value={appointment.status}
                onChange={(e) =>
                    updateStatus(
                    appointment.id,
                    e.target.value
                    )
                }
                >

                <option value="Pendiente">
                    Pendiente
                </option>

                <option value="Confirmado">
                    Confirmado
                </option>

                <option value="Completado">
                    Completado
                </option>

                <option value="Cancelado">
                    Cancelado
                </option>

                </select>

            </div>

            {appointment.notes && (

              <p className="mt-4 text-gray-500">

                {appointment.notes}

              </p>

            )}

          </Card>

        ))}

      </div>

    </div>
  )
}

export default Appointments