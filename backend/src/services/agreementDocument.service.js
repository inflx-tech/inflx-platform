'use strict';

/**
 * Item 7 — the document both sides keep (P13).
 * Rules v1.20 §9. Contract: features/item7-agreement · gap report §10
 *
 * Two rules decide everything here:
 *
 *   1. It is produced ONLY once both signatures exist. Before signing, the
 *      on-screen agreement IS the agreement; there is no PDF of an unsigned
 *      one to leak or to contradict.
 *   2. It renders ONLY from `contracts.terms_json`. The old PDF re-joined the
 *      invitation, the set and the campaign on every render, so editing an
 *      upstream row silently rewrote a signed document. Nothing here reads the
 *      invitation.
 *
 * A sha256 of the bytes is stored so a stored document can be proved not to
 * have changed.
 */

const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const storageService = require('./storage.service');
const standardTerms = require('./standardTerms.service');
const { longDate } = require('./agreementCopy');

const jsonObj = (v) => (v && typeof v === 'object' ? v : (() => { try { return JSON.parse(v); } catch { return null; } })());

// pdfkit's built-in Helvetica is WinAnsi and cannot render the rupee sign, so
// money reads "Rs." on the document exactly as it always has.
const money = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const AIM_LABEL = { conversion: 'Pay for Sale', engagement: 'Pay for Content', hybrid: 'Hybrid' };

