/**
 * Member data: "Download my data" and "Delete my data" (Jon: members get real control).
 *
 * Scope comes from the Prisma schema itself, so a new table with a `userId`
 * column is covered automatically:
 *   - every model with a `userId` field, filtered by the signed-in user's id
 *   - peptide_doses, which hang off the member's protocols (no userId column)
 *   - the User row itself (export omits the Drive refresh token)
 * Not covered: admin-authored tables (NOT_MEMBER_DATA), rows keyed only by email from before an account existed
 * (orders, waitlist, quiz answers), shared catalog rows, and anything in the
 * member's Google Drive. The UI says so plainly.
 *
 * Safety: the user id ALWAYS comes from the session via deps.getUser. Nothing
 * in the request (query, body) can name another user. See
 * tests/member-data-isolation-check.ts.
 */
import { Prisma } from '@prisma/client'

type ModelMeta = { name: string; fields: ReadonlyArray<{ name: string; kind: string; type: string; relationFromFields?: ReadonlyArray<string> | null }> }

const DOSES_MODEL = 'peptide_doses'
// Tables whose userId means "the admin who authored shared content", not member data.
// ponytail: explicit list; add any future admin-authored table that uses a userId column.
export const NOT_MEMBER_DATA = new Set(['AgentTraining'])
const PROTOCOLS_MODEL = 'user_peptide_protocols'

/** Prisma client delegate name: first letter lower-cased (ClientProgress -> clientProgress). */
export const delegateName = (model: string) => model.charAt(0).toLowerCase() + model.slice(1)

/** Models holding member data, ordered so children are deleted before the rows they point at. */
export function memberDataModels(models: ReadonlyArray<ModelMeta> = Prisma.dmmf.datamodel.models): string[] {
  const owned = models.filter(
    (m) => !NOT_MEMBER_DATA.has(m.name) && (m.name === DOSES_MODEL || m.fields.some((f) => f.name === 'userId')),
  )
  const names = new Set(owned.map((m) => m.name))
  const parents = new Map(
    owned.map((m) => [
      m.name,
      m.fields
        .filter((f) => f.kind === 'object' && f.relationFromFields?.length && names.has(f.type) && f.type !== m.name)
        .map((f) => f.type),
    ]),
  )
  // Topological order: a model comes before every model it references.
  const order: string[] = []
  const seen = new Set<string>()
  const visit = (name: string, stack: Set<string>) => {
    if (seen.has(name) || stack.has(name)) return
    stack.add(name)
    for (const m of owned) if (parents.get(m.name)?.includes(name)) visit(m.name, stack)
    stack.delete(name)
    seen.add(name)
    order.push(name)
  }
  for (const m of owned) visit(m.name, new Set())
  return order
}

/** The filter for one model, scoped to this user only. Throws on a missing id rather than ever returning `{}`. */
export function scopedWhere(model: string, userId: string, protocolIds: string[]): Record<string, unknown> {
  if (!userId) throw new Error('member-data: refusing to build a query without a user id')
  if (model === DOSES_MODEL) return { protocolId: { in: protocolIds } }
  return { userId }
}

type Db = Record<string, any>

async function protocolIdsFor(db: Db, userId: string): Promise<string[]> {
  const rows = await db[delegateName(PROTOCOLS_MODEL)].findMany({ where: { userId }, select: { id: true } })
  return rows.map((r: { id: string }) => r.id)
}

export async function exportMemberData(db: Db, userId: string, models = memberDataModels()) {
  const protocolIds = await protocolIdsFor(db, userId)
  const user = await db.user.findUnique({ where: { id: userId } })
  const { googleDriveRefreshToken: _secret, ...account } = user ?? {}
  const data: Record<string, unknown[]> = {}
  for (const model of models) {
    data[model] = await db[delegateName(model)].findMany({ where: scopedWhere(model, userId, protocolIds) })
  }
  return { exportedAt: new Date().toISOString(), account: user ? account : null, data }
}

/** Deletes every member-data row for this user, then the User row. One transaction. */
export async function deleteMemberData(db: Db, userId: string, models = memberDataModels()) {
  const protocolIds = await protocolIdsFor(db, userId)
  const ops = models.map((model) => db[delegateName(model)].deleteMany({ where: scopedWhere(model, userId, protocolIds) }))
  ops.push(db.user.deleteMany({ where: { id: userId } }))
  const results: Array<{ count: number }> = await db.$transaction(ops)
  const deleted: Record<string, number> = {}
  ;[...models, 'User'].forEach((m, i) => { if (results[i]?.count) deleted[m] = results[i].count })
  return deleted
}

export interface MemberDataDeps {
  getUser: () => Promise<{ id: string; googleDriveRefreshToken?: string | null } | null>
  db: Db
  revokeDrive?: (encryptedToken: string) => Promise<void>
}

/** HTTP handlers. Route files wire these to the real session and Prisma. */
export function createMemberDataHandlers(deps: MemberDataDeps) {
  return {
    async GET(): Promise<Response> {
      const user = await deps.getUser()
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      const body = await exportMemberData(deps.db, user.id)
      const day = new Date().toISOString().slice(0, 10)
      return new Response(JSON.stringify(body, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="reset-biology-my-data-${day}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    },

    async DELETE(req: Request): Promise<Response> {
      const user = await deps.getUser()
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      const body = await req.json().catch(() => null)
      if (body?.confirm !== 'DELETE') {
        return Response.json({ error: 'Type DELETE to confirm' }, { status: 400 })
      }
      // Best effort: stop our app's access to their Drive. Their Drive files are not touched.
      if (user.googleDriveRefreshToken && deps.revokeDrive) {
        await deps.revokeDrive(user.googleDriveRefreshToken).catch((err) =>
          console.error('[member-data] drive revoke failed (continuing):', err),
        )
      }
      const deleted = await deleteMemberData(deps.db, user.id)
      console.log('[member-data] member deleted their data', { userId: user.id, deleted })
      return Response.json({ ok: true, deleted })
    },
  }
}
