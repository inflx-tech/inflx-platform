'use client';
// Listings → Products without offers (O8). Contract: features/offer-builder-v2 · rules v1.4 §1.12
// Every published product that isn't in any offer on the chosen day, with its next offer or the
// one it was last in. Tick some → "Put in offer" starts a new offer with them in its pool.
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { brandApi } from '../../../../lib/api';
import { OFX_CSS } from '../../../../components/offers/offerCss';
import { dayMonth, inr, todayIndia } from '../../../../components/offers/offerFormat';

export default function ProductsWithoutOffers({ onCount }) {
  const router = useRouter();
  const [date, setDate] = useState(todayIndia());
  const [q, setQ] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    const params = { date };
    if (q.trim()) params.q = q.trim();
    if (min !== '') params.price_min = min;
    if (max !== '') params.price_max = max;
    const r = await brandApi.productsWithoutOffers(params);
    if (r.success) {
      setRows(r.data.products || []);
      if (onCount && !q && min === '' && max === '' && date === todayIndia()) onCount((r.data.products || []).length);
    } else setErr(r.error?.message || 'Couldn\'t load your products.');
  }, [date, q, min, max, onCount]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const all = rows && rows.length > 0 && picked.length === rows.length;

  async function putInOffer(ids) {
    // The type is chosen on the builder's first step; the products wait for it there.
    setBusy(true);
    router.push(`/dashboard/products/offers/new?products=${ids.join(',')}`);
  }

  return (
    <div className="ofx">
      <style dangerouslySetInnerHTML={{ __html: OFX_CSS }} />
      <div className="page">
        <div className="hdr"><div><h3>Products without offers</h3>
          <div className="sub">Published products that aren&apos;t in any offer on the day you pick. Check a future day, such as a set&apos;s posting date.</div></div></div>
        <div className="toolbar">
          <input className="inp w" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="row sm mut">📅 Free on <input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value || todayIndia())} /></label>
          <label className="row sm mut">Price <input className="inp" style={{ width: 90 }} type="number" min="0" placeholder="from" value={min} onChange={(e) => setMin(e.target.value)} />
            – <input className="inp" style={{ width: 90 }} type="number" min="0" placeholder="to" value={max} onChange={(e) => setMax(e.target.value)} /></label>
        </div>
        {picked.length > 0 && (
          <div className="card tint row between">
            <span className="sm"><b>{picked.length}</b> ticked</span>
            <div className="row">
              <button className="btn btn-ghost btn-sm" onClick={() => setPicked([])}>Clear</button>
              <button className="btn btn-ink btn-sm" disabled={busy} onClick={() => putInOffer(picked)}>Put {picked.length} in an offer</button>
            </div>
          </div>
        )}
        {err && <div className="card nobox"><span className="err">{err}</span><button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={load}>Try again</button></div>}
        {!rows && !err && <div className="card">{[0, 1, 2].map((i) => <div key={i} className="skel" />)}</div>}
        {rows && rows.length === 0 && <div className="empty"><b>Every published product is in an offer on {dayMonth(date)}.</b><span className="hint">Pick another day, or clear the filters.</span></div>}
        {rows && rows.length > 0 && (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr>
                <th style={{ width: 34 }}><input type="checkbox" checked={all} onChange={() => setPicked(all ? [] : rows.map((p) => p.id))} /></th>
                <th>Product</th><th>Category</th><th className="r">Price</th><th>Next offer</th><th />
              </tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td><input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} /></td>
                    <td><b>{p.name}</b></td>
                    <td className="sm">{p.category_path || '—'}</td>
                    <td className="r mono">{inr(p.price)}</td>
                    <td className="sm">
                      {p.next_offer
                        ? <span className="st scheduled">Joins &quot;{p.next_offer.name}&quot; on {dayMonth(p.next_offer.from)}</span>
                        : p.last_offer
                          ? <span className="st ended">Was in &quot;{p.last_offer.name}&quot;, ended {dayMonth(p.last_offer.until)}</span>
                          : <span className="mut2">None</span>}
                    </td>
                    <td className="r"><button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => putInOffer([p.id])}>Put in offer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="hint">&quot;Put in offer&quot; starts a new offer with the ticked products already in its pool.</div>
      </div>
    </div>
  );
}
