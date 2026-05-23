import { llm, getJobContext } from '@livekit/agents';
import { enqueueAndAwaitWorkflow } from '@callflow/workflows';
import { WorkflowType } from '@callflow/shared';
import * as schemas from './schemas.js';
import { backend } from './backend.js';

export function buildLiveKitTools(callId: string) {
  return {
    record_caller_email: llm.tool({
      description:
        'REQUIRED whenever the caller provides their email. Persists the email on the call. ' +
        'Never tell the caller their email is "saved" or "noted" without invoking this tool.',
      parameters: schemas.recordCallerEmail,
      execute: async ({ email }) => {
        await backend.recordCallerEmail(callId, email);
        return { saved: true, email };
      },
    }),

    get_caller_context: llm.tool({
      description:
        'REQUIRED after record_caller_email succeeds. Pulls prior-call memories for this email so you ' +
        'can greet returning callers with real context ("welcome back, last time we opened a ticket about wifi"). ' +
        'Returns up to 5 memories. Skip if the caller refused email or said they are new.',
      parameters: schemas.getCallerContext,
      execute: async ({ query }) => {
        const { memories } = await backend.searchMemory(callId, query ?? undefined);
        return { memories };
      },
    }),

    check_customer_status: llm.tool({
      description:
        'REQUIRED to look up account, plan, or recent-activity info. Returns the account record. ' +
        'Never quote account details to the caller without invoking this tool first.',
      parameters: schemas.checkCustomerStatus,
      execute: async (args) => {
        const r = await enqueueAndAwaitWorkflow(callId, WorkflowType.CHECK_CUSTOMER, args);
        if (r.status === 'completed') return (r.output as any) ?? { ok: true };
        return { status: r.status, workflowId: r.workflowId, error: r.error };
      },
    }),

    create_ticket: llm.tool({
      description:
        'REQUIRED to file a support ticket. Returns the created ticket. ' +
        'Never tell the caller a ticket exists or has been filed without invoking this tool.',
      parameters: schemas.createTicket,
      execute: async (args) => {
        const r = await enqueueAndAwaitWorkflow(callId, WorkflowType.CREATE_TICKET, args);
        if (r.status === 'completed') return (r.output as any) ?? { ok: true };
        return { status: r.status, workflowId: r.workflowId, error: r.error };
      },
    }),

    get_call_ticket: llm.tool({
      description:
        'Fetches the ticket attached to this call. Mostly redundant now since create_ticket ' +
        'already returns the ticket — use this only if the caller asks about a ticket after ' +
        'returning to an earlier topic.',
      parameters: schemas.getCallTicket,
      execute: async () => {
        const ticket = await backend.getCallTicket(callId);
        return { ticket };
      },
    }),

    schedule_appointment: llm.tool({
      description:
        'REQUIRED to book an appointment. Returns the booked appointment. ' +
        'Confirm date and time with the caller aloud, then invoke. ' +
        'Never tell the caller an appointment is booked without invoking this tool.',
      parameters: schemas.scheduleAppointment,
      execute: async (args) => {
        const r = await enqueueAndAwaitWorkflow(callId, WorkflowType.SCHEDULE_APPOINTMENT, args);
        if (r.status === 'completed') return (r.output as any) ?? { ok: true };
        return { status: r.status, workflowId: r.workflowId, error: r.error };
      },
    }),

    end_call: llm.tool({
      description:
        'REQUIRED to hang up. Invoke when the caller says goodbye or asks to end the call. ' +
        'Say a one-line goodbye first.',
      parameters: schemas.endCall,
      execute: async ({ reason }) => {
        await backend.endCall(callId).catch(() => undefined);
        // Tear down the LiveKit session shortly so the agent's farewell
        // line gets through TTS before the room disconnects.
        const ctx = getJobContext(false);
        if (ctx) setTimeout(() => void ctx.shutdown('caller-requested'), 1500);
        return { ended: true, reason: reason ?? null };
      },
    }),
  };
}
