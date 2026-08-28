#!/usr/bin/env node
'use strict';

/**
 * run-test-file.js — run one jest-style test file without jest.
 *
 * WHY THIS EXISTS
 * `jest.config.js` sets `globalSetup: ./tests/setup.js`, which connects to the test database.
 * That database has been unreachable since 2026-08-22, so **every** suite in this repo dies on
 * ECONNRESET before a single assertion runs — including suites that never touch a database.
 *
 * That is a real piece of debt and this script does not fix it. What it does is stop the debt
 * from silencing checks that do not need a database at all. A test file whose connection is
 * injected is pure logic; it should not be unrunnable because an unrelated socket is down.
 *
 * Supported: describe/test/it (nested, sync + async), beforeEach/afterEach, and the matchers
 * these suites actually use. Anything unsupported THROWS rather than passing quietly — a shim
 * that silently no-ops an assertion is the fake green this repo forbids.
 *
 *   node scripts/run-test-file.js tests/stage4-parcel.test.js
 *
 * Delete this the day `pnpm qa` runs again.
 */

const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/run-test-file.js <test-file>');
  process.exit(2);
}

const eq = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => eq(a[k], b[k]));
};

const show = v => {
  if (typeof v === 'string') return JSON.stringify(v.length > 200 ? `${v.slice(0, 200)}…` : v);
  try { return JSON.stringify(v); } catch { return String(v); }
};

function makeExpect(negated = false) {
  return function expect(actual) {
    const check = (pass, msg) => {
      if (pass === negated) throw new Error(negated ? `NOT ${msg}` : msg);
    };
    const api = {
      toBe:      e => check(Object.is(actual, e), `expected ${show(actual)} to be ${show(e)}`),
      toEqual:   e => check(eq(actual, e), `expected ${show(actual)} to equal ${show(e)}`),
      toContain: e => check(
        typeof actual === 'string' ? actual.includes(e) : Array.isArray(actual) && actual.includes(e),
        `expected ${show(actual)} to contain ${show(e)}`),
      toMatch:   e => check(
        (e instanceof RegExp ? e : new RegExp(e)).test(String(actual)),
        `expected ${show(actual)} to match ${e}`),
      toBeLessThan:    e => check(actual < e, `expected ${show(actual)} < ${show(e)}`),
      toBeGreaterThan: e => check(actual > e, `expected ${show(actual)} > ${show(e)}`),
      toBeGreaterThanOrEqual: e => check(actual >= e, `expected ${show(actual)} >= ${show(e)}`),
      toBeLessThanOrEqual:    e => check(actual <= e, `expected ${show(actual)} <= ${show(e)}`),
      toBeTruthy:  () => check(!!actual, `expected ${show(actual)} to be truthy`),
      toBeFalsy:   () => check(!actual, `expected ${show(actual)} to be falsy`),
      toBeNull:    () => check(actual === null, `expected ${show(actual)} to be null`),
      toBeDefined: () => check(actual !== undefined, 'expected a value, got undefined'),
      toHaveLength: e => check(actual && actual.length === e,
        `expected length ${e}, got ${actual && actual.length}`),
    };
    // Anything not listed above must fail loudly, not pass by absence.
    return new Proxy(negated ? api : { ...api, not: makeExpect(true)(actual) }, {
      get(t, k) {
        if (k in t) return t[k];
        if (typeof k === 'string') {
          return () => { throw new Error(`matcher "${k}" is not supported by this shim — run it under jest`); };
        }
        return undefined;
      },
    });
  };
}

const stack = [];
const cases = [];
const hooks = { before: [], after: [] };

global.describe = (name, fn) => { stack.push(name); fn(); stack.pop(); };
global.beforeEach = fn => hooks.before.push(fn);
global.afterEach  = fn => hooks.after.push(fn);
global.test = (name, fn) => cases.push({ path: [...stack, name], fn });
global.it = global.test;
global.expect = makeExpect();

require(path.resolve(file));

(async () => {
  let pass = 0;
  const failures = [];
  let group = '';
  for (const c of cases) {
    const g = c.path.slice(0, -1).join(' › ');
    if (g !== group) { group = g; console.log(`\n${group}`); }
    try {
      for (const h of hooks.before) await h();
      await c.fn();
      for (const h of hooks.after) await h();
      pass += 1;
      console.log(`  PASS  ${c.path[c.path.length - 1]}`);
    } catch (err) {
      failures.push({ name: c.path.join(' › '), err });
      console.log(`  FAIL  ${c.path[c.path.length - 1]}`);
      console.log(`        ${err.message}`);
    }
  }
  console.log(`\n${pass}/${cases.length} passed`);
  if (failures.length) {
    console.log(`\n${failures.length} FAILED:`);
    failures.forEach(f => console.log(`  - ${f.name}\n      ${f.err.message}`));
  }
  process.exit(failures.length ? 1 : 0);
})();
