// Free-tool landing pages (/tools/[slug]). Off unless NEXT_PUBLIC_RB_TOOL_PAGES is exactly 'true'
// (project rule 15). Read as a literal so Next inlines it at build time.
export const TOOL_PAGES_ENABLED = process.env.NEXT_PUBLIC_RB_TOOL_PAGES === 'true'

export type ToolPage = {
  slug: string
  name: string
  // One honest paragraph. Every sentence is lifted from existing site copy (rule 10); src names the file.
  description: string
  src: string
  // The tool itself. Signed-out visitors are sent to sign in by the tool's own route.
  href: string
}

export const TOOL_PAGES: ToolPage[] = [
  {
    slug: 'breath',
    name: 'Breath Training',
    description: 'Guided breathing exercises.',
    src: 'app/breath/layout.tsx metadata',
    href: '/breath',
  },
  {
    slug: 'journal',
    name: 'Daily Journal',
    description:
      'Review your daily journal, peptides, nutrition, workouts, breath practice, and mindset modules in one place.',
    src: 'app/journal/page.tsx metadata',
    href: '/daily-history',
  },
  {
    slug: 'nutrition',
    name: 'Nutrition Tracker',
    description: 'Track meals, macros, and the daily targets you set.',
    src: 'app/nutrition/page.tsx metadata',
    href: '/nutrition',
  },
  {
    slug: 'workout',
    name: 'Workout Tracker',
    description:
      'Custom fitness programs with analytics. Track logged sessions, sets, reps, and training history.',
    src: 'app/workout/page.tsx metadata',
    href: '/workout',
  },
  {
    slug: 'ear-training',
    name: 'Ear Training',
    description: 'Free ear training: identify notes, pitch n-back and a resonance maze.',
    src: 'app/ear-training/layout.tsx metadata',
    href: '/ear-training',
  },
  // Vision training is left out: the repo carries no description of it (title only). Add an entry
  // once Jonathan supplies the wording.
]

export function getToolPage(slug: string): ToolPage | undefined {
  return TOOL_PAGES.find((t) => t.slug === slug)
}
