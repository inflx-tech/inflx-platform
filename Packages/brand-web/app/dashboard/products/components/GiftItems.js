'use client';
// Listings → Gift items (O13). Contract: features/offer-builder-v2 · rules v1.4 §1.7
// Things a brand gives away with a free gift offer but never sells: name, photo, value, stock.
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { brandApi } from '../../../../lib/api';
import { OFX_CSS } from '../../../../components/offers/offerCss';
import { dayMonth, inr } from '../../../../components/offers/offerFormat';
import GiftItemForm from '../../../../components/offers/GiftItemForm';

export default function GiftItems({ onCount }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);   // null = the "new" form; an item = editing it

  const load = useCallback(async () => {
    setErr('');
    const r = await brandApi.getGiftItems();
    if (r.success) { setItems(r.data.gift_items || []); onCount && onCount((r.data.gift_items || []).length); }
    else setErr(r.error?.message || 'Couldn\'t load your gift items.');
  }, [onCount]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="ofx">
      <style dangerouslySetInnerHTML={{ __html: OFX_CSS }} />
      <div className="page">
        <div className="hdr">
          <div><h3>Gift items</h3><div className="sub">Things you give away with a free gift offer. Never sold on their own.</div></div>
          <button className="btn btn-ink" onClick={() => setEditing(null)}>+ New gift item</button>
        </div>
        <div className="grid2" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <div>
            {err && <div className="card nobox"><span className="err">{err}</span><button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={load}>Try again</button></div>}
            {!items && !err && <div className="card">{[0, 1, 2].map((i) => <div key={i} className="skel" />)}</div>}
            {items && items.length === 0 && (
              <div className="empty"><b>No gift items yet</b><span className="hint">A silver coin, a water bottle, a tote. Add one here, then pick it into a free gift offer&apos;s gift pool.</span></div>
            )}
            {items && items.length > 0 && (
              <div className="tblwrap">
                <table className="tbl">
                  <thead><tr><th>Gift item</th><th className="r">Value</th><th className="r">Stock</th><th>Used in</th><th /></tr></thead>
                  <tbody>
                    {items.map((g) => (
                      <tr key={g.id}>
                        <td><div className="row">
                          {g.photo_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={g.photo_url} alt="" style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'cover' }} />
                            : <span style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--bg2)', display: 'inline-block' }} />}
                          <b>{g.name}</b></div></td>
                        <td className="r mono">{inr(g.value)}</td>
                        <td className="r mono">{g.stock}</td>
                        <td>{g.used_in
                          ? <><Link href={`/dashboard/products/offers/${g.used_in.offer_id}`} className={'st ' + (g.used_in.now ? 'live' : 'scheduled')}>{g.used_in.name}</Link>
                              <div className="xs mut2">{g.used_in.now ? `until ${dayMonth(g.used_in.until)}` : `from ${dayMonth(g.used_in.from)}`}</div></>
                          : <span className="xs mut2">Not in any offer</span>}</td>
                        <td className="r"><button className="btn btn-ghost btn-sm" onClick={() => setEditing(g)}>Restock / edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <GiftItemForm key={editing ? editing.id : 'new'} item={editing}
            onSaved={() => { setEditing(null); load(); }}
            onCancel={editing ? () => setEditing(null) : null} />
        </div>
        <div className="hint">A gift item follows the same one-offer rule: it can be in only one live offer&apos;s gift pool at a time. Things you also sell, like a cap, stay normal products and can be picked into a gift pool from your listings.</div>
      </div>
    </div>
  );
}
