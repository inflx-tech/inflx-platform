/* Smoke — features/tracking-social. CollabTrackingScreen parses + imports resolve. */
describe('tracking-social', () => {
  it('CollabTrackingScreen requires + default-exports a component', () => {
    expect(() => require('../CollabTrackingScreen')).not.toThrow();
    expect(typeof require('../CollabTrackingScreen').default).toBe('function');
  });
});
