// Pure journal -> Markdown serializer for the member's Google Drive copy.
// Every member-authored field in the stored entry JSON is written (RB-FIX-7 I-1).
export type JournalMarkdownInput = {
  date: Date
  mood?: string | null
  weight?: number | null
  entry: Record<string, unknown>
}

const SECTIONS: Array<[string, string]> = [
  ['reasonsValidation', 'Reflection'],
  ['affirmationGoal', 'Affirmation: my goal'],
  ['affirmationBecause', 'Affirmation: because'],
  ['affirmationMeans', 'Affirmation: the means'],
  ['peptideNotes', 'Peptides'],
  ['workoutNotes', 'Workouts'],
  ['nutritionNotes', 'Nutrition'],
  ['breathNotes', 'Breath'],
  ['moduleNotes', 'Modules'],
  // legacy keys written by older versions of the Drive copy
  ['goals', 'Goals for Today'],
  ['content', 'Entry'],
]

export function journalToMarkdown(input: JournalMarkdownInput): string {
  const dateStr = input.date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
  let out = `# Journal Entry - ${dateStr}\n\n`
  if (input.mood) out += `**Mood:** ${input.mood}\n\n`
  if (input.weight) out += `**Weight:** ${input.weight}\n\n`
  for (const [key, title] of SECTIONS) {
    const v = input.entry[key]
    if (typeof v === 'string' && v.trim()) out += `## ${title}\n${v.trim()}\n\n`
  }
  return out
}
