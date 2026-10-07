// src/lib/auth0.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { prisma } from './prisma';
import { getAuth0TransactionCookieDomain } from './auth0-transaction-cookie';

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
async function syncUserToDatabase(session: Session): Promise<void> {
  if (!session?.user?.email) {
    return;
  }

  const { email, name, picture, sub: auth0Sub } = session.user;

  try {
    // Check if user exists by Auth0 ID or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { auth0Sub },
          { email }
        ]
      }
    });

    // Check for quiz submission to determine if they should get introduction tier
    const quizSubmission = await prisma.nEPQSubmission.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' }
    });

    if (!user) {
      // Create new user
      const memberID = await generateMemberID();
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          auth0Sub,
          memberID,
          image: picture || null,
          // The existing subscriber level unlocks the launch tools. During the
          // free-first launch it is indefinite and never represents a paid plan.
          accessLevel: 'subscriber',
          subscriptionStatus: 'active',
          subscriptionExpiry: null,
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

      console.log(`Created new free-launch user: ${email} (${memberID}) - no expiry`);
    } else {
      // Update existing user
      const updateData: Record<string, unknown> = {
        auth0Sub, // Always update auth0Sub in case it changed
        name: name || user.name,
        image: picture || user.image,
      };

      // Free-first launch: move legacy guest/introduction users onto the same
      // non-expiring access as new signups.
      if (user.accessLevel === 'guest' || user.accessLevel === 'introduction') {
        updateData.accessLevel = 'subscriber';
        updateData.subscriptionStatus = 'active';
        updateData.subscriptionExpiry = null;
        updateData.introductionStartDate = null;
        updateData.introductionExpiresAt = null;

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

        console.log(`Free launch: upgraded user to non-expiring access: ${email}`);
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
  transactionCookie: {
    domain: getAuth0TransactionCookieDomain(),
  },
  beforeSessionSaved: async (session) => {
    // Sync user to database when session is saved
    await syncUserToDatabase(session as Session);
    return session;
  }
});
