const API_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';
const API_KEY = process.env.API_KEY ?? '';

async function request<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

type CallDetailResponse = {
  data: {
    ticketId: string | null;
    workflows?: Array<{ type: string; status: string; output: unknown }>;
  };
};

export const backend = {
  saveMessage: (callId: string, role: 'user' | 'assistant', content: string) =>
    request('POST', `/calls/${callId}/messages`, { role, content, source: 'voice' }),
  recordCallerEmail: (callId: string, email: string) =>
    request('POST', `/calls/${callId}/email`, { email }),
  endCall: (callId: string) => request('POST', `/calls/end`, { callId }),
  async getCallTicket(callId: string) {
    const res = await request<CallDetailResponse>('GET', `/calls/${callId}`);
    const ticketId = res.data.ticketId;
    if (!ticketId) return null;
    const match = (res.data.workflows ?? [])
      .filter((w) => w.type === 'create_ticket' && w.status === 'completed')
      .map((w) => (w.output as any)?.ticket)
      .find((t) => t?.id === ticketId);
    return match ?? { id: ticketId };
  },
  async searchMemory(callId: string, query?: string) {
    const res = await request<{
      data: { email: string | null; memories: Array<{ id: string; text: string; createdAt?: string }> };
    }>('POST', `/memory/search`, { callId, query: query ?? null });
    return res.data;
  },
};
