'use client';
import { useEffect, useState, useCallback } from 'react';
import { brandApi, fmtMoney } from '../../../lib/api';

// Returns visibility (G-4) — READ-ONLY for brands. Admin owns the
// approve/reject/refund actions; this page only surfaces what's happening
// to the brand's returns so they're not blind to refund activity.

const FILTERS = [
  { key: 'open',   label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: '',       label: 'All' },
];

// follower_returns.return_status state machine (migration 048):
//   requested → approved → received → refunded ; or → rejected
const STATUS_LABEL = {
  requested: 'Requested',
  approved:  'Approved',
  received:  'Received',
  refunded:  'Refunded',
  rejected:  'Rejected',
};

const REASON_LABEL = {
  wrong_size:       'Wrong size',
  damaged:          'Damaged',
  not_as_described: 'Not as described',
  changed_mind:     'Changed mind',
  other:            'Other',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CSS = `
.rtn *{box-sizing:border-box}
.rtn{--white:#fff;--bg:#FAFAFA;--bg2:#F4F4F5;--yellow:#FFC107;--yellow-pale:#FFF7CC;--yellow-text:#6B5A00;
--ink:#0A0A0A;--muted:#52525B;--muted-2:#71717A;--muted-3:#A1A1AA;--border:#E4E4E7;--border-soft:#F4F4F5;
--success:#10B981;--success-pale:#D1FAE5;--success-text:#047857;--danger:#E8401A;--danger-pale:#FDEEE9;--danger-text:#B91C1C;--conv:#7E22CE;--conv-pale:#F3E8FF;--info:#1D4ED8;--info-pale:#DBEAFE;
font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;color:var(--ink);font-size:13px;max-width:1000px;margin:0 auto}
.rtn .hdr h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;letter-spacing:-.4px}
.rtn .hdr .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.rtn .hdr .sub{font-size:12px;color:var(--muted-2);margin-bottom:16px}
.rtn .cnt-chip{display:inline-flex;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}
.rtn .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.rtn .chip{padding:6px 12px;border-radius:99px;background:var(--white);border:1px solid var(--border);font-size:11.5px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit}
.rtn .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow);font-weight:700}
.rtn .ro{background:var(--white);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;overflow:hidden}
.rtn .ro-row{padding:12px 14px;display:grid;grid-template-columns:auto 1fr auto auto;gap:12px;align-items:center}
.rtn .thumb{width:46px;height:46px;border-radius:9px;object-fit:cover;background:var(--bg2);flex-shrink:0}
.rtn .thumb-ph{width:46px;height:46px;border-radius:9px;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--muted-3)}
.rtn .ro-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rtn .ro-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);margin-top:3px}
.rtn .ro-amt{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;text-align:right}
.rtn .ro-amt .sub{font-size:9px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.rtn .pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;white-space:nowrap}
.rtn .pill.requested{background:var(--yellow-pale);color:var(--yellow-text)}
.rtn .pill.approved,.rtn .pill.received{background:var(--info-pale);color:var(--info)}
.rtn .pill.refunded{background:var(--success-pale);color:var(--success-text)}
.rtn .pill.rejected{background:var(--danger-pale);color:var(--danger-text)}
.rtn .ro-sub{background:var(--bg);border-top:1px solid var(--border-soft);padding:10px 14px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.rtn .kv-l{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.rtn .kv-v{font-size:12px;font-weight:600;margin-top:3px;color:var(--muted)}
.rtn .ro-notes{grid-column:1 / -1;font-size:11.5px;color:var(--muted-2);line-height:1.5}
.rtn .readonly{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:var(--muted-2);background:var(--bg2);border:1px solid var(--border);border-radius:99px;padding:4px 10px;margin-bottom:14px}
.rtn .empty{background:linear-gradient(135deg,#FFFDEB,#FFF7CC);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px;text-align:center;margin-top:14px}
.rtn .empty .em{font-size:44px;margin-bottom:8px}.rtn .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;margin-bottom:6px}
.rtn .empty .p{font-size:12.5px;color:var(--muted);max-width:380px;margin:0 auto}
.rtn .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:rtn-spin .8s linear infinite;margin:80px auto;display:block}
@keyframes rtn-spin{to{transform:rotate(360deg)}}
`;

export default function ReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await brandApi.getReturns(filter || undefined);
      if (res.success || res.ok) setReturns(res.data?.returns || []);
      else setReturns([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="rtn">
      <style>{CSS}</style>

      <div className="hdr">
        <h1>Returns</h1>
        <div className="rule" />
        <div className="sub">Returns &amp; refund requests on your orders. Reviewed and actioned by INFLX support.</div>
      </div>

      <div className="readonly">
        <span>👁</span> View only — our team processes approvals &amp; refunds
      </div>

      <div className="chip-row">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'act' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <span className="spinner" />
      ) : returns.length === 0 ? (
        <div className="empty">
          <div className="em">↩</div>
          <div className="h">No returns here</div>
          <div className="p">
            {filter === 'open'
              ? 'No open return requests on your orders right now.'
              : filter === 'closed'
              ? 'No closed (refunded or rejected) returns yet.'
              : 'No customers have requested a return on your orders yet.'}
          </div>
        </div>
      ) : (
        returns.map(r => (
          <div key={r.id} className="ro">
            <div className="ro-row">
              {r.product_image_url ? (
                <img className="thumb" src={r.product_image_url} alt="" />
              ) : (
                <div className="thumb-ph">▤</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div className="ro-name">{r.product_name || 'Item'}</div>
                <div className="ro-meta">
                  {REASON_LABEL[r.reason] || r.reason}
                  {(r.variant_size || r.variant_color) && (
                    <> · {[r.variant_size, r.variant_color].filter(Boolean).join(' / ')}</>
                  )}
                  {' · '}{fmtDate(r.created_at)}
                </div>
              </div>
              <div className="ro-amt">
                {r.refund_amount != null ? (
                  <>
                    {fmtMoney(r.refund_amount)}
                    <div className="sub">Refund</div>
                  </>
                ) : (
                  <>
                    {fmtMoney(r.transaction_amount)}
                    <div className="sub">Order</div>
                  </>
                )}
              </div>
              <span className={`pill ${r.return_status}`}>
                {STATUS_LABEL[r.return_status] || r.return_status}
              </span>
            </div>

            <div className="ro-sub">
              <div>
                <div className="kv-l">Customer</div>
                <div className="kv-v">
                  {r.customer_first_name || 'Customer'}
                  {r.customer_phone_masked ? ` · ${r.customer_phone_masked}` : ''}
                </div>
              </div>
              <div>
                <div className="kv-l">Requested</div>
                <div className="kv-v">{fmtDate(r.created_at)}</div>
              </div>
              <div>
                <div className="kv-l">Reviewed</div>
                <div className="kv-v">{fmtDate(r.reviewed_at)}</div>
              </div>
              <div>
                <div className="kv-l">Refunded</div>
                <div className="kv-v">{fmtDate(r.refunded_at)}</div>
              </div>
              {r.reason_text && (
                <div className="ro-notes">
                  <span className="kv-l">Customer note</span> — {r.reason_text}
                </div>
              )}
              {r.admin_notes && (
                <div className="ro-notes">
                  <span className="kv-l">INFLX note</span> — {r.admin_notes}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
