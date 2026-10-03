'use client';
// OFFERS — Listings → Offers (O1). Contract: features/offer-builder-v2 · rules v1.4 §1.12
// Mounted by both product surfaces (/dashboard/products and /dashboard/products/listing).
//
// Offers are built on the builder page (/dashboard/products/offers/new) in six steps and live
// through Draft → Scheduled → Live → Ended. Retired from this list (rules 1.13): the "In store"
// badge, the "Publish to store" switch, the pop-up builder and Activate / Archive.
//
// Delete (features/offer-delete · rules v1.17 §1.9): a Draft row and an Ended row (ended early or
// by its date — the server's display_status) carry Delete beside their own button. A draft is
// erased; an ended offer leaves the brand's lists (its record stays for creators, orders, INFLX).
// Scheduled and Live rows have no Delete: end them first.
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { brandApi } from '../../../../lib/api';
import { OFX_CSS } from '../../../../components/offers/offerCss';
import { span, STATUS_LABEL, TYPE_CHIPS } from '../../../../components/offers/offerFormat';

const STATUS_CHIPS = [['all', 'All'], ['live', 'Live'], ['scheduled', 'Scheduled'], ['draft', 'Draft'], ['ended', 'Ended']];
const deletable = (o) => o.display_status === 'draft' || o.display_status === 'ended';

export default function OffersLibrary() {
  const [data, setData] = useState(null);     // { offers, counts }
  const [err, setErr] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [on, setOn] = useState('');
  const [dialog, setDialog] = useState(null);  // { offer } — the row whose Delete was pressed
  const [busy, setBusy] = useState(false);
  const [dlgErr, setDlgErr] = useState('');
  const [toast, setToast] = useState(null);

  const say = (msg, tone) => { setToast({ msg, type: tone }); setTimeout(() => setToast(null), 4000); };

  // The ended offer's own page deletes it and comes back here with ?deleted=1 (Listings › Offers).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (!sp.get('deleted')) return;
    say('Offer deleted.');
    sp.delete('deleted');
    window.history.replaceState(null, '', window.location.pathname + (sp.toString() ? `?${sp}` : ''));
  }, []);

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

  async function confirmDelete() {
    if (busy || !dialog) return;
    const isDraft = dialog.offer.display_status === 'draft';
    setBusy(true); setDlgErr('');
    const r = await brandApi.deleteOffer(dialog.offer.id);
    setBusy(false);
    if (!r.success) {
      // Already gone (deleted in another tab, or the first try went through and its answer was lost):
      // that is what the brand asked for, so close the box and show the list as it now is.
      if (r.error?.code === 'NOT_FOUND') { setDialog(null); load(); return; }
      setDlgErr(r.error?.message || 'Couldn\'t delete it. Try again.');
      // The server saw the offer differently (published meanwhile): refresh the rows behind the box
      // so its status and buttons are true when the brand closes it.
      if (r.error?.code === 'OFFER_LOCKED') load();
      return;
    }
    setDialog(null);
    say(isDraft ? 'Draft deleted.' : 'Offer deleted.');
    load();   // the pill counts come from the server
  }
  const dOffer = dialog && dialog.offer;
  const dDraft = dOffer && dOffer.display_status === 'draft';

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
                      <span className="acts">
                        {o.display_status === 'draft'
                          ? <Link className="btn btn-ghost btn-sm" href={`/dashboard/products/offers/${o.id}/edit`}>Continue</Link>
                          : <Link className="btn btn-ghost btn-sm" href={`/dashboard/products/offers/${o.id}`}>Open</Link>}
                        {deletable(o) && (
                          <button className="btn btn-danger btn-sm" onClick={() => { setDlgErr(''); setDialog({ offer: o }); }}>Delete</button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dOffer && (
        <div className="dimbg" onClick={() => !busy && setDialog(null)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <h4>{dDraft ? 'Delete this draft?' : <>Delete &quot;{dOffer.name}&quot;?</>}</h4>
            <div className="sm">{dDraft
              ? 'It isn\'t published, so no creator has it and no products are held. This can\'t be undone.'
              : 'It comes off your Offers list. Creators who had it, their posts, orders and payments keep their records.'}</div>
            {dlgErr && <div className="err">{dlgErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setDialog(null)}>Keep it</button>
              <button className="btn btn-danger" disabled={busy} onClick={confirmDelete}>{busy ? 'Deleting…' : (dDraft ? 'Delete draft' : 'Delete offer')}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={'toast' + (toast.type === 'err' ? ' err' : '')}>{toast.msg}</div>}
    </div>
  );
}
