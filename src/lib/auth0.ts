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
