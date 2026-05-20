'use strict';

/**
 * Shared local-dev DB constants. Side-effect free.
 * Distinct from db-config.mjs (qa:db ephemeral; container inflx-qa-pg,
 * port 5544, ephemeral volume). The two containers can coexist on
 * the founder's machine without collision.
 *
 * Contract: features/setup-local-dev-environment/
 */
export const PG_CONTAINER = 'inflx-dev-pg';
export const PG_IMAGE = 'postgres:16-alpine';
export const PG_PORT = 5433;
export const PG_VOLUME = 'inflx-dev-pgdata';
export const DB_NAME = 'inflx_dev';
export const DB_USER = 'postgres';
export const DB_PASS = 'dev';
export const DEV_DATABASE_URL =
  `postgresql://${DB_USER}:${DB_PASS}@localhost:${PG_PORT}/${DB_NAME}`;
