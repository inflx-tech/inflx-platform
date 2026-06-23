/**
 * vegKind — single source of truth for the Indian veg/non-veg mark.
 *
 * The DB enum is ('veg','non_veg','na') and DEFAULTS to 'na' (unmarked). The
 * old logic treated anything that wasn't exactly 'veg' as non-veg → it painted
 * unmarked dishes RED (a false non-veg claim). This returns three states so the
 * UI can show green for veg, red for non_veg, and a NEUTRAL mark for unknown.
 *
 *   'veg'      → green dot
 *   'nonveg'   → red dot
 *   'unknown'  → neutral / grey (na, null, undefined) — never claim non-veg
 */
export function vegKind(flag) {
  if (flag === true || flag === 'veg' || flag === 'Veg' || flag === 'VEG') return 'veg';
  if (flag === false || flag === 'non_veg' || flag === 'nonveg' || flag === 'non-veg'
      || flag === 'Non-veg' || flag === 'Non-Veg' || flag === 'NON_VEG') return 'nonveg';
  return 'unknown';
}
