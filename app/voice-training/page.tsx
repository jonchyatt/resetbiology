import Link from "next/link"
import {
  ArrowRight,
  AudioLines,
  Gauge,
  Headphones,
  Music,
  Piano,
  ScrollText,
  Shield,
  Sparkles,
  Waves,
  type LucideIcon,
} from "lucide-react"
import { PortalHeader } from "@/components/Navigation/PortalHeader"

type ToolCard = {
  title: string
  href: string
  description: string
  icon: LucideIcon
  accent: string
  panel: string
}

const primaryTools: ToolCard[] = [
  {
    title: "Vocal Trainer III",
    href: "/pitch-defender/vocal-trainer-3",
    description: "Blast Mix for part practice, channel balance, live meters, and step-by-step guided singing.",
    icon: Gauge,
    accent: "text-amber-200",
    panel: "from-amber-600/20 to-cyan-700/20 border-amber-300/30",
  },
  {
    title: "Vocal Trainer II",
    href: "/pitch-defender/vocal-trainer-2",
    description: "Backward-chain phrase mastery from the end of a song back toward the beginning.",
    icon: AudioLines,
    accent: "text-cyan-200",
    panel: "from-cyan-600/20 to-teal-700/20 border-cyan-300/30",
  },
  {
    title: "Vocal Trainer",
    href: "/pitch-defender/vocal-trainer",
    description: "Upload a recording, extract the vocal line, and practice with dichotic left-right audio.",
    icon: Headphones,
    accent: "text-sky-200",
    panel: "from-sky-600/20 to-indigo-700/20 border-sky-300/30",
  },
]

const practiceTools: ToolCard[] = [
  {
    title: "Simply Sing",
    href: "/pitch-defender/simply-sing",
    description: "Karaoke-style pitch ribbons for composer songs with continuous piano backing.",
    icon: Waves,
    accent: "text-teal-200",
    panel: "from-teal-600/20 to-cyan-700/20 border-teal-300/30",
  },
  {
    title: "Choir Practice",
    href: "/pitch-defender/choir-practice",
    description: "Full-piece audition practice with lyric flow and guided pitch tracking.",
    icon: Music,
    accent: "text-indigo-200",
    panel: "from-indigo-600/20 to-violet-700/20 border-indigo-300/30",
  },
  {
    title: "Note Runner",
    href: "/pitch-defender/note-runner",
    description: "Self-paced staff scroll that waits until the sung target pitch is correct.",
    icon: Piano,
    accent: "text-lime-200",
    panel: "from-lime-600/20 to-emerald-700/20 border-lime-300/30",
  },
  {
    title: "Synthesia Runner",
    href: "/pitch-defender/synthesia",
    description: "Falling-note blocks for matching each pitch as it reaches the keyboard.",
    icon: Sparkles,
    accent: "text-fuchsia-200",
    panel: "from-fuchsia-600/20 to-violet-700/20 border-fuchsia-300/30",
  },
]

const bridgeTools: ToolCard[] = [
  {
    title: "Pitchforks III",
    href: "/pitch-defender/pitchforks-3",
    description: "Hold sung notes to burn each pitchfork tine in sequence.",
    icon: Shield,
    accent: "text-rose-200",
    panel: "from-rose-600/20 to-amber-700/20 border-rose-300/30",
  },
  {
    title: "Retro Blaster II",
    href: "/pitch-defender/retro-2",
    description: "Rebuilt arcade ear-trainer — sing or key the note carried by each descending alien.",
    icon: Sparkles,
    accent: "text-cyan-200",
    panel: "from-cyan-600/20 to-blue-700/20 border-cyan-300/30",
  },
  {
    title: "Lyrics Trainer",
    href: "/pitch-defender/lyrics-trainer",
    description: "Backward-chain lyric and monologue memory for vocal performance.",
    icon: ScrollText,
    accent: "text-orange-200",
    panel: "from-orange-600/20 to-yellow-700/20 border-orange-300/30",
  },
]

function ToolGrid({ tools }: { tools: ToolCard[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tools.map((tool) => {
        const Icon = tool.icon

        return (
          <Link
            key={tool.href}
            href={tool.href}
            className={`group rounded-lg border bg-gradient-to-br ${tool.panel} p-5 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:shadow-xl`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`rounded-lg border border-white/10 bg-black/20 p-3 ${tool.accent}`}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <ArrowRight className="mt-2 h-5 w-5 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-white/80" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-xl font-bold text-white">{tool.title}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-300">{tool.description}</p>
          </Link>
        )
      })}
    </div>
  )
}

export default function VoiceTrainingPage() {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.84)), url(/hero-background.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <PortalHeader
        section="Voice Training"
        subtitle="Vocal production, part practice, pitch lock, and song mastery"
        secondaryBackLink="/pitch-defender"
        secondaryBackText="Back to Pitch Defender"
        showPeptideInfo={false}
      />

      <main className="relative z-10 pt-32">
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase text-cyan-200">Music Training</p>
            <h1 className="mt-4 text-4xl font-bold text-white md:text-6xl">
              Voice Training
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-200 md:text-xl">
              A dedicated doorway for the vocal side of Pitch Defender: sing-through tools, dichotic practice, part-learning, pitch-lock games, and performance memory.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/pitch-defender/vocal-trainer-3"
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-cyan-300"
              >
                Open Vocal Trainer III
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/ear-training"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                Ear Training
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-amber-200">Core Vocal Trainers</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Build the voice first</h2>
            </div>
          </div>
          <ToolGrid tools={primaryTools} />
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase text-teal-200">Sing-Through Practice</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Practice songs, parts, and staff timing</h2>
          </div>
          <ToolGrid tools={practiceTools} />
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase text-rose-200">Bridge Tools</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Connect pitch lock to performance</h2>
          </div>
          <ToolGrid tools={bridgeTools} />
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-white/10 bg-black/35 p-5 shadow-lg shadow-black/20">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Full Pitch Defender hub</h2>
                <p className="mt-1 text-sm text-gray-300">Composition, score verification, rhythm, sight reading, dev tools, and the full game menu remain available.</p>
              </div>
              <Link
                href="/pitch-defender"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/25"
              >
                Open Pitch Defender
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export const metadata = {
  title: "Voice Training | Reset Biology",
  description: "Vocal production, part practice, pitch lock, and song mastery tools in Reset Biology.",
}
