'use client';
/**
 * Admin · Money — the small shared pieces of the section (board AM1–AM12).
 * Contract: features/item17-wallet · master rules v1.31 §17A
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const dash = (n) => (Number(n) ? inr(n) : '—');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ist = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + 330 * 60000); };
/** "12 Oct" — a calendar day (YYYY-MM-DD) or a moment, in India's day. */
export function dayMon(v) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (m) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
  const d = ist(v);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` : '';
}
/** "30 Sep, 2:10 pm" */
export function dayTime(v) {
  const d = v ? ist(v) : null;
  if (!d) return '';
  const h = d.getUTCHours();
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${((h + 11) % 12) + 1}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}
/** "19 h waiting" / "35 min waiting" */
export function waited(minutes) {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes} min waiting`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h waiting`;
  return `${Math.floor(minutes / 1440)} days waiting`;
}
export const AIM = { engagement: 'Pay for Content', hybrid: 'Hybrid', conversion: 'Pay for Sale' };

/** Load once and on demand; `data` is the API's data, `error` true when it could not be read. */
export function useLoad(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Only the NEWEST request may fill the page: when a tab or a search changes while an older
  // request is still on its way, the older answer is dropped instead of overwriting the newer one.
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    const r = await fetcher();
    if (mine !== seq.current) return;
    setLoading(false);
    if (!r.success) { setError(r.error?.message || true); return; }
    setError(false);
    setData(r.data);
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, bad = false) => { setToast({ msg, bad }); setTimeout(() => setToast(null), 3500); };
  const node = toast ? (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 text-white ${toast.bad ? 'bg-red' : 'bg-t1'}`}>{toast.msg}</div>
  ) : null;
  return { show, node };
}

export function Head({ title, sub, right }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h1 className="font-display text-xl font-bold text-t1">{title}</h1>
        {sub ? <p className="text-xs text-t3 mt-0.5">{sub}</p> : null}
      </div>
      {right || null}
    </div>
  );
}

export function Tiles({ children }) {
  return <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>{children}</div>;
}
export function Tile({ label, value, note, dark, children }) {
  return (
    <div className={`rounded-xl border p-3 ${dark ? 'bg-t1 border-t1 text-white' : 'bg-white border-border'}`}>
      <div className={`text-[11px] ${dark ? 'text-white/70' : 'text-t3'}`}>{label}</div>
      {value != null ? <div className={`font-display text-xl font-extrabold ${dark ? 'text-white' : 'text-t1'}`}>{value}</div> : null}
      {note ? <div className={`text-[11px] mt-0.5 ${dark ? 'text-white/70' : 'text-t3'}`}>{note}</div> : null}
      {children}
    </div>
  );
}

export function Tabs({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {options.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-colors ${value === k ? 'bg-t1 border-t1 text-white' : 'bg-white border-border text-t2 hover:border-t1'}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

const TONE = {
  ok: 'bg-teal-pale text-teal-deep', wait: 'bg-navy-pale text-navy', move: 'bg-orange-pale text-orange-deep',
  no: 'bg-red-pale text-red', ended: 'bg-surface2 text-t3',
};
export function Chip({ tone = 'ended', children }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${TONE[tone] || TONE.ended}`}>{children}</span>;
}

/** heads: [label, alignRight?][]; rows: cell[][] (a cell is text or a node). */
export function Table({ heads, rows, empty = 'Nothing here.', loading, onRow }) {
  return (
    <div className="bg-white rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface2 border-b border-border">
            {heads.map(([h, num], i) => <th key={i} className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-t3 ${num ? 'text-right' : 'text-left'}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={heads.length} className="p-8 text-center text-t3 text-sm">Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={heads.length} className="p-8 text-center text-t3 text-sm">{empty}</td></tr>
          ) : rows.map((r, i) => (
            <tr key={r.key || i} onClick={onRow ? () => onRow(r, i) : undefined}
              className={`border-b border-border last:border-0 align-top ${onRow ? 'cursor-pointer hover:bg-surface2' : ''}`}>
              {(r.cells || r).map((c, j) => <td key={j} className={`px-3 py-2.5 text-t1 ${heads[j] && heads[j][1] ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Who({ name, kind }) {
  return <div><div className="font-bold text-t1">{name}</div><div className="text-[10.5px] text-t3">{kind}</div></div>;
}

export function Btn({ children, onClick, kind = 'pri', disabled, small = true }) {
  const cls = {
    pri: 'bg-t1 text-white hover:opacity-90',
    sec: 'bg-white border border-border text-t1 hover:border-t1',
    dan: 'bg-red-pale text-red border border-red/20 hover:bg-red hover:text-white',
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${small ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-2.5 text-sm'} font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}>
      {children}
    </button>
  );
}

export function Modal({ title, sub, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-base font-bold text-t1">{title}</h3>
        {sub ? <p className="text-xs text-t3 mt-0.5 mb-3">{sub}</p> : <div className="mb-3" />}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, required, children, error }) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-bold text-t2 mb-1.5">{label}{required ? <span className="text-red"> *</span> : null}</label>
      {children}
      {error ? <div className="text-[11px] text-red font-semibold mt-1">{error}</div> : null}
    </div>
  );
}
export const inputCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-t1';

/** Shown wherever money could be paid out while payments are simulated. */
export function TestModeBanner({ show }) {
  if (!show) return null;
  return (
    <div className="border-l-4 border-red bg-red-pale text-red rounded-r-lg px-3 py-2 text-xs font-semibold mb-4">
      Payments are in TEST MODE. Money added to wallets, and every shopper payment, is simulated — INFLX has not received it.
      Do not pay a withdrawal from the bank unless you know the money behind it is real.
    </div>
  );
}

export function GreyBox({ children }) {
  return <div className="bg-surface2 rounded-lg p-3 text-xs text-t2 leading-relaxed mb-3">{children}</div>;
}

export function LoadFailed({ onRetry, what = 'this page' }) {
  return (
    <div className="bg-white rounded-xl border border-border p-8 text-center text-sm text-t3">
      We couldn&apos;t load {what}. <button className="underline font-bold text-t1" onClick={onRetry}>Try again</button>
    </div>
  );
}

/** Copy a value to the clipboard, saying so for a moment. */
export function Copy({ value }) {
  const [done, setDone] = useState(false);
  return (
    <button className="text-[11px] underline font-semibold text-t2 ml-2"
      onClick={() => { try { navigator.clipboard.writeText(String(value)); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard unavailable */ } }}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}
