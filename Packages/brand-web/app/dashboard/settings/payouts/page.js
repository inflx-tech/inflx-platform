'use client';

/**
 * /dashboard/settings/payouts — Wave 3 (commerce settlement).
 *
 * Connect a Razorpay Route payout account so commerce sales (pay-at-store /
 * online orders / bookings) settle the brand's net share automatically. The
 * account is built from the brand's saved bank details (Wallet → Bank account).
 * In mock mode the account is synthesized instantly so the flow is testable
 * before Razorpay Route is enabled.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { brandApi } from '../../../../lib/api';

const CSS = `
.pay *{box-sizing:border-box}
.pay{--white:#FFFFFF;--bg:#FAFAFA;--bg2:#F4F4F5;--border:#E4E4E7;--ink:#0A0A0A;--ink2:#52525B;--ink3:#A1A1AA;--accent:#0A0A0A;--success:#16A34A;--warn:#D97706;--danger:#DC2626;background:var(--bg);min-height:100vh;color:var(--ink);font-family:'Outfit',ui-sans-serif,system-ui,sans-serif}
.pay .wrap{max-width:720px;margin:0 auto;padding:24px}
.pay h1{font-size:24px;font-weight:600;margin:0 0 4px}
.pay .sub{color:var(--ink2);font-size:14px;margin-bottom:24px}
.pay .card{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:16px}
.pay .row{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--bg2);font-size:14px}
.pay .row:last-child{border-bottom:0}
.pay .row .k{color:var(--ink2)}
.pay .row .v{font-weight:600}
.pay .pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;text-transform:capitalize}
.pay .pill.activated{background:#DCFCE7;color:#166534}
.pay .pill.created{background:#FEF9C3;color:#854D0E}
.pay .pill.not_created{background:var(--bg2);color:var(--ink3)}
.pay .pill.needs_clarification,.pay .pill.suspended{background:#FEE2E2;color:#991B1B}
.pay .btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;border:1px solid var(--accent);background:var(--accent);color:var(--white)}
.pay .btn:disabled{opacity:.5;cursor:not-allowed}
.pay .btn.ghost{background:var(--white);color:var(--ink);border-color:var(--border)}
.pay .err{padding:12px;background:#FEE2E2;color:#991B1B;border-radius:8px;font-size:13px;margin-bottom:16px}
.pay .ok{padding:12px;background:#DCFCE7;color:#166534;border-radius:8px;font-size:13px;margin-bottom:16px}
.pay .hint{font-size:12.5px;color:var(--ink2);line-height:1.6;margin-top:10px}
.pay .empty{padding:18px;text-align:center;background:var(--bg);border:1px dashed var(--border);border-radius:10px}
`;

export default function PayoutsPage() {
  const router = useRouter();
  const [acc, setAcc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  async function load() {
    const res = await brandApi.getPayoutAccount();
    setLoading(false);
    if (res.success) setAcc(res.data);
    else setErr(res.error?.message || 'Failed to load payout account');
  }

  useEffect(() => { load(); }, []);

  async function connect() {
    setConnecting(true); setErr(null); setOk(null);
    const res = await brandApi.createPayoutAccount();
    setConnecting(false);
    if (res.success) {
      setOk('Payout account connected. Commerce sales will settle to your bank automatically.');
      await load();
    } else {
      setErr(res.error?.message || 'Could not connect payout account');
    }
  }

  const status = acc?.linked_account_status || 'not_created';
  const connected = status !== 'not_created';

  return (
    <div className="pay">
      <style>{CSS}</style>
      <div className="wrap">
        <h1>Payouts</h1>
        <div className="sub">Connect a payout account so your commerce sales settle to your bank automatically.</div>

        {err && <div className="err">{err}</div>}
        {ok  && <div className="ok">{ok}</div>}

        {loading ? (
          <div className="card"><div className="empty">Loading…</div></div>
        ) : (
          <div className="card">
            <div className="row">
              <span className="k">Status</span>
              <span className={`pill ${status}`}>{status.replace(/_/g, ' ')}</span>
            </div>
            {acc?.bank_last4 && (
              <div className="row">
                <span className="k">Settlement bank</span>
                <span className="v">•••• {acc.bank_last4}{acc.bank_ifsc ? ` · ${acc.bank_ifsc}` : ''}</span>
              </div>
            )}
            {acc?.linked_account_id && (
              <div className="row">
                <span className="k">Account ID</span>
                <span className="v" style={{ fontFamily: 'monospace', fontSize: 12 }}>{acc.linked_account_id}</span>
              </div>
            )}

            {!connected && (
              <div style={{ marginTop: 16 }}>
                {acc?.has_bank_details ? (
                  <>
                    <button className="btn" onClick={connect} disabled={connecting}>
                      {connecting ? 'Connecting…' : 'Connect payout account'}
                    </button>
                    <div className="hint">
                      We&apos;ll use the bank account saved in your Wallet for settlements. Commerce sales settle to it after our commission (and TCS, where applicable).
                    </div>
                  </>
                ) : (
                  <div className="empty">
                    <div style={{ marginBottom: 10, color: 'var(--ink2)', fontSize: 13 }}>
                      Add your bank account (account number + IFSC) in Wallet first.
                    </div>
                    <button className="btn ghost" onClick={() => router.push('/dashboard/wallet')}>Go to Wallet →</button>
                  </div>
                )}
              </div>
            )}

            {connected && status !== 'activated' && (
              <div className="hint">Your payout account is being verified by our payments partner. Settlements begin once it&apos;s active.</div>
            )}
            {status === 'activated' && (
              <div className="hint">✓ Active — your commerce sales will settle to your bank automatically.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
