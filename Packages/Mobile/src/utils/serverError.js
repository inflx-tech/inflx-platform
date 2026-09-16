/**
 * serverError.js — where a refusal from the server is allowed to land.
 *
 * ⚠️ THE SILENT SAVE. Founder, 2026-09-16: "it is not adding any set" — she tapped Save and
 * the screen did nothing at all. The set was genuinely refused, for a good reason, in a
 * sentence the server wrote:
 *
 *     QUOTA_EXCEEDED · field: 'createSet'
 *     "Limit reached on the free plan: sets per campaign (1 / 1). Upgrade to continue."
 *
 * Every one of these screens did the same thing with it:
 *
 *     if (r.error?.field) setErrors({ [r.error.field]: r.error.message });
 *     else show(r.error?.message);
 *
 * `field` is not always a field. A validation error names one of the form's own boxes, and
 * putting the message there is right. But QUOTA_EXCEEDED names the ACTION ('createSet'),
 * and writing that into the errors map filed the sentence under a key no screen draws — so
 * the one thing she needed to read was the one thing she could not see.
 *
 * The rule: a message may only be filed under a field this form actually renders. Anything
 * else is spoken out loud.
 *
 * Contract: features/item4-campaigns-sets
 */

/**
 * @param {object} error       r.error from the API envelope — { code, message, field }
 * @param {string[]} fields    the field names THIS form draws an error line for
 * @param {string} fallback    what to say when the server sent no message
 * @returns {{ errors: object }|{ toast: string }} exactly one of the two
 */
export function routeServerError(error, fields, fallback) {
  const message = (error && error.message) || fallback;
  const field = error && error.field;
  if (field && Array.isArray(fields) && fields.includes(field)) return { errors: { [field]: message } };
  return { toast: message };
}

/**
 * The same decision for a screen that has one `setErrors` and one `show`. Saves every caller
 * writing the two-line if.
 */
export function applyServerError(error, { fields, setErrors, show, fallback }) {
  const r = routeServerError(error, fields, fallback);
  if (r.errors) setErrors(r.errors); else show(r.toast);
  return r;
}
