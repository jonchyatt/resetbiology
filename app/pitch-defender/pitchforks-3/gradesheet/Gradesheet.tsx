'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import styles from './gradesheet.module.css'

const STORAGE_KEY = 'pf3-procedure-gradesheet-v1'
const DRAFT_SAVED_MESSAGE = 'Draft saved on this phone; screenshots must be reattached after reload.'
const STORAGE_ERROR_MESSAGE = 'Draft storage is unavailable on this phone. Your current form will stay in this tab, but it cannot be restored after reload.'
const MAX_NOTE_LENGTH = 2000
const MAX_NAME_LENGTH = 80
const MAX_DEVICE_LENGTH = 160
const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024
const ACCEPTED_SCREENSHOT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type GradeStatus = 'not-tested' | 'pass' | 'fail'
type GradeItemId = 'staff-visible' | 'heard-marker' | 'drawer-switch' | 'phone-layout'

type ScreenshotAttachment = {
  file: File
  name: string
  type: string
  size: number
  previewUrl: string
}

type GradeItem = {
  id: GradeItemId
  title: string
  do: string
  passIf: string
  failIf: string
  status: GradeStatus
  notes: string
  screenshot: ScreenshotAttachment | null
  screenshotError: string
}

type Receipt = {
  id: string
  savedAt: string | null
}

const ITEM_DEFINITIONS: ReadonlyArray<Pick<GradeItem, 'id' | 'title' | 'do' | 'passIf' | 'failIf'>> = [
  {
    id: 'staff-visible',
    title: 'Staff target is visible',
    do: 'Open the live target and look at the STAFF panel.',
    passIf: 'STAFF shows five lines, the clef, and a nonblank target note.',
    failIf: 'Any line, the clef, or the target note is missing or blank.',
  },
  {
    id: 'heard-marker',
    title: 'Heard marker follows the voice',
    do: 'Sing a comfortable note while watching Staff. Gently move a little higher and lower, then stop.',
    passIf: 'Your marker moves up as your pitch rises and down as it falls; it shows the note you actually sing, including its octave.',
    failIf: 'The marker is missing, moves in the opposite direction, shows a different octave than the sung note, or silence earns a match.',
  },
  {
    id: 'drawer-switch',
    title: 'STAFF and OPTIONS switch cleanly',
    do: 'Tap STAFF, then OPTIONS, then STAFF several times.',
    passIf: 'The staff repaints each time and only the selected panel is visible.',
    failIf: 'Panels overlap, the staff disappears, or a switch leaves stale content on screen.',
  },
  {
    id: 'phone-layout',
    title: 'Phone layout stays usable',
    do: 'Use iPhone portrait; rotate and return if comfortable.',
    passIf: 'Controls are readable and reachable, with no clipping and no large logo obscuring the controls.',
    failIf: 'Any control is clipped, hard to reach or read, or hidden by the logo.',
  },
]

const STATUS_OPTIONS: ReadonlyArray<{ value: GradeStatus; label: string; mark: string }> = [
  { value: 'not-tested', label: 'Not checked', mark: '·' },
  { value: 'pass', label: 'Pass', mark: '✓' },
  { value: 'fail', label: 'Fail', mark: '×' },
]

function createInitialItems(): GradeItem[] {
  return ITEM_DEFINITIONS.map(item => ({
    ...item,
    status: 'not-tested',
    notes: '',
    screenshot: null,
    screenshotError: '',
  }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isGradeStatus(value: unknown): value is GradeStatus {
  return value === 'not-tested' || value === 'pass' || value === 'fail'
}

function isGradeItemId(value: unknown): value is GradeItemId {
  return ITEM_DEFINITIONS.some(item => item.id === value)
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The screenshot could not be previewed.'))
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('The screenshot preview was empty.'))
      }
    }
    reader.readAsDataURL(file)
  })
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)))
  }

  return btoa(binary)
}

