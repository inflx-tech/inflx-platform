'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { brandApi, fmtMoney } from '../../../../../lib/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

const STATUS_ICON = { queued: '⏳', locked: '🔒', released: '✓' };
const STATUS_CLS  = { queued: 'queued', locked: 'locked', released: 'released' };

// ─── Locked palette CSS scoped under .esc ───────────────────────────────────
const CSS = `
.esc *{box-sizing:border-box}
.esc{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --yellow:#FFC107; --yellow-hover:#E0A800; --yellow-pale:#FFF7CC; --yellow-50:#FFFDEB; --yellow-text:#6B5A00;
  --ink:#0A0A0A; --ink-2:#1F1F22;
  --muted:#52525B; --muted-2:#71717A; --muted-3:#A1A1AA; --muted-4:#D4D4D8;
  --border:#E4E4E7; --border-soft:#F4F4F5;
  --success:#10B981; --success-pale:#D1FAE5; --success-text:#047857;
  --danger:#E8401A; --danger-pale:#FDEEE9; --danger-text:#B91C1C;
  --info:#1D4ED8; --info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;
  color:var(--ink); font-size:13px; line-height:1.45;
  max-width:880px; margin:0 auto;
}
.esc .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

.esc .crumb{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);letter-spacing:.3px;text-transform:uppercase;margin-bottom:14px}
.esc .crumb b{color:var(--ink);font-weight:800}
.esc .crumb .sep{color:var(--muted-3);margin:0 6px}
.esc .crumb a{color:var(--muted-2);cursor:pointer;text-decoration:none}
.esc .crumb a:hover{color:var(--ink)}

.esc .hdr{margin-bottom:18px}
.esc .hdr h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.esc .hdr .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.esc .hdr .sub{font-size:12px;color:var(--muted-2);max-width:560px;line-height:1.5}
.esc .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}

.esc .hero{background:var(--ink);color:var(--white);border-radius:16px;padding:22px 26px;margin-bottom:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;position:relative;overflow:hidden}
@media (max-width: 640px){.esc .hero{grid-template-columns:repeat(2,1fr)}}
.esc .hero::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:var(--yellow);border-radius:50%;opacity:.06}
.esc .hero-cell{position:relative;z-index:2;border-left:1px solid rgba(255,255,255,.08);padding-left:18px}
.esc .hero-cell:first-child{border-left:0;padding-left:0}
.esc .hero-v{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:800;line-height:1.1;letter-spacing:-.4px;color:var(--white)}
.esc .hero-v.yel{color:var(--yellow)}
.esc .hero-v.green{color:#86EFAC}
.esc .hero-v.info{color:#93C5FD}
.esc .hero-l{font-family:'Outfit',sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-top:6px}

.esc .inf-card{background:var(--white);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:10px}
.esc .inf-card:hover{border-color:var(--muted-3)}
.esc .inf-head{padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border-soft);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.esc .inf-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink)}
.esc .inf-name .fullname{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);margin-left:8px;font-weight:500}
.esc .inf-tcount{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted-2)}

.esc .tr{display:grid;grid-template-columns:auto 1fr auto auto;gap:14px;padding:12px 16px;border-bottom:1px solid var(--border-soft);align-items:center}
.esc .tr:last-child{border-bottom:0}
.esc .tr-ic{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
.esc .tr-ic.queued{background:var(--yellow-pale);color:var(--yellow-text)}
.esc .tr-ic.locked{background:var(--info-pale);color:var(--info)}
.esc .tr-ic.released{background:var(--success-pale);color:var(--success-text)}
.esc .tr-ic.unknown{background:var(--bg2);color:var(--muted-2)}
.esc .tr-mid{min-width:0}
.esc .tr-num{font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:var(--ink)}
.esc .tr-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.esc .tr-fee{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);margin-top:3px}
.esc .tr-fee b{color:var(--ink);font-weight:700}
.esc .tr-amt{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:800;color:var(--ink);text-align:right}
.esc .status-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px}
.esc .status-pill.queued{background:var(--yellow-pale);color:var(--yellow-text)}
.esc .status-pill.locked{background:var(--info-pale);color:var(--info)}
.esc .status-pill.released{background:var(--success-pale);color:var(--success-text)}
.esc .status-pill.unknown{background:var(--bg2);color:var(--muted)}

.esc .notice-conv{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid var(--yellow);border-radius:14px;padding:18px;display:flex;gap:14px;align-items:flex-start}
.esc .notice-conv .em{width:40px;height:40px;border-radius:10px;background:var(--yellow);color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.esc .notice-conv .body{flex:1;min-width:0}
.esc .notice-conv h4{font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--ink);margin-bottom:5px}
.esc .notice-conv p{font-size:12px;color:var(--muted);line-height:1.55;margin-bottom:8px}
.esc .notice-conv p strong{color:var(--ink);font-weight:700}
.esc .notice-conv a{font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;color:var(--yellow-text);text-decoration:underline}
.esc .notice-conv a:hover{color:var(--ink)}

.esc .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;position:relative;overflow:hidden}
.esc .empty::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.18}
.esc .empty > *{position:relative;z-index:2}
.esc .empty .em{font-size:48px;margin-bottom:10px}
.esc .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.esc .empty .t{font-size:12px;color:var(--muted);max-width:480px;margin:0 auto;line-height:1.55}

.esc .err{padding:14px 16px;background:var(--danger-pale);border:1px solid #FBCBC4;border-radius:12px;font-size:12.5px;color:var(--danger-text)}
.esc .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:esc-spin .8s linear infinite;margin:80px auto;display:block}
@keyframes esc-spin{to{transform:rotate(360deg)}}
`;

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function EscrowDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    brandApi.getCampaignEscrow(id).then(res => {
      setLoading(false);
      if (res.success) setData(res.data);
      else setError(res.error?.message || 'Failed to load escrow data');
    }).catch(() => {
      setLoading(false);
      setError('Failed to load escrow data');
    });
  }, [id]);

  const summary   = data?.summary;
  const breakdown = data?.influencer_breakdown || [];
  const campaign  = data?.campaign;
  const totalTranches = breakdown.reduce((s, inf) => s + (inf.tranches?.length || 0), 0);

  const headerCount = (() => {
    if (campaign?.has_tranches === false) return 'No tranches';
    if (!data?.entries || data.entries.length === 0) return '0 tranches';
    return `${totalTranches} tranches across ${breakdown.length} influencer${breakdown.length === 1 ? '' : 's'}`;
  })();

  return (
    <div className="esc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="crumb">
        <a onClick={() => router.push('/dashboard/campaigns')}>/dashboard</a>
        <span className="sep">/</span>
        <a onClick={() => router.push('/dashboard/campaigns')}>campaigns</a>
        <span className="sep">/</span>
        {campaign?.name && (
          <>
            <a onClick={() => router.push(`/dashboard/campaigns/${id}`)}>{campaign.name}</a>
            <span className="sep">/</span>
          </>
        )}
        <b>escrow</b>
      </div>

      <div className="hdr">
        <span className="cnt-chip">{headerCount}</span>
        <h1>Escrow Breakdown</h1>
        <div className="rule" />
        {campaign && (
          <div className="sub">{campaign.name}{campaign.has_tranches === false ? ' (commission-only campaign)' : ''}</div>
        )}
      </div>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="err">{error}</div>
      ) : campaign?.has_tranches === false ? (
        <div className="notice-conv">
          <div className="em">💸</div>
          <div className="body">
            <h4>No escrow for conversion campaigns</h4>
            <p>This campaign pays influencers <strong>commission per conversion</strong>, not a fixed fee — so there are no tranches to lock up front. Earnings appear in the influencer's pending balance as conversions happen, and roll over to their wallet after the 30-day return window.</p>
            <a onClick={() => router.push(`/dashboard/campaigns/${id}?tab=conversions`)} style={{ cursor: 'pointer' }}>Open Conversions tab →</a>
          </div>
        </div>
      ) : (!data?.entries || data.entries.length === 0) ? (
        <div className="empty">
          <div className="em">🔒</div>
          <div className="h">No escrow entries yet</div>
          <div className="t">Escrow entries are created when the campaign is published and influencers are contracted.</div>
        </div>
      ) : (
        <>
          {summary && (
            <div className="hero">
              <div className="hero-cell">
                <div className="hero-v mono">{fmtMoney(summary.total)}</div>
                <div className="hero-l">Total Escrowed</div>
              </div>
              <div className="hero-cell">
                <div className="hero-v yel mono">{fmtMoney(summary.total_locked)}</div>
                <div className="hero-l">Locked</div>
              </div>
              <div className="hero-cell">
                <div className="hero-v green mono">{fmtMoney(summary.total_released)}</div>
                <div className="hero-l">Released</div>
              </div>
              <div className="hero-cell">
                <div className="hero-v info mono">{fmtMoney(summary.total_queued)}</div>
                <div className="hero-l">Queued</div>
              </div>
            </div>
          )}

          <div>
            {breakdown.map(inf => (
              <div key={inf.campaign_influencer_id} className="inf-card">
                <div className="inf-head">
                  <div className="inf-name">
                    {inf.instagram_handle ? `@${inf.instagram_handle}` : inf.influencer_name}
                    {inf.influencer_name && inf.instagram_handle && (
                      <span className="fullname">{inf.influencer_name}</span>
                    )}
                  </div>
                  <div className="inf-tcount">{inf.tranches.length} tranche{inf.tranches.length !== 1 ? 's' : ''}</div>
                </div>
                {inf.tranches.map(t => {
                  const cls = STATUS_CLS[t.status] || 'unknown';
                  return (
                    <div key={t.id} className="tr">
                      <div className={`tr-ic ${cls}`}>{STATUS_ICON[t.status] || '?'}</div>
                      <div className="tr-mid">
                        <div className="tr-num">Tranche {t.tranche_number}</div>
                        <div className="tr-meta">
                          {(t.trigger_event || '').replace(/_/g, ' ')}
                          {t.released_at && (<span> · Released {fmtDate(t.released_at)}</span>)}
                        </div>
                        {Number(t.escrow_fee_amount) > 0 && (
                          <div className="tr-fee">
                            Protection fee <b>{fmtMoney(t.escrow_fee_amount)}</b> · GST <b>{fmtMoney(t.fee_gst_amount)}</b>
                          </div>
                        )}
                      </div>
                      <div className="tr-amt">{fmtMoney(t.amount)}</div>
                      <span className={`status-pill ${cls}`}>{t.status}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
