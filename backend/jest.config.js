'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: './tests/setup.js',
  globalTeardown: './tests/teardown.js',
  testTimeout: 30000,
  // Run each test file serially (--runInBand) to avoid DB race conditions.
  // This is set in the npm script, but repeated here for clarity.
  verbose: true,
};
