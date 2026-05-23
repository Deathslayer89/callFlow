/**
 * Re-export so internal agent files can `import * as schemas from './schemas.js'`
 * without dragging in the full shared package surface. Single source
 * of truth lives in @callflow/shared/schemas.
 */
export {
  checkCustomerStatusSchema as checkCustomerStatus,
  createTicketSchema as createTicket,
  scheduleAppointmentSchema as scheduleAppointment,
  recordCallerEmailSchema as recordCallerEmail,
  endCallSchema as endCall,
  getCallTicketSchema as getCallTicket,
  getCallerContextSchema as getCallerContext,
} from '@callflow/shared/schemas';
