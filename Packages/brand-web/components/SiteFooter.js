// The public compliance footer.
//
// Rendered on the landing page and on every legal route, unchanged. That
// repetition is the point: the IT Rules require the Grievance Officer to be
// reachable from the home screen or one click from it, and the E-Commerce
// Rules require the entity identity block to be displayed — so the safest
// implementation is one that cannot be omitted from a page by forgetting it.
//
// White + yellow, matching /login and /dashboard. There is no dark variant.

import Logo from '../../shared/components/Logo';
import { TOKENS } from '../lib/legal/company';
import { PUBLIC_FOOTER_GROUPS, LEGAL_SURFACE_LIVE } from '../lib/legal/nav';
import { Tbd } from './legal/RichText';

const C = {
  ink: '#0A0A0A',
  t2: '#52525B',
  t3: '#71717A',
  t4: '#A1A1AA',
  line: '#E4E4E7',
  surface: '#FAFAFA',
};

/** A company fact, or a loud placeholder if the founder has not supplied it. */
function Fact({ token }) {
  const meta = TOKENS[token];
  return meta && meta.value ? <>{meta.value}</> : <Tbd token={token} />;
}

export default function SiteFooter() {
  return (
    <footer style={{ background: C.surface, borderTop: `1px solid ${C.line}` }}>
      <div className="mx-auto max-w-6xl px-6 pt-14">

        {/* ── identity + link groups ── */}
        <div className="grid grid-cols-2 gap-8 pb-10 md:grid-cols-5 md:gap-8">
          <div className="col-span-2 md:col-span-1">
            <Logo tone="dark" size="sm" />
            <p className="mt-4 text-[12.5px] leading-[1.75]" style={{ color: C.t2 }}>
              <span style={{ color: C.ink, fontWeight: 700 }}><Fact token="ENTITY" /></span>
              {/* CIN / address / GSTIN are statutory disclosures that belong with
                  the published legal pages. Until those ship they would render as
                  red placeholders on the public homepage, so they are held back
                  with them rather than shown half-filled. */}
              {LEGAL_SURFACE_LIVE && (
                <>
                  <br />CIN <Fact token="CIN" />
                  <br /><Fact token="REGISTERED_ADDRESS" />
                  <br />GSTIN <Fact token="GSTIN" />
                </>
              )}
            </p>
            {/* The intermediary line lives in the persistent footer rather than
                inside clause 17 of the terms. Almost every Indian platform
                buries it; the ones that surface it here read as competent, and
                a shopper deciding whether to trust a listing is not going to
                open a legal document to find out who they are buying from. */}
            <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: C.t3 }}>
              INFLX is a product of Omnara India Private Limited. INFLX is a technology
              platform, not the seller — products and services are sold by the businesses
              listed on it.
            </p>
          </div>

          {PUBLIC_FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h5
                className="mb-3.5 font-display text-[11.5px] font-extrabold uppercase tracking-[0.09em]"
                style={{ color: C.t4 }}
              >
                {group.title}
              </h5>
              <ul className="flex list-none flex-col gap-2.5 p-0">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-[13px] no-underline hover:underline" style={{ color: C.t2 }}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── mandatory disclosure strip ──
            Grievance Officer, customer care and the government helpline. The
            timelines shown are the ones in force since 20 Feb 2026; the older
            15-day figure that most Indian sites still publish is superseded.
            Held back with the legal pages — publishing a Grievance Officer block
            with no named officer in it is worse than not publishing one yet. */}
        {LEGAL_SURFACE_LIVE && (
        <div
          className="grid gap-6 py-6 md:grid-cols-3"
          style={{ borderTop: `1px solid ${C.line}` }}
        >
          <div>
            <h6 className="mb-2 font-display text-[11px] font-extrabold uppercase tracking-[0.09em]" style={{ color: C.t4 }}>
              Grievance Officer
            </h6>
            <p className="m-0 text-[12px] leading-[1.7]" style={{ color: C.t2 }}>
              <Fact token="GRIEVANCE_OFFICER" />, <Fact token="GRIEVANCE_DESIGNATION" /><br />
              <Fact token="GRIEVANCE_EMAIL" /><br />
              We acknowledge every complaint within <b style={{ color: C.ink }}>24 hours</b> and
              resolve it within <b style={{ color: C.ink }}>7 days</b>. Reports of intimate
              imagery or impersonation are acted on within{' '}
              <b style={{ color: C.ink }}>2 hours</b>.{' '}
              <a href="/legal/grievance" className="underline" style={{ color: C.t2 }}>
                How to raise a complaint
              </a>
            </p>
          </div>

          <div>
            <h6 className="mb-2 font-display text-[11px] font-extrabold uppercase tracking-[0.09em]" style={{ color: C.t4 }}>
              Customer Care
            </h6>
            <p className="m-0 text-[12px] leading-[1.7]" style={{ color: C.t2 }}>
              <Fact token="SUPPORT_EMAIL" /><br />
              Mobile <Fact token="SUPPORT_MOBILE" /><br />
              Landline <Fact token="SUPPORT_LANDLINE" />
            </p>
          </div>

          <div>
            <h6 className="mb-2 font-display text-[11px] font-extrabold uppercase tracking-[0.09em]" style={{ color: C.t4 }}>
              National Consumer Helpline
            </h6>
            <p className="m-0 text-[12px] leading-[1.7]" style={{ color: C.t2 }}>
              1915 · consumerhelpline.gov.in<br />
              Department of Consumer Affairs, Government of India. You may approach the
              helpline at any time, including before contacting us.
            </p>
          </div>
        </div>
        )}

        {/* ── ownership + copyright ──
            Given its own panel rather than set in fine print at the bottom.
            This is the block that establishes INFLX belongs to Omnara, so it
            is meant to be read, not skimmed past. Soft yellow ground keeps it
            prominent without introducing a dark surface. */}
        <div
          className="mb-6 rounded-2xl px-6 py-6"
          style={{ background: '#FFFBEB', border: '1px solid #F5E3A8' }}
        >
          <p className="m-0 text-center text-[15px] font-extrabold leading-snug" style={{ color: C.ink, fontFamily: 'Outfit, sans-serif' }}>
            © {new Date().getFullYear()} Omnara India Private Limited. All rights reserved.
          </p>
          <p className="m-0 mt-1.5 text-center text-[13.5px] font-semibold" style={{ color: '#8A6A00' }}>
            INFLX is a product of Omnara India Private Limited.
          </p>
          <p className="mx-auto mt-3.5 max-w-[760px] text-center text-[12.5px] leading-[1.7]" style={{ color: C.t2 }}>
            INFLX™, its logo, branding, software, website design, mobile applications and
            associated technology are the intellectual property of Omnara India Private
            Limited. Unauthorised copying, reproduction, reverse engineering, distribution
            or commercial use of any part of the platform without prior written permission
            is strictly prohibited. All other trade marks, product names and brand assets
            shown on this site belong to their respective owners.
          </p>
        </div>

        <div
          className="flex flex-wrap items-center justify-center gap-4 pb-7 text-[12.5px]"
          style={{ color: C.t3 }}
        >
          <span>
            Made with <span style={{ color: '#E8401A' }}>♥</span> in India
          </span>
        </div>
      </div>
    </footer>
  );
}
