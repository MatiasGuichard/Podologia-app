import { useEffect, useState } from "react"

import { Card } from "../components/ui/card"

import { supabase } from "../lib/supabase"

function Dashboard() {

  const [patientsCount, setPatientsCount] = useState(0)

  const [recordsCount, setRecordsCount] = useState(0)

  async function getStats() {

    const patientsResponse = await supabase
      .from("patients")
      .select("*", {
        count: "exact",
        head: true,
      })

    const recordsResponse = await supabase
      .from("medical_records")
      .select("*", {
        count: "exact",
        head: true,
      })

    setPatientsCount(
      patientsResponse.count || 0
    )

    setRecordsCount(
      recordsResponse.count || 0
    )
  }

  useEffect(() => {
    getStats()
  }, [])

  return (
    <div>

      <div className="mb-8">

        <h1 className="text-4xl font-bold">
          Dashboard
        </h1>

        <p className="text-gray-500 mt-2">
          Panel clínico de podología
        </p>

      </div>

      <div className="grid grid-cols-3 gap-6">

        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">

          <p className="text-gray-500">
            Pacientes
          </p>

          <h2 className="text-4xl font-bold mt-4">
            {patientsCount}
          </h2>

        </Card>

        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">

          <p className="text-gray-500">
            Consultas
          </p>

          <h2 className="text-4xl font-bold mt-4">
            {recordsCount}
          </h2>

        </Card>

        <Card className="p-6 dark:bg-zinc-900 dark:border-zinc-800">

          <p className="text-gray-500">
            Sistema
          </p>

          <h2 className="text-2xl font-bold mt-4">
            Online
          </h2>

        </Card>

      </div>

    </div>
  )
}

export default Dashboard