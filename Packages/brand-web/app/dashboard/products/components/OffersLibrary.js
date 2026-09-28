'use client';
// OFFERS — Listings → Offers (O1). Contract: features/offer-builder-v2 · rules v1.4 §1.12
// Mounted by both product surfaces (/dashboard/products and /dashboard/products/listing).
//
// Offers are built on the builder page (/dashboard/products/offers/new) in six steps and live
// through Draft → Scheduled → Live → Ended. Retired from this list (rules 1.13): the "In store"
// badge, the "Publish to store" switch, the pop-up builder and Activate / Archive.
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { brandApi } from '../../../../lib/api';
import { OFX_CSS } from '../../../../components/offers/offerCss';
import { span, STATUS_LABEL, TYPE_CHIPS } from '../../../../components/offers/offerFormat';

const STATUS_CHIPS = [['all', 'All'], ['live', 'Live'], ['scheduled', 'Scheduled'], ['draft', 'Draft'], ['ended', 'Ended']];

export default function OffersLibrary() {
  const [data, setData] = useState(null);     // { offers, counts }
  const [err, setErr] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [on, setOn] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const params = {};
    if (type) params.type = type;
    if (q.trim()) params.q = q.trim();
    if (on) params.on = on;
    const r = await brandApi.getOffers(params);
    if (r.success) setData(r.data);
    else setErr(r.error?.message || 'Couldn\'t load your offers.');
  }, [type, q, on]);

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const offers = (data?.offers || []).filter((o) => status === 'all' || o.display_status === status);
  const counts = data?.counts || {};

  return (
    <div className="ofx">
      <style dangerouslySetInnerHTML={{ __html: OFX_CSS }} />
      <div className="page">
        <div className="hdr">
          <div>
            <h3>Offers</h3>
            <div className="sub">Build offers on your products, then give them to creators when you set their terms.</div>
          </div>
          <Link className="btn btn-ink" href="/dashboard/products/offers/new">+ New offer</Link>
        </div>

        <div className="toolbar">
          <input className="inp w" placeholder="Search offers by name…" value={q} onChange={(e) => setQ(e.target.value)} />
          {TYPE_CHIPS.map(([k, label]) => (
            <button key={k || 'all'} className={'chip' + (type === k ? ' act' : '')} onClick={() => setType(k)}>{label}</button>
          ))}
        </div>
        <div className="toolbar">
          {STATUS_CHIPS.map(([k, label]) => (
            <button key={k} className={'chip' + (status === k ? ' act' : '')} onClick={() => setStatus(k)}>
              {label}{k !== 'all' && <span className="n">{counts[k] || 0}</span>}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <label className="row sm mut">📅 Valid on
            <input className="inp" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
            {on && <button className="link xs" onClick={() => setOn('')}>any time</button>}
          </label>
        </div>

        {err && <div className="card nobox"><span className="err">{err}</span><button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={load}>Try again</button></div>}

        {!data && !err && (
          <div className="card">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ width: `${80 - i * 15}%` }} />)}</div>
        )}

        {data && offers.length === 0 && (
          <div className="empty">
            <b>{(data.offers || []).length ? 'No offers match these filters.' : 'No offers yet'}</b>
            <span className="hint">Every offer is built from a list of your products. Creators can only sell it once you give it to them in their terms.</span>
            {!(data.offers || []).length && <Link className="btn btn-ink" href="/dashboard/products/offers/new">+ New offer</Link>}
          </div>
        )}

        {offers.length > 0 && (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th>Offer</th><th>Type</th><th className="r">Products</th><th>Dates</th><th>Status</th><th className="r">Creators</th><th /></tr></thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td><b>{o.name}</b><div className="xs mut2">{o.display_status === 'draft' ? (o.deal || 'Not published yet') : (o.deal || '—')}</div></td>
                    <td>{o.type_label}</td>
                    <td className="r mono">{o.products}{o.gifts ? ` + ${o.gifts} gift${o.gifts > 1 ? 's' : ''}` : ''}</td>
                    <td className="sm">{span(o.starts_on, o.ends_on)}</td>
                    <td><span className={'st ' + o.display_status}>{STATUS_LABEL[o.display_status]}</span></td>
                    <td className="r mono">{o.creators == null ? '—' : o.creators}</td>
                    <td className="r">
                      {o.display_status === 'draft'
                        ? <Link className="btn btn-ghost btn-sm" href={`/dashboard/products/offers/${o.id}/edit`}>Continue</Link>
                        : <Link className="btn btn-ghost btn-sm" href={`/dashboard/products/offers/${o.id}`}>Open</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
