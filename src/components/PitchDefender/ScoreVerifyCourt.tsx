'use client'

// ScoreVerifyCourt — PLUMB A4 "court of record" read, PHONE-FIRST.
// Additive: a NEW sibling to ScoreVerify.tsx (the desktop drag-canvas). Touches nothing there.
// Shows the 5 BLOCKING Baritone suspects (crop + engraving claim + 2 independent vision reads +
// the question) and captures Jon's verdict per row. Vision = corroboration; Jon = court.
// The lock still flips ONLY via the verified repo pipeline — this records Jon's signed read.
import { useEffect, useState, useCallback } from 'react'

const engravingCrop = (measure: number) => `/score/crops/engraving-bari-m${String(measure).padStart(2, '0')}.png`

type Suspect = {
  id: string; measure: number; word: string; page: string; crop: string
  engraving: string; priority: string; claude: string; argus: string
  synthesis: string; lead: string; question: string
}
type SuspectDoc = { song: string; part: string; generated: string; lockState: string; suspects: Suspect[] }
type Verdict = { verdict: 'correct' | 'wrong' | null; correctedPitch?: string; note?: string }

const LS_KEY = 'scoreVerifyVerdicts.v1'

function priorityStyle(p: string) {
  if (/TOP|WRONG/i.test(p)) return 'bg-red-600 text-white'
  if (/FINE/i.test(p)) return 'bg-emerald-700 text-white'
  return 'bg-amber-500 text-black'
}

