import { v4 as uuidv4 } from 'uuid';
import logger from '@callflow/shared/logger';
import { createTicketSchema, type CreateTicketInput } from '@callflow/shared/schemas';

const RESEND_API = 'https://api.resend.com/emails';

async function sendTicketEmail(
  ticketId: string,
  input: CreateTicketInput,
): Promise<{ delivered: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.RESEND_TO_EMAIL;
  if (!apiKey || !from || !to) {
    logger.info('ticket.email.skipped', { ticketId, reason: 'resend-not-configured' });
    return { delivered: false, error: 'not-configured' };
  }

  const body = {
    from,
    to: [to],
    subject: `New support ticket: ${ticketId}`,
    text:
      `Ticket ${ticketId}\n` +
      `Priority: ${input.priority ?? 'medium'}\n` +
      `Category: ${input.category ?? 'general'}\n\n` +
      `${input.description}\n`,
  };

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error('ticket.email.failed', { ticketId, status: res.status, body: text });
    throw new Error(`resend ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { id?: string };
  logger.info('ticket.email.sent', { ticketId, messageId: data.id });
  return { delivered: true, messageId: data.id };
}

export async function createTicket(rawInput: unknown): Promise<unknown> {
  const input: CreateTicketInput = createTicketSchema.parse(rawInput);
  const ticketId = `TICK-${uuidv4().substring(0, 8).toUpperCase()}`;
  logger.info('ticket.create', { ticketId, priority: input.priority });

  const email = await sendTicketEmail(ticketId, input);

  return {
    success: true,
    ticket: {
      id: ticketId,
      description: input.description,
      priority: input.priority ?? 'medium',
      category: input.category ?? 'general',
      status: email.delivered ? 'notified' : 'open',
      createdAt: new Date().toISOString(),
      email,
    },
  };
}
