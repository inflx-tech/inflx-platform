import { postStatusMeta } from '../CreateScreen';

describe('create-tab modules', () => {
  it('CreateScreen requires and default-exports a component', () => {
    expect(() => require('../CreateScreen')).not.toThrow();
    expect(typeof require('../CreateScreen').default).toBe('function');
  });
});

describe('postStatusMeta — moderation status → label + tone', () => {
  it('maps each status', () => {
    expect(postStatusMeta('submitted')).toEqual({ label: 'In review', tone: 'you' });
    expect(postStatusMeta('approved')).toEqual({ label: 'Live', tone: 'done' });
    expect(postStatusMeta('rejected')).toEqual({ label: 'Rejected', tone: 'closed' });
    expect(postStatusMeta('draft')).toEqual({ label: 'Draft', tone: 'neutral' });
  });
  it('falls back to Draft/neutral for unknown', () => {
    expect(postStatusMeta('whatever')).toEqual({ label: 'Draft', tone: 'neutral' });
  });
});
