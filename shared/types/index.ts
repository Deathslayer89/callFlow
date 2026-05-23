/**
 * Shared enums. Kept narrow: only values the database + queue contracts
 * actually persist. Everything else (message shapes, tool args, etc.)
 * comes from Prisma's generated types or the relevant SDK.
 */

export enum WorkflowType {
  CHECK_CUSTOMER = 'check_customer',
  CREATE_TICKET = 'create_ticket',
  SCHEDULE_APPOINTMENT = 'schedule_appointment',
  SUMMARIZE_CALL = 'summarize_call',
}
