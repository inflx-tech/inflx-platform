'use strict';

const ExcelJS = require('exceljs');
const db = require('../config/db');
const listingService = require('./listing.service');

// ─────────────────────────────────────────────────────────────────────────────
// Excel Service — auto-generates templates from schema, parses uploads.
//
// REWRITTEN: now reads `product_config.excel_columns` as the canonical
// declaration (used by all 4 rebuilt schemas: restaurant 12 cols, salon 8,
// fashion 10, car_rental 0+blocked). Falls back to `schema.fields[]` only
// for the 33 legacy v0 schemas not yet migrated.
//
// Type metadata is enriched from `attributes_schema` (when present) so
// columns get correct dropdowns, boolean Yes/No options, and number
// validation without per-category hardcoding.
//
// Master-catalogue linking + fashion variant decomposition live in the
// controller's bulkUploadProducts handler — this service surfaces helpers
// that the controller calls per-row.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the column definitions for a given category.
 *
 * Priority order:
 *   1. schema.product_config.excel_columns (declarative — rebuilt schemas)
 *   2. schema.fields[] (legacy v0 schemas)
 *   3. Universal fallback (name + section + price)
 *
 * Each column carries: { key, header, width, required, type, options?, hint? }
 * where type ∈ 'string' | 'number' | 'boolean' | 'dropdown'.
 */
function getColumnsForCategory(categoryKey) {
  const schema = listingService.loadSchema(categoryKey);
  if (!schema) return [];

  const columns = [];

  // Path 1: canonical excel_columns declaration (rebuilt schemas)
  const declared = schema.product_config?.excel_columns;
  if (Array.isArray(declared) && declared.length > 0) {
    return declared.map(d => enrichColumnFromSchema(d, schema));
  }

  // Path 2: legacy fields[] (v0 schemas)
  if (Array.isArray(schema.fields) && schema.fields.length > 0) {
    columns.push({ key: 'name', header: schema.product_noun + ' Name', width: 30, required: true, type: 'string' });
    if (schema.features?.sections && schema.sections?.length) {
      columns.push({
        key: 'section', header: 'Category / Section', width: 20,
        required: false, type: 'dropdown', options: schema.sections,
      });
    }
    columns.push({ key: 'price', header: 'Price (₹)', width: 15, required: true, type: 'number' });

    for (const field of schema.fields) {
      if (['name', 'section', 'price'].includes(field.key)) continue;
      if (['availability_picker'].includes(field.type)) continue;

      const col = {
        key: field.key,
        header: field.label,
        width: field.type === 'textarea' ? 35 : 20,
        required: field.required || false,
        type: mapFieldTypeToExcel(field.type),
      };
      if (field.type === 'select' && field.options) {
        col.type = 'dropdown';
        col.options = field.options;
      }
      if (field.type === 'veg_toggle') {
        col.type = 'dropdown';
        col.options = ['veg', 'non_veg', 'na'];
      }
      columns.push(col);
    }
    if (!columns.find(c => c.key === 'image_url')) {
      columns.push({ key: 'image_url', header: 'Image URL', width: 40, required: false, type: 'string' });
    }
    return columns;
  }

  // Path 3: minimal fallback — name + price only
  return [
    { key: 'name', header: schema.product_noun + ' Name', width: 30, required: true, type: 'string' },
    { key: 'price', header: 'Price (₹)', width: 15, required: true, type: 'number' },
    { key: 'image_url', header: 'Image URL', width: 40, required: false, type: 'string' },
  ];
}

/**
 * Enrich a declared excel_columns entry with type/options/dropdown metadata
 * from the schema's attributes_schema. The brand declares the column shape
 * (column header + field key + required + example); this function fills in
 * the Excel-rendering details (type, options for dropdowns).
 */