export default function ScoreVerifyCourt() {
  const [doc, setDoc] = useState<SuspectDoc | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [zoom, setZoom] = useState<string | null>(null)
  const [submit, setSubmit] = useState<{ state: 'idle' | 'saving' | 'done' | 'error'; msg?: string }>({ state: 'idle' })

  useEffect(() => {
    fetch('/score/lida-rose-suspects.json', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`fetch ${r.status}`); return r.json() })
      .then(setDoc)
      .catch((e) => setErr(String(e)))
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) setVerdicts(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  const set = useCallback((id: string, patch: Partial<Verdict>) => {
    setVerdicts((prev) => {
      const next = { ...prev, [id]: { ...(prev[id] || { verdict: null }), ...patch } }
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    setSubmit({ state: 'idle' })
  }, [])

  const decided = doc ? doc.suspects.filter((s) => verdicts[s.id]?.verdict).length : 0
  const total = doc?.suspects.length || 0

  async function sendRead() {
    if (!doc) return
    setSubmit({ state: 'saving' })
    const payload = {
      signedBy: 'Jon',
      verdicts: doc.suspects.map((s) => ({
        id: s.id, word: s.word, measure: s.measure, engraving: s.engraving,
        verdict: verdicts[s.id]?.verdict || null,
        correctedPitch: verdicts[s.id]?.correctedPitch || null,
        note: verdicts[s.id]?.note || null,
      })),
    }
    try {
      const r = await fetch('/api/score-verify/verdict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error(`save ${r.status}`)
      setSubmit({ state: 'done', msg: 'Read submitted. Claude will apply your verdicts, re-verify, and report back.' })
    } catch (e) {
      setSubmit({ state: 'error', msg: `Couldn't reach the server (${e}). Your read is saved on this phone — or just tell Claude the answers in chat.` })
    }
  }

  if (err) return <div className="min-h-screen bg-neutral-900 text-red-300 p-6">Couldn’t load suspects: {err}</div>
  if (!doc) return <div className="min-h-screen bg-neutral-900 text-neutral-300 flex items-center justify-center">Loading the court read…</div>

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100">
      {/* sticky header */}
      <header className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-bold leading-tight">{doc.song} — A4 Court Read</div>
            <div className="text-xs text-neutral-400">{doc.part} · you are the court of record</div>
          </div>
          <span className="shrink-0 rounded-full bg-red-600/20 text-red-300 border border-red-700 px-2.5 py-1 text-xs font-semibold">LOCK: RED</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded bg-neutral-800 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${total ? (decided / total) * 100 : 0}%` }} />
        </div>
        <div className="mt-1 text-xs text-neutral-400">{decided}/{total} decided</div>
      </header>

      <main className="px-4 py-4 max-w-xl mx-auto space-y-4 pb-32">
        <p className="text-sm text-neutral-300 leading-relaxed">
          The verifier narrowed 232 notes to <b>{total}</b> the machine couldn’t settle — they need your eyes on the page.
          Tap each crop to zoom. Mark <b>Correct</b> or <b>Wrong</b> (and the right pitch). Two independent eyes are shown as
          corroboration only — your call is the record.
        </p>

        {doc.suspects.map((s, i) => {
          const v = verdicts[s.id] || { verdict: null }
          return (
            <section key={s.id} className="rounded-2xl border border-neutral-800 bg-neutral-850 bg-neutral-800/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3">
                <div className="text-sm font-semibold">{i + 1}. “{s.word}” <span className="text-neutral-500 font-normal">· m{s.measure}</span></div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityStyle(s.priority)}`}>{s.priority}</span>
              </div>

              {/* OUR ENGRAVING vs THE PAGE — stacked for notehead comparison */}
              <div className="px-4 mt-2 space-y-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400 mb-1">our engraving · Baritone m{s.measure}</div>
                  <button onClick={() => setZoom(engravingCrop(s.measure))} className="block w-full bg-white rounded-lg overflow-hidden">
                    <img src={engravingCrop(s.measure)} alt={`our engraving of m${s.measure}`} className="w-full h-auto" loading="lazy" />
                  </button>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-400 mb-1">the printed page — tap to zoom</div>
                  <button onClick={() => setZoom(s.crop)} className="block w-full bg-white rounded-lg overflow-hidden">
                    <img src={s.crop} alt={`page crop for ${s.word}`} className="w-full h-auto" loading="lazy" />
                  </button>
                </div>
              </div>

              <div className="px-4 py-3 space-y-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs uppercase tracking-wide text-neutral-500">engraving says</span>
                  <span className="text-lg font-bold text-amber-300">{s.engraving}</span>
                </div>
                <p className="text-sm font-medium text-neutral-100">{s.question}</p>

                <details className="text-xs text-neutral-400">
                  <summary className="cursor-pointer select-none text-neutral-300">what the two eyes saw</summary>
                  <div className="mt-2 space-y-1">
                    <div><b>Claude:</b> {s.claude}</div>
                    <div><b>Argus:</b> {s.argus}</div>
                    <div className="text-neutral-300">{s.synthesis}</div>
                    <div className="text-emerald-300">{s.lead}</div>
                  </div>
                </details>

                {/* verdict */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => set(s.id, { verdict: 'correct', correctedPitch: '' })}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold border transition ${v.verdict === 'correct' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-200'}`}
                  >✓ Engraving correct</button>
                  <button
                    onClick={() => set(s.id, { verdict: 'wrong' })}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold border transition ${v.verdict === 'wrong' ? 'bg-red-600 border-red-400 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-200'}`}
                  >✗ Wrong</button>
                </div>
                {v.verdict === 'wrong' && (
                  <div className="space-y-2 pt-1">
                    <input
                      inputMode="text" autoCapitalize="characters" placeholder="right pitch — e.g. Eb3, Gb3"
                      value={v.correctedPitch || ''}
                      onChange={(e) => set(s.id, { correctedPitch: e.target.value })}
                      className="w-full min-h-[44px] rounded-xl bg-neutral-900 border border-neutral-700 px-3 text-base text-white placeholder-neutral-500"
                    />
                    <input
                      placeholder="note (optional) — rhythm, octave, anything"
                      value={v.note || ''}
                      onChange={(e) => set(s.id, { note: e.target.value })}
                      className="w-full min-h-[44px] rounded-xl bg-neutral-900 border border-neutral-700 px-3 text-sm text-white placeholder-neutral-500"
                    />
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </main>

      {/* sticky submit */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-neutral-950/95 backdrop-blur border-t border-neutral-800 px-4 py-3">
        <div className="max-w-xl mx-auto">
          {submit.state === 'done' ? (
            <div className="text-sm text-emerald-300 text-center py-2">✓ {submit.msg}</div>
          ) : (
            <>
              <button
                onClick={sendRead} disabled={submit.state === 'saving' || decided === 0}
                className="w-full min-h-[52px] rounded-2xl bg-emerald-600 disabled:bg-neutral-700 disabled:text-neutral-400 text-white text-base font-bold"
              >{submit.state === 'saving' ? 'Submitting…' : `Submit my read (${decided}/${total})`}</button>
              {submit.state === 'error' && <div className="mt-2 text-xs text-amber-300">{submit.msg}</div>}
            </>
          )}
        </div>
      </div>

      {/* zoom overlay */}
      {zoom && (
        <div onClick={() => setZoom(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3">
          <img src={zoom} alt="zoom" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 text-white text-2xl min-h-[44px] min-w-[44px]" onClick={() => setZoom(null)}>✕</button>
        </div>
      )}
    </div>
  )
}
