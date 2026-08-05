// Company identity — the ONE place the legal surface gets its facts.
//
// Everything the law requires INFLX to display about itself lives here:
// entity name, CIN, registered address, Grievance Officer, customer care.
// Legal documents reference these as {{TOKEN}} and never hard-code a value,
// so supplying a fact is a one-line edit here, not a hunt through prose.
//
// A token whose `value` is null is NOT rendered as empty or invented — it
// renders as a loud placeholder (see components/legal/Tbd.js) and is caught
// by the QA workflow before release. That asymmetry is deliberate: a blank
// CIN is a missing fact, but a plausible-looking wrong CIN is a false
// statement in a published legal document.

export const COMPANY = {
  legalName: 'Omnara India Private Limited',
  productName: 'INFLX',
  website: 'https://inflx.in',
  country: 'India',
};

// `why` is not decoration — it is the reason the founder cannot skip the
// field, and it is what the go-live checklist prints next to each blank.
export const TOKENS = {
  ENTITY: {
    value: COMPANY.legalName,
    label: 'Legal entity name',
    why: 'E-Commerce Rules r.4(2) — the entity name must be displayed as incorporated.',
  },
  // Not a founder-supplied fact — it resolves itself, because a stale
  // copyright year is the single most common defect on legal pages and
  // nobody ever remembers to bump it in January.
  COPYRIGHT_YEAR: {
    value: String(new Date().getFullYear()),
    label: 'Copyright year',
    why: 'Auto-filled. Never needs supplying.',
  },
  CIN: {
    value: null,
    label: 'Corporate Identity Number',
    why: 'Companies Act — official publications must carry the CIN alongside the name and registered office.',
  },
  GSTIN: {
    value: null,
    label: 'GSTIN',
    why: 'An e-commerce operator registers compulsorily. Displayed so sellers and buyers can verify the operator.',
  },
  REGISTERED_ADDRESS: {
    value: null,
    label: 'Registered office address',
    why: 'E-Commerce Rules r.4(2) — registered office and every branch office address must be displayed.',
  },
  GRIEVANCE_OFFICER: {
    value: null,
    label: 'Grievance Officer — full name',
    why: 'IT Rules r.3(2)(a) — the name must be published, not merely available on request.',
  },
  GRIEVANCE_DESIGNATION: {
    value: null,
    label: 'Grievance Officer — designation',
    why: 'E-Commerce Rules r.4(4) requires the designation in addition to name and contact.',
  },
  GRIEVANCE_EMAIL: {
    value: null,
    label: 'Grievance Officer — email',
    why: 'IT Rules r.3(2)(a). Must be monitored against a 24-hour acknowledgement clock.',
  },
  SUPPORT_EMAIL: {
    value: null,
    label: 'Customer care email',
    why: 'E-Commerce Rules r.4(2) requires contact details including email.',
  },
  SUPPORT_MOBILE: {
    value: null,
    label: 'Customer care mobile',
    why: 'E-Commerce Rules r.4(2) names mobile explicitly, separately from landline.',
  },
  SUPPORT_LANDLINE: {
    value: null,
    label: 'Customer care landline',
    why: 'E-Commerce Rules r.4(2) names landline explicitly. A mobile number alone does not satisfy it.',
  },
  EFFECTIVE_DATE: {
    value: null,
    label: 'Effective date of the published documents',
    why: 'A policy without an effective date cannot be shown to have applied to a past transaction.',
  },
  JURISDICTION_CITY: {
    value: null,
    label: 'Courts of which city have jurisdiction',
    why: 'Governing-law clauses name a seat. Usually the city of the registered office.',
  },
};

/** Tokens still awaiting a founder-supplied value, in declaration order. */
export function missingTokens() {
  return Object.entries(TOKENS)
    .filter(([, t]) => t.value === null || t.value === '')
    .map(([key, t]) => ({ key, ...t }));
}

/** True once every mandatory disclosure has a real value. Gate for release. */
export function identityComplete() {
  return missingTokens().length === 0;
}
