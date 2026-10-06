const CF_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type WorkersAiResponse = {
  success?: boolean;
  result?: { response?: string };
  errors?: { message?: string }[];
};

export class WorkersAiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkersAiUnavailableError';
  }
}

export async function runWorkersAi(
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_AI_TOKEN;
  if (!accountId || !apiToken) {
    throw new WorkersAiUnavailableError(
      'Cloudflare Workers AI is not configured; no paid OpenAI fallback is available.',
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_MODEL}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, max_tokens: maxTokens }),
    },
  );

  if (!response.ok) {
    throw new WorkersAiUnavailableError(
      `Cloudflare Workers AI failed with ${response.status}: ${(await response.text()).slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as WorkersAiResponse;
  if (!data.success || !data.result?.response) {
    throw new WorkersAiUnavailableError(
      data.errors?.[0]?.message || 'Cloudflare Workers AI returned no response.',
    );
  }

  return data.result.response;
}

export const workersAiModel = CF_MODEL;
export const workersAiKeyOwner = 'Cloudflare Workers AI free-tier project token';
