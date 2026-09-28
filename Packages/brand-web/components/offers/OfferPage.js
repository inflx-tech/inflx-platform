'use client';
// A published offer (O10) and its two allowed changes (O11). Contract: features/offer-builder-v2 · rules 1.9, 1.10
// Name, type, numbers, dates and pool are frozen once published: the creators' posts promise this
// deal. The brand can only take products out, or end the offer now.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { brandApi } from '../../lib/api';
import { OFX_CSS } from './offerCss';
import { STATUS_LABEL, inr, longDay, span } from './offerFormat';

export default function OfferPage({ id }) {
  const router = useRouter();
  const [view, setView] = useState(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState(null);
  const [removing, setRemoving] = useState(false);     // choosing products to remove
  const [ticked, setTicked] = useState([]);
  const [dialog, setDialog] = useState(null);          // { kind: 'remove', preview } | { kind: 'end' }
  const [busy, setBusy] = useState(false);
  const [dlgErr, setDlgErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const r = await brandApi.getOffer(id);
    if (!r.success) { setErr(r.error?.message || 'Couldn\'t load this offer.'); return; }
    if (r.data.offer.status === 'draft') { router.replace(`/dashboard/products/offers/${id}/edit`); return; }
    setView(r.data);
  }, [id, router]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('published')) {
      setToast({ msg: 'Published. Its products are locked to this offer for its dates.' });
      window.history.replaceState(null, '', `/dashboard/products/offers/${id}`);
      setTimeout(() => setToast(null), 4000);
    }
  }, [id]);

  const say = (msg, type) => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  async function openRemove() {
    if (!ticked.length) return;
    setDlgErr('');
    const r = await brandApi.offerRemovePreview(id, ticked);
    if (!r.success) { say(r.error?.message || 'Couldn\'t check those products.', 'err'); return; }
    setDialog({ kind: 'remove', preview: r.data });
  }
  async function confirmRemove() {
    if (busy) return;
    setBusy(true); setDlgErr('');
    const r = await brandApi.removeOfferProducts(id, ticked);
    setBusy(false);
    if (!r.success) { setDlgErr(r.error?.message || 'Couldn\'t remove them.'); return; }
    setDialog(null); setRemoving(false); setTicked([]);
    say(`${r.data.removed} product${r.data.removed > 1 ? 's' : ''} removed and free again.${r.data.creators_told ? ` ${r.data.creators_told} creator${r.data.creators_told > 1 ? 's were' : ' was'} told.` : ''}`);
    load();
  }
  async function confirmEnd() {
    if (busy) return;
    setBusy(true); setDlgErr('');
    const r = await brandApi.endOffer(id);
    setBusy(false);
    if (!r.success) { setDlgErr(r.error?.message || 'Couldn\'t end the offer.'); return; }
    setDialog(null);
    say(`Offer ended. Its products are free from today.${r.data.creators_told ? ` ${r.data.creators_told} creator${r.data.creators_told > 1 ? 's were' : ' was'} told.` : ''}`);
    load();
  }

  if (err) {
    return (<div className="ofx"><style dangerouslySetInnerHTML={{ __html: OFX_CSS }} />
      <div className="page"><div className="card nobox"><span className="err">{err}</span>
        <div className="row"><button className="btn btn-ghost btn-sm" onClick={load}>Try again</button><Link className="btn btn-ghost btn-sm" href="/dashboard/products/listing?tab=offers">← Offers</Link></div></div></div></div>);
  }
  if (!view) {
    return <div className="ofx"><style dangerouslySetInnerHTML={{ __html: OFX_CSS }} /><div className="page"><div className="card">{[0, 1, 2].map((i) => <div key={i} className="skel" />)}</div></div></div>;
  }

  const o = view.offer;
  const ds = o.display_status;
  const running = ds === 'live' || ds === 'scheduled';
  const statusText = ds === 'live' ? `Live · ${o.days_left} day${o.days_left === 1 ? '' : 's'} left`
    : ds === 'scheduled' ? `Scheduled · starts in ${o.starts_in} day${o.starts_in === 1 ? '' : 's'}`
    : STATUS_LABEL[ds];
  const items = [...view.pool.buy.map((p) => ({ ...p, pool: 'buy' })), ...view.pool.gift.map((g) => ({ ...g, pool: 'gift' }))];
  const creators = view.creators || [];
  const pickedNames = items.filter((p) => ticked.includes(p.id)).map((p) => p.name);

  return (
    <div className="ofx">
      <style dangerouslySetInnerHTML={{ __html: OFX_CSS }} />
      <div className="page">
        <div className="row between">
          <Link className="link" href="/dashboard/products/listing?tab=offers">← Offers</Link>
          {running && (
            <div className="row">
              <button className="btn btn-ghost btn-sm" onClick={() => { setRemoving((v) => !v); setTicked([]); }}>{removing ? 'Cancel removing' : 'Remove products'}</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setDlgErr(''); setDialog({ kind: 'end' }); }}>End offer now</button>
            </div>
          )}
        </div>
        <div className="hdr">
          <div><h3>{o.name}</h3><div className="sub">{o.type_label}{o.deal ? ` · ${o.deal}` : ''} · {o.starts_on && o.ends_on ? `${longDay(o.starts_on)} – ${longDay(o.ends_on)}` : ''}</div></div>
          <span className={'st ' + ds}>{statusText}</span>
        </div>
        <div className="grid3">
          <div className="card"><span className="lbl">Pool</span><span className="big">{view.pool.counts.buy}{view.pool.counts.gift ? ` + ${view.pool.counts.gift}` : ''}</span><span className="xs mut2">products{view.pool.counts.gift ? ' + gifts' : ''} · frozen</span></div>
          <div className="card"><span className="lbl">Creators given this offer</span><span className="big">{creators.length}</span><span className="xs mut2">{creators.length ? `in ${new Set(creators.map((c) => c.set_name + c.campaign_name)).size} set${new Set(creators.map((c) => c.set_name + c.campaign_name)).size > 1 ? 's' : ''}` : 'You give offers to creators when you set their terms'}</span></div>
          <div className="card"><span className="lbl">Live posts using it</span><span className="big">{view.posts.live}</span><span className="xs mut2">{view.posts.note}</span></div>
        </div>

        {removing && (
          <div className="card warnbox">
            <div className="row between"><b className="sm">Tick the products to take out of this offer</b>
              <button className="btn btn-ink btn-sm" disabled={!ticked.length} onClick={openRemove}>Remove {ticked.length || ''} product{ticked.length === 1 ? '' : 's'}</button></div>
            <div className="plist" style={{ background: '#fff' }}>
              {items.map((p) => (
                <label key={p.pool + p.id} className="prow">
                  <input type="checkbox" checked={ticked.includes(p.id)} onChange={() => setTicked((t) => (t.includes(p.id) ? t.filter((x) => x !== p.id) : [...t, p.id]))} />
                  <div className="t"><b>{p.name}</b><span className="xs mut2">{p.pool === 'gift' ? `Gift · ${inr(p.value)}` : inr(p.price)}</span></div>
                </label>
              ))}
            </div>
          </div>
        )}

        {creators.length > 0 && (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th>Creator</th><th>Set</th><th className="r">Posts</th><th className="r">Sales</th></tr></thead>
              <tbody>
                {creators.map((c) => (
                  <tr key={c.campaign_influencer_id}><td><b>{c.name}</b></td><td className="sm">{c.campaign_name} · {c.set_name}</td><td className="r mono">{c.posts}</td><td className="r mono">{c.sales == null ? '—' : inr(c.sales)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!removing && (
          <div className="card">
            <h4>The pool</h4>
            <div className="plist">
              {items.map((p) => (
                <div key={p.pool + p.id} className="prow">
                  <div className="t"><b>{p.name}</b><span className="xs mut2">{p.pool === 'gift' ? (p.kind === 'gift_item' ? `Gift item · worth ${inr(p.value)} · stock ${p.stock}` : `Gift · ${inr(p.value)} · limit ${p.gift_limit || '—'}`) : `${inr(p.price)}${p.quantity > 1 ? ` · qty ${p.quantity}` : ''}${p.added_by === 'auto_add' ? ` · added automatically from ${longDay(p.from_day)}` : ''}`}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="hint">Name, type, numbers and pool can&apos;t be edited once published. Creators&apos; posts already promise this deal. To change the deal, end it and build a new one.</div>
      </div>

      {dialog && dialog.kind === 'remove' && (
        <div className="dimbg" onClick={() => !busy && setDialog(null)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <h4>Remove {dialog.preview.products.length} product{dialog.preview.products.length > 1 ? 's' : ''} from this offer?</h4>
            <div className="sm">{pickedNames.join(' · ')}</div>
            <div className="card warnbox" style={{ gap: 4 }}>
              {dialog.preview.creators.length
                ? <span className="sm"><b>{dialog.preview.creators.length} creator{dialog.preview.creators.length > 1 ? 's have' : ' has'} this offer</b> ({dialog.preview.creators.slice(0, 3).join(', ')}{dialog.preview.creators.length > 3 ? '…' : ''}). They&apos;ll leave any of their posts using it.</span>
                : <span className="sm"><b>No creator has this offer yet.</b></span>}
              <span className="xs">Each creator gets a notification. Shoppers already paying keep the offer price.</span>
            </div>
            <div className="hint">The {dialog.preview.products.length} product{dialog.preview.products.length > 1 ? 's' : ''} become free right away and can go into another offer. {dialog.preview.products_left} stay{dialog.preview.products_left === 1 ? 's' : ''} in this offer.</div>
            {dlgErr && <div className="err">{dlgErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
              <button className="btn btn-ink" disabled={busy} onClick={confirmRemove}>{busy ? 'Removing…' : 'Remove products'}</button>
            </div>
          </div>
        </div>
      )}

      {dialog && dialog.kind === 'end' && (
        <div className="dimbg" onClick={() => !busy && setDialog(null)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <h4>End &quot;{o.name}&quot; now?</h4>
            <div className="card nobox" style={{ gap: 4 }}>
              <span className="sm"><b>Every post using this offer leaves the shop.</b></span>
              <span className="xs">Their photos and videos promise {o.deal ? o.deal.toLowerCase() : 'this deal'}, so they can&apos;t stay up at full price.{creators.length ? ` The ${creators.length} creator${creators.length > 1 ? 's are' : ' is'} told.` : ''}</span>
            </div>
            <div className="hint">{view.pool.counts.buy === 1 ? 'Its 1 product becomes' : `All ${view.pool.counts.buy} products become`}{view.pool.counts.gift ? ' (and its gifts)' : ''} free right away. It stays in your list as Ended, with its dates ({span(o.starts_on, o.ends_on)}).</div>
            {dlgErr && <div className="err">{dlgErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setDialog(null)}>Keep it running</button>
              <button className="btn btn-danger" disabled={busy} onClick={confirmEnd}>{busy ? 'Ending…' : 'End offer now'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={'toast' + (toast.type === 'err' ? ' err' : '')}>{toast.msg}</div>}
    </div>
  );
}
