'use strict';

/**
 * pdf.service.js
 * Generates a contract PDF using PDFKit.
 * Returns a Buffer containing the PDF data.
 */

const PDFDocument = require('pdfkit');

/**
 * Generate a contract PDF buffer.
 * @param {object} contract  — contract row from DB
 * @returns {Promise<Buffer>}
 */
async function generateContractPDF(contract) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Title ──────────────────────────────────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').text('INFLUENCER COLLABORATION CONTRACT', {
      align: 'center',
    });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text('INFLX Platform — inflx.in', { align: 'center' });
    doc.moveDown(2);

    // ── Parties ────────────────────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('PARTIES');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Brand:       ${contract.brand_name || 'N/A'}`);
    doc.text(`Influencer:  ${contract.influencer_name || 'N/A'}`);
    doc.moveDown(1.5);

    // ── Campaign Details ───────────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('CAMPAIGN DETAILS');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Campaign:          ${contract.campaign_name || 'N/A'}`);
    const totalFee = parseFloat(contract.influencer_fee || 0);
    const bonus    = parseFloat(contract.bonus_amount || 0);
    if (bonus > 0) {
      const baseFee = totalFee - bonus;
      doc.text(`Base Fee:          ₹${baseFee.toFixed(2)}`);
      doc.text(`Brand Bonus:       ₹${bonus.toFixed(2)}`);
      doc.text(`Total Fee:         ₹${totalFee.toFixed(2)}`);
    } else {
      doc.text(`Agreed Fee:        ₹${totalFee.toFixed(2)}`);
    }
    doc.text(`Posting Date:      ${contract.posting_date || 'To be agreed'}`);
    doc.text(`Revision Limit:    ${contract.revision_limit}`);
    doc.moveDown(1.5);

    // ── Custom Clauses (only if brand selected any) ────────────────────────
    let clausesData = contract.custom_clauses;
    if (typeof clausesData === 'string') {
      try { clausesData = JSON.parse(clausesData); } catch { clausesData = null; }
    }
    if (clausesData) {
      const enabled = clausesData.clauses || {};
      const enabledIds = Object.keys(enabled).filter(k => enabled[k]?.enabled);
      const notes = clausesData.notes;

      if (enabledIds.length > 0 || notes) {
        doc.fontSize(14).font('Helvetica-Bold').text('SPECIAL CLAUSES');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');

        const labels = {
          commercial_rights:      'Commercial Usage Rights',
          category_exclusivity:   'Category Exclusivity',
          content_ownership:      'Content Ownership Transfer',
        };
        const descTemplates = {
          commercial_rights:    (v) => `The brand may repurpose the influencer's content in paid advertising, social, and offline marketing channels for ${v} days after the content goes live.`,
          category_exclusivity: (v) => `The influencer agrees not to promote a competing brand in the same category for ${v} days from the date of contract signing.`,
          content_ownership:    ()  => `Final approved content (raw + edited versions) becomes the brand's property to use indefinitely. The influencer retains the right to keep the content on their own profile.`,
        };

        let counter = 1;
        for (const id of enabledIds) {
          const v = enabled[id]?.value;
          doc.font('Helvetica-Bold').text(`${counter}. ${labels[id] || id}`);
          doc.font('Helvetica').text(descTemplates[id] ? descTemplates[id](v) : '', { align: 'justify' });
          doc.moveDown(0.5);
          counter++;
        }
        if (notes) {
          doc.font('Helvetica-Bold').text(`${counter}. Additional Notes`);
          doc.font('Helvetica').text(notes, { align: 'justify' });
          doc.moveDown(0.5);
        }
        doc.moveDown(1);
      }
    }

    // ── Content Requirements ───────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('CONTENT REQUIREMENTS');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(contract.content_requirements || 'No specific requirements provided.');
    doc.moveDown(1.5);

    // ── Payment Schedule ───────────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('PAYMENT SCHEDULE');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    const fee = parseFloat(contract.influencer_fee || 0);
    doc.text(`Tranche 1 (25%): ₹${(fee * 0.25).toFixed(2)} — Released on contract activation`);
    doc.text(`Tranche 2 (25%): ₹${(fee * 0.25).toFixed(2)} — Released on content going live`);
    doc.text(`Tranche 3 (50%): ₹${(fee * 0.50).toFixed(2)} — Released 30 days after content live`);
    doc.moveDown(1.5);

    // ── Terms & Conditions ─────────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('TERMS & CONDITIONS');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');
    doc.text(
      '1. The influencer agrees to create and publish content as specified above.\n' +
      '2. Content must be original, accurate, and comply with ASCI guidelines for sponsored content.\n' +
      '3. The brand retains the right to request up to the specified number of revisions.\n' +
      '4. Commission returns are subject to a 30-day window after content goes live.\n' +
      '5. TDS of 10% will be deducted from withdrawals as per applicable Indian tax law.\n' +
      '6. Any disputes shall be resolved through the INFLX platform dispute resolution process.\n' +
      '7. This contract is governed by the laws of India.',
      { align: 'justify' }
    );
    doc.moveDown(2);

    // ── Signatures ─────────────────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('SIGNATURES');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    // Influencer signature
    doc.text(`Influencer: ${contract.influencer_signed_name || '___________________'}`);
    doc.text(`Date: ${contract.influencer_signed_at ? new Date(contract.influencer_signed_at).toISOString() : '___________________'}`);
    doc.moveDown(1);

    // Brand signature
    doc.text(`Brand Representative: ${contract.brand_name || '___________________'}`);
    doc.text(`Date: ${contract.brand_signed_at ? new Date(contract.brand_signed_at).toISOString() : '___________________'}`);
    doc.moveDown(1);

    // ── Footer ─────────────────────────────────────────────────────────────
    doc.fontSize(8).fillColor('#666666');
    doc.text(
      `Contract ID: ${contract.id} | Generated by INFLX Platform`,
      { align: 'center' }
    );

    doc.end();
  });
}

