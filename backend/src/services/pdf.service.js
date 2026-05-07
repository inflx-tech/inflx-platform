'use strict';

/**
 * pdf.service.js
 * Generates a contract PDF using PDFKit.
 * Returns a Buffer containing the PDF data.
 */

const PDFDocument = require('pdfkit');

// PDFKit's built-in fonts (Helvetica / Times / Courier) are restricted to
// WinAnsiEncoding, which does NOT include the Indian Rupee sign (U+20B9).
// Using "\u20B9" in the PDF renders as "¹" (superscript 1). We standardise
// on "Rs." across the contract to keep it readable without embedding a
// Unicode TTF font (which would add ~1MB to the backend and complicate
// deployment). Callers should route money through this helper.
function fmtMoney(rupees) {
  const n = parseFloat(rupees || 0);
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format a posting / signing date as "01 May 2026" (or just the date portion
// when the value is already a string). Replaces the raw
// "Fri May 01 2026 00:00:00 GMT+0000 (Coordinated Universal Time)" dump.
function fmtDate(value) {
  if (!value) return 'To be agreed';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
    doc.text(`Goal:              ${(contract.goal || 'engagement').replace(/_/g, ' ')}`);

    // contracts.influencer_fee is the BASE agreed fee. The total paid to the
    // influencer is base + bonus_amount. Conversion-only contracts have
    // effectiveFee = 0 — they're commission-only.
    const baseFee  = parseFloat(contract.influencer_fee || 0);
    const bonus    = parseFloat(contract.bonus_amount || 0);
    const totalFee = baseFee + bonus;
    if (totalFee > 0) {
      if (bonus > 0) {
        doc.text(`Base Fee:          ${fmtMoney(baseFee)}`);
        doc.text(`Brand Bonus:       ${fmtMoney(bonus)}`);
        doc.text(`Total Fee:         ${fmtMoney(totalFee)}`);
      } else {
        doc.text(`Agreed Fee:        ${fmtMoney(baseFee)}`);
      }
    }
    doc.text(`Posting Date:      ${fmtDate(contract.posting_date)}`);
    doc.text(`Revision Limit:    ${contract.revision_limit}`);
    doc.moveDown(1.5);

    // ── Deliverables ───────────────────────────────────────────────────────
    // Always shown. Pulled from formats_json (the campaign-set source of
    // truth) so the contract memorialises exactly what was promised even
    // before brandSign auto-creates the live deliverable rows. Format chips
    // can be either ['Instagram reel', 'Instagram post'] or
    // [{name: 'Instagram reel', count: 2}, ...] depending on legacy data —
    // handled both shapes.
    const formats = (() => {
      let raw = contract.formats_json;
      if (raw == null) return [];
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return []; } }
      if (!Array.isArray(raw)) return [];
      return raw.map(f => typeof f === 'string'
        ? { name: f, count: 1 }
        : { name: f.name || f.type || 'Format', count: Number(f.count) || 1 });
    })();
    if (formats.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('DELIVERABLES');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      let n = 1;
      for (const f of formats) {
        const qty = f.count > 1 ? ` x${f.count}` : '';
        doc.text(`${n}. ${f.name}${qty}`);
        n++;
      }
      doc.moveDown(1.5);
    }

    // ── Production Arrangement ─────────────────────────────────────────────
    // How the influencer will actually create the content. Three modes
    // (visit / shipment / remote) — relevant to engagement, conversion,
    // and hybrid alike. Falls back gracefully when production_event isn't
    // populated yet (e.g. PDF generated at brand-approve time).
    const mode = contract.production_mode || 'remote';
    const pe   = contract.production_event || {};
    doc.fontSize(14).font('Helvetica-Bold').text('PRODUCTION ARRANGEMENT');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    if (mode === 'visit') {
      doc.text('Mode:              Visit (Influencer at Brand Location)');
      const addrParts = [
        pe.visit_address, pe.visit_city, pe.visit_state, pe.visit_pincode,
      ].filter(Boolean);
      doc.text(`Address:           ${addrParts.length ? addrParts.join(', ') : 'To be confirmed by brand after both parties sign'}`);
      if (pe.visit_scheduled_at) {
        doc.text(`Scheduled:         ${fmtDate(pe.visit_scheduled_at)}`);
      }
      if (pe.visit_contact_name || pe.visit_contact_phone) {
        const contact = [pe.visit_contact_name, pe.visit_contact_phone].filter(Boolean).join(' / ');
        doc.text(`Contact:           ${contact}`);
      }
    } else if (mode === 'shipment') {
      doc.text('Mode:              Product Shipment (Brand to Influencer)');
      const addrParts = [
        pe.shipment_to_address_line, pe.shipment_to_city,
        pe.shipment_to_state, pe.shipment_to_pincode,
      ].filter(Boolean);
      doc.text(`Shipping Address:  ${addrParts.length ? addrParts.join(', ') : 'Influencer\'s registered address'}`);
      if (pe.shipment_courier || pe.shipment_awb) {
        const tracking = [pe.shipment_courier, pe.shipment_awb].filter(Boolean).join(' / ');
        doc.text(`Tracking:          ${tracking}`);
      }
      if (pe.shipment_dispatched_at) {
        doc.text(`Dispatched:        ${fmtDate(pe.shipment_dispatched_at)}`);
      }
    } else {
      doc.text('Mode:              Remote (No Physical Exchange)');
      doc.text('The influencer will create content directly from the campaign brief and brand assets. No on-site shoot or product shipment required.');
    }
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
    // Falls back through contract → set → campaign briefs. Many campaigns
    // stored the brief at the SET level (campaign_sets.brief) rather than
    // at campaigns.brief, which is what contract.service.autoCreate used to
    // copy into contracts.content_requirements. This fallback prevents
    // PDFs from saying "No specific requirements provided" when the brief
    // actually exists somewhere in the chain.
    doc.fontSize(14).font('Helvetica-Bold').text('CONTENT REQUIREMENTS');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    const requirements = contract.content_requirements
      || contract.set_brief
      || contract.campaign_brief
      || contract.brief
      || 'No specific requirements provided.';
    doc.text(requirements, { align: 'justify' });
    doc.moveDown(1.5);

    // ── Payment Schedule — fee-bearing contracts only (engagement / hybrid) ──
    // Tranches are computed off the TOTAL (base + bonus), since the influencer
    // is owed the full sum. Conversion contracts have totalFee = 0 and get
    // a Commission Terms section below instead.
    if (totalFee > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('PAYMENT SCHEDULE');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Tranche 1 (25%): ${fmtMoney(totalFee * 0.25)} - Released on contract activation`);
      doc.text(`Tranche 2 (25%): ${fmtMoney(totalFee * 0.25)} - Released on content going live`);
      doc.text(`Tranche 3 (50%): ${fmtMoney(totalFee * 0.50)} - Released 30 days after content live`);
      doc.moveDown(1.5);
    }

    // ── Commission Terms — conversion / hybrid contracts ─────────────────────
    const commissionPct = parseFloat(contract.commission_pct || 0);
    if (commissionPct > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('COMMISSION TERMS');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Commission Rate:   ${commissionPct}% of each sale or booking driven by the influencer.`);
      if (contract.offer_type) {
        doc.text(`Offer Type:        ${String(contract.offer_type).replace(/_/g, ' ')}`);
      }
      let offerCfg = contract.offer_config_json;
      if (typeof offerCfg === 'string') {
        try { offerCfg = JSON.parse(offerCfg); } catch { offerCfg = null; }
      }
      if (offerCfg && offerCfg.value != null) {
        const label = contract.offer_type === 'percentage' ? `${offerCfg.value}%` : fmtMoney(offerCfg.value);
        doc.text(`Offer Value:       ${label}`);
      }
      if (contract.coupon_code) {
        doc.text(`Coupon Code:       ${contract.coupon_code}`);
      }
      doc.moveDown(0.3);
      doc.text('Commissions are credited to the influencer\'s pending balance at the time of each confirmed sale and moved to the withdrawable balance after a 30-day return window. No upfront payment is made for conversion-only engagements.', { align: 'justify' });
      doc.moveDown(1.5);
    }

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
    doc.text(`Date: ${contract.influencer_signed_at ? fmtDate(contract.influencer_signed_at) : '___________________'}`);
    doc.moveDown(1);

    // Brand signature
    doc.text(`Brand Representative: ${contract.brand_name || '___________________'}`);
    doc.text(`Date: ${contract.brand_signed_at ? fmtDate(contract.brand_signed_at) : '___________________'}`);
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
