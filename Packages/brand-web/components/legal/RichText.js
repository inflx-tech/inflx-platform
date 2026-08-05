// Inline renderer for legal copy.
//
// Legal documents are data (lib/legal/docs-*.js), so their prose needs a
// tiny inline vocabulary — deliberately tiny, because every construct here
// is one a drafter can get wrong. Exactly three forms are supported:
//
//   **bold**              emphasis
//   [text](/href)         link
//   {{TOKEN}}             a company fact from lib/legal/company.js
//
// No raw HTML. A document cannot inject markup into the page, which matters
// because these files are the ones most likely to be edited by someone who
// is thinking about compliance rather than about React.

import { TOKENS } from '../../lib/legal/company';

// One pass, three alternatives. Capturing groups keep the delimiters so the
// split result alternates literal / match / literal.
const INLINE = /(\{\{[A-Z_]+\}\}|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

/**
 * An unsupplied company fact. Rendered loud on purpose — a missing CIN must
 * look broken, because the alternative (silently blank, or worse, invented)
 * is a false statement in a published legal document.
 */
export function Tbd({ token }) {
  const meta = TOKENS[token];
  return (
    <span
      // Machine-readable marker. The QA workflow counts these rather than
      // grepping for token names, because names like "CIN" also appear as
      // ordinary label text — a text search matched those and passed against
      // a deliberately broken build until this attribute existed.
      data-tbd={token}
      title={meta ? `${meta.label} — not yet supplied` : 'Unknown token'}
      style={{
        background: '#FDEEE9',
        color: '#B3350F',
        border: '1px dashed #E8401A',
        borderRadius: 4,
        padding: '0 5px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.85em',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {token}
    </span>
  );
}

/** Resolve {{TOKEN}} to its value, or to a visible placeholder. */
function Token({ name }) {
  const meta = TOKENS[name];
  if (meta && meta.value) return <>{meta.value}</>;
  return <Tbd token={name} />;
}

export default function RichText({ text }) {
  if (!text) return null;

  const parts = String(text).split(INLINE).filter((p) => p !== '');

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('{{') && part.endsWith('}}')) {
          return <Token key={i} name={part.slice(2, -2)} />;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          // Recurse, so a token inside bold still resolves. Rendering the
          // inner text raw made "**© {{COPYRIGHT_YEAR}} …**" print the token
          // literally on the page. Safe from runaway recursion because the
          // bold pattern excludes asterisks, so the inner text has no bold.
          return (
            <strong key={i} style={{ color: '#0A0A0A', fontWeight: 700 }}>
              <RichText text={part.slice(2, -2)} />
            </strong>
          );
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) {
          const [, label, href] = link;
          // External links leave the site, so they carry the usual opener
          // protections. Internal ones are plain <a> — these are static
          // documents and a client-side transition buys nothing.
          const external = /^https?:\/\//.test(href);
          return (
            <a
              key={i}
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              style={{ color: '#0A0A0A', textDecoration: 'underline', textDecorationColor: '#FFC107', textUnderlineOffset: 2 }}
            >
              {label}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
