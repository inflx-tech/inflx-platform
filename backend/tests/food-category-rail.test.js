'use strict';
/** world_categories rule — the placeable category rail (Food 3C #1). */
const { runRule } = require('../src/services/sectionRules.service');
const { truncateAll, query } = require('./helpers/db');

beforeEach(async () => { await truncateAll(); });

describe('world_categories rule (category rail)', () => {
  it("returns a world's enabled vertical categories, ordered; excludes disabled + other worlds", async () => {
    await query(`DELETE FROM follower_vertical_categories`);
    await query(`INSERT INTO follower_vertical_categories (vertical_key, key, name, enabled, sort_order) VALUES
      ('food','pizza','Pizza',true,2),('food','biryani','Biryani',true,1),
      ('food','hidden','Hidden',false,3),('fashion','jeans','Jeans',true,1)`);
    const items = await runRule('world_categories', { categoryKey: 'food' });
    expect(items.map(i => i.name)).toEqual(['Biryani', 'Pizza']);
    expect(items[0].entity_type).toBe('category');
    expect(items[0].key).toBe('biryani');
  });
  it('empty when no world key', async () => {
    expect(await runRule('world_categories', {})).toEqual([]);
  });
});
