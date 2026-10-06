import { NextRequest, NextResponse } from 'next/server';
import { AgentOrchestrator, AgentType } from '@/lib/agents/AgentOrchestrator';
import { workersAiKeyOwner, workersAiModel, WorkersAiUnavailableError } from '@/lib/workersAi';

export const dynamic = 'force-dynamic';

const EXPERTS = new Set<AgentType>([
  'CONCIERGE',
  'PEPTIDE',
  'EXERCISE',
  'NUTRITION',
  'BREATH',
  'JOURNAL',
  'VISION',
  'NBACK',
  'COURSE',
  'SALES',
  'ONBOARDING',
  'PROFESSOR',
]);

type Body = {
  message?: unknown;
  history?: unknown;
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ agent: string }> }) {
  const { agent: rawAgent } = await ctx.params;
  const agent = rawAgent.toUpperCase() as AgentType;
  if (!EXPERTS.has(agent)) {
    return NextResponse.json({ error: 'expert-not-found', agent: rawAgent }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'message-required' }, { status: 400 });
  }
  if (message.length > 800) {
    return NextResponse.json({ error: 'message-too-long', max: 800 }, { status: 413 });
  }

  try {
    const history = Array.isArray(body.history) ? body.history : [];
    const result = await new AgentOrchestrator().handleDirectMessage('anonymous', message, history, agent);
    return NextResponse.json(
      { agent: result.agent, answer: result.response, model: workersAiModel, keyOwner: workersAiKeyOwner },
      { headers: { 'X-RB-Brain-Model': workersAiModel, 'X-RB-Brain-Key-Owner': workersAiKeyOwner } },
    );
  } catch (error) {
    if (error instanceof WorkersAiUnavailableError) {
      return NextResponse.json({ error: 'free-brain-unavailable', detail: error.message }, { status: 503 });
    }
    console.error('[ExpertAPI] request failed', error);
    return NextResponse.json({ error: 'expert-failed' }, { status: 500 });
  }
}
