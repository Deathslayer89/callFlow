'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function CallsPage() {
  const { data: callsData, isLoading } = useQuery({
    queryKey: ['calls', 'all'],
    queryFn: () => api.getCalls({ page: 1, limit: 100 }),
  });

  const calls = callsData?.data ?? [];

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <Link href="/" className="font-mono text-sm font-semibold hover:underline">
            callflow
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="text-sm text-neutral-600">calls</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : calls.length === 0 ? (
          <p className="text-sm text-neutral-500">No calls yet.</p>
        ) : (
          <div className="border border-neutral-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 bg-neutral-50">
                  <th className="px-3 py-2 font-medium">Call</th>
                  <th className="px-3 py-2 font-medium">Started</th>
                  <th className="px-3 py-2 font-medium text-right">Duration</th>
                  <th className="px-3 py-2 font-medium text-right">Messages</th>
                  <th className="px-3 py-2 font-medium text-right">Cost</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c: any) => (
                  <tr key={c.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="px-3 py-2">
                      <Link
                        href={`/calls/${c.id}`}
                        className="font-mono text-xs hover:underline"
                      >
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
                      {c._count?.messages ?? 0}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-mono text-xs"
                      title={`${c.tokensInput ?? 0} in / ${c.tokensOutput ?? 0} out`}
                    >
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
        )}
      </main>
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
