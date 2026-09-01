'use strict';

/**
 * The set's new shape, as the controller handles it.
 * Contract: features/stage-a-the-set
 *
 * These are SOURCE assertions, and source assertions are exactly what has fooled this
 * project nine times — `toContain('someName')` satisfied by the import line above the
 * code being tested. So every one below asserts a RELATIONSHIP that cannot be satisfied
 * by a mention: column count against placeholder count, and a field's presence in all
 * three of the column list, the value list and the destructuring.
 *
 * Each was mutation-tested against the real controller before being kept.
 */

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'campaign.controller.js'), 'utf8'
);

const NEW_FIELDS = ['go_live_date', 'shoot_mode', 'invites_close_at'];

const NL = String.fromCharCode(10);

/**
 * The createSet INSERT, from the keyword to the end of its value array.
 *
 * The closing bracket is found by looking for a line that IS a bracket. Scanning for the
 * next ']' does NOT work: the value array contains a JSON.stringify fallback of '[]', so
 * a naive search truncates the block three lines early and silently hides the very fields
 * this file exists to check.
 *
 * The first version of this helper did exactly that — and these tests failed, correctly,
 * on the helper rather than on the controller. Kept as a note because a source-reading
 * test that quietly reads the wrong source is the same fault in a different coat.
 */
const createInsert = () => {
  const i = SRC.indexOf('INSERT INTO campaign_sets');
  expect(i).toBeGreaterThan(-1);
  const after = SRC.indexOf('RETURNING *', i);
  const close = SRC.indexOf(NL + '    ]', after);
  expect(close).toBeGreaterThan(after);
  return SRC.slice(i, close + 6);
};

describe('createSet writes the whole set', () => {
  const block = createInsert();

  test('every column has a placeholder, and every placeholder has a value', () => {
    const cols = block
      .slice(block.indexOf('(campaign_id'), block.indexOf(')\n     VALUES'))
      .split(',').map((c) => c.trim()).filter(Boolean);

    const placeholders = block.match(/\$\d+/g) || [];
    const highest = Math.max(...placeholders.map((x) => Number(x.slice(1))));

    const values = block
      .slice(block.indexOf('[') + 1)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.endsWith(',') && !l.startsWith('//'));

    // A column added without a placeholder, or a placeholder without a value, is a
    // 500 on the first real use. This is the one invariant worth pinning.
    expect(cols.length).toBe(highest);
    expect(values.length).toBe(highest);
  });

  test.each(NEW_FIELDS)('%s is written, not just accepted', (field) => {
    const cols = block.slice(block.indexOf('(campaign_id'), block.indexOf(')\n     VALUES'));
    const vals = block.slice(block.indexOf('['));
    // in the column list AND in the value array — either alone is a silent drop
    expect(cols).toContain(field);
    expect(vals).toContain(field);
  });

  test.each(NEW_FIELDS)('%s is read off req.body', (field) => {
    const destructure = SRC.slice(SRC.indexOf('const createSet'), SRC.indexOf('} = req.body;', SRC.indexOf('const createSet')));
    expect(destructure).toContain(field);
  });
});

describe('the shape is validated, not merely stored', () => {
  test('createSet asks setShape before inserting', () => {
    const fn = SRC.slice(SRC.indexOf('const createSet'), SRC.indexOf('INSERT INTO campaign_sets'));
    expect(fn).toMatch(/setShape\.validateSetShape\(/);
    // and it must ACT on the answer — a call whose result is ignored is not a check
    expect(fn).toMatch(/if \(!\w+\.ok\)/);
  });

  test('updateSet validates the MERGED shape, not just the fields sent', () => {
    const i = SRC.indexOf("'go_live_date', 'shoot_mode', 'invites_close_at',");
    const fn = SRC.slice(i, SRC.indexOf('const setClauses', i));
    expect(fn).toMatch(/setShape\.validateSetShape\(/);
    // sending invites_close_at alone must still see the STORED go_live_date
    expect(fn).toMatch(/set\.go_live_date/);
    expect(fn).toMatch(/set\.invites_close_at/);
  });

  test('an existing go-live day is not re-checked against the lead time', () => {
    // a set built last week may launch tomorrow; re-validating would make it uneditable
    // simply because time passed
    const i = SRC.indexOf("'go_live_date', 'shoot_mode', 'invites_close_at',");
    const fn = SRC.slice(i, SRC.indexOf('const setClauses', i));
    expect(fn).toMatch(/changingDay/);
  });

  test.each(NEW_FIELDS)('%s is on the updateSet allow-list', (field) => {
    const i = SRC.indexOf('const allowed = [', SRC.indexOf('const updateSet'));
    const list = SRC.slice(i, SRC.indexOf('];', i));
    expect(list).toContain(field);
  });
});

describe('duplicating a set keeps its shape', () => {
  test('the copy carries the day and the mode across', () => {
    const i = SRC.lastIndexOf('INSERT INTO campaign_sets');
    const block = SRC.slice(i, SRC.indexOf('RETURNING *', i));
    expect(block).toContain('SELECT campaign_id');   // this is the duplicate, not the create
    for (const f of NEW_FIELDS) {
      // twice: once in the column list, once in the SELECT
      expect(block.split(f).length - 1).toBeGreaterThanOrEqual(2);
    }
  });
});
