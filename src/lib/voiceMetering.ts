import type { PrismaClient } from '@prisma/client';

const VOICE_MINUTES_PER_REQUEST = 1;

/**
 * Atomically reserves one included voice minute before paid voice processing.
 * Returns the post-reservation balance, or null when no minutes remain.
 */
export async function reserveVoiceMinute(
    prisma: Pick<PrismaClient, 'user'>,
    userId: string,
): Promise<number | null> {
    const consumed = await prisma.user.updateMany({
        where: {
            id: userId,
            voiceMinutesRemaining: { gte: VOICE_MINUTES_PER_REQUEST },
        },
        data: {
            voiceMinutesRemaining: { decrement: VOICE_MINUTES_PER_REQUEST },
        },
    });

    if (consumed.count !== 1) return null;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { voiceMinutesRemaining: true },
    });

    return user?.voiceMinutesRemaining ?? null;
}