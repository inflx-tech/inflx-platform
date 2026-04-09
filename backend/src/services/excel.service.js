'use strict';

const ExcelJS = require('exceljs');
const db = require('../config/db');
const listingService = require('./listing.service');

// ─────────────────────────────────────────────────────────────────────────────
// Excel Service — auto-generates templates from schema, parses uploads
// Template format is ALWAYS derived from schema JSON — any schema change
// automatically updates the template.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the column definitions for a given category.
 * Derives columns from schema.fields + schema.product_config + listing_steps.
 * This is the SINGLE SOURCE OF TRUTH for template format.
 */
function getColumnsForCategory(categoryKey) {
  const schema = listingService.loadSchema(categoryKey);
  if (!schema) return [];

  const columns = [];

  // Universal columns that every business gets
  columns.push({ key: 'name', header: schema.product_noun + ' Name', width: 30, required: true, type: 'string' });

  // Section/category column if sections exist
  if (schema.features?.sections && schema.sections?.length) {
    columns.push({
      key: 'section', header: 'Category / Section', width: 20,
      required: false, type: 'dropdown', options: schema.sections,
    });
  }

  columns.push({ key: 'price', header: 'Price (₹)', width: 15, required: true, type: 'number' });

  // Business-specific columns from schema.fields
  for (const field of (schema.fields || [])) {
    // Skip universal fields already added
    if (['name', 'section', 'price'].includes(field.key)) continue;
    // Skip complex types that don't fit Excel
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

  // Add car-rental-specific pricing columns from listing_steps
  if (categoryKey === 'car_rental') {
    const pricingStep = (schema.listing_steps || []).find(s => s.id === 'pricing');
    if (pricingStep?.price_fields) {
      for (const pf of pricingStep.price_fields) {
        if (pf.key === 'day_rate') continue; // already covered by 'price'
        columns.push({
          key: pf.key, header: pf.label, width: 20,
          required: pf.required || false, type: 'number',
        });
      }
    }
    // Services column
    columns.push({ key: 'services', header: 'Services (comma-separated)', width: 35, required: false, type: 'string',
      hint: 'e.g. Self drive, With driver, Outstation, Airport' });
  }

  // Image URL column (always last)
  if (!columns.find(c => c.key === 'image_url')) {
    columns.push({ key: 'image_url', header: 'Image URL', width: 40, required: false, type: 'string' });
  }

  return columns;
}

function mapFieldTypeToExcel(type) {
  const map = {
    text: 'string', url: 'string', textarea: 'string',
    number: 'number', duration_select: 'number',
    variant_builder: 'string', // comma-separated
    select: 'string', veg_toggle: 'string',
    toggle: 'boolean', checkbox: 'boolean',
  };
  return map[type] || 'string';
}

/**
 * Generate an Excel template workbook for a given category.
 * Returns an ExcelJS Workbook ready to be written to response.
 */
async function generateTemplate(categoryKey, brandName) {
  const schema = listingService.loadSchema(categoryKey);
  if (!schema) throw new Error(`No schema for category: ${categoryKey}`);

  const columns = getColumnsForCategory(categoryKey);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'INFLX Platform';
  wb.created = new Date();

  // ── Main data sheet ────────────────────────────────────────────────────
  const ws = wb.addWorksheet(schema.product_noun_plural || 'Products');

  // Set columns
  ws.columns = columns.map(c => ({
    header: c.header + (c.required ? ' *' : ''),
    key: c.key,
    width: c.width,
  }));

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1F35' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  // Add data validation for dropdown columns
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx];
    if (col.type === 'dropdown' && col.options) {
      const colLetter = String.fromCharCode(65 + colIdx);
      for (let row = 2; row <= 101; row++) {
        ws.getCell(`${colLetter}${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${col.options.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid',
          error: `Please select from: ${col.options.join(', ')}`,
        };
      }
    }
  }

  // Add 3 example rows for guidance
  const examples = getExampleRows(categoryKey, columns);
  for (const example of examples) {
    const row = ws.addRow(example);
    row.font = { italic: true, color: { argb: 'FF999999' } };
  }

  // ── Instructions sheet ─────────────────────────────────────────────────
  const instrWs = wb.addWorksheet('Instructions');
  instrWs.columns = [
    { header: 'Column', key: 'col', width: 25 },
    { header: 'Required', key: 'req', width: 12 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Description', key: 'desc', width: 50 },
  ];

  const instrHeader = instrWs.getRow(1);
  instrHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  instrHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };

  for (const col of columns) {
    instrWs.addRow({
      col: col.header,
      req: col.required ? 'YES' : 'No',
      type: col.type === 'dropdown' ? `Select: ${col.options?.join(', ')}` : col.type,
      desc: col.hint || '',
    });
  }

  // Add metadata row
  instrWs.addRow({});
  instrWs.addRow({ col: 'Business Type', req: schema.label });
  instrWs.addRow({ col: 'Brand', req: brandName || '' });
  instrWs.addRow({ col: 'Generated', req: new Date().toISOString() });
  instrWs.addRow({ col: 'Note', req: 'Delete the grey example rows before uploading. Required columns marked with *.' });

  // For car rental, add master vehicles reference sheet
  if (categoryKey === 'car_rental') {
    await addMasterVehiclesSheet(wb);
  }

  return wb;
}

async function addMasterVehiclesSheet(wb) {
  const { rows } = await db.query(
    `SELECT make, model, segment, seats, fuel_type, transmission, engine_cc, kmpl,
            day_rate_min, day_rate_max, km_rate_min, km_rate_max, services_json
     FROM master_vehicles ORDER BY make, model`
  );

  const refWs = wb.addWorksheet('Vehicle Reference');
  refWs.columns = [
    { header: 'Make', key: 'make', width: 18 },
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Segment', key: 'segment', width: 15 },
    { header: 'Seats', key: 'seats', width: 8 },
    { header: 'Fuel', key: 'fuel_type', width: 18 },
    { header: 'Transmission', key: 'transmission', width: 22 },
    { header: 'Engine', key: 'engine_cc', width: 12 },
    { header: 'KMPL', key: 'kmpl', width: 8 },
    { header: 'Day Rate (Min)', key: 'day_rate_min', width: 14 },
    { header: 'Day Rate (Max)', key: 'day_rate_max', width: 14 },
    { header: 'KM Rate (Min)', key: 'km_rate_min', width: 12 },
    { header: 'KM Rate (Max)', key: 'km_rate_max', width: 12 },
    { header: 'Services', key: 'services', width: 40 },
  ];

  const refHeader = refWs.getRow(1);
  refHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  refHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3050' } };

  for (const row of rows) {
    refWs.addRow({
      ...row,
      services: Array.isArray(row.services_json) ? row.services_json.join(', ') : '',
    });
  }
}

/**
 * Generate example rows for a given category.
 */
function getExampleRows(categoryKey, columns) {
  const examples = {
    car_rental: [
      { name: 'Maruti Suzuki Swift', section: 'Hatchback', price: 900, description: '5 seats · Petrol · Manual / AMT', km_rate: 11, security_deposit: 3000, extra_km_charge: 10, services: 'Self drive, With driver, City trips' },
      { name: 'Toyota Innova Crysta', section: 'MPV / MUV', price: 1800, description: '7 seats · Diesel · Manual / AT', km_rate: 16, security_deposit: 5000, extra_km_charge: 16, services: 'With driver, Outstation, Airport, Wedding / events' },
      { name: 'Hyundai Creta', section: 'SUV', price: 1400, description: '5 seats · Petrol / Diesel · Auto DCT', km_rate: 14, security_deposit: 5000, extra_km_charge: 14, services: 'Self drive, With driver, Outstation' },
    ],
    restaurant: [
      { name: 'Butter Chicken', section: 'Main Course', price: 299, veg_flag: 'non_veg', description: 'Creamy tomato-based chicken curry' },
      { name: 'Paneer Tikka', section: 'Starters', price: 199, veg_flag: 'veg', description: 'Grilled cottage cheese with spices' },
    ],
    fashion_walkin: [
      { name: 'Silk Saree — Kanjeevaram', section: 'Sarees', price: 8500, description: 'Pure silk, traditional design' },
      { name: 'Raymond Suit', section: 'Suits', price: 12000, description: 'Navy blue, regular fit' },
    ],
  };

  return examples[categoryKey] || [
    { name: `Example ${columns[0]?.header || 'Item'} 1`, price: 999 },
    { name: `Example ${columns[0]?.header || 'Item'} 2`, price: 1499 },
  ];
}

/**
 * Parse an uploaded Excel file and return validated rows.
 * Returns { rows: [...], errors: [...] }
 */
async function parseUpload(buffer, categoryKey) {
  const schema = listingService.loadSchema(categoryKey);
  if (!schema) throw new Error(`No schema for category: ${categoryKey}`);

  const columns = getColumnsForCategory(categoryKey);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet(1); // First sheet
  if (!ws) throw new Error('No worksheet found in uploaded file');

  const rows = [];
  const errors = [];

  // Read header row to map column positions
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

  // Parse data rows (skip header, skip example rows with italic font)
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return; // skip header

    // Skip example rows (italic or grey)
    const firstCell = row.getCell(1);
    if (firstCell.font?.italic || firstCell.font?.color?.argb === 'FF999999') return;

    // Skip empty rows
    const hasData = row.values?.some(v => v != null && v !== '');
    if (!hasData) return;

    const rowData = {};
    const rowErrors = [];

    for (const [colNum, col] of Object.entries(colMap)) {
      const cell = row.getCell(parseInt(colNum));
      let value = cell.value;

      // Handle rich text
      if (value && typeof value === 'object' && value.richText) {
        value = value.richText.map(r => r.text).join('');
      }
      // Handle formulas
      if (value && typeof value === 'object' && value.result !== undefined) {
        value = value.result;
      }

      // Type coercion
      if (col.type === 'number' && value != null) {
        value = parseFloat(value);
        if (isNaN(value)) {
          rowErrors.push(`Row ${rowNumber}: "${col.header}" must be a number`);
          value = null;
        }
      }

      // Validation
      if (col.required && (value == null || value === '')) {
        rowErrors.push(`Row ${rowNumber}: "${col.header}" is required`);
      }

      if (col.type === 'dropdown' && col.options && value) {
        if (!col.options.includes(value.toString())) {
          rowErrors.push(`Row ${rowNumber}: "${col.header}" must be one of: ${col.options.join(', ')}`);
        }
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
 * Convert parsed rows into brand_products payloads.
 */
function rowsToProducts(rows, categoryKey) {
  return rows.map(row => {
    const product = {
      name: row.name,
      price: row.price,
      section: row.section || null,
      description: row.description || '',
      image_url: row.image_url || '',
      veg_flag: row.veg_flag || 'na',
      is_active: true,
    };

    // Car rental specific: store pricing in variants_json
    if (categoryKey === 'car_rental') {
      product.variants_json = JSON.stringify({
        day_rate: row.price,
        km_rate: row.km_rate || null,
        security_deposit: row.security_deposit || null,
        extra_km_charge: row.extra_km_charge || null,
        services: row.services ? row.services.split(',').map(s => s.trim()) : [],
      });
      product.is_bookable = true;
    }

    // Variant builder fields: convert comma-separated to JSON
    if (row.variants_json && typeof row.variants_json === 'string') {
      try {
        product.variants_json = row.variants_json;
      } catch {
        product.variants_json = JSON.stringify(
          row.variants_json.split(',').map(v => ({ label: v.trim(), price: row.price }))
        );
      }
    }

    return product;
  });
}

module.exports = {
  getColumnsForCategory,
  generateTemplate,
  parseUpload,
  rowsToProducts,
};
