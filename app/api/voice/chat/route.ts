import { NextRequest, NextResponse } from 'next/server';
import { AgentOrchestrator } from '@/lib/agents/AgentOrchestrator';
import { auth0 } from '@/lib/auth0';
import { workersAiKeyOwner, workersAiModel } from '@/lib/workersAi';

// Force dynamic rendering because the free Workers AI and Fish lane are runtime configured.
export const dynamic = 'force-dynamic';

// Lazy initialization for the Workers AI-backed expert orchestrator.
let orchestrator: AgentOrchestrator | null = null;
function getOrchestrator(): AgentOrchestrator {
    if (!orchestrator) {
        orchestrator = new AgentOrchestrator();
    }
    return orchestrator;
}

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate User
        console.log('[VoiceAPI] Starting request processing...');

        let session;
        try {
            session = await auth0.getSession();
        } catch (authError) {
            console.error('[VoiceAPI] Auth error:', authError);
            return NextResponse.json({ error: 'Auth error', details: String(authError) }, { status: 401 });
        }

        const userId = session?.user?.sub; // Auth0 User ID

        if (!userId) {
            console.error('[VoiceAPI] No user session found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log(`[VoiceAPI] User authenticated: ${userId}`);

        // 2. Use client-side transcription. This route intentionally does not send member
        // audio to OpenAI Whisper: free traffic must not fall through to Jon's paid key.
        const formData = await req.formData();
        const userText = (formData.get('transcript') || '').toString().trim();
        if (!userText || userText.trim().length === 0) {
            return NextResponse.json(
                { error: 'transcript-required', message: 'Use browser speech recognition or typed input; paid server transcription is disabled.' },
                { status: 422 },
            );
        }

        // 4. Get Agent Response (The "Brain")
        // Check for page context from form data (for page-aware routing)
        const pageContext = formData.get('pageContext') as string | null;
        console.log(`[VoiceAPI] Page context: ${pageContext || 'none (will classify)'}`);

        let agent: string;
        let agentText: string;
        try {
            const result = await getOrchestrator().handleMessage(userId, userText, [], pageContext || undefined);
            agent = result.agent;
            agentText = result.response;
            console.log(`[VoiceAPI] Agent (${agent}) replied: "${agentText}"`);
        } catch (agentError) {
            console.error('[VoiceAPI] Agent error:', agentError);
            return NextResponse.json({ error: 'Agent processing failed', details: String(agentError) }, { status: 500 });
        }

        // 5. Render via the owned Fish free lane. The deployed site must be configured with
        // a reachable Quicksilver URL; localhost is valid only for local development.
        const fishMouthUrl = process.env.RB_FREE_VOICE_URL;
        if (!fishMouthUrl) {
            return NextResponse.json(
                { error: 'free-voice-not-configured', message: 'RB_FREE_VOICE_URL is required; paid TTS is disabled.' },
                { status: 503 },
            );
        }

        let audioResponse: Response;
        try {
            audioResponse = await fetch(new URL('/tts', fishMouthUrl), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: agentText, voice: 'cedar' }),
            });
        } catch (ttsError) {
            return NextResponse.json({ error: 'free-voice-failed', details: String(ttsError) }, { status: 502 });
        }
        if (!audioResponse.ok) {
            return NextResponse.json({ error: 'free-voice-failed', status: audioResponse.status }, { status: 502 });
        }
        const audioArrayBuffer = await audioResponse.arrayBuffer();

        // 6. Return Audio and Metadata
        return new NextResponse(audioArrayBuffer, {
            headers: {
                'Content-Type': audioResponse.headers.get('content-type') || 'audio/wav',
                'X-Agent-Response-Text': encodeURIComponent(agentText),
                'X-Agent-Type': agent,
                'X-RB-Brain-Model': workersAiModel,
                'X-RB-Brain-Key-Owner': workersAiKeyOwner,
                'X-RB-Voice-Model': 'Fish s2.1-pro-free',
                'X-RB-Voice-Key-Owner': 'Jon-owned Fish free lane',
            },
        });

    } catch (error) {
        console.error('[VoiceAPI] Unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}
