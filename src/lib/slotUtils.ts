export function generateSlots(start: string, end: string): string[] {
  const slots: string[] = []
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  let mins = sh * 60 + sm
  const endMins = eh * 60 + em
  while (mins < endMins) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    mins += 15
  }
  return slots
}

export function getSlotStates(
  slots: string[],
  bookedTimes: string[]
): Record<string, "free" | "occupied" | "blocked"> {
  const states: Record<string, "free" | "occupied" | "blocked"> = {}
  for (const s of slots) states[s] = "free"
  for (const raw of bookedTimes) {
    const t = raw.slice(0, 5)
    if (states[t] !== undefined) states[t] = "occupied"
    const [h, m] = t.split(":").map(Number)
    const base = h * 60 + m
    for (const offset of [15, 30]) {
      const bm = base + offset
      const key = `${String(Math.floor(bm / 60)).padStart(2, "0")}:${String(bm % 60).padStart(2, "0")}`
      if (states[key] === "free") states[key] = "blocked"
    }
  }
  return states
}
