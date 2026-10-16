// Delete-entry rule (RB-FIX-7 I-5): remove what the member wrote, keep the
// system-written dose lines (peptideNotes) so dose history is not lost.
export function journalAfterDelete(entryJson: string | null | undefined):
  { keep: false } | { keep: true; entryJson: string } {
  let e: Record<string, unknown> = {}
  try { e = entryJson ? JSON.parse(entryJson) : {} } catch { e = {} }
  const dose = typeof e.peptideNotes === 'string' ? e.peptideNotes.trim() : ''
  if (!dose) return { keep: false }
  const tasks = Object.fromEntries(
    Object.entries((e.tasksCompleted as Record<string, boolean>) ?? {}).filter(([k]) => /pept/i.test(k)),
  )
  return { keep: true, entryJson: JSON.stringify({ peptideNotes: e.peptideNotes, localDate: e.localDate, tasksCompleted: tasks }) }
}
