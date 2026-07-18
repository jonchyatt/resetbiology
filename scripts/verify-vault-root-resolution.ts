/**
 * Runnable check for resolveVaultRootFolder() — the vault-root identity
 * contract that fixes the duplicate-folder defect (FRICTION-REGISTER.md,
 * connect-walkthrough-2026-07-14-5541). Mocks the Drive client; no network.
 *
 * Run: npx tsx scripts/verify-vault-root-resolution.ts
 */
import assert from 'node:assert/strict'
import { resolveVaultRootFolder } from '../src/lib/google-drive'
import type { drive_v3 } from 'googleapis'

type MockFile = { id: string; trashed?: boolean; appProperties?: Record<string, string>; name?: string }

// Minimal fake Drive client — only the three methods resolveVaultRootFolder calls.
function makeMockDrive(opts: {
  files: MockFile[] // the full set of folders "visible" to this account, as Drive would see them
  getShouldFail?: (fileId: string) => boolean // simulate 404/403/wrong-account on files.get
  onCreate?: (name: string, parents?: string[] | null) => void
}) {
  let nextId = 100
  const created: MockFile[] = []

  const drive = {
    files: {
      get: async ({ fileId }: { fileId: string }) => {
        if (opts.getShouldFail?.(fileId)) {
          const err: any = new Error('File not found')
          err.code = 404
          throw err
        }
        const f = opts.files.find((f) => f.id === fileId)
        if (!f) {
          const err: any = new Error('File not found')
          err.code = 404
          throw err
        }
        return { data: { id: f.id, trashed: !!f.trashed } }
      },
      list: async ({ q }: { q: string }) => {
        // Interpret just enough of the query to drive the two query shapes
        // resolveVaultRootFolder issues — exact (rbVaultRoot + rbUserId) and
        // broad (rbVaultRoot OR name=). Good enough for a logic-level mock.
        const pool = [...opts.files, ...created]
        const wantsExactUser = /appProperties has \{ key='rbUserId' and value='([^']+)' \}/.exec(q)?.[1]
        const wantsStamped = q.includes("key='rbVaultRoot'")
        const wantsName = /name='([^']+)'/.exec(q)?.[1]
        const isBroad = q.includes(' or ')

        const results = pool.filter((f) => {
          if (f.trashed) return false
          if (isBroad) {
            const stampMatch = wantsStamped && f.appProperties?.rbVaultRoot === 'true'
            const nameMatch = wantsName && f.name === wantsName
            return !!(stampMatch || nameMatch)
          }
          if (wantsExactUser) {
            return f.appProperties?.rbVaultRoot === 'true' && f.appProperties?.rbUserId === wantsExactUser
          }
          return false
        })
        return { data: { files: results.map((f) => ({ id: f.id })) } }
      },
      create: async ({ requestBody }: { requestBody: drive_v3.Schema$File }) => {
        opts.onCreate?.(requestBody.name!, requestBody.parents ?? null)
        // Only root folders (no parents) get tracked as discoverable candidates —
        // subfolder creates don't matter to this contract's logic.
        if (!requestBody.parents) {
          const id = `created-${nextId++}`
          created.push({
            id,
            name: requestBody.name!,
            appProperties: requestBody.appProperties as Record<string, string> | undefined,
          })
          return { data: { id } }
        }
        return { data: { id: `created-sub-${nextId++}` } }
      },
    },
  }

  return { drive: drive as unknown as drive_v3.Drive, created }
}

