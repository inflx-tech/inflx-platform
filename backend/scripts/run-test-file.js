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
      toBeUndefined: () => check(actual === undefined, `expected undefined, got ${show(actual)}`),
      toHaveLength: e => check(actual && actual.length === e,
        `expected length ${e}, got ${actual && actual.length}`),
      // Added when a check needed it, rather than the check being rewritten around the gap.
      // A runner that quietly lacks what tests want to say pushes people towards weaker tests.
      // 'actual' must be a function here — expect(() => f()).toThrow(). Calling a non-function
      // fails rather than silently reporting "did not throw".
      toThrow: (e) => {
        if (typeof actual !== 'function') {
          return check(false, `toThrow needs a function, got ${show(actual)}`);
        }
        let threw = null;
        try { actual(); } catch (err) { threw = err; }
        if (!threw) return check(false, 'expected the function to throw, and it did not');
        const msg = String(threw && threw.message);
        // A real message on the pass branch too, so `.not.toThrow()` can say what was thrown
        // instead of printing an empty "NOT".
        if (e === undefined) return check(true, `the function threw ${show(msg)}`);
        return check(
          e instanceof RegExp ? e.test(msg) : msg.includes(String(e)),
          // show() renders a RegExp as {} — String() is what a reader needs here.
          `expected the thrown message ${show(msg)} to match ${e instanceof RegExp ? String(e) : show(e)}`);
      },
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

/**
 * .each — jest's table form. Added when a suite needed it rather than the suite being
 * rewritten around the shim: a runner that quietly lacks what the tests use pushes people
 * towards weaker tests, which is the slow version of fake green.
 *
 * Supports the array-of-values and array-of-arrays forms, and %s / %d / %i substitution.
 */
const eachFor = (register) => (rows) => (name, fn) => {
  (rows || []).forEach((row) => {
    const args = Array.isArray(row) ? row : [row];
    let i = 0;
    const title = String(name).replace(/%[sdi]/g, () => String(args[i++]));
    register(title, () => fn(...args));
  });
};
global.test.each = eachFor(global.test);
global.it = global.test;
global.it.each = global.test.each;
global.describe.each = eachFor((n, f) => global.describe(n, f));
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
