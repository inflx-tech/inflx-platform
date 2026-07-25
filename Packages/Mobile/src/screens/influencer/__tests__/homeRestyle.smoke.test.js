/* Smoke — features/home-restyle. Confirms the restyled HomeScreen parses and its
   imports (ig tokens, collabStages, CollabRow.badgeFor) resolve. */
describe('home-restyle', () => {
  it('HomeScreen requires and default-exports a component', () => {
    expect(() => require('../HomeScreen')).not.toThrow();
    expect(typeof require('../HomeScreen').default).toBe('function');
  });
});
