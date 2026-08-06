// The legal hub.
//
// Exists because a footer link list is a poor place to *find* something. A
// reader arrives here knowing what went wrong ("I want my money back",
// "someone used my photo") rather than which document covers it, so the
// groups are labelled by audience and each card says what the document is
// actually for.

import { DOCUMENTS } from '../../lib/legal/registry';
import { missingTokens } from '../../lib/legal/company';

export const metadata = {
  title: 'Legal & Policies — INFLX',
  description:
    'Every INFLX policy and agreement in one place — privacy, terms, creator and brand agreements, refunds, copyright, ranking transparency and grievance redressal.',
  alternates: { canonical: 'https://inflx.in/legal' },
};

const C = {
  ink: '#0A0A0A', t2: '#52525B', t3: '#71717A', t4: '#A1A1AA',
  line: '#E4E4E7', surface: '#FAFAFA', yellow: '#FFC107', yellowPale: '#FFFBEB',
};

const GROUPS = [
  { key: 'policies', title: 'Policies', blurb: 'The rules that apply to everyone using INFLX.' },
  { key: 'agreements', title: 'Agreements', blurb: 'Terms written for a specific side of the platform.' },
  { key: 'transparency', title: 'Transparency', blurb: 'How the platform makes decisions that affect you.' },
];

const HELP = [
  { href: '/legal/grievance', title: 'Raise a grievance', desc: 'Report a problem to our Grievance Officer. Acknowledged within 24 hours.' },
  { href: '/account-deletion', title: 'Delete my account', desc: 'Erase your INFLX account and the data attached to it.' },
  { href: '/contact', title: 'Contact us', desc: 'Customer care, registered office and how to reach the right team.' },
];

export default function LegalIndex() {
  const missing = missingTokens();

  return (
    <>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        <div className="mx-auto max-w-6xl px-6 pb-10 pt-12">
          <h1 className="font-display text-[32px] font-extrabold tracking-[-0.025em] md:text-[40px]" style={{ color: C.ink }}>
            Legal &amp; Policies
          </h1>
          <p className="mt-3 max-w-[640px] text-[15.5px] leading-[1.65]" style={{ color: C.t2 }}>
            INFLX connects brands, creators and shoppers. Because those three sides owe each
            other different things, we publish terms for each rather than one document that
            covers none of them well. Everything below is written in plain English.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Draft banner. Present only while a mandatory disclosure is unfilled —
            it disappears on its own the moment company.js is completed, so it
            cannot be forgotten in place. */}
        {missing.length > 0 && (
          <div
            className="mb-10 rounded-xl p-[16px_18px]"
            style={{ background: '#FDEEE9', border: '1px dashed #E8401A' }}
          >
            <b className="block font-display text-[13px]" style={{ color: '#B3350F' }}>
              These documents are not yet in force
            </b>
            <p className="m-0 mt-1.5 text-[13px] leading-[1.65]" style={{ color: '#8C2A0C' }}>
              {missing.length} mandatory disclosure{missing.length === 1 ? '' : 's'} — including
              the company identity and Grievance Officer details — have not been filled in, and
              the documents have not been reviewed by a legal practitioner. Placeholders are
              shown in red wherever a value is missing.
            </p>
          </div>
        )}

        {GROUPS.map((group) => {
          const docs = DOCUMENTS.filter((d) => d.group === group.key);
          if (docs.length === 0) return null;
          return (
            <div key={group.key} className="mb-12">
              <h2 className="font-display text-[20px] font-extrabold" style={{ color: C.ink }}>{group.title}</h2>
              <p className="mb-5 mt-1 text-[13.5px]" style={{ color: C.t3 }}>{group.blurb}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {docs.map((d) => (
                  <a
                    key={d.slug}
                    href={`/legal/${d.slug}`}
                    className="block rounded-2xl p-[20px_22px] no-underline"
                    style={{ border: `1px solid ${C.line}`, background: '#fff' }}
                  >
                    <b className="mb-1.5 block font-display text-[15.5px] font-bold" style={{ color: C.ink }}>{d.title}</b>
                    <span className="block text-[13px] leading-[1.6]" style={{ color: C.t2 }}>{d.summary}</span>
                    {d.appliesTo && (
                      <span className="mt-2.5 block text-[11.5px]" style={{ color: C.t4 }}>{d.appliesTo}</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          );
        })}

        <div className="rounded-2xl p-[24px_26px]" style={{ background: C.yellowPale, border: '1px solid #F5E3A8' }}>
          <h2 className="font-display text-[20px] font-extrabold" style={{ color: C.ink }}>Need something done, not read?</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {HELP.map((h) => (
              <a
                key={h.href}
                href={h.href}
                className="block rounded-xl p-[16px_18px] no-underline"
                style={{ background: '#fff', border: '1px solid #F0E4BC' }}
              >
                <b className="mb-1 block font-display text-[14px]" style={{ color: C.ink }}>{h.title}</b>
                <span className="text-[12.5px] leading-[1.55]" style={{ color: C.t2 }}>{h.desc}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
