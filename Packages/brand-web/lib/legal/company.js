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
    value: 'U63120AP2026PTC125275',
    label: 'Corporate Identity Number',
    why: 'Companies Act — official publications must carry the CIN alongside the name and registered office.',
  },
  // Optional means "may legitimately not exist yet", not "nice to have".
  // A company incorporated in 2026 may have no GSTIN and no landline. An
  // optional token that is unset is simply not rendered — no placeholder, no
  // empty label — rather than blocking publication for a fact that does not
  // exist.
  GSTIN: {
    value: null,
    optional: true,
    label: 'GSTIN',
    why: 'Shown so sellers and buyers can verify the operator. Omitted entirely until GST registration exists.',
  },
  // From the Certificate of Incorporation (CIN U63120AP2026PTC125275,
  // incorporated 13 April 2026). The certificate labels this the "Mailing
  // Address as per record available in Registrar of Companies office" — for a
  // newly incorporated company that is normally the registered office too,
  // but if the two ever diverge, both must be displayed.
  REGISTERED_ADDRESS: {
    value: 'Door No. 10-40, Middeladon, Medarametla, Korisapadu, Bodduvaripalem, Ongole, Prakasam – 523212, Andhra Pradesh, India',
    label: 'Registered office address',
    why: 'E-Commerce Rules r.4(2) — registered office and every branch office address must be displayed.',
  },
  GRIEVANCE_OFFICER: {
    value: 'M Aveen',
    label: 'Grievance Officer — full name',
    why: 'IT Rules r.3(2)(a) — the name must be published, not merely available on request.',
  },
  GRIEVANCE_DESIGNATION: {
    value: 'Founder',
    label: 'Grievance Officer — designation',
    why: 'E-Commerce Rules r.4(4) requires the designation in addition to name and contact.',
  },
  GRIEVANCE_EMAIL: {
    value: 'contact@inflx.in',
    label: 'Grievance Officer — email',
    why: 'IT Rules r.3(2)(a). Must be monitored against a 24-hour acknowledgement clock.',
  },
  GRIEVANCE_PHONE: {
    value: '+91 86394 48121',
    label: 'Grievance Officer — phone',
    why: 'Not strictly required, but the Indian platforms that handle grievances well all publish one.',
  },
  SUPPORT_EMAIL: {
    value: 'contact@inflx.in',
    label: 'Customer care email',
    why: 'E-Commerce Rules r.4(2) requires contact details including email.',
  },
  SUPPORT_MOBILE: {
    value: '+91 86394 48121',
    label: 'Customer care mobile',
    why: 'E-Commerce Rules r.4(2) names mobile explicitly, separately from landline.',
  },
  SUPPORT_LANDLINE: {
    value: null,
    optional: true,
    label: 'Customer care landline',
    why: 'E-Commerce Rules r.4(2) names landline separately from mobile. Omitted until a landline exists; worth adding when the team forms.',
  },
  EFFECTIVE_DATE: {
    value: '1 August 2026',
    label: 'Effective date of the published documents',
    why: 'A policy without an effective date cannot be shown to have applied to a past transaction.',
  },
  JURISDICTION_CITY: {
    value: 'Ongole, Andhra Pradesh',
    label: 'Courts of which city have jurisdiction',
    why: 'Governing-law clauses name a seat. Taken from the registered office; change it if the company later operates from elsewhere.',
  },
};

/**
 * Tokens still awaiting a founder-supplied value, in declaration order.
 * Optional tokens are excluded — a company with no GST registration and no
 * landline is not an incomplete company, and blocking publication on a fact
 * that does not exist would be wrong.
 */
export function missingTokens() {
  return Object.entries(TOKENS)
    .filter(([, t]) => !t.optional && (t.value === null || t.value === ''))
    .map(([key, t]) => ({ key, ...t }));
}

/** True once every mandatory disclosure has a real value. Gate for release. */
export function identityComplete() {
  return missingTokens().length === 0;
}