function enrichColumnFromSchema(declared, schema) {
  const fieldKey = declared.field;
  const attrs = schema.attributes_schema?.[fieldKey];
  const brandFieldDef = schema.brand_config?.fields?.[fieldKey];

  // Width — wider for free-text/description columns
  let width = 20;
  if (/description|notes/i.test(fieldKey)) width = 35;
  if (/url|image/i.test(fieldKey)) width = 40;
  if (fieldKey === 'name') width = 30;

  const col = {
    key: fieldKey,
    header: declared.column,
    width,
    required: !!declared.required,
    type: 'string',
    hint: declared.example ? `e.g. ${declared.example}` : '',
  };

  // Type inference from attributes_schema (most rebuilt schemas)
  const def = attrs || brandFieldDef;
  if (def) {
    if (def.type === 'number') col.type = 'number';
    else if (def.type === 'boolean') {
      col.type = 'dropdown';
      col.options = ['Yes', 'No'];
    }
    else if (def.type === 'select' && Array.isArray(def.options)) {
      col.type = 'dropdown';
      col.options = def.options;
    }
    else if (def.type === 'multi_select' && Array.isArray(def.options)) {
      // Multi-select rendered as comma-separated string in Excel
      col.type = 'string';
      col.hint = `${col.hint ? col.hint + ' · ' : ''}Comma-separated. Allowed: ${def.options.join(', ')}`;
    }
    else if (def.type === 'veg_toggle') {
      col.type = 'dropdown';
      col.options = ['veg', 'non_veg', 'na'];
    }
  }

  // Special-case keys that aren't in attributes_schema but have known shapes
  if (fieldKey === 'price' || fieldKey === 'stock' || fieldKey === 'duration_mins' || fieldKey === 'return_policy_days' || fieldKey === 'stock_per_variant') {
    col.type = 'number';
  }
  if (fieldKey === 'sizes' || fieldKey === 'colors') {
    col.type = 'string';   // comma-separated; decomposed into product_variants in controller
    col.hint = col.hint || (fieldKey === 'sizes' ? 'Comma-separated, e.g. S, M, L, XL' : 'Comma-separated, e.g. Black, White, Navy');
  }

  return col;
}

function mapFieldTypeToExcel(type) {
  const map = {
    text: 'string', url: 'string', textarea: 'string', string: 'string',
    number: 'number', duration_select: 'number',
    variant_builder: 'string',
    select: 'string', veg_toggle: 'string',
    toggle: 'boolean', checkbox: 'boolean', boolean: 'boolean',
  };
  return map[type] || 'string';
}

/**
 * Generate an Excel template workbook for a given category.
 *
 * Throws if `product_config.excel_upload === false` — the controller
 * surfaces this as a clean error to the brand (e.g. car_rental).
 */
