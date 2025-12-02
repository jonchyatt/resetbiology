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
        // Check for API Keys
        if (!process.env.OPENAI_API_KEY) {
            console.error('[VoiceAPI] Missing OPENAI_API_KEY');
            return NextResponse.json({ error: 'Server configuration error: Missing OpenAI API Key' }, { status: 500 });
        }

        // 1. Authenticate User
        const session = await auth0.getSession();
        const userId = session?.user?.sub; // Auth0 User ID

        if (!userId) {
            console.warn('[VoiceAPI] Unauthorized access attempt');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Audio File
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            console.warn('[VoiceAPI] No audio file provided');
            return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
        }

        // 3. Transcribe Audio (Speech-to-Text)
        console.log('[VoiceAPI] Starting transcription...');
        let transcription;
        try {
            transcription = await openai.audio.transcriptions.create({
                file: audioFile,
                model: 'whisper-1',
            });
        } catch (transcriptionError: any) {
            console.error('[VoiceAPI] Transcription Error:', transcriptionError);
            return NextResponse.json({ error: `Transcription failed: ${transcriptionError.message}` }, { status: 500 });
        }

        const userText = transcription.text;
        console.log(`[VoiceAPI] User said: "${userText}"`);

        // 4. Get Agent Response (The "Brain")
        // We pass an empty history for now, but in a real app we'd fetch it from DB
        console.log('[VoiceAPI] Getting agent response...');
        let agentResponse;
        try {
            agentResponse = await orchestrator.handleMessage(userId, userText, []);
        } catch (orchestratorError: any) {
            console.error('[VoiceAPI] Orchestrator Error:', orchestratorError);
            return NextResponse.json({ error: `Agent processing failed: ${orchestratorError.message}` }, { status: 500 });
        }

        const { agent, response: agentText } = agentResponse;
        console.log(`[VoiceAPI] Agent (${agent}) replied: "${agentText}"`);

        // 5. Generate Speech (Text-to-Speech)
        console.log('[VoiceAPI] Generating speech...');
        let mp3;
        try {
            mp3 = await openai.audio.speech.create({
                model: 'tts-1',
                voice: 'alloy', // You can change this based on the agent type!
                input: agentText,
            });
        } catch (ttsError: any) {
            console.error('[VoiceAPI] TTS Error:', ttsError);
            return NextResponse.json({ error: `Text-to-speech failed: ${ttsError.message}` }, { status: 500 });
        }

        const buffer = Buffer.from(await mp3.arrayBuffer());

        // 6. Return Audio and Metadata
        // We return the audio as the body, and metadata in headers or we could use a multipart response.
        // For simplicity, let's return the audio and put the text in a header.
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'X-Agent-Response-Text': encodeURIComponent(agentText),
                'X-Agent-Type': agent,
            },
        });

    } catch (error: any) {
        console.error('[VoiceAPI] Critical Error:', error);
        return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
    }
}