function screenshotErrorFor(file: File): string | null {
  if (!ACCEPTED_SCREENSHOT_TYPES.has(file.type)) {
    return 'Screenshot must be JPEG, PNG, or WebP. This file was not attached.'
  }

  if (file.size > MAX_SCREENSHOT_BYTES) {
    return 'Screenshot must be 4 MiB or smaller. This file was not attached.'
  }

  if (file.name.length > MAX_NAME_LENGTH) {
    return 'Screenshot filename must be 80 characters or fewer. This file was not attached.'
  }

  return null
}

export default function Gradesheet() {
  const [items, setItems] = useState<GradeItem[]>(createInitialItems)
  const [tester, setTester] = useState('')
  const [device, setDevice] = useState('iPhone / Safari')
  const [draftReady, setDraftReady] = useState(false)
  const [draftNotice, setDraftNotice] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [previewPendingIds, setPreviewPendingIds] = useState<ReadonlySet<GradeItemId>>(() => new Set())
  const previewPendingRef = useRef(new Set<GradeItemId>())

  const persistDraft = useCallback((nextItems: ReadonlyArray<GradeItem>) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: nextItems.map(item => ({
          id: item.id,
          status: item.status,
          notes: item.notes,
        })),
      }))
      setStorageError(null)
      setDraftNotice(DRAFT_SAVED_MESSAGE)
    } catch {
      setDraftNotice(null)
      setStorageError(STORAGE_ERROR_MESSAGE)
    }
  }, [])

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(STORAGE_KEY)

      if (rawDraft) {
        const parsed: unknown = JSON.parse(rawDraft)
        if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
          throw new Error('Saved draft has an unexpected shape.')
        }

        const savedItems = new Map<GradeItemId, { status: GradeStatus; notes: string }>()
        for (const candidate of parsed.items) {
          if (!isRecord(candidate) || !isGradeItemId(candidate.id) || !isGradeStatus(candidate.status) || typeof candidate.notes !== 'string') {
            continue
          }

          savedItems.set(candidate.id, {
            status: candidate.status,
            notes: candidate.notes.slice(0, MAX_NOTE_LENGTH),
          })
        }

        if (savedItems.size > 0) {
          setItems(current => current.map(item => {
            const saved = savedItems.get(item.id)
            return saved ? { ...item, ...saved } : item
          }))
        }
      }
    } catch {
      setStorageError(STORAGE_ERROR_MESSAGE)
    } finally {
      setDraftReady(true)
    }
  }, [])

  useEffect(() => {
    if (draftReady) persistDraft(items)
  }, [draftReady, items, persistDraft])

  const reviewedCount = useMemo(
    () => items.filter(item => item.status !== 'not-tested').length,
    [items],
  )

  const updateItem = useCallback((id: GradeItemId, patch: Partial<Pick<GradeItem, 'status' | 'notes'>>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
    setSubmitError(null)
    setReceipt(null)
  }, [])

  const updateScreenshotError = useCallback((id: GradeItemId, message: string) => {
    setItems(current => current.map(item => item.id === id ? { ...item, screenshotError: message } : item))
    setSubmitError(null)
    setReceipt(null)
  }, [])

  const setPreviewPending = useCallback((id: GradeItemId, pending: boolean) => {
    if (pending) previewPendingRef.current.add(id)
    else previewPendingRef.current.delete(id)
    setPreviewPendingIds(new Set(previewPendingRef.current))
  }, [previewPendingRef])

  const handleScreenshotChange = useCallback(async (id: GradeItemId, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validationError = screenshotErrorFor(file)
    if (validationError) {
      updateScreenshotError(id, validationError)
      return
    }

    setPreviewPending(id, true)
    try {
      const previewUrl = await fileToDataUrl(file)
      setItems(current => current.map(item => item.id === id ? {
        ...item,
        screenshot: {
          file,
          name: file.name,
          type: file.type,
          size: file.size,
          previewUrl,
        },
        screenshotError: '',
      } : item))
      setSubmitError(null)
      setReceipt(null)
    } catch (error) {
      updateScreenshotError(id, error instanceof Error ? error.message : 'The screenshot could not be previewed. This file was not attached.')
    } finally {
      setPreviewPending(id, false)
    }
  }, [setPreviewPending, updateScreenshotError])

  const removeScreenshot = useCallback((id: GradeItemId) => {
    setItems(current => current.map(item => item.id === id ? {
      ...item,
      screenshot: null,
      screenshotError: '',
    } : item))
    setSubmitError(null)
    setReceipt(null)
  }, [])

  const saveDraftBeforeNavigation = useCallback(() => {
    if (draftReady) persistDraft(items)
  }, [draftReady, items, persistDraft])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setReceipt(null)

    if (previewPendingRef.current.size > 0) {
      setSubmitError('Wait for the screenshot preview to finish before submitting.')
      return
    }

    if (reviewedCount === 0) {
      setSubmitError('Choose Pass or Fail for at least one procedure item before submitting.')
      return
    }

    const itemWithScreenshotError = items.find(item => item.screenshotError)
    if (itemWithScreenshotError) {
      setSubmitError(`Fix the screenshot for “${itemWithScreenshotError.title}” before submitting.`)
      return
    }

    setIsSubmitting(true)

    try {
      const serializedItems = await Promise.all(items.map(async item => ({
        id: item.id,
        status: item.status,
        notes: item.notes.slice(0, MAX_NOTE_LENGTH),
        ...(item.screenshot ? {
          screenshot: {
            name: item.screenshot.name,
            type: item.screenshot.type,
            data: await fileToBase64(item.screenshot.file),
          },
        } : {}),
      })))

      const response = await fetch('/api/pitchforks-gradesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          tester: tester.slice(0, MAX_NAME_LENGTH).trim(),
          device: device.slice(0, MAX_DEVICE_LENGTH).trim(),
          items: serializedItems,
        }),
      })

      const body: unknown = await response.json().catch(() => null)
      const serverMessage = isRecord(body) && typeof body.error === 'string'
        ? body.error
        : isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string'
          ? body.error.message
          : null
      if (!response.ok || !isRecord(body) || typeof body.id !== 'string' || serverMessage) {
        const message = serverMessage ?? 'The gradesheet could not be saved. Your entries and screenshots are still here; try again.'
        throw new Error(message)
      }

      setReceipt({
        id: body.id,
        savedAt: typeof body.savedAt === 'string' ? body.savedAt : null,
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'The gradesheet could not be saved. Your entries and screenshots are still here; try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [device, items, previewPendingRef, reviewedCount, tester])

  return (
    <main className={styles.page} data-testid="pf3-gradesheet">
      <div className={styles.shell}>
        <nav className={styles.topBar} aria-label="Gradesheet navigation">
          <span className={styles.eyebrow}>PITCHFORKS III · PRIVATE DEV CHECK</span>
          <Link
            className={styles.gameLink}
            href="/pitch-defender/pitchforks-3"
            target="_blank"
            rel="noopener noreferrer"
            onClick={saveDraftBeforeNavigation}
          >
            Open game ↗
          </Link>
        </nav>

        <header className={styles.header}>
          <h1>Procedure Gradesheet</h1>
          <p className={styles.intro}>
            The only outstanding check here is the Staff visual test. The prior eight-row singer tests remain passed. Record what you observe on the live Pitchforks III surface. This report does not change your game progress.
          </p>
        </header>

        <section className={styles.progressCard} aria-labelledby="gradesheet-progress-title">
          <div>
            <p className={styles.progressLabel} id="gradesheet-progress-title">Review progress</p>
            <p className={styles.progressValue}>{reviewedCount} of {ITEM_DEFINITIONS.length} reviewed</p>
          </div>
          <p className={styles.progressHelp}>
            {reviewedCount === 0 ? 'Choose Pass or Fail for at least one item to submit.' : 'You can submit with a partial review; unchecked items remain Not checked.'}
            <br />Reviewed count is a checklist count. This report does not change your game progress.
          </p>
        </section>

        {(draftNotice || storageError) && (
          <div className={storageError ? styles.storageError : styles.draftNotice} role={storageError ? 'alert' : 'status'} aria-live="polite">
            {storageError ?? draftNotice}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <section className={styles.panel} aria-labelledby="reviewer-details-title">
            <div className={styles.sectionHeading}>
              <h2 id="reviewer-details-title">Who is checking?</h2>
            </div>
            <div className={styles.metaGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Tester <span className={styles.optional}>(optional)</span></span>
                <input
                  className={styles.textInput}
                  type="text"
                  value={tester}
                  maxLength={MAX_NAME_LENGTH}
                  disabled={isSubmitting}
                  onChange={event => {
                    setTester(event.target.value.slice(0, MAX_NAME_LENGTH))
                    setSubmitError(null)
                    setReceipt(null)
                  }}
                  placeholder="Name or initials"
                  autoComplete="name"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Device</span>
                <input
                  className={styles.textInput}
                  type="text"
                  value={device}
                  maxLength={MAX_DEVICE_LENGTH}
                  disabled={isSubmitting}
                  onChange={event => {
                    setDevice(event.target.value.slice(0, MAX_DEVICE_LENGTH))
                    setSubmitError(null)
                    setReceipt(null)
                  }}
                  placeholder="iPhone / Safari"
                  autoComplete="off"
                />
              </label>
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="procedure-items-title">
            <div className={styles.sectionHeading}>
              <h2 id="procedure-items-title">Procedure checks</h2>
              <p className={styles.sectionHelp}>Pass and Fail are recorded observations. This report does not change your game progress.</p>
            </div>

            <div className={styles.itemList}>
              {items.map((item, index) => (
                <fieldset className={styles.item} key={item.id}>
                  <legend className={styles.itemLegend}>
                    <span className={styles.itemIndex}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.itemState}>{STATUS_OPTIONS.find(option => option.value === item.status)?.label}</span>
                  </legend>
                  <dl className={styles.guidance}>
                    <div className={styles.guidanceRow}>
                      <dt>Do</dt>
                      <dd>{item.do}</dd>
                    </div>
                    <div className={styles.guidanceRow}>
                      <dt>Pass if</dt>
                      <dd>{item.passIf}</dd>
                    </div>
                    <div className={styles.guidanceRow}>
                      <dt>Fail if</dt>
                      <dd>{item.failIf}</dd>
                    </div>
                  </dl>

                  <div className={styles.statusGroup} role="radiogroup" aria-label={`Result for ${item.title}`}>
                    {STATUS_OPTIONS.map(option => {
                      const checked = item.status === option.value
                      return (
                        <label className={`${styles.statusOption} ${checked ? styles.statusOptionSelected : ''} ${isSubmitting ? styles.statusOptionDisabled : ''}`} key={option.value}>
                          <input
                            type="radio"
                            name={`status-${item.id}`}
                            value={option.value}
                            checked={checked}
                            disabled={isSubmitting}
                            onChange={() => updateItem(item.id, { status: option.value })}
                            data-testid={`pf3-gradesheet-status-${item.id}-${option.value}`}
                          />
                          <span className={styles.statusMark} aria-hidden="true">{checked ? option.mark : ''}</span>
                          <span>{option.label}</span>
                        </label>
                      )
                    })}
                  </div>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Notes <span className={styles.optional}>(optional)</span></span>
                    <textarea
                      className={styles.textarea}
                      value={item.notes}
                      maxLength={MAX_NOTE_LENGTH}
                      disabled={isSubmitting}
                      onChange={event => updateItem(item.id, { notes: event.target.value.slice(0, MAX_NOTE_LENGTH) })}
                      placeholder="What did you observe?"
                      aria-describedby={`${item.id}-notes-count`}
                    />
                    <span className={styles.fieldMeta} id={`${item.id}-notes-count`}>{item.notes.length} / {MAX_NOTE_LENGTH}</span>
                  </label>

                  <div className={styles.attachmentBlock}>
                    <label className={styles.fileField}>
                      <span className={styles.fieldLabel}>Screenshot <span className={styles.optional}>(optional)</span></span>
                      <input
                        className={styles.fileInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={isSubmitting || previewPendingIds.has(item.id)}
                        onChange={event => { void handleScreenshotChange(item.id, event) }}
                        aria-describedby={`${item.id}-screenshot-help`}
                      />
                      <span className={styles.fieldMeta} id={`${item.id}-screenshot-help`}>JPEG, PNG, or WebP · max 4 MiB. The selected image stays local until you submit.</span>
                    </label>

                    {item.screenshotError && <p className={styles.error} role="alert">{item.screenshotError}</p>}

                    {(item.screenshot || item.screenshotError) && (
                      <div className={styles.screenshotCard}>
                        {item.screenshot ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element -- this is a local, user-selected preview rather than a page asset. */}
                            <img className={styles.preview} src={item.screenshot.previewUrl} alt={`${item.title} screenshot preview`} />
                            <div className={styles.screenshotDetails}>
                              <strong>{item.screenshot.name}</strong>
                              <span>{item.screenshot.type} · {formatBytes(item.screenshot.size)}</span>
                              <span className={styles.localLabel}>{receipt ? 'Included in received gradesheet' : 'Attached locally · not sent yet'}</span>
                            </div>
                          </>
                        ) : (
                          <div className={styles.screenshotDetails}>
                            <strong>No screenshot attached</strong>
                            <span>Skip this optional evidence and submit the notes instead.</span>
                          </div>
                        )}
                        <button className={styles.removeButton} type="button" disabled={isSubmitting || previewPendingIds.has(item.id)} onClick={() => removeScreenshot(item.id)}>
                          {item.screenshot ? 'Remove screenshot' : 'Remove/skip screenshot'}
                        </button>
                      </div>
                    )}
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

          <section className={styles.submitPanel} aria-labelledby="submit-title">
            <div>
              <h2 id="submit-title">Send this review</h2>
              <p className={styles.submitCopy}>Sends notes and selected screenshots to this computer’s private D: drive. No audio recorded.</p>
            </div>

            {submitError && <p className={styles.error} role="alert">{submitError}</p>}
            {receipt && (
              <div className={styles.receipt} role="status" aria-live="polite">
                <strong>Receipt received: {receipt.id}</strong>
                <span>{receipt.savedAt ? `Saved at ${receipt.savedAt}. ` : ''}Saved on this computer. Tell Codex “gradesheet submitted” so I can review it.</span>
                <span>This confirms the gradesheet was received. This report does not change your game progress.</span>
              </div>
            )}

            <button
              className={styles.submitButton}
              type="submit"
              disabled={isSubmitting || reviewedCount === 0 || previewPendingIds.size > 0}
              data-testid="pf3-gradesheet-submit"
            >
              {isSubmitting ? 'Sending gradesheet…' : previewPendingIds.size > 0 ? 'Preparing screenshot…' : 'Submit gradesheet'}
            </button>
            <p className={styles.retryHelp}>If saving fails, the form and attached files stay here so you can retry.</p>
          </section>
        </form>

        <footer className={styles.footer}>
          <Link
            className={styles.backLink}
            href="/pitch-defender/pitchforks-3"
            target="_blank"
            rel="noopener noreferrer"
            onClick={saveDraftBeforeNavigation}
          >
            Back to Pitchforks III ↗
          </Link>
          <span>Private development route · screenshots must be reattached after reload.</span>
        </footer>
      </div>
    </main>
  )
}
