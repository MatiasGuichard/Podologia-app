import { useState } from "react"
import { Link } from "react-router-dom"
import {
  ChevronLeft, ChevronRight,
  Play, UserCheck, XCircle, User, Pencil, Trash2, CheckCircle2,
} from "lucide-react"
import { Card } from "./ui/card"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog"
import type { Appointment } from "../types"
import { loadSettings } from "../lib/settings"
import { generateSlots, getSlotStates } from "../lib/slotUtils"

const SLOT_HEIGHT = 40
const APT_HEIGHT  = SLOT_HEIGHT * 3

export type WeeklyCalendarViewProps = {
  appointments: Appointment[]
  onEditAppointment: (appointment: Appointment) => void
  onUpdateStatus: (id: string, status: string) => void
  onDeleteAppointment: (id: string) => void
  updatingStatusId: string | null
  onSlotClick: (date: string, time: string) => void
}

export function WeeklyCalendarView({
  appointments,
  onEditAppointment,
  onUpdateStatus,
  onDeleteAppointment,
  updatingStatusId,
  onSlotClick,
}: WeeklyCalendarViewProps) {
  const today = new Date().toISOString().split("T")[0]
  const nowMinsCalendar = new Date().getHours() * 60 + new Date().getMinutes()

  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    d.setHours(0, 0, 0, 0)
    return d
  })

  const [activeApt, setActiveApt] = useState<Appointment | null>(null)

  const s = loadSettings()
  const workStart = s.workStart || "08:00"
  const workEnd   = s.workEnd   || "20:00"
  const slots = generateSlots(workStart, workEnd)
  const totalHeight = slots.length * SLOT_HEIGHT

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  const isCurrentWeek = (() => {
    const now = new Date()
    const day = now.getDay()
    const mon = new Date(now)
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    mon.setHours(0, 0, 0, 0)
    return weekStart.getTime() === mon.getTime()
  })()

  function prevWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d)
  }
  function nextWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d)
  }
  function goToday() {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    d.setHours(0, 0, 0, 0)
    setWeekStart(d)
  }

  function slotTop(time: string): number {
    const [th, tm] = time.slice(0, 5).split(":").map(Number)
    const [wh, wm] = workStart.split(":").map(Number)
    return ((th * 60 + tm) - (wh * 60 + wm)) / 15 * SLOT_HEIGHT
  }

  function aptColor(apt: Appointment): string {
    const isPast   = apt.appointment_date < today
    const isMissed = isPast && (apt.status === "Pendiente" || apt.status === "Confirmado")
    if (isMissed)                     return "bg-orange-100 border-l-[3px] border-orange-400 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200"
    if (apt.status === "No vino")     return "bg-orange-100 border-l-[3px] border-orange-400 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200"
    if (apt.status === "Completado")  return "bg-emerald-200 border-l-[3px] border-emerald-600 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-100"
    if (apt.status === "Confirmado")  return "bg-green-100 border-l-[3px] border-green-400 text-green-900 dark:bg-green-950/60 dark:text-green-200"
    if (apt.status === "En atención") return "bg-violet-100 border-l-[3px] border-violet-400 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200"
    if (apt.status === "Cancelado")   return "bg-red-100 border-l-[3px] border-red-400 text-red-900 dark:bg-red-950/60 dark:text-red-200 opacity-60"
    return "bg-yellow-100 border-l-[3px] border-yellow-400 text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-200"
  }

  const weekLabel = (() => {
    const s2 = weekDays[0], e = weekDays[6]
    const same = s2.getMonth() === e.getMonth()
    return `${s2.toLocaleDateString("es-AR", same ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${e.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`
  })()

  const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
  const TIME_COL_W = 52

  function aptStatusBadge(status: string): { label: string; cls: string } {
    switch (status) {
      case "Confirmado":  return { label: "Confirmado",  cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" }
      case "En atención": return { label: "En atención", cls: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" }
      case "Completado":  return { label: "Completado",  cls: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" }
      case "Cancelado":   return { label: "Cancelado",   cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" }
      case "No vino":     return { label: "No vino",     cls: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" }
      default:            return { label: "Sin confirmar", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300" }
    }
  }

  function fmtPopupDate(date: string, time: string): string {
    const d = new Date(date + "T12:00:00")
    return `${d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })} · ${time.slice(0, 5)}`
  }

  return (
    <Card className="mb-6 dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">

      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevWeek} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextWeek} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <button onClick={goToday} className="ml-1 text-xs text-gray-400 hover:text-black dark:hover:text-white border border-gray-200 dark:border-zinc-700 rounded-md px-2 py-1 transition-colors">
              Hoy
            </button>
          )}
        </div>
        <span className="text-sm font-semibold capitalize">{weekLabel}</span>
        <div style={{ width: 80 }} />
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 620 }}>

          <div className="flex border-b dark:border-zinc-800">
            <div style={{ width: TIME_COL_W, flexShrink: 0 }} />
            {weekDays.map((d, i) => {
              const ds = toDateStr(d)
              const isToday = ds === today
              return (
                <div key={ds} className={`flex-1 text-center py-2 ${i > 0 ? "border-l dark:border-zinc-800" : ""}`}>
                  <p className="text-xs font-medium text-gray-400 dark:text-zinc-500">{DAY_NAMES[i]}</p>
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mt-0.5
                    ${isToday ? "bg-emerald-500 text-white" : "text-gray-700 dark:text-zinc-200"}
                  `}>
                    {d.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ height: 540, overflowY: "auto" }}>
            <div style={{ display: "flex", height: totalHeight }}>

              <div style={{ width: TIME_COL_W, flexShrink: 0, position: "relative" }}>
                {slots.map((slot, i) => (
                  slot.endsWith(":00") ? (
                    <div
                      key={slot}
                      style={{ position: "absolute", top: i * SLOT_HEIGHT, width: "100%", height: SLOT_HEIGHT }}
                      className="flex items-start justify-end pr-2 pt-0.5"
                    >
                      <span className="text-[10px] text-gray-400 dark:text-zinc-600 font-medium select-none leading-none">
                        {slot}
                      </span>
                    </div>
                  ) : null
                ))}
              </div>

              {weekDays.map((d, colIdx) => {
                const ds = toDateStr(d)
                const allDayApts = appointments.filter(a => a.appointment_date === ds)
                const activeApts = allDayApts.filter(a => a.status !== "Cancelado")
                const states = getSlotStates(slots, activeApts.map(a => a.appointment_time))

                return (
                  <div
                    key={ds}
                    style={{ flex: 1, position: "relative", height: totalHeight }}
                    className={colIdx > 0 ? "border-l dark:border-zinc-800" : ""}
                  >
                    {slots.map((slot, slotIdx) => {
                      const state = states[slot]
                      const isHour     = slot.endsWith(":00")
                      const isHalfHour = slot.endsWith(":30")
                      const isFree     = state === "free"
                      const isBlocked  = state === "blocked"
                      const [sh, sm]   = slot.split(":").map(Number)
                      const isPastSlot = ds < today || (ds === today && (sh * 60 + sm) < nowMinsCalendar)
                      const canClick   = isFree && !isPastSlot

                      return (
                        <div
                          key={slot}
                          style={{ position: "absolute", top: slotIdx * SLOT_HEIGHT, height: SLOT_HEIGHT, left: 0, right: 0 }}
                          className={[
                            isHour     ? "border-t border-gray-200 dark:border-zinc-700/70" :
                            isHalfHour ? "border-t border-gray-100 dark:border-zinc-800/80" :
                                         "border-t border-gray-50 dark:border-zinc-800/40",
                            canClick  ? "hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors" : "",
                            isBlocked ? "bg-gray-100/70 dark:bg-zinc-700/20 cursor-not-allowed" : "",
                            isPastSlot && isFree ? "bg-gray-50/80 dark:bg-zinc-800/20" : "",
                          ].join(" ")}
                          onClick={canClick ? () => onSlotClick(ds, slot) : undefined}
                        />
                      )
                    })}

                    {allDayApts.map((apt) => {
                      const top = slotTop(apt.appointment_time)
                      if (top < 0 || top >= totalHeight) return null
                      return (
                        <div
                          key={apt.id}
                          style={{ position: "absolute", top: top + 1, height: APT_HEIGHT - 2, left: 2, right: 2, zIndex: 10 }}
                          className={`group rounded-md overflow-hidden cursor-pointer ${aptColor(apt)}`}
                          onClick={() => setActiveApt(apt)}
                        >
                          <div className="px-1.5 py-1">
                            <p className="text-[11px] font-semibold leading-tight truncate">
                              {apt.patients?.first_name} {apt.patients?.last_name}
                            </p>
                            <p className="text-[10px] opacity-60 leading-tight mt-0.5">
                              {apt.appointment_time.slice(0, 5)}
                            </p>
                          </div>

                          {apt.status === "Pendiente" && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }} className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                className="flex-1 flex items-center justify-center py-1 bg-black/8 hover:bg-green-500/25 dark:bg-white/8 dark:hover:bg-green-500/25 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, "Confirmado") }}
                                title="Confirmar" disabled={updatingStatusId === apt.id}
                              >
                                <UserCheck className="h-3 w-3 text-green-700 dark:text-green-400" />
                              </button>
                              <button
                                className="flex-1 flex items-center justify-center py-1 bg-black/8 hover:bg-gray-500/20 dark:bg-white/8 dark:hover:bg-gray-500/20 border-l border-black/10 dark:border-white/10 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, "No vino") }}
                                title="No vino" disabled={updatingStatusId === apt.id}
                              >
                                <XCircle className="h-3 w-3 text-gray-600 dark:text-zinc-400" />
                              </button>
                            </div>
                          )}

                          {apt.status === "Confirmado" && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }} className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                className="flex-1 flex items-center justify-center py-1 bg-black/8 hover:bg-violet-500/25 dark:bg-white/8 dark:hover:bg-violet-500/25 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, "En atención") }}
                                title="Iniciar atención" disabled={updatingStatusId === apt.id}
                              >
                                <Play className="h-3 w-3 text-violet-700 dark:text-violet-400" />
                              </button>
                              <button
                                className="flex-1 flex items-center justify-center py-1 bg-black/8 hover:bg-gray-500/20 dark:bg-white/8 dark:hover:bg-gray-500/20 border-l border-black/10 dark:border-white/10 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, "No vino") }}
                                title="No vino" disabled={updatingStatusId === apt.id}
                              >
                                <XCircle className="h-3 w-3 text-gray-600 dark:text-zinc-400" />
                              </button>
                            </div>
                          )}

                          {apt.status === "En atención" && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }} className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                className="flex-1 flex items-center justify-center py-1 bg-black/8 hover:bg-emerald-500/25 dark:bg-white/8 dark:hover:bg-emerald-500/25 transition-colors"
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, "Completado") }}
                                title="Completado" disabled={updatingStatusId === apt.id}
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

            </div>
          </div>

        </div>
      </div>

      {activeApt && (
        <Dialog open onOpenChange={(v) => { if (!v) setActiveApt(null) }}>
          <DialogContent className="max-w-[280px] p-0 overflow-hidden gap-0">
            <DialogTitle className="sr-only">
              Turno — {activeApt.patients?.first_name} {activeApt.patients?.last_name}
            </DialogTitle>
            <div className="p-4 pb-3">
              <p className="font-bold text-base leading-tight">
                {activeApt.patients?.first_name} {activeApt.patients?.last_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                45m · {fmtPopupDate(activeApt.appointment_date, activeApt.appointment_time)}
              </p>
              <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${aptStatusBadge(activeApt.status).cls}`}>
                {aptStatusBadge(activeApt.status).label}
              </span>
              {activeApt.notes && (
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 leading-relaxed">{activeApt.notes}</p>
              )}
            </div>
            <div className="border-t dark:border-zinc-800 p-3 flex flex-col gap-1.5">
              <button
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/60 transition-colors text-left"
                onClick={() => { onUpdateStatus(activeApt.id, "Confirmado"); setActiveApt(null) }}
              >
                <UserCheck className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">Confirmar turno</span>
              </button>
              <button
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/60 transition-colors text-left"
                onClick={() => { onUpdateStatus(activeApt.id, "En atención"); setActiveApt(null) }}
              >
                <Play className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">Iniciar atención</span>
              </button>
              <button
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-left"
                onClick={() => { onUpdateStatus(activeApt.id, "No vino"); setActiveApt(null) }}
              >
                <XCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">No vino</span>
              </button>
            </div>
            <div className="border-t dark:border-zinc-800 p-3 flex flex-col gap-0.5">
              <Link
                to={`/patients/${activeApt.patient_id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => setActiveApt(null)}
              >
                <User className="h-4 w-4 shrink-0" />
                <span className="text-sm">Ver ficha del paciente</span>
              </Link>
              <button
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors w-full text-left"
                onClick={() => { setActiveApt(null); onEditAppointment(activeApt) }}
              >
                <Pencil className="h-4 w-4 shrink-0" />
                <span className="text-sm">Editar turno</span>
              </button>
              <button
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors w-full text-left"
                onClick={() => { setActiveApt(null); onDeleteAppointment(activeApt.id) }}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="text-sm">Eliminar turno</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
