'use client';

// Grievance intake.
//
// The IT Rules require a *mechanism* that lets a complainant supply the
// details needed to act — an email address alone does not satisfy it. There
// is no complaints endpoint on the backend yet, so this composes a complete,
// correctly structured complaint and hands it off by email, and it shows the
// complainant the exact clock their category runs on before they submit.
//
// Building this against a nonexistent API would have been the wrong kind of
// complete: it would look like it worked and silently drop complaints.

import { useState } from 'react';
import { TOKENS } from '../../lib/legal/company';

// The response clock genuinely differs by category, so the form states the
// real one rather than a single comfortable average. The two-hour categories
// are the ones the Rules single out, and a complainant in that situation
// should not have to read a policy page to learn they are a priority.
const CATEGORIES = [
  {
    id: 'intimate',
    label: 'Intimate imagery, nudity or sexual content showing me',
    sla: 'Acted on within 2 hours',
    urgent: true,
  },
  {
    id: 'impersonation',
    label: 'Someone is impersonating me, or has posted a morphed image of me',
    sla: 'Acted on within 2 hours',
    urgent: true,
  },
  {
    id: 'prohibited',
    label: 'Other content that should not be on the platform',
    sla: 'Acted on within 36 hours',
  },
  {
    id: 'ip',
    label: 'Copyright or trade mark infringement',
    sla: 'Resolved within 7 days — see the Copyright & Takedown Policy',
  },
  {
    id: 'order',
    label: 'An order, booking, refund or payment problem',
    sla: 'Acknowledged within 24 hours, resolved within 7 days',
  },
  {
    id: 'privacy',
    label: 'My personal data — access, correction or erasure',
    sla: 'Acknowledged within 24 hours, resolved within 7 days',
  },
  {
    id: 'other',
    label: 'Something else',
    sla: 'Acknowledged within 24 hours, resolved within 7 days',
  },
];

const C = {
  ink: '#0A0A0A', t2: '#52525B', t3: '#71717A', t4: '#A1A1AA',
  line: '#E4E4E7', line2: '#D4D4D8', surface: '#FAFAFA',
  yellow: '#FFC107', yellowPale: '#FFFBEB', yellowEdge: '#F5E3A8',
};

const field = {
  width: '100%',
  border: `1px solid ${C.line2}`,
  borderRadius: 10,
  padding: '11px 13px',
  fontSize: 14,
  fontFamily: 'inherit',
  color: C.ink,
  background: '#fff',
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 700,
  color: C.ink,
  marginBottom: 6,
};

export default function GrievanceForm() {
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [form, setForm] = useState({ name: '', contact: '', where: '', what: '', want: '' });
  const [copied, setCopied] = useState(false);

  const chosen = CATEGORIES.find((c) => c.id === category);
  const email = TOKENS.GRIEVANCE_EMAIL.value;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const subject = `Grievance — ${chosen.label}`;
  const body = [
    `Category: ${chosen.label}`,
    '',
    `Name: ${form.name || '—'}`,
    `Email or mobile for reply: ${form.contact || '—'}`,
    '',
    'Where on INFLX this is (link, screen, order or campaign reference):',
    form.where || '—',
    '',
    'What happened:',
    form.what || '—',
    '',
    'What I am asking INFLX to do:',
    form.want || '—',
    '',
    '— Submitted from inflx.in/legal/grievance',
  ].join('\n');

  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked — the textarea below is still selectable by hand */
    }
  };

  return (
    <div className="mt-6 rounded-2xl p-[22px_24px]" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <h3 className="font-display text-[17px] font-extrabold" style={{ color: C.ink }}>
        Raise a complaint
      </h3>
      <p className="mb-5 mt-1.5 text-[13px] leading-[1.65]" style={{ color: C.t2 }}>
        Fill this in and we will have everything we need to act. You do not need an INFLX
        account to complain, and you can complain on behalf of someone else.
      </p>

      <div className="mb-4">
        <label style={labelStyle} htmlFor="g-category">What is this about?</label>
        <select id="g-category" style={field} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <p
          className="mt-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold"
          style={{
            background: chosen.urgent ? '#FDEEE9' : C.yellowPale,
            color: chosen.urgent ? '#B3350F' : '#8A6A00',
            border: `1px solid ${chosen.urgent ? '#F3C6B8' : C.yellowEdge}`,
          }}
        >
          {chosen.urgent ? '⚡ Priority — ' : ''}{chosen.sla}
        </p>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label style={labelStyle} htmlFor="g-name">Your name</label>
          <input id="g-name" style={field} value={form.name} onChange={set('name')} placeholder="Full name" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="g-contact">Email or mobile we should reply to</label>
          <input id="g-contact" style={field} value={form.contact} onChange={set('contact')} placeholder="So we can reach you" />
        </div>
      </div>

      <div className="mb-4">
        <label style={labelStyle} htmlFor="g-where">Where on INFLX is this?</label>
        <input id="g-where" style={field} value={form.where} onChange={set('where')} placeholder="Link, screen name, order number or campaign reference" />
      </div>

      <div className="mb-4">
        <label style={labelStyle} htmlFor="g-what">What happened?</label>
        <textarea id="g-what" rows={4} style={{ ...field, resize: 'vertical' }} value={form.what} onChange={set('what')} placeholder="Describe the problem in your own words." />
      </div>

      <div className="mb-5">
        <label style={labelStyle} htmlFor="g-want">What would you like us to do?</label>
        <textarea id="g-want" rows={2} style={{ ...field, resize: 'vertical' }} value={form.want} onChange={set('want')} placeholder="For example: remove the content, refund the order, correct my data." />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {mailto ? (
          <a
            href={mailto}
            className="rounded-full px-6 py-3 text-[13.5px] font-bold no-underline"
            style={{ background: C.yellow, color: C.ink }}
          >
            Send to the Grievance Officer
          </a>
        ) : (
          <span
            className="rounded-full px-4 py-3 text-[12.5px] font-bold"
            style={{ background: '#FDEEE9', color: '#B3350F', border: '1px dashed #E8401A' }}
          >
            GRIEVANCE_EMAIL not yet published — copy the complaint below instead
          </span>
        )}
        <button
          type="button"
          onClick={copy}
          className="rounded-full px-5 py-3 text-[13.5px] font-bold"
          style={{ background: '#fff', color: C.ink, border: `1px solid ${C.line2}`, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {copied ? 'Copied' : 'Copy complaint'}
        </button>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-[12.5px] font-semibold" style={{ color: C.t3 }}>
          Preview what will be sent
        </summary>
        <pre
          className="mt-2.5 overflow-x-auto rounded-xl p-4 text-[12px] leading-[1.6]"
          style={{ background: '#fff', border: `1px solid ${C.line}`, color: C.t2, whiteSpace: 'pre-wrap' }}
        >
          {`Subject: ${subject}\n\n${body}`}
        </pre>
      </details>

      <p className="mt-4 text-[11.5px] leading-[1.6]" style={{ color: C.t4 }}>
        We record every complaint against a reference number and tell you what that number
        is when we acknowledge it. Keep it — you will need it if you escalate.
      </p>
    </div>
  );
}
