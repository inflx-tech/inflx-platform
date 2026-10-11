'use strict';

/**
 * Round-trip test for the Excel bulk-add service (contract: listing-excel-bulk).
 * No DB/HTTP — exercises template build → fill → parse → group → validateItem.
 *   node scripts/test-listing-bulk.js
 */
const ExcelJS = require('exceljs');
const bulk = require('../src/services/listingBulk.service');
const taxonomy = require('../src/services/taxonomy.service');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

const node = { id: 'node-saree', vertical: 'fashion', segment: 'Women', category: 'Ethnic Wear', name: 'Saree', is_leaf: true, size_system: 'free_size' };
const facets = [
  { facet_key: 'color_tone', label: 'Colour / Tone', facet_role: 'variant', input_type: 'multi_select', required: 'required', allowed_values: ['Maroon', 'Teal', 'Gold'] },
  { facet_key: 'size', label: 'Size', facet_role: 'variant', input_type: 'multi_select', required: 'optional', allowed_values: [] },
  { facet_key: 'fabric', label: 'Fabric / Material', facet_role: 'descriptive', input_type: 'single_select', required: 'required', allowed_values: ['Silk', 'Cotton', 'Linen'] },
  { facet_key: 'occasion', label: 'Occasion', facet_role: 'discovery', input_type: 'multi_select', required: 'optional', allowed_values: ['Wedding', 'Festive', 'Casual'] },
];

// Fill an in-memory workbook the way a brand would, using the live column model.
async function filledBuffer(dropHeaders = []) {
  const { cols } = bulk.columnModel(node, facets);
  // Use the REAL template headers — required ones carry a " *" marker, exactly
  // as buildTemplateWorkbook writes them. (Regression guard: the importer must
  // match "Name *" to the "Name" column spec.)
  const headers = cols.map(c => c.header + (c.required ? ' *' : '')).filter(h => !dropHeaders.includes(h.replace(/ \*$/, '')) && !dropHeaders.includes(h));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Products');
  ws.addRow(headers);
  const set = (obj) => headers.map(h => obj[h.replace(/ \*$/, '')] ?? obj[h] ?? '');
  // One product, two colours (row-per-variant) + image-URL columns.
  ws.addRow(set({ Name: 'Kanjivaram Silk', Price: '4200', Brand: 'Charvitha', Colour: 'Maroon', Stock: '12', 'Fabric / Material': 'Silk', Occasion: 'Wedding,Festive', 'Cover image URLs': 'https://x.test/c1.jpg, https://x.test/c2.jpg', 'Colour image URLs': 'https://x.test/maroon.jpg' }));
  ws.addRow(set({ Name: 'Kanjivaram Silk', Price: '4200', Brand: 'Charvitha', Colour: 'Teal', Stock: '8', 'Fabric / Material': 'Silk', Occasion: 'Wedding,Festive', 'Colour image URLs': 'https://x.test/teal.jpg' }));
  return wb.xlsx.writeBuffer();
}

