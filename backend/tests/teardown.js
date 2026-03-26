'use strict';

/**
 * Jest globalTeardown — runs once after all test suites.
 * The pg Pool in db.js drains automatically when the process exits.
 * Nothing explicit needed here; this file exists for future cleanup hooks.
 */

module.exports = async () => {
  // Pool closes when Node process exits
};
