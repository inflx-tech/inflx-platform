'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: './tests/setup.js',
  globalTeardown: './tests/teardown.js',
  // Per-worker teardown: closes the pg pools created inside each
  // test file's sandbox (globalTeardown runs in a separate process
  // and cannot). Eliminates the leaked TCPWRAP handles so Jest
  // exits cleanly WITHOUT --forceExit. Contract: qa-db-determinism.
  setupFilesAfterEnv: ['<rootDir>/tests/jest.afterEnv.js'],
  testTimeout: 30000,
  // Run each test file serially (--runInBand) to avoid DB race conditions.
  // This is set in the npm script, but repeated here for clarity.
  verbose: true,
};