(async () => {
  console.log('listing-bulk round-trip');

  // 1) Template columns
  const wb = bulk.buildTemplateWorkbook(node, facets, new Date('2026-06-12T00:00:00Z'));
  const ws = wb.getWorksheet('Products');
  const hdr = ws.getRow(1).values.filter(Boolean).map(s => String(s));
  ok(hdr.some(h => /Name \*/.test(h)) && hdr.some(h => /Price \*/.test(h)), 'template marks Name/Price required');
  // stock-asked-once: a one-size leaf (Saree) has one row per colour — no Size column, and ONE Stock column.
  ok(hdr.some(h => /Colour \*/.test(h)) && !hdr.includes('Size') && !hdr.includes('Variant stock') && hdr.filter(h => h === 'Stock').length === 1,
    'one-size template: Colour and one Stock column, no Size, no Variant stock');
  ok(!!wb.getWorksheet('Instructions'), 'template has Instructions sheet');

  // 2) Parse + group a filled file
  const buf = await filledBuffer();
  const rows = await bulk.parseRows({ originalname: 'saree.xlsx', buffer: buf });
  ok(rows.length === 2, `parsed 2 rows (got ${rows.length})`);
  const { items, fileErrors } = bulk.buildItems(rows, node, facets);
  ok(fileErrors.length === 0, 'no file errors on a good sheet');
  ok(items.length === 1, `2 colour rows grouped into 1 product (got ${items.length})`);
  const it = items[0] || {};
  ok(it.variants && it.variants.length === 2, 'item has 2 colour variants');
  ok(JSON.stringify(it.facets.color_tone) === JSON.stringify(['Maroon', 'Teal']), 'color_tone facet = [Maroon, Teal]');
  ok(Array.isArray(it.facets.occasion) && it.facets.occasion.length === 2, 'multi_select Occasion split to array');
  ok(it.facets.fabric === 'Silk', 'single_select Fabric = Silk');
  const vMaroon = (it.variants || []).find(v => v.color === 'Maroon');
  ok(vMaroon && vMaroon.sizes.length === 1 && vMaroon.sizes[0].size === 'Free Size' && vMaroon.sizes[0].stock === '12',
    'the row stock is filed under the one size of the leaf (Maroon · Free Size = 12)');
  ok(it.stock === null && JSON.stringify(it.facets.size) === JSON.stringify(['Free Size']), 'no product-level stock is sent; size facet = [Free Size]');

  // Image-URL columns (listing-image-urls): raw links collected for the controller to ingest.
  ok(hdr.includes('Cover image URLs') && hdr.includes('Colour image URLs'), 'template has image-URL columns');
  ok(Array.isArray(it.__cover_urls) && it.__cover_urls.length === 2, `cover image URLs collected (got ${it.__cover_urls?.length})`);
  ok(vMaroon && JSON.stringify(vMaroon.__image_urls) === JSON.stringify(['https://x.test/maroon.jpg']), 'per-colour image URL collected (Maroon)');

  // 3) validateItem (current specs) passes
  const errs = taxonomy.validateItem(node, facets, it);
  ok(errs.length === 0, `validateItem passes (errs: ${JSON.stringify(errs)})`);

  // 4) Stale template — a now-required column missing → file error, nothing built
  const buf2 = await filledBuffer(['Fabric / Material']);
  const rows2 = await bulk.parseRows({ originalname: 'stale.xlsx', buffer: buf2 });
  const r2 = bulk.buildItems(rows2, node, facets);
  ok(r2.fileErrors.length > 0 && /Fabric/.test(r2.fileErrors[0]), 'missing required column → re-download file error');

  // 4b) A sheet from the OLD template (it has a "Variant stock" column, even an empty one) is refused whole
  const wbOld = new ExcelJS.Workbook(); const wsO = wbOld.addWorksheet('Products');
  wsO.addRow(['Name *', 'Price *', 'Stock', 'Colour *', 'Size', 'Variant stock', 'Fabric / Material *']);
  wsO.addRow(['Old sheet saree', '900', '20', 'Maroon', 'Free Size', '', 'Silk']);
  const rowsOld = await bulk.parseRows({ originalname: 'old.xlsx', buffer: await wbOld.xlsx.writeBuffer() });
  const rOld = bulk.buildItems(rowsOld, node, facets);
  ok(rOld.items.length === 0 && rOld.fileErrors.length === 1 && rOld.fileErrors[0] === bulk.OLD_TEMPLATE, 'old-template sheet → refused with the re-download sentence');

  // 5) Bad dropdown value → per-item validation catches it
  const { cols } = bulk.columnModel(node, facets);
  const headers = cols.map(c => c.header);
  const wbBad = new ExcelJS.Workbook(); const wsB = wbBad.addWorksheet('Products');
  wsB.addRow(headers);
  wsB.addRow(headers.map(h => ({ Name: 'X', Price: '100', Colour: 'Maroon', Stock: '1', 'Fabric / Material': 'Silkk' }[h] ?? '')));
  const rowsBad = await bulk.parseRows({ originalname: 'bad.xlsx', buffer: await wbBad.xlsx.writeBuffer() });
  const rb = bulk.buildItems(rowsBad, node, facets);
  const ebad = taxonomy.validateItem(node, facets, rb.items[0]);
  ok(ebad.some(e => /Fabric/i.test(e)), 'invalid Fabric value rejected by validateItem');

  // 6) coerceItemFacets — snap case + drop unknown OPTIONAL tag (the founder's bug)
  const cit = { name: 'Z', facets: { fabric: 'cotton', occasion: ['Casual', 'Smart Casual'] } };
  const cw = bulk.coerceItemFacets([cit], facets);
  ok(cit.facets.fabric === 'Cotton', 'coerce snaps case (cotton → Cotton)');
  ok(JSON.stringify(cit.facets.occasion) === JSON.stringify(['Casual']), 'coerce drops unknown optional tag (Smart Casual kept Casual)');
  ok(cw.some(w => w.dropped === 'Smart Casual'), 'coerce reports the dropped tag as a warning');
  const cerr = taxonomy.validateItem(node, facets, { ...cit, price: '1', facets: { ...cit.facets, color_tone: ['Maroon'] } });
  ok(cerr.length === 0, 'item validates after coerce');

  console.log(`\nTOTALS: ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
