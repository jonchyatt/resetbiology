import { NextRequest, NextResponse } from 'next/server';
import { getPeptide } from '@/data/peptide-education/generated';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CF_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_USER_MESSAGE = 800;
const MAX_HISTORY = 6;
const MAX_TOKENS = 600;

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type Body = { message?: string; history?: ChatMessage[] };

function buildCitations(card: ReturnType<typeof getPeptide>) {
  if (!card) return '';
  const lines: string[] = [];
  for (const expertKey of ['hunter-williams', 'taylor-williams', 'trevor-bachmeyer'] as const) {
    const expert = card.experts[expertKey];
    if (!expert) continue;
    const speaker =
      expertKey === 'hunter-williams' ? 'Hunter Williams'
      : expertKey === 'taylor-williams' ? 'Taylor Williams'
      : 'Dr Trevor Bachmeyer';

    const bp = (expert as { baseline_protocol?: unknown }).baseline_protocol as
      | { purpose: string; dose: string; frequency: string; timing: string; duration: string; vial_mg: string; bac_mL: string }
      | null
      | undefined;
    if (bp) {
      lines.push(
        `${speaker} (cheat-sheet): "${card.peptide} — ${bp.purpose}. Dose ${bp.dose}, ${bp.frequency}, ${bp.timing}. Duration ${bp.duration}. Reconstitute ${bp.vial_mg} vial in ${bp.bac_mL} BAC."`
      );
    }
    const top = expert.summary?.top_sources?.slice(0, 4) || [];
    for (const s of top) {
      const id = s.source_id || 'unknown';
      const ts = s.first_timestamp ? ` ${s.first_timestamp}` : '';
      const snippet = (s.top_snippet || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      if (snippet) lines.push(`${speaker} (${id}${ts}): "${snippet}"`);
    }
    const acute = expert.summary?.acute_signals?.slice(0, 2) || [];
    for (const s of acute) {
      const snip = (s.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 220);
      if (snip) lines.push(`${speaker} (acute): "${snip}"`);
    }
    const chronic = expert.summary?.chronic_signals?.slice(0, 2) || [];
    for (const s of chronic) {
      const snip = (s.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 220);
      if (snip) lines.push(`${speaker} (chronic): "${snip}"`);
    }
  }
  return lines.join('\n');
}

function buildSystemPrompt(card: NonNullable<ReturnType<typeof getPeptide>>) {
  const citations = buildCitations(card);
  return [
    `You are a Reset Biology peptide librarian for ${card.peptide}.`,
    `Answer ONLY using the verbatim citations below from Hunter Williams, Taylor Williams, and Dr Trevor Bachmeyer.`,
    `Each answer must cite at least one Speaker (sourceId timestamp): "quote".`,
    `If the answer is not in the citations, say exactly: "I don't have expert content on that for ${card.peptide}."`,
    `Never invent doses, mechanisms, or contraindications not present in the citations.`,
    `Always end with: 📚 [View full research](/education/peptides/${card.slug})`,
    ``,
    `# Citations for ${card.peptide}`,
    citations || '(no citations available)',
  ].join('\n');
}

function sanitizeHistory(history: ChatMessage[] | undefined): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_USER_MESSAGE) }))
    .slice(-MAX_HISTORY);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const card = getPeptide(slug);
  if (!card) {
    return NextResponse.json({ error: 'peptide-not-found', slug }, { status: 404 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_AI_TOKEN;
  if (!accountId || !apiToken) {
    return NextResponse.json(
      {
        error: 'chat-not-configured',
        message:
          'The peptide chat is awaiting Cloudflare Workers AI configuration. Until then, please use the cited sources on this page.',
      },
      { status: 503 }
    );
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const userMessage = (body.message || '').toString().trim();
  if (!userMessage) {
    return NextResponse.json({ error: 'message-required' }, { status: 400 });
  }
  if (userMessage.length > MAX_USER_MESSAGE) {
    return NextResponse.json({ error: 'message-too-long', max: MAX_USER_MESSAGE }, { status: 413 });
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(card) },
    ...sanitizeHistory(body.history),
    { role: 'user', content: userMessage },
  ];

  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_MODEL}`;
  const cfRes = await fetch(cfUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, max_tokens: MAX_TOKENS }),
  });

  if (!cfRes.ok) {
    const text = await cfRes.text().catch(() => '');
    return NextResponse.json(
      { error: 'cf-workers-ai-failed', status: cfRes.status, detail: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const data = (await cfRes.json()) as {
    success?: boolean;
    result?: { response?: string };
    errors?: { message?: string }[];
  };

  if (!data.success || !data.result?.response) {
    return NextResponse.json(
      { error: 'cf-workers-ai-empty', detail: data.errors?.[0]?.message || 'no response' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    peptide: card.peptide,
    slug: card.slug,
    answer: data.result.response,
  });
}
