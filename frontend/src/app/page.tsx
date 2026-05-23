'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const { data: callsData } = useQuery({
    queryKey: ['calls'],
    queryFn: () => api.getCalls({ page: 1, limit: 10 }),
  });

  const startVoiceCall = async () => {
    setStarting(true);
    try {
      const res = await api.startCall({ metadata: { source: 'dashboard' } });
      router.push(`/calls/${res.data.id}/voice`);
    } catch (err) {
      console.error('Failed to start call', err);
      setStarting(false);
    }
  };

  const calls = callsData?.data || [];
  const total = callsData?.pagination?.total ?? 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-mono font-semibold text-sm">callflow</span>
            <span className="text-xs text-neutral-500">
              {total} {total === 1 ? 'call' : 'calls'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="px-3 py-1.5 rounded-md border border-neutral-200 text-sm hover:bg-neutral-50"
            >
              Chat
            </Link>
            <button
              onClick={startVoiceCall}
              disabled={starting}
              className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-sm hover:bg-neutral-800 disabled:opacity-50"
            >
              {starting ? 'Starting…' : 'New call'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h1 className="text-sm font-medium text-neutral-900">Recent calls</h1>
            <Link href="/calls" className="text-xs text-neutral-500 hover:text-neutral-900">
              All →
            </Link>
          </div>
          <CallList calls={calls} />
        </section>
      </main>
    </div>
  );
}

function CallList({ calls }: { calls: any[] }) {
  if (calls.length === 0) {
    return (
      <p className="text-sm text-neutral-500 py-6">
        No calls yet. Start one with the button above.
      </p>
    );
  }

  return (
    <div className="border border-neutral-200 rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-500 bg-neutral-50">
            <th className="px-3 py-2 font-medium">Call</th>
            <th className="px-3 py-2 font-medium">Started</th>
            <th className="px-3 py-2 font-medium text-right">Duration</th>
            <th className="px-3 py-2 font-medium text-right">Cost</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c: any) => (
            <tr key={c.id} className="border-t border-neutral-200 hover:bg-neutral-50">
              <td className="px-3 py-2">
                <Link href={`/calls/${c.id}`} className="font-mono text-xs hover:underline">
                  {c.phoneNumber ?? c.id.slice(0, 8)}
                </Link>
              </td>
              <td className="px-3 py-2 text-neutral-500 text-xs">
                {new Date(c.startedAt).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs">
                {c.duration ? `${c.duration}s` : '—'}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs">
                {formatCost(c.costUsd)}
              </td>
              <td className="px-3 py-2">
                <StatusDot status={c.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'active'
      ? 'bg-emerald-500'
      : status === 'completed'
      ? 'bg-neutral-400'
      : 'bg-red-500';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {status}
    </span>
  );
}

function formatCost(value: unknown): string {
  const n = typeof value === 'string' ? Number(value) : (value as number | null | undefined);
  if (n == null || Number.isNaN(n) || n === 0) return '—';
  return n < 0.01 ? '<$0.01' : `$${n.toFixed(4)}`;
}
