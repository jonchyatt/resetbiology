import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { AgentOrchestrator } from '@/lib/agents/AgentOrchestrator';
import { getSession } from '@auth0/nextjs-auth0';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const orchestrator = new AgentOrchestrator();

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate User
        const session = await getSession();
        const userId = session?.user?.sub; // Auth0 User ID

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Audio File
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
        }

        // 3. Transcribe Audio (Speech-to-Text)
        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
        });

        const userText = transcription.text;
        console.log(`[VoiceAPI] User said: "${userText}"`);

        // 4. Get Agent Response (The "Brain")
        // We pass an empty history for now, but in a real app we'd fetch it from DB
        const { agent, response: agentText } = await orchestrator.handleMessage(userId, userText, []);
        console.log(`[VoiceAPI] Agent (${agent}) replied: "${agentText}"`);

        // 5. Generate Speech (Text-to-Speech)
        const mp3 = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'alloy', // You can change this based on the agent type!
            input: agentText,
        });

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

    } catch (error) {
        console.error('[VoiceAPI] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
