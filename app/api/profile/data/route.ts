import { google } from 'googleapis'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/vault-encryption'
import { createMemberDataHandlers } from '@/lib/member-data'

export const dynamic = 'force-dynamic'

// "Download my data" (GET) and "Delete my data" (DELETE, body { confirm: "DELETE" }).
// The user always comes from the session; nothing in the request can name another user.
const handlers = createMemberDataHandlers({
  getUser: async () => getUserFromSession(await auth0.getSession()),
  db: prisma as any,
  revokeDrive: async (stored) => {
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    await oauth2Client.revokeToken(decryptToken(stored).plaintext)
  },
})

export const GET = () => handlers.GET()
export const DELETE = (req: Request) => handlers.DELETE(req)
