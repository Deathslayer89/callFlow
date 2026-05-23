import { WorkflowType } from '@callflow/shared';
import logger from '@callflow/shared/logger';
import { checkCustomerStatus } from '../activities/customerStatus';
import { createTicket } from '../activities/createTicket';
import { scheduleAppointment } from '../activities/scheduleAppointment';
import { summarizeCall } from '../activities/summarizeCall';

/** Dispatches a workflow type to the matching activity. */
export async function executeWorkflow(type: WorkflowType, input: unknown): Promise<unknown> {
  logger.info('Executing workflow', { type });

  switch (type) {
    case WorkflowType.CHECK_CUSTOMER:
      return checkCustomerStatus(input);
    case WorkflowType.CREATE_TICKET:
      return createTicket(input);
    case WorkflowType.SCHEDULE_APPOINTMENT:
      return scheduleAppointment(input);
    case WorkflowType.SUMMARIZE_CALL:
      return summarizeCall(input);
    default:
      throw new Error(`Unknown workflow type: ${type}`);
  }
}
