import { createHash } from 'node:crypto';
import type { WorkflowType } from '@callflow/shared';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

export function computeIdempotencyKey(
  callId: string,
  type: WorkflowType,
  input: unknown,
): string {
  return createHash('sha256')
    .update(`${callId}|${type}|${stableStringify(input)}`)
    .digest('hex');
}
