// src/lib/auth0.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { prisma } from './prisma';

// Session type for Auth0 v4
interface Session {
  user: {
    email?: string;
    name?: string;
    picture?: string;
    sub?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Generate a unique member ID for new users
 * Format: RB-XXXXXX (6 digit number)
 */
async function generateMemberID(): Promise<string> {
  // Find the highest existing member ID
  const lastUser = await prisma.user.findFirst({
    where: {
      memberID: { not: null }
    },
    orderBy: { memberID: 'desc' },
    select: { memberID: true }
  });

  let nextNumber = 1;
  if (lastUser?.memberID) {
    const match = lastUser.memberID.match(/RB-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `RB-${nextNumber.toString().padStart(6, '0')}`;
}

/**
 * Sync user to database after authentication
 * Called from beforeSessionSaved hook
 */
export async function syncUserToDatabase(session: Session): Promise<void> {
  if (!session?.user?.email) {
    return;
  }

  const { email, name, picture, sub: auth0Sub } = session.user;
  // Auth0 only populates email_verified when it has a verified claim to give
  // us — absence means NOT verified, same contract as getUserFromSession.ts.
  const emailVerified = session.user.email_verified === true;

  try {
    // (a) Match by Auth0 sub first — the normal, unambiguous case. Falls
    // through to the email lookup below only when no row owns this sub yet.
    let user = auth0Sub
      ? await prisma.user.findUnique({ where: { auth0Sub } })
      : null;

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email } });

      if (existingByEmail && !emailVerified) {
        // (c) Email-match but UNVERIFIED: do not reattach this sub to the
        // existing row and do not create a duplicate (unique email
        // constraint would reject it anyway). Skip the sync entirely —
        // resolveUserFromSession()'s guard is the backstop that turns this
        // into a 403 verify_email response on the API side. Must not throw:
        // the caller (beforeSessionSaved) still needs to return the session
        // so the login redirect completes.
        console.warn('[identity-merge] blocked: unverified email matches existing user', {
          existingUserId: existingByEmail.id,
          attemptedSub: auth0Sub,
          email,
        });
        return;
      }

      if (existingByEmail) {
        // (b) Email-match + VERIFIED: reattach this sub to the existing row.
        user = existingByEmail;
        console.log('[identity-merge]', {
          existingUserId: existingByEmail.id,
          newSub: auth0Sub,
          email,
          emailVerified: true,
        });
      }
    }

    // Check for quiz submission to determine if they should get introduction tier.
    // ONLY for a session with a VERIFIED email claim: the funnel is public and
    // unauthenticated, so linking by unverified email would let an attacker who
    // signs up with someone else's address inherit that person's private
    // submission (reason, scores). Sync-created rows (subscriber tier) never
    // DB-link retroactively; their reason resolves via the verified
    // email-fallback in /api/user/reason instead.
    const quizSubmission = emailVerified
      ? await prisma.nEPQSubmission.findFirst({
          where: { email },
          orderBy: { createdAt: 'desc' }
        })
      : null;

    if (!user) {
      // Create new user
      const memberID = await generateMemberID();
      const now = new Date();

      // Satori Living Foundation Grant: all new users get 6 months subscriber access
      const grantExpiry = new Date(now);
      grantExpiry.setMonth(grantExpiry.getMonth() + 6);

      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          auth0Sub,
          memberID,
          image: picture || null,
          accessLevel: 'subscriber',
          subscriptionStatus: 'active',
          subscriptionExpiry: grantExpiry,
          role: 'basic',
          // Introduction tier fields not used for grant
          introductionStartDate: null,
          introductionExpiresAt: null,
          quizSubmissionId: quizSubmission?.id || null,
          // Store quiz responses for easy access
          quizResponses: quizSubmission ? {
            submissionId: quizSubmission.id,
            auditLevel: quizSubmission.auditLevel,
            auditScore: quizSubmission.auditScore,
            categoryScores: quizSubmission.categoryScores,
            topRecommendations: quizSubmission.topRecommendations,
          } : null,
        }
      });

      console.log(`Created new user: ${email} (${memberID}) - Grant: 6-month subscriber until ${grantExpiry.toISOString().split('T')[0]}`);
    } else {
      // Update existing user
      const updateData: Record<string, unknown> = {
        auth0Sub, // Always update auth0Sub in case it changed
        name: name || user.name,
        image: picture || user.image,
      };

      // Satori Living Foundation Grant: upgrade any guest/introduction user to 6-month subscriber
      if (user.accessLevel === 'guest' || user.accessLevel === 'introduction') {
        const now = new Date();
        const grantExpiry = new Date(now);
        grantExpiry.setMonth(grantExpiry.getMonth() + 6);

        updateData.accessLevel = 'subscriber';
        updateData.subscriptionStatus = 'active';
        updateData.subscriptionExpiry = grantExpiry;

        if (quizSubmission && !user.quizSubmissionId) {
          updateData.quizSubmissionId = quizSubmission.id;
          updateData.quizResponses = {
            submissionId: quizSubmission.id,
            auditLevel: quizSubmission.auditLevel,
            auditScore: quizSubmission.auditScore,
            categoryScores: quizSubmission.categoryScores,
            topRecommendations: quizSubmission.topRecommendations,
          };
        }

        console.log(`Grant: Upgraded user to 6-month subscriber: ${email} until ${grantExpiry.toISOString().split('T')[0]}`);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });
    }
  } catch (error) {
    console.error('Error in user sync:', error);
    // Don't throw - let authentication proceed even if DB sync fails
  }
}

// Auth0 v4 SDK with beforeSessionSaved hook for user sync
export const auth0 = new Auth0Client({
  beforeSessionSaved: async (session) => {
    // Sync user to database when session is saved
    await syncUserToDatabase(session as Session);
    return session;
  }
});
