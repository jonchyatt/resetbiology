/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'

const SCALE = 6
const BASE = '/images/pitchforks'

function Sprite({ name, w, h, label }: { name: string; w: number; h: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={`${BASE}/${name}`}
        alt={name}
        width={w * SCALE}
        height={h * SCALE}
        style={{ imageRendering: 'pixelated', background: 'rgba(0,0,0,0.25)' }}
      />
      <div className="text-[10px] text-gray-500 font-mono">{label || name}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-sm uppercase tracking-widest text-indigo-300 mb-3 border-b border-indigo-900/50 pb-1">{title}</h2>
      <div className="flex flex-wrap gap-6 items-end">{children}</div>
    </section>
  )
}

export default function PitchforksSpritePreview() {
  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/pitch-defender" className="text-xs text-indigo-400 hover:text-indigo-200">← Back to Pitch Defender</Link>
        <h1 className="text-2xl font-bold mt-2 mb-1">Pitchforks Sprite Atlas — Placeholder Preview</h1>
        <p className="text-sm text-gray-400 mb-8">
          AI-generated placeholder pixel art (Python/PIL). Native pixel size scaled 6x for inspection.
          Polish later — these are wireframes for shape + anchor verification, not finished art.
          Forks are a <strong>separate layer</strong> that composites over villagers at runtime.
        </p>

        <Section title="Frankenstein — side view (32x48, 4-frame strips)">
          <Sprite name="frankenstein_idle.png"     w={128} h={48} label="frankenstein_idle (4 frames)" />
          <Sprite name="frankenstein_charging.png" w={128} h={48} label="frankenstein_charging (4 frames)" />
        </Section>

        <Section title="Frankenstein — FPS view (64x96)">
          <Sprite name="frankenstein_fps.png" w={64} h={96} />
        </Section>

        <Section title="Villager 2-tine (16x24)">
          <Sprite name="villager_2tine_walk.png"      w={64} h={24} label="walk → right (4f)" />
          <Sprite name="villager_2tine_walk_left.png" w={64} h={24} label="walk → left (4f)" />
          <Sprite name="villager_2tine_burned_1.png"  w={16} h={24} label="burned 1" />
          <Sprite name="villager_2tine_ash.png"       w={16} h={24} label="ash" />
        </Section>

        <Section title="Villager 3-tine">
          <Sprite name="villager_3tine_walk.png"      w={64} h={24} label="walk → right" />
          <Sprite name="villager_3tine_walk_left.png" w={64} h={24} label="walk → left" />
          <Sprite name="villager_3tine_burned_1.png"  w={16} h={24} label="burned 1" />
          <Sprite name="villager_3tine_burned_2.png"  w={16} h={24} label="burned 2" />
          <Sprite name="villager_3tine_ash.png"       w={16} h={24} label="ash" />
        </Section>

        <Section title="Villager 4-tine">
          <Sprite name="villager_4tine_walk.png"      w={64} h={24} label="walk → right" />
          <Sprite name="villager_4tine_walk_left.png" w={64} h={24} label="walk → left" />
          <Sprite name="villager_4tine_burned_1.png"  w={16} h={24} label="burned 1" />
          <Sprite name="villager_4tine_burned_2.png"  w={16} h={24} label="burned 2" />
          <Sprite name="villager_4tine_burned_3.png"  w={16} h={24} label="burned 3" />
          <Sprite name="villager_4tine_ash.png"       w={16} h={24} label="ash" />
        </Section>

        <Section title="Forks 2-tine — separate layer (8x16)">
          <Sprite name="fork_2tine_b0.png"      w={8} h={16} label="full" />
          <Sprite name="fork_2tine_b0_glow.png" w={8} h={16} label="full · GLOW" />
          <Sprite name="fork_2tine_b1.png"      w={8} h={16} label="-1" />
          <Sprite name="fork_2tine_b2.png"      w={8} h={16} label="-2" />
        </Section>

        <Section title="Forks 3-tine">
          <Sprite name="fork_3tine_b0.png"      w={8} h={16} label="full" />
          <Sprite name="fork_3tine_b0_glow.png" w={8} h={16} label="GLOW" />
          <Sprite name="fork_3tine_b1.png"      w={8} h={16} label="-1" />
          <Sprite name="fork_3tine_b2.png"      w={8} h={16} label="-2" />
          <Sprite name="fork_3tine_b3.png"      w={8} h={16} label="-3" />
        </Section>

        <Section title="Forks 4-tine">
          <Sprite name="fork_4tine_b0.png"      w={8} h={16} label="full" />
          <Sprite name="fork_4tine_b0_glow.png" w={8} h={16} label="GLOW" />
          <Sprite name="fork_4tine_b1.png"      w={8} h={16} label="-1" />
          <Sprite name="fork_4tine_b2.png"      w={8} h={16} label="-2" />
          <Sprite name="fork_4tine_b3.png"      w={8} h={16} label="-3" />
          <Sprite name="fork_4tine_b4.png"      w={8} h={16} label="-4" />
        </Section>

        <Section title="FPS Villager — far / mid / near (4-frame strips)">
          <Sprite name="villager_fps_far.png"  w={64}  h={24} label="far · 16x24" />
          <Sprite name="villager_fps_mid.png"  w={96}  h={32} label="mid · 24x32" />
          <Sprite name="villager_fps_near.png" w={128} h={48} label="near · 32x48" />
        </Section>

        <Section title="Composite preview PNG">
          <img
            src={`${BASE}/preview.png`}
            alt="composite"
            style={{ imageRendering: 'pixelated', maxWidth: '100%' }}
          />
        </Section>

        <div className="mt-12 p-4 border border-amber-700/40 bg-amber-950/20 rounded text-xs text-amber-200">
          <strong>For the artist:</strong> All these PNGs live in <code>public/images/pitchforks/</code>.
          Edit them in Aseprite/Piskel at native size — do NOT pre-scale. The game scales x3 in canvas.
          Anchors live in the sibling <code>.json</code> files (rod_tip, fork_base, tines, etc.) — keep those
          coordinates accurate when you redraw, or update them to match the new sprite.
        </div>
      </div>
    </div>
  )
}
