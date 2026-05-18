'use strict';

/**
 * Shared B2b DB-lane constants. Side-effect free (safe to import
 * from db-up / db-down / qa-db without starting anything).
 */
export const PG_CONTAINER = 'inflx-qa-pg';
export const PG_IMAGE = 'postgres:16-alpine';
export const PG_PORT = 5544; // non-default on purpose (no silent clash)
export const TEST_DATABASE_URL = `postgresql://postgres:qa@localhost:${PG_PORT}/inflx_test`;