function stamp(at) {
  if (!at) return '';
  const d = new Date(at);
  const day = longDate(d.toISOString().slice(0, 10));
  const t = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day}, ${t} IST`;
}

/** Render the document from the snapshot and the two signature blocks. */
async function render(contract) {
  const s = jsonObj(contract.terms_json);
  if (!s) throw new AppError('VALIDATION_ERROR', 'This agreement has no terms snapshot.', 422);
  const terms = await standardTerms.byVersion(s.termsVersion).catch(() => null);

  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const label = (t) => doc.moveDown(0.8).fontSize(8).font('Helvetica-Bold').fillColor('#77766E').text(String(t).toUpperCase(), { characterSpacing: 1 }).fillColor('#1A1A17').moveDown(0.3);
  const row = (k, v) => {
    if (v == null || v === '') return;
    const y = doc.y;
    doc.fontSize(10).font('Helvetica').fillColor('#5B5A53').text(String(k), 50, y, { width: 180 });
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1A1A17').text(String(v), 240, y, { width: 305, align: 'right' });
    doc.moveDown(0.35);
  };

  // Header — two rules, as the mockup's own page style
  doc.fontSize(17).font('Helvetica-Bold').text('Collaboration Agreement');
  doc.moveDown(0.2).fontSize(10).font('Helvetica').fillColor('#5B5A53')
     .text(`${s.parties.brand.name} & ${s.parties.creator.name} · ${AIM_LABEL[s.aim] || s.aim}`);
  doc.moveDown(0.2).fontSize(9).font('Helvetica')
     .text(`${contract.reference_no || ''}     ${longDate(String(s.generatedAt).slice(0, 10))}`);
  doc.fillColor('#1A1A17').moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1A1A17');
  doc.moveDown(0.15);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#E5E4DE');

  // The parties — names and cities only. Phase 1 identity (rules §9).
  label('The parties');
  const bp = [s.parties.brand.city, s.parties.brand.state].filter(Boolean).join(', ');
  const cp = [s.parties.creator.city, s.parties.creator.state].filter(Boolean).join(', ');
  row(s.parties.brand.name, `Brand${bp ? ' · ' + bp : ''}`);
  if (contract.brand_signed_name) row('Signing for the brand', contract.brand_signed_name);
  row(s.parties.creator.name, `Creator${cp ? ' · ' + cp : ''}${s.parties.creator.handle ? ' · @' + s.parties.creator.handle : ''}`);

  // The work
  label('The work');
  row('Campaign and set', `${s.campaignName} · ${s.setName}`);
  row('Aim', AIM_LABEL[s.aim] || s.aim);
  row('Posting date', longDate(s.postingDate));
  row('Mode of work', s.branchName
    ? `Store Visit · ${s.branchName}${s.branchCity ? ', ' + s.branchCity : ''}`
    : 'Remote · products shipped to the creator');
  if (s.work.deliverablesWords) row('Deliverables', s.work.deliverablesWords);
  if (s.work.usageRights) row('Usage rights', s.work.usageRights.words);
  if (s.work.minShoppablePosts != null) row('Shoppable posts', `At least ${s.work.minShoppablePosts}`);
  if (s.sell) row('She may sell', s.sell.words);
  row('Signatures due by', longDate(s.cutoff));

  // The money
  label('The money');
  if (s.money.fee) {
    row('Fee', money(s.money.fee));
    if (s.money.split) {
      row('On signing', `${money(s.money.split.t1)} (${s.money.splitPct[0]}%)`);
      row('When the content is live', `${money(s.money.split.t2)} (${s.money.splitPct[1]}%)`);
      row('After it stays live', `${money(s.money.split.t3)} (${s.money.splitPct[2]}%)`);
    }
    if (s.money.campaignFee > 0) {
      row('INFLX campaign fee', `${money(s.money.campaignFee)} (${s.money.campaignFeePct}%), paid by the brand`);
    }
  }
  if (s.money.commissionPct != null) {
    row('Commission', `${s.money.commissionPct}% on what she sells`);
    if (s.money.commissionAfterDays != null) {
      row('Commission paid', `After the ${s.money.commissionAfterDays}-day return window`);
    }
  }

  // Also agreed — numbered, plain language
  label('Also agreed');
  const clauses = [];
  if (s.returnTerms) {
    clauses.push(`The creator returns any products she does not keep within ${s.returnTerms.days} days of posting, and the brand pays the return shipping.`);
  }
  if (s.money.fee) clauses.push('The brand confirms the content is live before the second payment is released.');
  clauses.push('Neither party may change these commercial terms inside this collaboration after signing.');
  clauses.push('Disputes follow the INFLX dispute process in the standard terms.');
  clauses.push('The creator receives the fee in full. The INFLX campaign fee is paid by the brand and is never deducted from a creator payment.');
  if (s.note) clauses.push(`The brand's note to the creator: "${s.note}"`);
  doc.fontSize(10).font('Helvetica');
  clauses.forEach((c, i) => doc.text(`${i + 1}. ${c}`, { align: 'left' }).moveDown(0.25));

  // The two signature blocks, side by side, with how each was made
  label('Signatures');
  const top = doc.y;
  const block = (x, who, name, at, device, ip) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#77766E').text(who.toUpperCase(), x, top, { width: 230, characterSpacing: 1 });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1A1A17').text(name || '—', x, top + 14, { width: 230 });
    doc.fontSize(9).font('Helvetica').fillColor('#5B5A53').text(at ? `Signed ${stamp(at)}` : 'Not signed', x, top + 30, { width: 230 });
    doc.fontSize(9).font('Helvetica').fillColor('#77766E').text([device, ip].filter(Boolean).join(' · ') || '—', x, top + 44, { width: 230 });
  };
  block(50, 'Creator', contract.influencer_signed_name, contract.influencer_signed_at, contract.influencer_signed_device, contract.influencer_signed_ip);
  block(310, 'Brand', contract.brand_signed_name, contract.brand_signed_at, contract.brand_signed_device, contract.brand_signed_ip);
  doc.y = top + 70;
  doc.fillColor('#1A1A17');

  // The standard terms, in full, so the document is self-contained
  if (terms) {
    label(`INFLX standard terms · version ${terms.version}`);
    doc.fontSize(9).font('Helvetica').text(terms.body, { align: 'justify' });
  }

  doc.moveDown(1);
  doc.fontSize(8).font('Helvetica').fillColor('#77766E').text(
    `INFLX standard terms version ${s.termsVersion} apply and form part of this agreement. Signed electronically through INFLX; each signature records the name typed, the time, the device and the network address. Reference ${contract.reference_no || contract.id}.`,
    { align: 'center' }
  );

  doc.end();
  return done;
}

/**
 * Produce and store the document. Refuses unless both signatures exist, so
 * there is never a PDF of an unsigned agreement.
 */
async function produce(contractId) {
  const { rows } = await db.query(`SELECT * FROM contracts WHERE id = $1`, [contractId]);
  const contract = rows[0];
  if (!contract) throw new AppError('NOT_FOUND', 'Contract not found', 404);
  if (!contract.influencer_signed_at || !contract.brand_signed_at) {
    throw new AppError('VALIDATION_ERROR', "The agreement can be downloaded once you've both signed.", 422);
  }
  if (!contract.terms_json) throw new AppError('VALIDATION_ERROR', 'This agreement has no terms snapshot.', 422);

  const buffer = await render(contract);
  const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const key = await storageService.uploadPDF(buffer, `agreement_${contractId}.pdf`);
  await db.query(
    `UPDATE contracts SET pdf_url = $2, pdf_sha256 = $3, pdf_generated_at = now(), pdf_generation_error = NULL WHERE id = $1`,
    [contractId, key, sha]
  );
  return { key, sha256: sha, bytes: buffer.length };
}

module.exports = { render, produce };
