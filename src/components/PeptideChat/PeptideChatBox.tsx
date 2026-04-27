'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

type Props = {
  slug: string;
  peptide: string;
};

export default function PeptideChatBox({ slug, peptide }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setError(null);
    setSending(true);

    const next: Message[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');

    try {
      const res = await fetch(`/api/peptide-chat/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: messages }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 503) {
          setError(data.message || 'Chat is not configured yet.');
        } else if (res.status === 413) {
          setError('Message too long — please shorten and retry.');
        } else {
          setError(data.error || `Chat failed (HTTP ${res.status}).`);
        }
        return;
      }

      const answer = (data.answer || '').toString();
      setMessages([...next, { role: 'assistant', content: answer }]);
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <section className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden">
      <header className="bg-gradient-to-r from-[#3FBFB5]/80 to-[#72C247]/80 px-4 py-3">
        <h2 className="text-xl font-bold text-white">Ask the {peptide} Librarian</h2>
        <p className="text-xs text-white/85">
          Answers cite Hunter Williams, Taylor Williams, and Dr Trevor Bachmeyer only — no invented content.
        </p>
      </header>

      <div ref={scrollRef} className="max-h-[420px] min-h-[120px] overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-white/50 italic text-sm">
            Ask a question about {peptide}: dosing, timing, female-specific considerations, acute vs chronic context, stacking, contraindications.
          </p>
        ) : (
          messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} />
          ))
        )}
        {sending && <div className="text-white/50 italic text-sm">Thinking…</div>}
      </div>

      {error && (
        <div className="mx-4 mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="border-t border-white/10 p-3 bg-black/20">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={`Ask about ${peptide}…`}
            rows={2}
            maxLength={800}
            disabled={sending}
            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#3FBFB5] resize-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !input.trim()}
            className="px-4 py-2 bg-[#3FBFB5] hover:bg-[#3FBFB5]/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-white/40 mt-2">
          Research educational use only. Not medical advice. Citations only — no invented content.
        </p>
      </div>
    </section>
  );
}

function ChatBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-[#3FBFB5]/30 border border-[#3FBFB5]/50 text-white'
            : 'bg-white/10 border border-white/20 text-white/90'
        }`}
      >
        {renderWithLinks(content)}
      </div>
    </div>
  );
}

function renderWithLinks(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const isInternal = match[2].startsWith('/');
    parts.push(
      <a
        key={`link-${i++}`}
        href={match[2]}
        target={isInternal ? '_self' : '_blank'}
        rel={isInternal ? undefined : 'noopener noreferrer'}
        className="text-[#3FBFB5] underline"
      >
        {match[1]}
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
