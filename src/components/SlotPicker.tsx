import { Lock } from "lucide-react"
import type { Appointment } from "../types"
import { loadSettings } from "../lib/settings"
import { generateSlots, getSlotStates } from "../lib/slotUtils"

type Props = {
  date: string
  appointments: Appointment[]
  value: string
  onChange: (t: string) => void
  excludeId?: string
}

export function SlotPicker({ date, appointments, value, onChange, excludeId }: Props) {
  const s = loadSettings()
  const workStart = s.workStart || "08:00"
  const workEnd   = s.workEnd   || "20:00"

  if (!date) {
    return (
      <p className="border rounded-lg p-4 text-center text-sm text-gray-400 dark:text-zinc-500 dark:border-zinc-700">
        Seleccioná una fecha para ver los horarios disponibles
      </p>
    )
  }

  const slots = generateSlots(workStart, workEnd)
  const bookedTimes = appointments
    .filter(a => a.appointment_date === date && a.id !== excludeId && a.status !== "Cancelado")
    .map(a => a.appointment_time)
  const states = getSlotStates(slots, bookedTimes)
  const sel = value.slice(0, 5)

  const todayStr = new Date().toISOString().split("T")[0]
  const isToday  = date === todayStr
  const nowMins  = new Date().getHours() * 60 + new Date().getMinutes()

  return (
    <div className="border rounded-lg p-3 dark:border-zinc-700">
      <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
        {slots.map(slot => {
          const state = states[slot]
          const isSelected = sel === slot
          const [sh, sm] = slot.split(":").map(Number)
          const isPast = isToday && (sh * 60 + sm) < nowMins
          const disabled = !isSelected && (state !== "free" || isPast)
          return (
            <button
              key={slot}
              type="button"
              disabled={disabled}
              onClick={() => onChange(slot)}
              title={
                isPast              ? "Horario ya pasado" :
                state === "occupied" ? "Turno ocupado" :
                state === "blocked"  ? "Bloqueado — turno en curso" :
                undefined
              }
              className={`flex items-center justify-center gap-0.5 py-2 rounded-lg text-xs font-medium border transition-colors
                ${isSelected
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                  : isPast
                    ? "bg-gray-50 dark:bg-zinc-800/40 text-gray-300 dark:text-zinc-700 border-gray-100 dark:border-zinc-800 cursor-not-allowed line-through"
                    : state === "occupied"
                      ? "bg-gray-100 dark:bg-zinc-700/50 text-gray-400 border-gray-200 dark:border-zinc-700 cursor-not-allowed"
                      : state === "blocked"
                        ? "bg-gray-50 dark:bg-zinc-800 text-gray-300 dark:text-zinc-600 border-gray-100 dark:border-zinc-800 cursor-not-allowed"
                        : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-zinc-500 cursor-pointer"
                }`}
            >
              {slot}{state === "blocked" && !isPast && <Lock className="h-2.5 w-2.5 ml-0.5 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
