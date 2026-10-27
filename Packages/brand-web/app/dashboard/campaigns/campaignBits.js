'use client';

/* Shared pieces for the web Campaigns tab (features/web-campaigns-monitor).
   The words are the phone's words (Packages/Mobile/src/screens/brand/copy4.js). */

/** The derived campaign / set state → chip. draft = outline, live = green, finished = grey. */
const STATE = {
  draft:     { cls: 'bg-white text-[#52525B] border border-[#D4D4D8]', dot: '', label: 'Draft' },
  live:      { cls: 'bg-[#D1FAE5] text-[#047857]', dot: 'bg-[#10B981]', label: 'Live' },
  completed: { cls: 'bg-[#F4F4F5] text-[#52525B]', dot: 'bg-[#71717A]', label: 'Completed' },
  expired:   { cls: 'bg-[#F4F4F5] text-[#52525B]', dot: 'bg-[#A1A1AA]', label: 'Expired' },
};

export function StateChip({ state, className = '' }) {
  const cfg = STATE[state] || STATE.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold uppercase tracking-[0.3px] whitespace-nowrap flex-shrink-0 ${cfg.cls} ${className}`}>
      {cfg.dot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
      {cfg.label}
    </span>
  );
}

/** Small tinted chip for a row's standing (waiting = blue, your move = orange, no = red). */
export function Tag({ tone = 'wait', children }) {
  const cls = {
    wait: 'bg-[#E6EFFC] text-[#1D5FBF]',
    move: 'bg-[#FFEBDD] text-[#B04600]',
    no:   'bg-[#FDEEE9] text-[#B91C1C]',
    done: 'bg-[#F4F4F5] text-[#52525B]',
    ok:   'bg-[#D1FAE5] text-[#047857]',
  }[tone] || 'bg-[#F4F4F5] text-[#52525B]';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.3px] whitespace-nowrap ${cls}`}>{children}</span>;
}

export const AIM_WORD = { conversion: 'Pay for Sale', engagement: 'Pay for Content', hybrid: 'Hybrid' };
export const MODE_WORD = { visit: 'Store Visit', shipment: 'Remote' };
export const aimWord = (g) => AIM_WORD[g] || (g ? String(g) : '');
export const modeWord = (m) => MODE_WORD[m] || (m ? String(m) : '');

/** 'YYYY-MM-DD' (a calendar day in India) or an ISO stamp → "2 Nov 2026". Never shifts a day. */
export function fmtDay(v) {
  if (!v) return '';
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** ISO stamp → "26 Oct 2026, 09:10". */
export function fmtStamp(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** The one-line "this is done on the phone" note. */
export function PhoneNote({ children, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-2.5 bg-white border border-dashed border-[#D4D4D8] rounded-[10px] px-3 py-2 text-[12.5px] text-[#52525B] mb-5 ${className}`}>
      <span className="font-mono text-[10.5px] font-bold bg-[#F4F4F5] text-[#0A0A0A] px-1.5 py-0.5 rounded-[6px]">PHONE</span>
      <span>{children}</span>
    </div>
  );
}

/** The phone path under a row: "INFLX brand app › Campaigns › Set A". */
export function PhonePath({ children }) {
  return <span className="text-[11.5px] font-semibold text-[#1D5FBF]">{children}</span>;
}
