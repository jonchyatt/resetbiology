// src/lib/speech/whisper.worker.ts

import { pipeline } from '@huggingface/transformers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null
let loading = false

async function loadModel() {
  if (transcriber || loading) return
  loading = true

  try {
    self.postMessage({ type: 'status', status: 'loading', message: 'Loading voice model...' })

    transcriber = await (pipeline as Function)(
      'automatic-speech-recognition',
      'onnx-community/whisper-tiny.en',
      {
        dtype: 'q8',       // quantized for speed
        device: 'wasm',    // works everywhere
      }
    )

    self.postMessage({ type: 'status', status: 'ready', message: 'Voice model ready' })
  } catch (error) {
    self.postMessage({
      type: 'status',
      status: 'error',
      message: `Failed to load voice model: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  } finally {
    loading = false
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type, audio } = event.data

  if (type === 'load') {
    await loadModel()
    return
  }

  if (type === 'transcribe') {
    if (!transcriber) {
      await loadModel()
      if (!transcriber) return
    }

    try {
      const result = await transcriber(audio, {
        language: 'en',
        task: 'transcribe',
      })

      // result is { text: string } or { text: string }[]
      const text = Array.isArray(result) ? result[0]?.text : (result as { text: string }).text

      self.postMessage({
        type: 'result',
        text: text || '',
        timestamp: Date.now(),
      })
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Transcription failed',
      })
    }
  }
}
