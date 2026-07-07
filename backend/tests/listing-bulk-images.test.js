'use strict';

/**
 * Bulk-import image-URL parsing (contract: listing-image-urls).
 * - the same URLs repeated across a colour's size rows must dedup to the unique
 *   set (founder hit 12 images/colour = 3 URLs × 4 size rows);
 * - a cell may separate URLs by comma OR newline (brands paste either).
 * buildItems is pure (no DB).
 */

const { buildItems } = require('../src/services/listingBulk.service');

const node = { size_system: 'alpha', vertical: 'fashion', segment: 'Men', category: 'Topwear', name: 'Polo' };
const facets = [
  { facet_key: 'color_tone', label: 'Colour', input_type: 'single_select', required: 'required', allowed_values: ['Navy', 'White'] },
  { facet_key: 'size', label: 'Size', input_type: 'single_select', allowed_values: ['S', 'M', 'L'] },
];

describe('bulk import — colour image URL parsing', () => {
  it('dedups URLs repeated across a colour\'s size rows; splits comma AND newline', () => {
    const navyUrls = 'https://x/1.jpg, https://x/2.jpg, https://x/3.jpg';
    const rows = [
      // Navy: same 3 comma-separated URLs on TWO size rows → must dedup to 3.
      { Name: 'Classic Polo', Price: '999', Colour: 'Navy', Size: 'S', 'Colour image URLs': navyUrls },
      { Name: 'Classic Polo', Price: '999', Colour: 'Navy', Size: 'M', 'Colour image URLs': navyUrls },
      // White: newline-separated URLs in one cell → must split to 2.
      { Name: 'Classic Polo', Price: '999', Colour: 'White', Size: 'S', 'Colour image URLs': 'https://y/1.jpg\nhttps://y/2.jpg' },
    ];

    const { items, fileErrors } = buildItems(rows, node, facets);
    expect(fileErrors).toEqual([]);
    expect(items).toHaveLength(1);

    const byColour = Object.fromEntries(items[0].variants.map(v => [v.color, v.__image_urls]));
    expect(byColour.Navy).toEqual(['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']); // 3, not 6
    expect(byColour.White).toEqual(['https://y/1.jpg', 'https://y/2.jpg']);                    // newline split
  });
});
