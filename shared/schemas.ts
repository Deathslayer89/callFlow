import { z } from 'zod';

/**
 * Wire contracts for workflow inputs. Used by:
 *  - the voice agent's LiveKit tools (validates model output)
 *  - the text agent's ai-sdk tools (same)
 *  - workflow activities (validates queue payloads before executing)
 *
 * Keeping them here means the model can't invent argument shapes that
 * later blow up in the worker.
 */

export const checkCustomerStatusSchema = z.object({
  email: z.string().email().describe("Customer's email address"),
});

export const createTicketSchema = z.object({
  // Keep this schema simple — OpenAI's strict-mode JSON schema rejects some
  // zod refinements (e.g. `.positive()` becomes `exclusiveMinimum: true`).
  // Use `.nullish()` on optional fields: LLMs often pass `null` instead of
  // omitting them, and plain `.optional()` rejects null.
  description: z.string().describe('What the caller reported'),
  priority: z.enum(['low', 'medium', 'high']).nullish(),
  category: z.string().nullish().describe('Issue category, e.g. billing, technical'),
});

export const scheduleAppointmentSchema = z.object({
  date: z.string().describe('Appointment date as YYYY-MM-DD'),
  time: z.string().describe('Appointment time as HH:MM in 24-hour format'),
  duration: z.number().nullish().describe('Duration in minutes (positive integer)'),
  notes: z.string().nullish(),
});

// STT often mangles emails — "@" comes back as "at" or "thread", "." as "dot".
// Normalize before validating so the LLM can pass through what it heard.
export function normalizeSpokenEmail(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+(at|thread)\s+/g, '@')
    .replace(/\s+dot\s+/g, '.')
    .replace(/\s+underscore\s+/g, '_')
    .replace(/\s+(dash|hyphen)\s+/g, '-')
    .replace(/\s+/g, '');
}

export const recordCallerEmailSchema = z.object({
  email: z
    .string()
    .min(1)
    .transform(normalizeSpokenEmail)
    .pipe(z.string().email())
    .describe('Caller email. Spoken words like "at"/"dot" will be normalized.'),
});

export const endCallSchema = z.object({
  reason: z.string().nullish().describe('Short reason e.g. "caller hung up", "resolved"'),
});

export const getCallTicketSchema = z.object({});

export const getCallerContextSchema = z.object({
  query: z
    .string()
    .nullish()
    .describe(
      'Optional natural-language query (e.g. the topic the caller just brought up). ' +
      'Leave empty for a general "recent context" pull.',
    ),
});

export type CheckCustomerStatusInput = z.infer<typeof checkCustomerStatusSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ScheduleAppointmentInput = z.infer<typeof scheduleAppointmentSchema>;
export type RecordCallerEmailInput = z.infer<typeof recordCallerEmailSchema>;
export type EndCallInput = z.infer<typeof endCallSchema>;
export type GetCallTicketInput = z.infer<typeof getCallTicketSchema>;
export type GetCallerContextInput = z.infer<typeof getCallerContextSchema>;
