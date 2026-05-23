// Import direct so this unit test doesn't load queue/client (which opens
// Redis sockets at module load).
import { computeIdempotencyKey } from '../../workflows/src/idempotency';
import { WorkflowType } from '@callflow/shared';

describe('computeIdempotencyKey', () => {
  it('is stable across key insertion order in the input object', () => {
    // The actual property we care about: if the LLM emits the same arguments
    // with keys in a different order, we still dedupe. Anything else (e.g.
    // collisions on differing inputs) is a sha256 property, not ours.
    const callId = '11111111-1111-1111-1111-111111111111';
    const a = computeIdempotencyKey(callId, WorkflowType.CREATE_TICKET, {
      description: 'router down',
      priority: 'high',
    });
    const b = computeIdempotencyKey(callId, WorkflowType.CREATE_TICKET, {
      priority: 'high',
      description: 'router down',
    });
    expect(a).toBe(b);
  });
});
