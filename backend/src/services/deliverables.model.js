'use strict';

/**
 * When does a collaboration have deliverables at all?
 *
 * Contract: features/deliverables-only-when-buying-content
 *
 * Founder, 2026-08-28, after his countersign was refused:
 *   "content related reels and all is come mandatory only in pay for content type of campaign"
 *
 * THREE PLACES ANSWERED THIS QUESTION, AND ALL THREE ANSWERED DIFFERENTLY
 *
 *   BrandSetWizardScreen  formats_json: buyingContent ? formats : []
 *                         → sends an empty list for a commission set. Correct.
 *
 *   contract.brandSign    empty list → throw 422, refuse the whole countersign
 *                         → "campaign set has no deliverable formats". The reported bug.
 *                            The brand could not sign a deal the app had told them was fine.
 *
 *   getMyCampaignDetail   empty list → formats = [{ type: 'reel', count: 1 }]
 *                         → INVENTS a reel she never agreed to deliver, then shows it to her
 *                            as pending work.
 *
 * One refuses, one fabricates, and the phone that produced the data thinks both are wrong.
 * That is the "two things doing one job" fault this repo has now paid for five times.
 *
 * So: one rule, here.
 *
 * WHY COMMISSION WORK HAS NO DELIVERABLES
 * A commission creator is not selling content — she is selling product. The brand pays nothing
 * up front and owes nothing if she posts nothing; she earns only when someone buys through her
 * link. There is no deliverable to be late on, revise, or approve, because nothing was bought.
 *
 * A brand paying a FEE is buying specific content, and must say what. There the requirement
 * stands, and stays a hard error.
 */

/** The set goals that mean the brand is paying for content. Mirrors the wizard's `buyingContent`. */
const CONTENT_BUYING_GOALS = ['engagement', 'hybrid'];

/**
 * ⚠️ WHICH AIMS MUST NAME THEIR CONTENT — and it is NOT the same list.
 *
 * Rules v1.21 §7, what each side may counter:
 *   Pay for Content → fee, DELIVERABLES (content types and counts), usage rights
 *   Hybrid          → fixed fee and commission percentage. No deliverables.
 * and the Hybrid definition: "Sale/Shoppable workflow identical to Pay for Sale, while upfront
 * fixed money follows the Pay-for-Content-style 25%/25%/50% milestone payment."
 *
 * So Hybrid is Pay-for-Sale work plus fixed money. Its work requirement is shoppable posts, not
 * content formats. Treating it as content-buying made a Hybrid set with no formats IMPOSSIBLE TO
 * COUNTERSIGN: the brand typed her name, tapped Sign, and the server refused with an error she
 * could not see, so the sheet kept reopening. Found in production 2026-09-17 on
 * INFLX-2026-00003 (hybrid, ₹4,000, formats_json []). The divergence was known and noted in
 * item7-agreement.test.js at build time; this is it being decided in the rules' favour.
 *
 * A Hybrid set that DOES name formats still gets those deliverables — the brand asked for them.
 * It simply may not be refused for having none.
 */
const CONTENT_REQUIRED_GOALS = ['engagement'];
function requiresContent(goal) {
  return CONTENT_REQUIRED_GOALS.includes(String(goal || "").toLowerCase());
}

/**
 * @param {string} goal  campaign_sets.goal — 'conversion' | 'engagement' | 'hybrid'
 * @returns {boolean}
 */
function buysContent(goal) {
  return CONTENT_BUYING_GOALS.includes(String(goal || '').toLowerCase());
}

const VALID_TYPES = ['reel', 'post', 'story', 'youtube_video', 'youtube_short'];

/**
 * Work out what deliverables a collaboration should have.
 *
 * Never throws — the caller decides what a problem means. brandSign turns `error` into a 422;
 * a read path can simply show nothing.
 *
 * @param {string} goal
 * @param {*} formatsJson  the set's formats_json: array, JSON string, null
 * @param {function} [canonical]  optional type normaliser the caller already owns
 * @returns {{ formats: Array<{type:string,count:number}>, error: string|null }}
 */
function plannedDeliverables(goal, formatsJson, canonical) {
  const toType = typeof canonical === 'function' ? canonical : (t) => String(t || 'reel').toLowerCase();

  // Commission-only. Nothing was bought, so nothing is owed — and nothing is invented either.
  // An empty list here is the right answer, not a missing one.
  if (!buysContent(goal)) return { formats: [], error: null };

  let raw = formatsJson;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (e) {
      return { formats: [], error: `The set's content formats are unreadable (${e.message}).` };
    }
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    // Hybrid with nothing named is a complete collaboration: fixed money plus shoppable posts.
    if (!requiresContent(goal)) return { formats: [], error: null };
    return {
      formats: [],
      // Said in the brand's own words. The old message named a JSON column at a brand who has
      // never seen one.
      error: 'This campaign pays for content, so the set has to say what content. '
           + 'Open the set and add at least one format — a reel, a post, a story — before signing.',
    };
  }

  const formats = raw.map((f) => {
    if (typeof f === 'string') return { type: toType(f), count: 1 };
    const t = (f && (f.type || f.name || f.label)) || 'reel';
    // ⚠️ A count of 0 means "not asked for" and must survive as 0 so the filter below drops it.
    // My first draft wrote Math.max(1, ...), which silently turned every zero into ONE — so a
    // set with every format at zero produced a deliverable the brand had explicitly not asked
    // for, and the "everything is zero" case below could never be reached. Caught by its own
    // test failing, not by reading.
    //
    // A MISSING count still means one: "reel" with no number is one reel.
    const n = f && f.count;
    const count = (n === undefined || n === null || n === '') ? 1 : (parseInt(n, 10) || 0);
    return { type: toType(t), count: Math.max(0, count) };
  }).filter(f => f.count > 0);

  // A list of zero-count rows is the same as no list. The wizard filters these out, but a set
  // saved by an older build or through the API may not have.
  if (formats.length === 0) {
    return {
      formats: [],
      error: 'This campaign pays for content, but every format on the set is set to zero. '
           + 'Open the set and give at least one of them a count before signing.',
    };
  }

  return { formats, error: null };
}

/**
 * stage-a — formats_json moved down to the creator (migration 166). A brand no longer
 * sets "what she posts" on the set at all; SB-30 asks it per creator. But six contracts
 * already signed under the old set-level ask, so the read side still has to answer for
 * them: her value, else the set's, else nothing. Written once so every reader — signing,
 * the PDF, her own campaign screen, the auto-create-on-activate fallback — agrees.
 *
 * @param {*} herFormats  campaign_influencers.formats_json
 * @param {*} setFormats  campaign_sets.formats_json
 * @returns {*} whichever one is a non-empty array (or a JSON string of one), else null
 */
function resolveFormats(herFormats, setFormats) {
  const nonEmpty = (v) => {
    if (v == null) return false;
    if (typeof v === 'string') {
      try { const p = JSON.parse(v); return Array.isArray(p) && p.length > 0; } catch { return false; }
    }
    return Array.isArray(v) && v.length > 0;
  };
  if (nonEmpty(herFormats)) return herFormats;
  if (nonEmpty(setFormats)) return setFormats;
  return null;
}

module.exports = { buysContent, requiresContent, plannedDeliverables, resolveFormats, CONTENT_BUYING_GOALS, CONTENT_REQUIRED_GOALS, VALID_TYPES };
