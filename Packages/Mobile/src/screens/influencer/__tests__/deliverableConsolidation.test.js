import { deliverableStatusMeta } from '../DeliverableScreen';

describe('deliverable-consolidation', () => {
  it('unified DeliverableScreen requires + default-exports a component', () => {
    expect(() => require('../DeliverableScreen')).not.toThrow();
    expect(typeof require('../DeliverableScreen').default).toBe('function');
  });
});

describe('deliverableStatusMeta', () => {
  it('maps deliverable statuses to label + tone', () => {
    expect(deliverableStatusMeta('pending')).toEqual({ label: 'Pending', tone: 'neutral' });
    expect(deliverableStatusMeta('submitted')).toEqual({ label: 'In review', tone: 'brand' });
    expect(deliverableStatusMeta('under_review')).toEqual({ label: 'In review', tone: 'brand' });
    expect(deliverableStatusMeta('approved')).toEqual({ label: 'Approved', tone: 'you' });
    expect(deliverableStatusMeta('revision_requested')).toEqual({ label: 'Revision', tone: 'you' });
    expect(deliverableStatusMeta('live')).toEqual({ label: 'Live', tone: 'done' });
  });
  it('falls back gracefully for unknown', () => {
    expect(deliverableStatusMeta('weird_state')).toEqual({ label: 'weird state', tone: 'neutral' });
  });
});
