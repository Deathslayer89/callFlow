import logger from '@callflow/shared/logger';
import { checkCustomerStatusSchema, type CheckCustomerStatusInput } from '@callflow/shared/schemas';

/**
 * Mock customer lookup. Swap this for your real CRM call when shipping —
 * the input contract is locked by the Zod schema so the tool layer can't
 * send anything this function doesn't expect.
 */
export async function checkCustomerStatus(rawInput: unknown): Promise<unknown> {
  const input: CheckCustomerStatusInput = checkCustomerStatusSchema.parse(rawInput);
  logger.info('Checking customer status', { email: input.email });

  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    success: true,
    customer: {
      email: input.email,
      status: 'active',
      accountType: 'premium',
      registeredAt: '2023-01-15',
      lastPurchase: '2024-01-10',
      totalOrders: 15,
      lifetimeValue: 2450.0,
    },
  };
}