async function run() {
  let subfoldersCreated = 0

  // Case 1: valid pointer — reuse, create nothing.
  {
    const { drive, created } = makeMockDrive({
      files: [{ id: 'root-1', appProperties: { rbVaultRoot: 'true', rbUserId: 'user-1' } }],
      onCreate: () => subfoldersCreated++,
    })
    const result = await resolveVaultRootFolder(drive, 'user-1', 'root-1')
    assert.equal(result.status, 'reused')
    assert.equal((result as any).folderId, 'root-1')
    assert.equal(created.length, 0, 'valid pointer must not create anything')
  }

  // Case 2: stale/deleted pointer — falls to discovery, finds the user's own
  // stamped root, reuses it (repairs the pointer) instead of creating.
  {
    const { drive, created } = makeMockDrive({
      files: [{ id: 'root-2', appProperties: { rbVaultRoot: 'true', rbUserId: 'user-2' } }],
      getShouldFail: (fileId) => fileId === 'stale-pointer',
    })
    const result = await resolveVaultRootFolder(drive, 'user-2', 'stale-pointer')
    assert.equal(result.status, 'reused')
    assert.equal((result as any).folderId, 'root-2')
    assert.equal(created.length, 0, 'discovery-reuse must not create anything')
  }

  // Case 2b: inaccessible pointer (403) — same as stale, falls to discovery.
  {
    const { drive } = makeMockDrive({
      files: [{ id: 'root-2b', appProperties: { rbVaultRoot: 'true', rbUserId: 'user-2b' } }],
      getShouldFail: () => true, // simulate 403 on the stored pointer
    })
    const result = await resolveVaultRootFolder(drive, 'user-2b', 'forbidden-pointer')
    assert.equal(result.status, 'reused')
    assert.equal((result as any).folderId, 'root-2b')
  }

  // Case 3: ambiguous discovery — a legacy name-only folder (no appProperties,
  // pre-contract) is visible, no pointer, no exact stamped match for this user.
  // Must fail closed and flag, not auto-adopt, not create another tree.
  {
    const { drive, created } = makeMockDrive({
      files: [{ id: 'legacy-1', name: 'Reset Biology Data' }],
    })
    const result = await resolveVaultRootFolder(drive, 'user-3', null)
    assert.equal(result.status, 'ambiguous')
    assert.deepEqual((result as any).candidateFolderIds, ['legacy-1'])
    assert.equal(created.length, 0, 'ambiguous must not create a new tree')
  }

  // Case 4: wrong-account pointer — stored pointer's owning account differs
  // from the account now connecting. Must fail closed and flag immediately,
  // without ever calling files.get/list (verified via a drive that throws on
  // any call it doesn't expect).
  {
    const drive = {
      files: {
        get: async () => {
          throw new Error('must not call files.get on a known account mismatch')
        },
        list: async () => {
          throw new Error('must not call files.list on a known account mismatch')
        },
        create: async () => {
          throw new Error('must not call files.create on a known account mismatch')
        },
      },
    } as unknown as drive_v3.Drive
    const result = await resolveVaultRootFolder(drive, 'user-4', 'root-under-old-account', {
      stored: 'old-account@gmail.com',
      current: 'new-account@gmail.com',
    })
    assert.equal(result.status, 'ambiguous')
    assert.deepEqual((result as any).candidateFolderIds, ['root-under-old-account'])
  }

  // Case 5: none — no pointer, zero candidates anywhere — create fresh,
  // stamped with appProperties for future discovery.
  {
    let createdRootAppProps: Record<string, string> | undefined
    const { drive, created } = makeMockDrive({
      files: [],
      onCreate: (name) => {
        if (name === 'Reset Biology Data') subfoldersCreated++
      },
    })
    const result = await resolveVaultRootFolder(drive, 'user-5', null)
    assert.equal(result.status, 'created')
    assert.equal(created.length, 1)
    createdRootAppProps = created[0].appProperties
    assert.equal(createdRootAppProps?.rbVaultRoot, 'true')
    assert.equal(createdRootAppProps?.rbUserId, 'user-5')
  }

  console.log('OK — all 5 vault-root resolution cases passed:')
  console.log('  1. valid pointer -> reuse, no create')
  console.log('  2. stale/inaccessible pointer -> discovery -> reuse')
  console.log('  3. ambiguous (legacy name-only candidate) -> fail-closed + flagged')
  console.log('  4. wrong-account pointer -> fail-closed + flagged (no Drive calls)')
  console.log('  5. no candidates -> create fresh, stamped with appProperties')
}

run().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
