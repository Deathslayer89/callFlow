'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function CallDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data, isLoading } = useQuery({
    queryKey: ['call', id],
    queryFn: () => api.getCall(id),
  });

  const call = data?.data;

  if (isLoading) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  if (!call) {
    return <CenteredMessage>Call not found</CenteredMessage>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <Link href="/" className="font-mono text-sm font-semibold hover:underline">
            callflow
          </Link>
          <span className="text-neutral-300">/</span>
          <Link href="/calls" className="text-sm text-neutral-600 hover:text-neutral-900">
            calls
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="font-mono text-xs text-neutral-600">{id.slice(0, 8)}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-8">
        <aside className="space-y-6">
          <Meta call={call} />
          {call.workflows?.length > 0 && <Workflows items={call.workflows} />}
        </aside>

        <section>
          <h2 className="text-sm font-medium mb-3">Conversation</h2>
          {!call.messages?.length ? (
            <p className="text-sm text-neutral-500">No messages.</p>
          ) : (
            <div className="space-y-3">
              {call.messages.map((m: any) => (
                <Bubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Meta({ call }: { call: any }) {
  const cost = formatCost(call.costUsd);
  const tokens = (call.tokensInput ?? 0) + (call.tokensOutput ?? 0);
  return (
    <div>
      <h2 className="text-sm font-medium mb-3">Details</h2>
      <dl className="text-xs space-y-2">
        <Row label="Status">
          <StatusDot status={call.status} />
        </Row>
        <Row label="Phone">
          <span className="font-mono">{call.phoneNumber ?? '—'}</span>
        </Row>
        <Row label="Email">
          <span className="font-mono">{call.callerEmail ?? '—'}</span>
        </Row>
        <Row label="Ticket">
          <span className="font-mono">{call.ticketId ?? '—'}</span>
        </Row>
        <Row label="Started">{new Date(call.startedAt).toLocaleString()}</Row>
        {call.endedAt && <Row label="Ended">{new Date(call.endedAt).toLocaleString()}</Row>}
        <Row label="Duration">
          <span className="font-mono">{call.duration ? `${call.duration}s` : '—'}</span>
        </Row>
        <Row label="Tokens">
          <span className="font-mono">{tokens > 0 ? tokens.toLocaleString() : '—'}</span>
        </Row>
        <Row label="Cost">
          <span className="font-mono">{cost}</span>
        </Row>
      </dl>
    </div>
  );
}

function Workflows({ items }: { items: any[] }) {
  return (
    <div>
      <h2 className="text-sm font-medium mb-3">Workflows</h2>
      <ul className="text-xs space-y-2">
        {items.map((w) => (
          <li key={w.id} className="flex items-center justify-between">
            <span className="font-mono text-neutral-700">{w.type}</span>
            <StatusDot status={w.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Bubble({ message }: { message: any }) {
  const fromUser = message.role === 'user';
  return (
    <div className={`flex ${fromUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
          fromUser
            ? 'bg-neutral-900 text-white'
            : 'bg-neutral-100 text-neutral-900'
        }`}
      >
        <p>{message.content}</p>
        <p
          className={`mt-1 text-[10px] font-mono ${
            fromUser ? 'text-neutral-400' : 'text-neutral-500'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'active' || status === 'running'
      ? 'bg-emerald-500'
      : status === 'completed'
      ? 'bg-neutral-400'
      : status === 'pending'
      ? 'bg-amber-500'
      : 'bg-red-500';
  return (
    <span className="inline-flex items-center gap-1.5 text-neutral-600">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {status}
    </span>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-neutral-500">{children}</p>
    </div>
  );
}

function formatCost(value: unknown): string {
  const n = typeof value === 'string' ? Number(value) : (value as number | null | undefined);
  if (n == null || Number.isNaN(n) || n === 0) return '—';
  return n < 0.01 ? '<$0.01' : `$${n.toFixed(4)}`;
}