/**
 * Generate a Form 16A-style TDS certificate PDF for an influencer.
 *
 * @param {object} opts
 * @param {object} opts.influencer   — influencer row with user join fields
 * @param {string} opts.fy           — e.g. '2024-25'
 * @param {Date}   opts.fyStart      — FY start date
 * @param {Date}   opts.fyEnd        — FY end date
 * @param {number} opts.grossEarnings  — total withdrawn (rupees)
 * @param {number} opts.tdsDeducted    — total TDS deducted (rupees)
 * @param {number} opts.netPaid        — grossEarnings - tdsDeducted (rupees)
 * @returns {Promise<Buffer>}
 */
async function generateTdsCertificate({ influencer, fy, fyStart, fyEnd, grossEarnings, tdsDeducted, netPaid }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : 'N/A';

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(18).font('Helvetica-Bold').text('CERTIFICATE OF TAX DEDUCTED AT SOURCE', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text('(Under Section 194-JB of the Income Tax Act, 1961)', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).text(`Financial Year: ${fy}  (${fmtDate(fyStart)} to ${fmtDate(fyEnd)})`, { align: 'center' });
    doc.moveDown(1.5);

    // ── Deductor (Platform) ─────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('DEDUCTOR DETAILS');
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    doc.text('Name:             INFLX Technologies Pvt. Ltd.');
    doc.text('Address:          inflx.in (Online Platform, India)');
    doc.text('TAN:              As registered with Income Tax Department');
    doc.moveDown(1.5);

    // ── Deductee (Influencer) ───────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('DEDUCTEE DETAILS');
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Name:             ${influencer.full_name || influencer.name || 'N/A'}`);
    doc.text(`Instagram Handle: @${influencer.instagram_handle || 'N/A'}`);
    doc.text(`PAN:              ${influencer.pan_number || 'NOT PROVIDED — submit PAN to claim TDS credit'}`);
    doc.text(`Phone:            ${influencer.phone || 'N/A'}`);
    doc.moveDown(1.5);

    // ── Earnings Summary ────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('EARNINGS & TDS SUMMARY');
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');

    // Simple table
    const col1 = 55, col2 = 320;
    const drawRow = (label, value, bold = false) => {
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, col1, y, { continued: false });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(value, col2, y);
      doc.moveDown(0.3);
    };

    drawRow('Gross Earnings (Total Withdrawals):', fmt(grossEarnings));
    drawRow('TDS Rate Applied:',                  '10% (u/s 194-JB)');
    drawRow('TDS Deducted:',                      fmt(tdsDeducted), true);
    drawRow('Net Amount Paid:',                   fmt(netPaid));
    doc.moveDown(1);

    // ── Declaration ─────────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('DECLARATION');
    doc.moveDown(0.4);
    doc.fontSize(9).font('Helvetica');
    doc.text(
      'I certify that a sum of ' + fmt(tdsDeducted) + ' has been deducted at source from the payments ' +
      'made to the above-named deductee during the financial year ' + fy + ', in accordance with the ' +
      'provisions of the Income Tax Act, 1961. The deducted amount has been / will be deposited to the ' +
      'Central Government account.',
      { align: 'justify' }
    );
    doc.moveDown(1.5);

    doc.fontSize(9).fillColor('#888888');
    doc.text(
      'Note: This certificate is system-generated. For official purposes, please cross-verify with ' +
      'Form 26AS on the Income Tax e-Filing portal (incometax.gov.in). TDS credit will reflect in ' +
      'Form 26AS after the deductor files the quarterly TDS return.',
      { align: 'justify' }
    );
    doc.moveDown(1.5);

    // ── Footer ──────────────────────────────────────────────────────────────
    doc.fontSize(8).fillColor('#333333');
    doc.text(
      `Generated on: ${new Date().toLocaleDateString('en-IN')} | INFLX Platform — inflx.in`,
      { align: 'center' }
    );

    doc.end();
  });
}

module.exports = { generateContractPDF, generateTdsCertificate };
