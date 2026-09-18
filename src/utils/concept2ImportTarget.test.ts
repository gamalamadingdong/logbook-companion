import { describe, expect, it } from 'vitest';
import { concept2ImportTarget } from '../../supabase/functions/_shared/concept2/importTarget';

describe('Concept2 import reconciliation', () => {
  it('keeps the provider result as a separate import when a nearby LC-owned row matches', () => {
    expect(concept2ImportTarget({ id: 'manual-id', source: 'manual', external_id: null }, '86940')).toBeUndefined();
    expect(concept2ImportTarget({ id: 'capture-id', source: 'erg_link_live', external_id: null }, '86940')).toBeUndefined();
  });

  it('updates only the row already carrying that exact provider result ID', () => {
    expect(concept2ImportTarget({ id: 'provider-id', source: 'concept2', external_id: '86940' }, '86940')).toBe('provider-id');
    expect(concept2ImportTarget({ id: 'other-result', source: 'concept2', external_id: '86939' }, '86940')).toBeUndefined();
  });
});
