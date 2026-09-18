'use strict';

/**
 * Which shoot, and what state does it start in.
 *
 * Contract: features/shoot-starts-where-the-agreement-left-it
 *
 * Founder, 2026-08-28, after counter-signing Asha's contract:
 *   "till, contract signing by both parties done, next logical step is shooting plan... But I am
 *   not able to see the shoot plan... without doing anything from both it is saying shoot plan is
 *   done."
 *
 * WHAT ACTUALLY HAPPENED TO HER ROW
 *
 *   collab_agreements.terms_json->>'mode'   = 'visit'      ← both sides agreed a store visit
 *   contracts.production_mode               =  NULL        ← never carried across
 *   production_events.mode                  = 'remote'     ← defaulted
 *   production_events.status                = 'completed'  ← at birth
 *
 * Two separate faults, one after the other:
 *
 * 1. THE MODE WAS SETTLED AND THEN THROWN AWAY. production_mode was written in exactly one
 *    place — the brand's "Approve & Send" step. Briefing a creator straight to signing skips
 *    that step by design, so nothing ever set it, and `production_mode || 'remote'` did the
 *    rest. The agreement had the answer the whole time. This is the same fault as asking her
 *    to agree twice: a thing settled at the handshake, re-asked (or in this case re-guessed)
 *    later in a different vocabulary.
 *
 * 2. REMOTE WAS BORN COMPLETED. `mode === 'remote' ? 'completed' : 'proposed'`, on the reasoning
 *    that there is "nothing to coordinate". There is nothing to COORDINATE — no slot to agree,
 *    no parcel to track. There is still a shoot to DO. The founder's rule, from Stage 4 and
 *    repeated now: a store visit is marked done by both sides; a remote shoot is marked done by
 *    the creator. Neither is marked done by the database.
 *
 * Both answers live here so no caller can invent a third.
 */

const MODES = ['visit', 'shipment', 'remote'];

/**
 * Where this collaboration's shoot happens.
 *
 * The agreement is the authority. The contract is a copy of it, and only wins when it disagrees
 * — a brand may deliberately change the arrangement at Approve & Send, and that is a later
 * decision by the same two people.
 *
 * Item 10 (features/item10-store-visit): THE SET COMES FIRST. Since the campaign-and-set-first
 * pivot the mode of work is chosen once, on the set, and locked the moment the first invitation
 * goes out (rules §28). Neither of the two older sources below is written on that path — the
 * brief door that filled the agreement is closed (item 8), and Approve & Send is switched off
 * (item 7) — so every set-first collaboration fell through to 'remote'. In production on
 * 18 Sep 2026 that was six of seven signed collaborations, including the only Store Visit.
 *
 * @param {object} o
 * @param {string} o.setMode         campaign_sets.shoot_mode — the authority when present
 * @param {string} o.contractMode    contracts.production_mode — usually null
 * @param {string} o.agreementMode   collab_agreements.terms_json->>'mode'
 * @returns {{ mode: string, source: 'set'|'contract'|'agreement'|'default' }}
 */
function resolveProductionMode({ setMode, contractMode, agreementMode } = {}) {
  const s = String(setMode || '').toLowerCase();
  if (MODES.includes(s)) return { mode: s, source: 'set' };

  const c = String(contractMode || '').toLowerCase();
  if (MODES.includes(c)) return { mode: c, source: 'contract' };

  const a = String(agreementMode || '').toLowerCase();
  if (MODES.includes(a)) return { mode: a, source: 'agreement' };

  // Nothing said anywhere. 'remote' is the only mode that needs no address, no slot and no
  // courier, so it is the one that cannot block her on information nobody supplied.
  return { mode: 'remote', source: 'default' };
}

/**
 * The state a freshly created shoot starts in.
 *
 * ⚠️ NOTHING starts completed. A shoot is finished when a person says it is finished.
 *
 *   visit / shipment → 'proposed'  — the planning state. Either side may put up a slot or an
 *                                    address, the other accepts or counters.
 *   remote           → 'confirmed' — there is nothing to arrange, so it skips planning. It does
 *                                    NOT skip the shoot: she marks it done when she has shot it.
 *
 * @param {string} mode
 * @returns {'proposed'|'confirmed'}
 */
function initialStatusFor(mode) {
  return String(mode || '').toLowerCase() === 'remote' ? 'confirmed' : 'proposed';
}

module.exports = { MODES, resolveProductionMode, initialStatusFor };
