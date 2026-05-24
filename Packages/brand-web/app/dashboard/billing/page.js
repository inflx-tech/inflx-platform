'use client';

/**
 * /dashboard/billing — Brand subscription invoice history
 *
 * Phase A7-brand. Read-only list of all subscription_invoices for the
 * current brand. Mirrors /admin/billing/invoices style; this view is
 * brand-scoped (the same data, filtered to caller's brand by backend).
 */

import { useEffect, useState } from 'react';
import { brandApi, fmtMoney } from '../../../lib/api';

const CSS = `
.b *{box-sizing:border-box}
.b{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --border:#E4E4E7; --ink:#0A0A0A; --ink2:#52525B; --ink3:#A1A1AA;
  background:var(--bg); color:var(--ink); min-height:100vh;
  font-family:'Outfit',ui-sans-serif,system-ui,sans-serif;
}
.b .wrap{max-width:1200px; margin:0 auto; padding:24px}
.b h1{font-size:24px; font-weight:600; margin:0 0 4px}
.b .sub{color:var(--ink2); font-size:14px; margin-bottom:24px}
.b .card{background:var(--white); border:1px solid var(--border); border-radius:12px; overflow:hidden}
.b table{width:100%; border-collapse:collapse; font-size:14px}
.b th{background:var(--bg2); text-align:left; padding:12px 16px; font-weight:600; color:var(--ink2); font-size:12px; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid var(--border)}
.b td{padding:12px 16px; border-bottom:1px solid var(--bg2)}
.b tr:last-child td{border-bottom:0}
.b .pill{display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; background:var(--bg2); color:var(--ink2)}
.b .pill.paid{background:#DCFCE7; color:#166534}
.b .pill.pending{background:#FEF3C7; color:#92400E}
.b .pill.failed{background:#FEE2E2; color:#991B1B}
.b .pill.refunded{background:#DBEAFE; color:#1E40AF}
.b .mono{font-family:'JetBrains Mono',ui-monospace,monospace; font-size:12px; color:var(--ink2)}
.b .empty{padding:48px 24px; text-align:center; color:var(--ink3); font-size:14px}
.b .summary{display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap}
.b .stat{background:var(--white); border:1px solid var(--border); border-radius:12px; padding:16px 20px; min-width:180px}
.b .stat .label{font-size:11px; color:var(--ink3); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px}
.b .stat .val{font-size:22px; font-weight:600; color:var(--ink)}
.b .err{padding:12px; background:#FEE2E2; color:#991B1B; border-radius:8px; font-size:13px; margin-bottom:16px}
`;

function pillClass(status) {
  return `pill ${status}`;
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setL]         = useState(true);
  const [err, setErr]           = useState(null);

  async function load() {
    setL(true); setErr(null);
    try {
      const res = await brandApi.getMyInvoices({ limit: 100 });
      setInvoices(res.data?.invoices || []);
    } catch (e) {
      setErr(e?.message || 'Failed to load invoices');
    } finally {
      setL(false);
    }
  }
  useEffect(() => { load(); }, []);

  const paidSum = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.total_inr || i.amount_inr || 0), 0);
  const pendingCount = invoices.filter(i => i.status === 'pending').length;
  const failedCount  = invoices.filter(i => i.status === 'failed').length;

  return (
    <div className="b">
      <style>{CSS}</style>
      <div className="wrap">
        <h1>Billing</h1>
        <div className="sub">Subscription invoices for your brand. GST 18% included in totals.</div>

        {err && <div className="err">{err}</div>}

        <div className="summary">
          <div className="stat"><div className="label">Invoices</div><div className="val">{invoices.length}</div></div>
          <div className="stat"><div className="label">Paid (₹)</div><div className="val">{fmtMoney(paidSum)}</div></div>
          {pendingCount > 0 && <div className="stat"><div className="label">Pending</div><div className="val">{pendingCount}</div></div>}
          {failedCount > 0 && <div className="stat"><div className="label">Failed</div><div className="val">{failedCount}</div></div>}
        </div>

        <div className="card">
          {loading ? (
            <div className="empty">Loading…</div>
          ) : invoices.length === 0 ? (
            <div className="empty">No invoices yet. Your first invoice will appear here when you upgrade to a paid plan.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Tier</th>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>GST</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Paid at</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><span className="mono">{(inv.id || '').slice(0, 8)}</span></td>
                    <td>{(inv.tier_key || '').toUpperCase()}</td>
                    <td>{inv.period_start} → {inv.period_end}</td>
                    <td>{fmtMoney(inv.amount_inr || 0)}</td>
                    <td>{fmtMoney(inv.gst_amount_inr || 0)}</td>
                    <td><strong>{fmtMoney(inv.total_inr || (parseFloat(inv.amount_inr || 0) + parseFloat(inv.gst_amount_inr || 0)))}</strong></td>
                    <td><span className={pillClass(inv.status)}>{inv.status}</span></td>
                    <td>{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
