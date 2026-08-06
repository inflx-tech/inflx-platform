// One layout for every legal document.
//
// Documents are data; this turns any of them into a page — header with
// effective/updated dates, a sticky contents rail, the prose, and related
// links. Because there is exactly one renderer, no document can quietly
// acquire a different structure, and a reader who has learned to navigate
// one has learned all eleven.

import RichText from './RichText';
import { TOKENS } from '../../lib/legal/company';
import { getDoc } from '../../lib/legal/registry';

const C = {
  ink: '#0A0A0A',
  t2: '#52525B',
  t3: '#71717A',
  t4: '#A1A1AA',
  line: '#E4E4E7',
  line2: '#D4D4D8',
  surface: '#FAFAFA',
  surface2: '#F4F4F5',
  yellow: '#FFC107',
  yellowDeep: '#E0A800',
  yellowPale: '#FFFBEB',
  yellowEdge: '#F5E3A8',
};

function DateFact({ token }) {
  const meta = TOKENS[token];
  if (meta && meta.value) return <>{meta.value}</>;
  return (
    <span
      style={{
        background: '#FDEEE9',
        color: '#B3350F',
        border: '1px dashed #E8401A',
        borderRadius: 4,
        padding: '0 5px',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {token}
    </span>
  );
}

function Block({ block }) {
  if (block.p) {
    return (
      <p className="mb-3.5 text-[14.5px] leading-[1.78]" style={{ color: C.t2 }}>
        <RichText text={block.p} />
      </p>
    );
  }

  if (block.ul) {
    return (
      <ul className="mb-4 list-disc pl-5">
        {block.ul.map((item, i) => (
          <li key={i} className="mb-1.5 text-[14.5px] leading-[1.78]" style={{ color: C.t2 }}>
            <RichText text={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (block.table) {
    const { head, rows } = block.table;
    // Tables carry the densest content in these documents (timelines, who-owes-
    // what). On a phone they must scroll inside their own box rather than
    // widening the page — a legal page that scrolls sideways is unreadable.
    return (
      <div className="mb-4 w-full overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th
                  key={i}
                  className="p-[11px_12px] text-left font-display text-[11px] font-extrabold uppercase tracking-[0.07em]"
                  style={{ color: C.t4, background: C.surface, borderBottom: `1px solid ${C.line}` }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="p-[11px_12px] align-top leading-[1.6]"
                    style={{
                      borderBottom: `1px solid ${C.line}`,
                      color: c === 0 ? C.ink : C.t2,
                      fontWeight: c === 0 ? 600 : 400,
                    }}
                  >
                    <RichText text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.callout) {
    return (
      <div
        className="mb-4 rounded-[10px] p-[16px_18px]"
        style={{ background: C.yellowPale, border: `1px solid ${C.yellowEdge}`, borderLeft: `3px solid ${C.yellow}` }}
      >
        {block.callout.label && (
          <span className="mb-1.5 block font-display text-[10.5px] font-extrabold uppercase tracking-[0.09em]" style={{ color: '#8A6A00' }}>
            {block.callout.label}
          </span>
        )}
        {/* pre-line so a callout can lay out an address block across lines
            without the document data needing markup for a line break. */}
        <p className="m-0 text-[13.5px] leading-[1.7]" style={{ color: '#5C4600', whiteSpace: 'pre-line' }}>
          <RichText text={block.callout.p} />
        </p>
      </div>
    );
  }

  return null;
}

export default function DocPage({ doc, children }) {
  const related = (doc.related || []).map(getDoc).filter(Boolean);

  return (
    <>
      {/* ── document header ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        <div className="mx-auto max-w-6xl px-6 pb-9 pt-11">
          <div className="mb-3 text-[12.5px]" style={{ color: C.t3 }}>
            <a href="/" className="no-underline hover:underline" style={{ color: C.t3 }}>Home</a>
            {' › '}
            <a href="/legal" className="no-underline hover:underline" style={{ color: C.t3 }}>Legal</a>
            {' › '}
            {doc.title}
          </div>
          <h1 className="font-display text-[30px] font-extrabold tracking-[-0.025em] md:text-[38px]" style={{ color: C.ink }}>
            {doc.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {[
              ['Effective', <DateFact key="e" token="EFFECTIVE_DATE" />],
              ['Last updated', <DateFact key="u" token="EFFECTIVE_DATE" />],
              ['Version', doc.version || '1.0'],
            ].map(([label, val], i) => (
              <span
                key={i}
                className="rounded-full px-3 py-1.5 text-[11.5px] font-bold"
                style={{ background: '#fff', border: `1px solid ${C.line}`, color: C.t2 }}
              >
                {label} <span style={{ color: C.ink }}>{val}</span>
              </span>
            ))}
          </div>
          {doc.appliesTo && (
            <p className="mt-3.5 text-[13px]" style={{ color: C.t2 }}>
              <span style={{ fontWeight: 600, color: C.ink }}>Applies to:</span> {doc.appliesTo}
            </p>
          )}
        </div>
      </div>

      {/* ── contents rail + prose ── */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-8 px-6 pb-16 pt-10 md:grid-cols-[230px_1fr] md:gap-13">
        <aside className="md:sticky md:top-[78px]">
          <h5 className="mb-3 font-display text-[11px] font-extrabold uppercase tracking-[0.09em]" style={{ color: C.t4 }}>
            On this page
          </h5>
          <ol className="flex list-none flex-col gap-0.5 p-0">
            {doc.sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-lg px-2.5 py-1.5 text-[12.8px] leading-[1.45] no-underline"
                  style={{ color: C.t2, borderLeft: '2px solid transparent' }}
                >
                  {i + 1}. {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <main className="max-w-[720px]">
          {doc.inShort && (
            <div
              className="mb-5 rounded-[10px] p-[16px_18px]"
              style={{ background: C.yellowPale, border: `1px solid ${C.yellowEdge}`, borderLeft: `3px solid ${C.yellow}` }}
            >
              <span className="mb-1.5 block font-display text-[10.5px] font-extrabold uppercase tracking-[0.09em]" style={{ color: '#8A6A00' }}>
                In short
              </span>
              <p className="m-0 text-[13.5px] leading-[1.7]" style={{ color: '#5C4600' }}>
                <RichText text={doc.inShort} />
              </p>
            </div>
          )}

          {doc.sections.map((section, i) => (
            <section key={section.id} id={section.id} style={{ scrollMarginTop: 90 }}>
              <h2 className="mb-3 mt-9 font-display text-[19px] font-bold first:mt-0" style={{ color: C.ink }}>
                <span className="mr-2.5 font-extrabold" style={{ color: C.yellowDeep }}>{i + 1}</span>
                {section.heading}
              </h2>
              {section.blocks.map((b, bi) => <Block key={bi} block={b} />)}
            </section>
          ))}

          {children}

          {related.length > 0 && (
            <div className="mt-11 pt-6" style={{ borderTop: `1px solid ${C.line}` }}>
              <h5 className="mb-3.5 font-display text-[11px] font-extrabold uppercase tracking-[0.09em]" style={{ color: C.t4 }}>
                Related documents
              </h5>
              <div className="grid gap-3 sm:grid-cols-3">
                {related.map((r) => (
                  <a
                    key={r.slug}
                    href={`/legal/${r.slug}`}
                    className="block rounded-xl p-[14px_16px] no-underline"
                    style={{ border: `1px solid ${C.line}` }}
                  >
                    <b className="mb-1 block font-display text-[13.5px]" style={{ color: C.ink }}>{r.title}</b>
                    <span className="text-[11.5px] leading-[1.5]" style={{ color: C.t3 }}>{r.summary}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
