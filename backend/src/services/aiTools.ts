import { tool, zodSchema, type Schema } from 'ai';
import { enqueueAndAwaitWorkflow } from '@callflow/workflows';
import { WorkflowType } from '@callflow/shared';
import type { ZodTypeAny } from 'zod';
import {
  checkCustomerStatusSchema,
  createTicketSchema,
  scheduleAppointmentSchema,
  recordCallerEmailSchema,
  endCallSchema,
  getCallTicketSchema,
  getCallerContextSchema,
  type CheckCustomerStatusInput,
  type CreateTicketInput,
  type ScheduleAppointmentInput,
  type RecordCallerEmailInput,
  type EndCallInput,
  type GetCallTicketInput,
  type GetCallerContextInput,
} from '@callflow/shared/schemas';
import { prisma } from '../database/client';
import { searchMemoryForCall } from './memory';

// Passing a zod schema straight to tool({ inputSchema }) trips TS2589
// ("instantiation excessively deep") on ai-sdk v6 + zod 3.25. zodSchema()
// keeps the runtime parse and drops the generic the compiler chokes on.
const toSchema = <T>(s: ZodTypeAny): Schema<T> =>
  zodSchema(s as never) as unknown as Schema<T>;

const checkCustomerStatus = toSchema<CheckCustomerStatusInput>(checkCustomerStatusSchema);
const createTicket = toSchema<CreateTicketInput>(createTicketSchema);
const scheduleAppointment = toSchema<ScheduleAppointmentInput>(scheduleAppointmentSchema);
const recordCallerEmail = toSchema<RecordCallerEmailInput>(recordCallerEmailSchema);
const endCall = toSchema<EndCallInput>(endCallSchema);
const getCallTicket = toSchema<GetCallTicketInput>(getCallTicketSchema);
const getCallerContext = toSchema<GetCallerContextInput>(getCallerContextSchema);

export function buildAiSdkTools(callId: string, opts: { requestId?: string } = {}) {
  const runAndWait = (type: WorkflowType, args: unknown) =>
    enqueueAndAwaitWorkflow(callId, type, args, { requestId: opts.requestId });

  return {
    record_caller_email: tool({
      description: 'Save the caller email on the call. Read it back letter-by-letter first.',
      inputSchema: recordCallerEmail,
      execute: async ({ email }) => {
        const user = await prisma.user.upsert({
          where: { email },
          create: { email },
          update: {},
        });
        await prisma.call.update({
          where: { id: callId },
          data: { callerEmail: email, userId: user.id },
        });
        return { saved: true, email };
      },
    }),

    get_caller_context: tool({
      description:
        'Pull prior-call memories for the caller (keyed on their email). Use after record_caller_email ' +
        'has succeeded so you can welcome returning callers with real context.',
      inputSchema: getCallerContext,
      execute: async ({ query }) => {
        const { memories } = await searchMemoryForCall(callId, query ?? undefined);
        return { memories };
      },
    }),

    check_customer_status: tool({
      description: 'Look up a customer account by email. Returns the account record.',
      inputSchema: checkCustomerStatus,
      execute: async (args) => {
        const r = await runAndWait(WorkflowType.CHECK_CUSTOMER, args);
        if (r.status === 'completed') return (r.output as any) ?? { ok: true };
        return { status: r.status, workflowId: r.workflowId, error: r.error };
      },
    }),

    create_ticket: tool({
      description: 'Open a support ticket when the caller reports a problem. Returns the ticket.',
      inputSchema: createTicket,
      execute: async (args) => {
        const r = await runAndWait(WorkflowType.CREATE_TICKET, args);
        if (r.status === 'completed') return (r.output as any) ?? { ok: true };
        return { status: r.status, workflowId: r.workflowId, error: r.error };
      },
    }),

    get_call_ticket: tool({
      description:
        'Returns the ticket attached to this call. Use to read a ticket ID back to the caller.',
      inputSchema: getCallTicket,
      execute: async () => {
        const call = await prisma.call.findUnique({
          where: { id: callId },
          select: { ticketId: true },
        });
        if (!call?.ticketId) return { ticket: null };
        const wf = await prisma.workflow.findFirst({
          where: { callId, type: 'create_ticket', status: 'completed' },
          orderBy: { completedAt: 'desc' },
          select: { output: true },
        });
        const persisted = (wf?.output as any)?.ticket;
        return { ticket: persisted ?? { id: call.ticketId } };
      },
    }),

    schedule_appointment: tool({
      description: 'Book an appointment. Confirm date and time before calling. Returns the appointment.',
      inputSchema: scheduleAppointment,
      execute: async (args) => {
        const r = await runAndWait(WorkflowType.SCHEDULE_APPOINTMENT, args);
        if (r.status === 'completed') return (r.output as any) ?? { ok: true };
        return { status: r.status, workflowId: r.workflowId, error: r.error };
      },
    }),

    end_call: tool({
      description: 'Hang up. Use when caller says goodbye or asks to end the call.',
      inputSchema: endCall,
      execute: async ({ reason }) => {
        const existing = await prisma.call.findUnique({ where: { id: callId } });
        if (existing) {
          const endedAt = new Date();
          const duration = Math.floor((endedAt.getTime() - existing.startedAt.getTime()) / 1000);
          await prisma.call.update({
            where: { id: callId },
            data: { status: 'completed', endedAt, duration },
          });
        }
        return { ended: true, reason: reason ?? null };
      },
    }),
  };
}
