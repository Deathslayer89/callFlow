'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: `${API_URL}/api/chat` }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput('');
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <header className="border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="font-mono text-sm font-semibold hover:underline">
          callflow
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-sm text-neutral-600">chat</span>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-400">
            Type something. The agent uses the same tools as the voice path.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-900'
              }`}
            >
              {m.parts.map((part, i) => {
                if (part.type === 'text') return <p key={i}>{part.text}</p>;
                if (part.type.startsWith('tool-')) {
                  return (
                    <p key={i} className="font-mono text-[11px] opacity-60">
                      → {part.type.replace('tool-', '')}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {status === 'streaming' && (
          <p className="font-mono text-[11px] text-neutral-400">…</p>
        )}
      </main>

      <form
        onSubmit={submit}
        className="border-t border-neutral-200 px-4 py-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message"
          className="flex-1 rounded-md border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:border-neutral-900"
          disabled={status === 'streaming'}
        />
        <button
          type="submit"
          disabled={!input.trim() || status === 'streaming'}
          className="rounded-md bg-neutral-900 text-white px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
