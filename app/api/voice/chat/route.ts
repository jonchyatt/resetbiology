import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { AgentOrchestrator } from '@/lib/agents/AgentOrchestrator';
import { auth0 } from '@/lib/auth0';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const orchestrator = new AgentOrchestrator();

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

        // 2. Parse Audio File
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            console.error('[VoiceAPI] No audio file in request');
            return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
        }

        console.log(`[VoiceAPI] Received audio file: ${audioFile.size} bytes, type: ${audioFile.type}`);

        // 3. Transcribe Audio (Speech-to-Text)
        let userText: string;
        try {
            const transcription = await openai.audio.transcriptions.create({
                file: audioFile,
                model: 'whisper-1',
            });
            userText = transcription.text;
            console.log(`[VoiceAPI] User said: "${userText}"`);
        } catch (transcribeError) {
            console.error('[VoiceAPI] Transcription error:', transcribeError);
            return NextResponse.json({ error: 'Transcription failed', details: String(transcribeError) }, { status: 500 });
        }

        if (!userText || userText.trim().length === 0) {
            console.warn('[VoiceAPI] Empty transcription');
            return NextResponse.json({ error: 'Could not understand audio' }, { status: 400 });
        }

        // 4. Get Agent Response (The "Brain")
        let agent: string;
        let agentText: string;
        try {
            const result = await orchestrator.handleMessage(userId, userText, []);
            agent = result.agent;
            agentText = result.response;
            console.log(`[VoiceAPI] Agent (${agent}) replied: "${agentText}"`);
        } catch (agentError) {
            console.error('[VoiceAPI] Agent error:', agentError);
            return NextResponse.json({ error: 'Agent processing failed', details: String(agentError) }, { status: 500 });
        }

        // 5. Generate Speech (Text-to-Speech)
        let audioArrayBuffer: ArrayBuffer;
        try {
            const mp3 = await openai.audio.speech.create({
                model: 'tts-1',
                voice: 'alloy',
                input: agentText,
            });
            audioArrayBuffer = await mp3.arrayBuffer();
            console.log(`[VoiceAPI] Generated audio response: ${audioArrayBuffer.byteLength} bytes`);
        } catch (ttsError) {
            console.error('[VoiceAPI] TTS error:', ttsError);
            return NextResponse.json({ error: 'TTS failed', details: String(ttsError) }, { status: 500 });
        }

        // 6. Return Audio and Metadata
        return new NextResponse(audioArrayBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'X-Agent-Response-Text': encodeURIComponent(agentText),
                'X-Agent-Type': agent,
            },
        });

    } catch (error) {
        console.error('[VoiceAPI] Unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}
