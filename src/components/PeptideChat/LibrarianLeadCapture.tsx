'use client';

import { useState, type FormEvent } from 'react';
import { track } from '@vercel/analytics';

export function LibrarianLeadCapture() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('saving');

    try {
      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Peptide Librarian subscriber',
          email,
          startedAt: new Date().toISOString(),
          utmSource: 'peptide-librarian',
          utmMedium: 'email-capture',
          selectedOffer: null,
        }),
      });

      if (!response.ok) throw new Error('Lead capture failed');

      track('Librarian Email Captured');
      setStatus('saved');
    } catch (error) {
      console.error('Librarian lead capture error:', error);
      setStatus('error');
    }
  }

  if (status === 'saved') {
    return <p className="text-sm text-emerald-200">Saved. We&apos;ll send new library updates to {email}.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <label htmlFor="librarian-email" className="sr-only">Email for peptide library updates</label>
      <input
        id="librarian-email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email me new peptide research"
        className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:border-[#3FBFB5] focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === 'saving'}
        className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25 disabled:opacity-50"
      >
        {status === 'saving' ? 'Saving…' : 'Get updates'}
      </button>
      {status === 'error' && <p className="self-center text-sm text-red-200">Could not save. Please try again.</p>}
    </form>
  );
}
