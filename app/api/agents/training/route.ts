import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';

// GET - Load training for an agent
export async function GET(req: NextRequest) {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const agentId = searchParams.get('agent');

        if (!agentId) {
            return NextResponse.json({ error: 'Missing agent parameter' }, { status: 400 });
        }

        // Find user
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { auth0Sub: session.user.sub },
                    { email: session.user.email as string }
                ]
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get training from AgentTraining table (or create one)
        const training = await prisma.agentTraining.findUnique({
            where: {
                agentId_userId: {
                    agentId: agentId,
                    userId: user.id
                }
            }
        });

        return NextResponse.json({
            training: training?.content || '',
            lastUpdated: training?.updatedAt
        });

    } catch (error) {
        console.error('[AgentTraining API] GET error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// POST - Save training for an agent
export async function POST(req: NextRequest) {
    try {
        const session = await auth0.getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { agentId, training } = await req.json();

        if (!agentId) {
            return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
        }

        // Find user
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { auth0Sub: session.user.sub },
                    { email: session.user.email as string }
                ]
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Upsert training
        const result = await prisma.agentTraining.upsert({
            where: {
                agentId_userId: {
                    agentId: agentId,
                    userId: user.id
                }
            },
            create: {
                agentId: agentId,
                userId: user.id,
                content: training
            },
            update: {
                content: training
            }
        });

        return NextResponse.json({
            success: true,
            updatedAt: result.updatedAt
        });

    } catch (error) {
        console.error('[AgentTraining API] POST error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
