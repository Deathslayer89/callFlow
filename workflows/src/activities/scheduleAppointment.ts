import { v4 as uuidv4 } from 'uuid';
import logger from '@callflow/shared/logger';
import {
  scheduleAppointmentSchema,
  type ScheduleAppointmentInput,
} from '@callflow/shared/schemas';

export async function scheduleAppointment(rawInput: unknown): Promise<unknown> {
  const input: ScheduleAppointmentInput = scheduleAppointmentSchema.parse(rawInput);
  logger.info('Scheduling appointment', { date: input.date, time: input.time });

  await new Promise((resolve) => setTimeout(resolve, 600));

  const appointmentId = `APPT-${uuidv4().substring(0, 8).toUpperCase()}`;
  return {
    success: true,
    appointment: {
      id: appointmentId,
      date: input.date,
      time: input.time,
      duration: input.duration ?? 30,
      notes: input.notes ?? '',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      meetingLink: `https://meet.example.com/${appointmentId}`,
    },
  };
}