async function generateTemplate(categoryKey, brandName) {
  const schema = listingService.loadSchema(categoryKey);
  if (!schema) throw new Error(`No schema for category: ${categoryKey}`);

  if (schema.product_config?.excel_upload === false) {
    const e = new Error(`Bulk Excel upload is not available for ${schema.label || categoryKey}. Use the wizard to add ${schema.product_noun_plural?.toLowerCase() || 'items'} — accurate specs are auto-filled from our database.`);
    e.code = 'EXCEL_UPLOAD_DISABLED';
    throw e;
  }

  const columns = getColumnsForCategory(categoryKey);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'INFLX Platform';
  wb.created = new Date();

  // ── Main data sheet ────────────────────────────────────────────────────
  const ws = wb.addWorksheet(schema.product_noun_plural || 'Products');

  ws.columns = columns.map(c => ({
    header: c.header + (c.required ? ' *' : ''),
    key: c.key,
    width: c.width,
  }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1F35' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  // Data validation for dropdown columns
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx];
    if (col.type === 'dropdown' && col.options && col.options.length > 0) {
      const colLetter = excelColLetter(colIdx + 1);
      for (let row = 2; row <= 101; row++) {
        ws.getCell(`${colLetter}${row}`).dataValidation = {
          type: 'list',
          allowBlank: !col.required,
          formulae: [`"${col.options.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid value',
          error: `Please select from: ${col.options.join(', ')}`,
        };
      }
    }
  }

  // Schema-driven example rows from excel_columns[].example
  const declared = schema.product_config?.excel_columns;
  if (Array.isArray(declared) && declared.length > 0) {
    const exampleRow = {};
    for (const d of declared) {
      if (d.example !== undefined) exampleRow[d.field] = d.example;
    }
    if (Object.keys(exampleRow).length > 0) {
      const row = ws.addRow(exampleRow);
      row.font = { italic: true, color: { argb: 'FF999999' } };
    }
  }

  // ── Instructions sheet ─────────────────────────────────────────────────
  const instrWs = wb.addWorksheet('Instructions');
  instrWs.columns = [
    { header: 'Column', key: 'col', width: 28 },
    { header: 'Required', key: 'req', width: 12 },
    { header: 'Type', key: 'type', width: 18 },
    { header: 'Notes', key: 'desc', width: 60 },
  ];

  const instrHeader = instrWs.getRow(1);
  instrHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  instrHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };

  for (const col of columns) {
    instrWs.addRow({
      col: col.header,
      req: col.required ? 'YES' : 'No',
      type: col.type === 'dropdown' ? `Pick from: ${col.options.join(' / ')}` : col.type,
      desc: col.hint || '',
    });
  }

  // Metadata footer
  instrWs.addRow({});
  instrWs.addRow({ col: 'Business Type', req: schema.label });
  instrWs.addRow({ col: 'Brand', req: brandName || '' });
  instrWs.addRow({ col: 'Generated', req: new Date().toISOString() });
  instrWs.addRow({});
  instrWs.addRow({ col: '⚠ Tips' });
  instrWs.addRow({ col: 'Delete the grey example row before uploading.' });
  instrWs.addRow({ col: 'Required columns are marked with *.' });
  if (categoryKey === 'restaurant') {
    instrWs.addRow({ col: 'Items matching our curated dish catalogue auto-link — you get a default photo + cross-brand analytics.' });
  }
  if (categoryKey === 'salon') {
    instrWs.addRow({ col: 'Services matching our curated catalogue auto-link — saves you time on common services.' });
  }
  if (categoryKey === 'fashion') {
    instrWs.addRow({ col: 'For variants: enter sizes (S, M, L) and colors (Black, White) as comma-separated strings. We will create one SKU per size × color with the same stock_per_variant.' });
  }

  return wb;
}

// Excel column letter helper for arbitrary column counts (handles >26 cols)
function excelColLetter(n) {
  let letter = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/**
 * Parse an uploaded Excel file and return validated rows.
 * Returns { rows: [...], errors: [...], totalParsed }
 *
 * Each row carries the schema-declared keys (e.g. for fashion: name,
 * section, price, gender, fabric, description, sizes, colors,
 * stock_per_variant, return_policy_days). The controller decomposes
 * variants + handles master-catalogue linking after this returns.
 */
async function parseUpload(buffer, categoryKey) {
  const schema = listingService.loadSchema(categoryKey);
  if (!schema) throw new Error(`No schema for category: ${categoryKey}`);

  if (schema.product_config?.excel_upload === false) {
    const e = new Error(`Bulk Excel upload is not available for ${schema.label || categoryKey}.`);
    e.code = 'EXCEL_UPLOAD_DISABLED';
    throw e;
  }

  const columns = getColumnsForCategory(categoryKey);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet(1);
  if (!ws) throw new Error('No worksheet found in uploaded file');

  const rows = [];
  const errors = [];

  // Map header positions to columns (case-insensitive header match)
  const headerRow = ws.getRow(1);
  const colMap = {};
  headerRow.eachCell((cell, colNumber) => {
    const headerText = (cell.value || '').toString().replace(/\s*\*$/, '').trim();
    const matchedCol = columns.find(c =>
      c.header.toLowerCase() === headerText.toLowerCase() ||
      c.key.toLowerCase() === headerText.toLowerCase()
    );
    if (matchedCol) colMap[colNumber] = matchedCol;
  });

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return; // skip header

    // Skip example rows (italic / grey)
    const firstCell = row.getCell(1);
    if (firstCell.font?.italic || firstCell.font?.color?.argb === 'FF999999') return;

    const hasData = row.values?.some(v => v != null && v !== '');
    if (!hasData) return;

    const rowData = {};
    const rowErrors = [];

    for (const [colNum, col] of Object.entries(colMap)) {
      const cell = row.getCell(parseInt(colNum));
      let value = cell.value;

      if (value && typeof value === 'object' && value.richText) {
        value = value.richText.map(r => r.text).join('');
      }
      if (value && typeof value === 'object' && value.result !== undefined) {
        value = value.result;
      }

      // Type coercion + boolean Yes/No mapping
      if (col.type === 'number' && value != null && value !== '') {
        value = parseFloat(value);
        if (isNaN(value)) {
          rowErrors.push(`Row ${rowNumber}: "${col.header}" must be a number`);
          value = null;
        }
      }
      if (col.type === 'dropdown' && col.options && value != null && value !== '') {
        const v = String(value).trim();
        const matched = col.options.find(o => o.toLowerCase() === v.toLowerCase());
        if (!matched) {
          rowErrors.push(`Row ${rowNumber}: "${col.header}" must be one of: ${col.options.join(', ')}`);
        } else {
          value = matched;
        }
      }
      // Boolean dropdown (Yes/No) → true/false
      if (col.type === 'dropdown' && col.options?.length === 2 &&
          col.options.includes('Yes') && col.options.includes('No') &&
          value != null && value !== '') {
        value = String(value).toLowerCase() === 'yes';
      }

      // Required validation
      if (col.required && (value == null || value === '')) {
        rowErrors.push(`Row ${rowNumber}: "${col.header}" is required`);
      }

      rowData[col.key] = value;
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
    } else {
      rows.push(rowData);
    }
  });

  return { rows, errors, totalParsed: rows.length + errors.length };
}

/**
 * Convert parsed rows into brand_products payloads. Variant decomposition
 * (sizes × colors → product_variants rows) and master-catalogue linking
 * happen in the controller, post-row-creation.
 *
 * Per-category storage_format is honored: maps row keys → DB columns per
 * the schema's product_config.storage_format declaration when present.
 * Falls back to a sensible default when not.
 */
function rowsToProducts(rows, categoryKey) {
  const schema = listingService.loadSchema(categoryKey);
  const storageFormat = schema?.product_config?.storage_format;

  return rows.map(row => {
    const product = {
      name: row.name,
      price: parseFloat(row.price || 0),
      section: row.section || row.category || null,
      description: row.description || '',
      image_url: row.image_url || '',
      veg_flag: normalizeVegFlag(row.veg_flag),
      stock: row.stock != null ? parseInt(row.stock, 10) : null,
      is_active: true,
      is_bookable: false,
    };

    // Category-specific: pack typed attributes into variants_json
    // (per the storage_format spec — variants_json carries the per-product
    // attribute object). Only include keys actually provided in the row.
    const variantsObj = {};
    for (const [k, v] of Object.entries(row)) {
      if (['name', 'price', 'section', 'category', 'description', 'image_url', 'veg_flag', 'stock'].includes(k)) continue;
      if (k === 'sizes' || k === 'colors' || k === 'stock_per_variant') continue;   // handled by variant decomposition
      if (v != null && v !== '') {
        variantsObj[k] = v;
      }
    }
    if (Object.keys(variantsObj).length > 0) {
      product.variants_json = variantsObj;
    }

    // Per-category specials
    if (categoryKey === 'car_rental') {
      product.is_bookable = true;
    }
    if (categoryKey === 'salon') {
      product.duration_mins = row.duration_mins ? parseInt(row.duration_mins, 10) : null;
      product.is_bookable = true;
    }
    if (categoryKey === 'fashion') {
      // Return policy on the product row itself (column added in migration 047)
      if (row.return_policy_days != null) {
        product.return_policy_days = parseInt(row.return_policy_days, 10);
      }
      // Carry sizes/colors through as a flag for the controller's variant
      // decomposition step. Removed from the product payload before INSERT.
      product._fashion_variants = {
        sizes: parseCommaList(row.sizes),
        colors: parseCommaList(row.colors),
        stock_per_variant: row.stock_per_variant != null ? parseInt(row.stock_per_variant, 10) : 0,
      };
    }

    return product;
  });
}

function normalizeVegFlag(v) {
  if (v == null) return 'na';
  const s = String(v).toLowerCase().trim();
  if (s === 'veg' || s === 'vegetarian') return 'veg';
  if (s === 'non_veg' || s === 'non-veg' || s === 'nonveg') return 'non_veg';
  if (s === 'egg' || s === 'eggetarian') return 'na';
  return 'na';
}

function parseCommaList(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Restaurant + Salon: try to link a parsed row to its master-catalogue entry.
 * Returns the master row id (or null when no match). Match is by
 * lowercased name + section.
 *
 * The controller calls this per row and sets the master_dish_id /
 * master_service_id on the product before INSERT.
 */
async function findMasterMatch(categoryKey, name, section) {
  if (!name) return null;
  if (categoryKey === 'restaurant') {
    const { rows } = await db.query(
      `SELECT id FROM master_dishes
        WHERE LOWER(name) = LOWER($1)
          AND ($2::text IS NULL OR LOWER(section) = LOWER($2))
        LIMIT 1`,
      [name, section || null]
    );
    return rows[0]?.id || null;
  }
  if (categoryKey === 'salon') {
    const { rows } = await db.query(
      `SELECT id FROM master_salon_services
        WHERE LOWER(name) = LOWER($1)
          AND ($2::text IS NULL OR LOWER(category) = LOWER($2))
        LIMIT 1`,
      [name, section || null]
    );
    return rows[0]?.id || null;
  }
  return null;
}

/**
 * Decompose a fashion product's _fashion_variants payload into one
 * product_variants row per (size × color) combo. Called by controller after
 * the parent brand_products row is inserted.
 */
function buildFashionVariantRows(productId, variantSpec) {
  if (!variantSpec) return [];
  const sizes = variantSpec.sizes || [];
  const colors = variantSpec.colors || [];
  const stock = Number(variantSpec.stock_per_variant || 0);

  if (sizes.length === 0 && colors.length === 0) return [];

  const rows = [];
  if (sizes.length > 0 && colors.length > 0) {
    for (const s of sizes) for (const c of colors) {
      rows.push({ product_id: productId, size: s, color: c, stock });
    }
  } else if (sizes.length > 0) {
    for (const s of sizes) rows.push({ product_id: productId, size: s, color: null, stock });
  } else {
    for (const c of colors) rows.push({ product_id: productId, size: null, color: c, stock });
  }
  return rows;
}

module.exports = {
  getColumnsForCategory,
  generateTemplate,
  parseUpload,
  rowsToProducts,
  findMasterMatch,
  buildFashionVariantRows,
};
