'use strict';

/**
 * listingBulk.service.js — Excel bulk-add for the drill-down listing engine
 * (contract: features/listing-excel-bulk).
 *
 * A per-leaf template is GENERATED LIVE from the leaf's current facet_definitions
 * (never stored), so a spec change auto-propagates to the sheet. The importer
 * parses the same shape back, groups row-per-variant, and hands items[] to the
 * SAME taxonomy.validateItem + insertProducts path the UI uses.
 */

const ExcelJS = require('exceljs');

const COLOR_KEY = 'color_tone';
const SIZE_KEY = 'size';

// Mirrors the brand-web wizard's size systems (clothing). Furniture variant
// facets carry their own allowed_values and never reach here.
const SIZE_SYSTEMS = {
  alpha: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  plus_alpha: ['XL', '2XL', '3XL', '4XL', '5XL', '6XL'],
  waist_in: ['26', '28', '30', '32', '34', '36', '38', '40', '42', '44'],
  waist_plus: ['38', '40', '42', '44', '46', '48', '50'],
  bra: ['30', '32', '34', '36', '38', '40', '42', '44'],
  age: ['0-3m', '3-6m', '6-12m', '12-18m', '18-24m', '2-3y', '3-4y', '4-5y', '5-6y', '6-7y', '7-8y', '8-9y', '9-10y', '10-11y', '11-12y', '13-14y', '15-16y'],
  uk_women: ['UK2', 'UK3', 'UK4', 'UK5', 'UK6', 'UK7', 'UK8', 'UK9'],
  uk_men: ['UK5', 'UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12'],
  kids_shoe: ['UK4', 'UK5', 'UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12', 'UK13'],
  ring: ['Adjustable', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
  bangle: ['2.4', '2.6', '2.8', '2.10', 'Free'], sock_size: ['S', 'M', 'L', 'Free'],
  free_size: ['Free Size'], one_size: ['One Size'], unstitched: ['Unstitched'],
};
const sizeValues = (sys) => SIZE_SYSTEMS[sys] || ['Free Size'];

const norm = (s) => String(s == null ? '' : s).trim();
const lc = (s) => norm(s).toLowerCase();
// Match headers ignoring case AND the required-marker " *" the template adds to
// required column headers (e.g. sheet has "Name *", model has "Name").
const headerKey = (s) => lc(s).replace(/\s*\*$/, '').trim();

/**
 * The ordered column model for a leaf — the single definition both the template
 * (headers + dropdowns) and the importer (header→field map) read.
 */
function columnModel(node, facets) {
  const colorFacet = facets.find(f => f.facet_key === COLOR_KEY) || null;
  const sizeFacet = facets.find(f => f.facet_key === SIZE_KEY) || null;
  const hasVariants = !!colorFacet;
  // Detail columns = everything that isn't a fixed/handled field.
  const detail = facets.filter(f => !['images', 'price', COLOR_KEY, SIZE_KEY, 'brand'].includes(f.facet_key)
    && f.facet_role !== 'media' && f.facet_role !== 'price');

  const dropdown = (f) => {
    if (f.input_type === 'boolean') return ['Yes', 'No'];
    if ((f.input_type === 'single_select') && Array.isArray(f.allowed_values) && f.allowed_values.length > 1) return f.allowed_values;
    return null; // multi_select → comma-separated free text; number/text → free
  };

  const cols = [
    { header: 'Name', field: 'name', required: true },
    { header: 'Price', field: 'price', required: true },
    { header: 'Brand', field: 'brand' },
    { header: 'Description', field: 'description', note: 'optional shopper-facing description' },
    { header: 'Stock', field: 'stock', note: 'base stock (optional)' },
    ...detail.map(f => ({
      header: f.label, field: 'facet', facet: f, required: f.required === 'required',
      list: dropdown(f), multi: f.input_type === 'multi_select',
    })),
  ];
  if (hasVariants) {
    cols.push({ header: 'Colour', field: 'color', required: true,
      list: (Array.isArray(colorFacet.allowed_values) && colorFacet.allowed_values.length > 1) ? colorFacet.allowed_values : null });
    if (sizeFacet) cols.push({ header: 'Size', field: 'size', list: sizeValues(node.size_system) });
    cols.push({ header: 'Variant stock', field: 'variant_stock', note: 'stock for this colour+size row' });
  }
  // Image-URL columns (contract: listing-image-urls). Ingested server-side on
  // import; comma-separate multiple. Cover is product-level; Colour attaches to
  // that colour's row.
  cols.push({ header: 'Cover image URLs', field: 'cover_urls', note: 'image links, comma-separated; first = main' });
  if (hasVariants) cols.push({ header: 'Colour image URLs', field: 'colour_urls', note: 'image links for this colour, comma-separated' });
  return { cols, hasVariants, colorFacet, sizeFacet, detail };
}

/** Build the live .xlsx workbook for a leaf. */
function buildTemplateWorkbook(node, facets, stampDate) {
  const { cols } = columnModel(node, facets);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'INFLX'; wb.created = stampDate;
  const ws = wb.addWorksheet('Products', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = cols.map(c => ({ header: c.header + (c.required ? ' *' : ''), key: c.header, width: Math.max(12, Math.min(28, c.header.length + 6)) }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((cell, i) => {
    const c = cols[i - 1];
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c && c.required ? 'FFFFE08A' : 'FFF1F1F4' } };
  });

  // Dropdown data-validation on enumerated columns (rows 2..501). Excel inline
  // lists cap ~255 chars — fall back to free text (still validated on import).
  cols.forEach((c, idx) => {
    if (!Array.isArray(c.list) || !c.list.length) return;
    const formula = '"' + c.list.join(',') + '"';
    if (formula.length > 255) return;
    const colLetter = ws.getColumn(idx + 1).letter;
    for (let r = 2; r <= 501; r++) {
      ws.getCell(`${colLetter}${r}`).dataValidation = {
        type: 'list', allowBlank: !c.required, formulae: [formula],
        showErrorMessage: true, error: 'Pick a value from the list', errorTitle: c.header,
      };
    }
  });

  // Instructions sheet — per-column help + allowed values + a stale-detect stamp.
  const ins = wb.addWorksheet('Instructions');
  ins.columns = [{ header: 'Column', width: 24 }, { header: 'Required?', width: 12 }, { header: 'How to fill', width: 70 }];
  ins.getRow(1).font = { bold: true };
  cols.forEach(c => {
    let how = 'Free text.';
    if (c.field === 'price' || c.field === 'stock' || c.field === 'variant_stock') how = 'A number.';
    else if (Array.isArray(c.list)) how = (c.multi ? 'Comma-separate one or more of: ' : 'Pick one of: ') + c.list.join(', ');
    else if (c.multi) how = 'Comma-separate multiple values.';
    else if (c.field === 'color') how = 'The colour name (one row per colour).';
    else if (c.field === 'size') how = 'One size per row.';
    else if (c.field === 'name') how = 'Product name. Repeat the SAME name across rows that are the same product in different colours/sizes.';
    ins.addRow([c.header, c.required ? 'Yes' : 'No', how]);
  });
  ins.addRow([]);
  ins.addRow(['—', '', `Template for: ${node.segment || ''} › ${node.category || ''} › ${node.name}`]);
  ins.addRow(['—', '', `category_node_id: ${node.id}`]);
  ins.addRow(['—', '', `Specs as of: ${stampDate.toISOString().slice(0, 10)} — if you changed specs after this, re-download.`]);
  ins.addRow(['—', '', 'SKU is generated automatically — do not add a SKU column. Photos are added in the app after upload.']);

  return wb;
}

/** Parse an uploaded .xlsx/.csv into an array of { header: value } row objects. */
async function parseRows(file) {
  const fname = lc(file.originalname);
  if (fname.endsWith('.csv')) {
    const { parse } = require('csv-parse/sync');
    return parse(file.buffer, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file.buffer);
  const ws = wb.getWorksheet('Products') || wb.worksheets[0];
  if (!ws) return [];
  const headers = [];
  ws.getRow(1).eachCell((cell, col) => { headers[col] = norm(cell.text != null ? cell.text : cell.value); });
  const rows = [];
  ws.eachRow((row, rn) => {
    if (rn === 1) return;
    const obj = {}; let any = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const h = headers[col]; if (!h) return;
      const v = norm(cell.text != null ? cell.text : cell.value);
      obj[h] = v; if (v !== '') any = true;
    });
    if (any) obj.__row = rn, rows.push(obj);
  });
  return rows;
}

/**
 * Turn parsed rows into batch items, grouped row-per-variant by Name.
 * Returns { items, fileErrors }. fileErrors are template-level (e.g. a now-
 * required column is missing → re-download). Per-row/facet validation is left
 * to taxonomy.validateItem in the controller; each item carries __rows for
 * mapping those errors back to spreadsheet rows.
 */
function buildItems(rows, node, facets) {
  const { cols, hasVariants, detail } = columnModel(node, facets);
  const fileErrors = [];

  // Present headers (case-insensitive, required-marker-insensitive). Built from
  // the UNION of all rows' keys — parseRows only emits keys for non-empty cells,
  // so a single sparse first row must not hide a column that exists elsewhere.
  const present = new Set();
  rows.forEach(r => Object.keys(r).forEach(h => present.add(headerKey(h))));
  // A required column entirely absent from the sheet = stale/wrong template.
  cols.filter(c => c.required).forEach(c => {
    if (!present.has(headerKey(c.header))) fileErrors.push(`Column "${c.header}" is missing — your template is out of date, please re-download.`);
  });
  if (fileErrors.length) return { items: [], fileErrors };

  const get = (row, header) => {
    const k = Object.keys(row).find(kk => headerKey(kk) === headerKey(header));
    return k ? row[k] : '';
  };

  // Group by Name when variants are in play; else one item per row.
  const groups = new Map();
  rows.forEach((row, i) => {
    const name = norm(get(row, 'Name'));
    const key = hasVariants ? lc(name) : `__${i}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const items = [];
  for (const grp of groups.values()) {
    const first = grp[0];
    const facetVals = {};
    detail.forEach(f => {
      const raw = norm(get(first, f.label));
      if (raw === '') return;
      facetVals[f.facet_key] = (f.input_type === 'multi_select')
        ? raw.split(',').map(s => s.trim()).filter(Boolean)
        : raw;
    });

    // Split an image-URL cell on commas OR newlines (brands paste either), and
    // dedup within the cell.
    const splitUrls = (s) => [...new Set(norm(s).split(/[,\n\r]+/).map(x => x.trim()).filter(Boolean))];

    let variants;
    if (hasVariants) {
      const byColor = new Map();
      const colorImgs = new Map();
      const sizes = new Set();
      grp.forEach(row => {
        const color = norm(get(row, 'Colour')); if (!color) return;
        if (!byColor.has(color)) byColor.set(color, []);
        const size = norm(get(row, 'Size'));
        const stock = norm(get(row, 'Variant stock'));
        if (size) { byColor.get(color).push({ size, stock: stock === '' ? null : stock }); sizes.add(size); }
        const us = splitUrls(get(row, 'Colour image URLs'));
        // Dedup across the colour's size rows — the same URLs repeated on every
        // size row must not become N copies in the carousel.
        if (us.length) colorImgs.set(color, [...new Set([...(colorImgs.get(color) || []), ...us])]);
      });
      facetVals[COLOR_KEY] = [...byColor.keys()];
      if (sizes.size) facetVals[SIZE_KEY] = [...sizes];
      // __image_urls = raw links → ingested by the controller; images filled then.
      variants = [...byColor.entries()].map(([color, szs]) => ({ color, images: [], __image_urls: colorImgs.get(color) || [], sizes: szs }));
    }

    items.push({
      name: norm(get(first, 'Name')),
      price: norm(get(first, 'Price')),
      brand: norm(get(first, 'Brand')) || null,
      description: norm(get(first, 'Description')) || null,
      stock: norm(get(first, 'Stock')) || null,
      facets: facetVals,
      variants: variants && variants.length ? variants : undefined,
      __cover_urls: splitUrls(get(first, 'Cover image URLs')),   // raw → ingested by controller
      __rows: grp.map(r => r.__row).filter(Boolean),
    });
  }
  return { items, fileErrors };
}

/**
 * Make imported facet values forgiving for bulk-from-catalog sheets:
 *  - case/whitespace-insensitive match → snap to the canonical allowed value
 *    (e.g. "machine wash" → "Machine wash"); and
 *  - an UNRECOGNISED value on an OPTIONAL enumerated facet is dropped (a search
 *    tag we don't know shouldn't block the whole upload) and reported as a
 *    warning. Required facets / colour keep strict behaviour → validateItem
 *    still hard-fails them.
 * Mutates items in place; returns warnings[].
 */
function coerceItemFacets(items, facets) {
  const warnings = [];
  const byKey = new Map(facets.map(f => [f.facet_key, f]));
  for (const it of items) {
    const f4 = it.facets || {};
    for (const key of Object.keys(f4)) {
      const f = byKey.get(key);
      if (!f) continue;
      const allowed = Array.isArray(f.allowed_values) ? f.allowed_values : [];
      if (allowed.length <= 1) continue;                    // open vocab / note-style → leave
      const canon = (v) => allowed.find(a => lc(a) === lc(v)) || null;
      const required = f.required === 'required';
      const val = f4[key];
      if (Array.isArray(val)) {
        const kept = [];
        for (const v of val) {
          const c2 = canon(v);
          if (c2) kept.push(c2);
          else { warnings.push({ name: it.name, facet: f.label, dropped: v }); }
        }
        if (kept.length) f4[key] = [...new Set(kept)];
        else if (!required) delete f4[key];
        else f4[key] = kept;                                // empty → validateItem hard-fails (required)
      } else {
        const c2 = canon(val);
        if (c2) f4[key] = c2;
        else if (!required) { warnings.push({ name: it.name, facet: f.label, dropped: val }); delete f4[key]; }
        // required + no match → leave; validateItem hard-fails
      }
    }
  }
  return warnings;
}

// sizeValues is exported so the move-category rules (listingBulkActions.service)
// can check a product's existing sizes against a TARGET leaf's size system from
// the one definition of that vocabulary, rather than keeping a second copy.
module.exports = { buildTemplateWorkbook, parseRows, buildItems, coerceItemFacets, columnModel, sizeValues, SIZE_SYSTEMS, COLOR_KEY, SIZE_KEY };
