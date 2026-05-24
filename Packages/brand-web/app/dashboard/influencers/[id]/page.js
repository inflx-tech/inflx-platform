'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, fmtNum, fmtRupees } from '../../../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const TIER_CFG = {
  nano:      { label: 'Nano',      range: '1K–10K'    },
  micro:     { label: 'Micro',     range: '10K–100K'  },
  mid:       { label: 'Mid',       range: '100K–500K' },
  macro:     { label: 'Macro',     range: '100K–1M'   },
  mega:      { label: 'Mega',      range: '1M+'       },
  celebrity: { label: 'Celebrity', range: '1M+'       },
};

const PLATFORM_ICON = { Instagram: '📸', YouTube: '▶️', Both: '📸▶️' };

// ─── Helpers ────────────────────────────────────────────────────────────────

function initials(handle, name) {
  const src = (name || handle || '??').replace(/^@/, '').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function parseList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try { const j = JSON.parse(raw); return Array.isArray(j) ? j.filter(Boolean) : [raw]; }
  catch { return [raw]; }
}

function relDays(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

// ─── Locked palette CSS scoped under .inf — day-1 discipline ────────────────
const CSS = `
.inf *{box-sizing:border-box}
.inf{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --yellow:#FFC107; --yellow-hover:#E0A800; --yellow-pale:#FFF7CC; --yellow-50:#FFFDEB; --yellow-text:#6B5A00;
  --ink:#0A0A0A; --ink-2:#1F1F22;
  --muted:#52525B; --muted-2:#71717A; --muted-3:#A1A1AA; --muted-4:#D4D4D8;
  --border:#E4E4E7; --border-soft:#F4F4F5;
  --success:#10B981; --success-pale:#D1FAE5; --success-text:#047857;
  --danger:#E8401A; --danger-pale:#FDEEE9; --danger-text:#B91C1C;
  --conv:#7E22CE; --conv-pale:#F3E8FF;
  --eng:#0E7490; --eng-pale:#CFFAFE;
  --info:#1D4ED8; --info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;
  color:var(--ink); font-size:13px; line-height:1.45;
}
.inf .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

.inf .crumb{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);letter-spacing:.3px;text-transform:uppercase;margin-bottom:14px}
.inf .crumb b{color:var(--ink);font-weight:800}
.inf .crumb .sep{color:var(--muted-3);margin:0 6px}
.inf .crumb a{color:var(--muted-2);cursor:pointer}
.inf .crumb a:hover{color:var(--ink)}

.inf .btn-ghost{padding:8px 14px;background:var(--white);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}
.inf .btn-ghost:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.inf .btn-ink{padding:8px 14px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.inf .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.inf .btn-yel{padding:8px 14px;background:var(--yellow);color:var(--ink);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.inf .btn-yel:hover:not(:disabled){background:var(--yellow-hover);color:var(--ink)}

/* HERO */
.inf .prof-hero{background:var(--ink);color:var(--white);border-radius:18px;padding:24px 28px;display:flex;gap:22px;align-items:flex-start;position:relative;overflow:hidden;margin-bottom:16px}
.inf .prof-hero::before{content:'';position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:var(--yellow);border-radius:50%;opacity:.07}
.inf .prof-hero > *{position:relative;z-index:2}
.inf .prof-av{width:96px;height:96px;border-radius:20px;background:var(--yellow);color:var(--ink);display:flex;align-items:center;justify-content:center;font-family:'Outfit',sans-serif;font-weight:800;font-size:32px;flex-shrink:0;overflow:hidden}
.inf .prof-av img{width:100%;height:100%;object-fit:cover}
.inf .prof-info{flex:1;min-width:0}
.inf .prof-info h1{font-family:'Outfit',sans-serif;font-size:26px;font-weight:700;color:var(--white);letter-spacing:-.4px;margin-bottom:6px}
.inf .prof-row{display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:rgba(255,255,255,.65);margin-bottom:8px}
.inf .prof-row .yel{color:var(--yellow)}
.inf .prof-row .it{font-style:italic}
.inf .prof-bio{font-size:13px;color:rgba(255,255,255,.85);line-height:1.55;margin-bottom:10px;max-width:560px}
.inf .prof-tags{display:flex;flex-wrap:wrap;gap:5px}
.inf .prof-tag{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:99px;background:rgba(255,255,255,.08);color:var(--white);border:1px solid rgba(255,255,255,.12);text-transform:capitalize}
.inf .prof-cta{display:flex;flex-direction:column;gap:8px;flex-shrink:0}

.inf .ic-verify{display:inline-flex;align-items:center;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:5px;background:var(--yellow);color:var(--ink);text-transform:uppercase;letter-spacing:.3px}
.inf .tier-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px;display:inline-flex;align-items:center;gap:4px}
.inf .tier-pill.nano{background:rgba(255,255,255,.1);color:rgba(255,255,255,.85)}
.inf .tier-pill.micro{background:rgba(29,78,216,.25);color:#93C5FD}
.inf .tier-pill.mid{background:rgba(14,116,144,.25);color:#67E8F9}
.inf .tier-pill.macro{background:rgba(126,34,206,.25);color:#D8B4FE}
.inf .tier-pill.mega{background:var(--yellow);color:var(--ink)}
.inf .tier-pill.celebrity{background:rgba(232,64,26,.25);color:#FCA5A5}

/* Stats strip */
.inf .prof-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
.inf .prof-stat{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.inf .prof-stat-v{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-.3px}
.inf .prof-stat-v.green{color:var(--success-text)}
.inf .prof-stat-v.info{color:var(--info)}
.inf .prof-stat-l{font-family:'Outfit',sans-serif;font-size:10px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-top:4px}
.inf .prof-stat-s{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);margin-top:3px}

/* 2-col grid */
.inf .prof-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width: 880px){.inf .prof-grid{grid-template-columns:1fr}}
.inf .prof-col{display:flex;flex-direction:column;gap:14px}
.inf .prof-card{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:18px}
.inf .prof-card h3{font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:var(--ink);margin-bottom:12px;display:flex;align-items:center;gap:6px}
.inf .prof-card h3 .ind{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;color:var(--muted-2);padding:2px 6px;background:var(--bg);border-radius:5px;margin-left:auto}

/* Engagement bars */
.inf .eb-row{margin-bottom:10px}
.inf .eb-row:last-child{margin-bottom:0}
.inf .eb-top{display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);margin-bottom:4px}
.inf .eb-top b{color:var(--ink);font-weight:700}
.inf .eb-track{height:6px;background:var(--bg);border-radius:99px;overflow:hidden}
.inf .eb-fill{height:100%;background:var(--ink);border-radius:99px}
.inf .eb-fill.info{background:var(--info)}
.inf .eb-fill.green{background:var(--success)}
.inf .eb-fill.conv{background:var(--conv)}

/* k/v list */
.inf .kv-list .kv{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-soft);font-size:12px;gap:14px}
.inf .kv-list .kv:last-child{border-bottom:0}
.inf .kv-k{color:var(--muted-2);font-weight:500;flex-shrink:0}
.inf .kv-v{color:var(--ink);font-weight:700;font-family:'JetBrains Mono',monospace;text-align:right;overflow:hidden;text-overflow:ellipsis;min-width:0}

/* Past brands */
.inf .brands-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.inf .brand-card{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border-soft);border-radius:10px;min-width:0}
.inf .brand-av{width:24px;height:24px;border-radius:6px;background:var(--ink);color:var(--yellow);display:flex;align-items:center;justify-content:center;font-family:'Outfit',sans-serif;font-weight:800;font-size:10px;flex-shrink:0}
.inf .brand-h{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.inf .brand-h.more{color:var(--muted-2);font-weight:600}

/* Activity Signal */
.inf .fresh-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.inf .fresh{padding:10px 12px;background:var(--bg);border:1px solid var(--border-soft);border-radius:10px;text-align:center}
.inf .fresh-v{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:800;color:var(--ink);letter-spacing:-.2px;line-height:1.2}
.inf .fresh-v.green{color:var(--success-text)}
.inf .fresh-l{font-family:'Outfit',sans-serif;font-size:9.5px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-top:3px}
.inf .fresh-note{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted-2);text-align:center;margin-top:6px}

/* Pricing */
.inf .price-big{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:800;color:var(--ink);letter-spacing:-.4px;margin-bottom:4px}
.inf .price-sub{font-size:11.5px;color:var(--muted-2);margin-bottom:14px}
.inf .price-bar{display:flex;align-items:center;gap:8px}
.inf .price-bar-t{flex:1;height:6px;background:var(--bg);border-radius:99px;overflow:hidden}
.inf .price-bar-f{height:100%;background:linear-gradient(90deg,var(--yellow) 0%,var(--yellow-hover) 100%);border-radius:99px}
.inf .price-bar-l{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2)}

/* Collab chips */
.inf .chip-cloud{display:flex;flex-wrap:wrap;gap:6px}
.inf .chip{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px;background:var(--bg);border:1px solid var(--border);color:var(--ink);text-transform:capitalize}
.inf .chip.use{background:var(--conv-pale);color:var(--conv);border-color:rgba(126,34,206,.2)}

/* Sticky bottom CTA */
.inf .sticky-cta{position:sticky;bottom:0;background:var(--white);border-top:1px solid var(--border);padding:14px 24px;display:flex;justify-content:space-between;align-items:center;gap:14px;margin:24px -24px -24px;border-radius:0 0 14px 14px;flex-wrap:wrap}
.inf .sticky-cta-l{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2)}
.inf .sticky-cta-l b{color:var(--ink);font-weight:700}
.inf .sticky-cta-r{display:flex;gap:8px}

/* Modal */
.inf .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px}
.inf .modal{background:var(--white);border-radius:16px;max-width:380px;width:100%;padding:22px;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}
.inf .modal h3{font-family:'Outfit',sans-serif;font-size:16px;font-weight:700;color:var(--ink);margin-bottom:8px}
.inf .modal p{font-size:12.5px;color:var(--muted-2);margin-bottom:18px;line-height:1.55}
.inf .modal-actions{display:flex;gap:8px}
.inf .modal-actions button,.inf .modal-actions a{flex:1;padding:10px 14px;font-size:12px;font-weight:700;border-radius:10px;cursor:pointer;font-family:inherit;border:0;text-align:center;text-decoration:none;display:block}
.inf .modal-actions .cancel{background:var(--white);border:1px solid var(--border);color:var(--ink)}
.inf .modal-actions .cancel:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.inf .modal-actions .go{background:var(--ink);color:var(--yellow)}
.inf .modal-actions .go:hover{background:var(--ink-2);color:var(--yellow)}

.inf .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:inf-spin .8s linear infinite;margin:80px auto}
@keyframes inf-spin{to{transform:rotate(360deg)}}
.inf .err{padding:14px 16px;background:var(--danger-pale);border:1px solid #FBCBC4;border-radius:10px;font-size:12.5px;color:var(--danger-text);margin:80px auto;max-width:480px;text-align:center}
`;

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function InfluencerProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [inf, setInf]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    api.get(`/influencers/${id}`).then(res => {
      setLoading(false);
      if (res.success) setInf(res.data?.influencer || res.data);
    });
  }, [id]);

  // Derived collections (safe even before inf loads)
  const tier    = useMemo(() => (inf && TIER_CFG[inf.tier]) || TIER_CFG.micro, [inf]);
  const tierKey = inf && TIER_CFG[inf.tier] ? inf.tier : 'micro';
  const niches  = useMemo(() => [...(inf?.niche || []), ...(inf?.secondary_niche || [])].filter(Boolean), [inf]);
  const brands  = useMemo(() => parseList(inf?.past_brands_json), [inf]);
  const collabs = useMemo(() => parseList(inf?.collaboration_types_json), [inf]);
  const useCases = useMemo(() => parseList(inf?.recommended_use_cases), [inf]);

  if (loading) return (
    <div className="inf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="spinner" />
    </div>
  );
  if (!inf) return (
    <div className="inf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="err">Influencer not found.</div>
    </div>
  );

  const inits      = initials(inf.instagram_handle, inf.full_name || inf.name);
  const isScraped  = inf.source === 'scraped';
  const erVal      = Number(inf.engagement_rate || 0);
  const erColor    = erVal >= 8 ? 'green' : erVal >= 4 ? 'info' : '';
  const erLabel    = erVal >= 8 ? '🔥 Excellent' : erVal >= 4 ? '✅ Good' : 'Average';

  // Engagement bar segments — only render those with > 0
  const ebMax = Math.max(inf.avg_likes || 0, 1);
  const ebSegs = [
    { label: 'Likes',    value: inf.avg_likes,    icon: '❤', cls: 'ink' },
    { label: 'Comments', value: inf.avg_comments, icon: '💬', cls: 'info' },
    { label: 'Shares',   value: inf.avg_shares,   icon: '🔁', cls: 'green' },
    { label: 'Saves',    value: inf.avg_saves,    icon: '🔖', cls: 'conv' },
  ].filter(s => Number(s.value || 0) > 0);

  // Activity Signal — show card only when at least one field is non-null
  const hasActivity = inf.posting_frequency_per_week != null ||
                      inf.total_posts_90d != null ||
                      inf.commercial_post_rate != null ||
                      inf.rank_score != null ||
                      inf.growth_potential_score != null ||
                      inf.activity_status != null ||
                      inf.last_calculated_at != null;

  const profileWebsite = inf.website ? `https://${String(inf.website).replace(/^https?:\/\//, '')}` : null;
  const refreshNote = inf.last_calculated_at ? `Data last refreshed ${relDays(inf.last_calculated_at)}${isScraped ? ' · auto re-scraped every 7d' : ''}` : null;

  return (
    <div className="inf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="crumb">
        <a onClick={() => router.push('/dashboard')}>/dashboard</a>
        <span className="sep">/</span>
        <a onClick={() => router.push('/dashboard/influencers')}>influencers</a>
        <span className="sep">/</span>
        <b>@{inf.instagram_handle}</b>
      </div>

      {/* HERO */}
      <div className="prof-hero">
        <div className="prof-av">
          {inf.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inf.profile_image_url} alt={inf.instagram_handle} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : inits}
        </div>
        <div className="prof-info">
          <h1>{inf.full_name || inf.name || `@${inf.instagram_handle}`}</h1>
          <div className="prof-row">
            <span className="yel">@{inf.instagram_handle}</span>
            {inf.youtube_handle && <span>▶ {inf.youtube_handle}</span>}
            <span>{PLATFORM_ICON[inf.platform] || '📸'} {inf.platform || 'Instagram'}</span>
            {inf.city && <span>📍 {inf.city}{inf.state ? `, ${inf.state}` : ''}</span>}
            {inf.age && <span>🎂 {inf.age} yrs</span>}
            {inf.gender && <span style={{ textTransform: 'capitalize' }}>⚤ {inf.gender}</span>}
            {isScraped && <span className="it">scraped{inf.last_calculated_at ? ` · data ${relDays(inf.last_calculated_at)}` : ''}</span>}
            {inf.is_inflx_verified && <span className="ic-verify">✓ Verified</span>}
            <span className={`tier-pill ${tierKey}`}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', opacity: .6 }}></span>{tier.label}</span>
          </div>
          {inf.bio && <p className="prof-bio">{inf.bio}</p>}
          <div className="prof-tags">
            {niches.map(n => <span key={n} className="prof-tag">{n}</span>)}
            {(inf.language || []).map(l => <span key={l} className="prof-tag">{l}</span>)}
          </div>
        </div>
        <div className="prof-cta">
          <button className="btn-yel" onClick={() => setShowInvite(true)}>+ Invite to Campaign</button>
          {profileWebsite && (
            <a href={profileWebsite} target="_blank" rel="noreferrer" className="btn-ghost" style={{ background: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.12)', color: '#FFFFFF', textAlign: 'center' }}>View on Instagram ↗</a>
          )}
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="prof-stats">
        <div className="prof-stat">
          <div className="prof-stat-v">{fmtNum(inf.followers_count)}</div>
          <div className="prof-stat-l">Followers</div>
          <div className="prof-stat-s">{tier.label} tier · {tier.range}</div>
        </div>
        <div className="prof-stat">
          <div className={`prof-stat-v ${erColor}`}>{erVal}%</div>
          <div className="prof-stat-l">Engagement Rate</div>
          <div className="prof-stat-s">{erLabel} · view-based</div>
        </div>
        <div className="prof-stat">
          <div className="prof-stat-v">{fmtNum(inf.avg_views)}</div>
          <div className="prof-stat-l">Avg Views</div>
          <div className="prof-stat-s">per post · last 90d</div>
        </div>
        <div className="prof-stat">
          <div className="prof-stat-v">{fmtNum(inf.total_posts)}</div>
          <div className="prof-stat-l">Total Posts</div>
          <div className="prof-stat-s">lifetime</div>
        </div>
      </div>

      {/* 2-COL GRID */}
      <div className="prof-grid">
        {/* LEFT */}
        <div className="prof-col">
          {/* Engagement */}
          {ebSegs.length > 0 && (
            <div className="prof-card">
              <h3>📊 Avg Engagement per Post <span className="ind">view-based</span></h3>
              {ebSegs.map(s => {
                const pct = Math.min(100, Math.max(2, ((s.value || 0) / ebMax) * 100));
                return (
                  <div key={s.label} className="eb-row">
                    <div className="eb-top"><span>{s.icon} {s.label}</span><b>{fmtNum(s.value)}</b></div>
                    <div className="eb-track"><div className={`eb-fill ${s.cls}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pricing */}
          <div className="prof-card">
            <h3>💰 Pricing (per post)</h3>
            {inf.price_per_post_min && inf.price_per_post_max ? (
              <>
                <div className="price-big">{fmtRupees(inf.price_per_post_min)} – {fmtRupees(inf.price_per_post_max)}</div>
                <div className="price-sub">Indicative rate · final fee via negotiation</div>
                <div className="price-bar">
                  <div className="price-bar-t"><div className="price-bar-f" style={{ width: '60%' }} /></div>
                  <div className="price-bar-l">{tier.label} avg</div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>Pricing not disclosed</div>
            )}
          </div>

          {/* Collab types */}
          {collabs.length > 0 && (
            <div className="prof-card">
              <h3>🎬 Collaboration Types</h3>
              <div className="chip-cloud">
                {collabs.map(c => <span key={c} className="chip">{String(c).replace(/_/g, ' ')}</span>)}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="prof-col">
          {/* Past Brands */}
          {brands.length > 0 && (
            <div className="prof-card">
              <h3>
                🏆 Past Brand Collaborations
                <span className="ind">
                  {inf.total_brand_collaborations ? `${inf.total_brand_collaborations} collabs` : `${brands.length} brand${brands.length === 1 ? '' : 's'}`}
                  {inf.unique_brands_count ? ` · ${inf.unique_brands_count} unique` : ''}
                </span>
              </h3>
              <div className="brands-grid">
                {brands.slice(0, 8).map(b => {
                  const bn = String(typeof b === 'string' ? b : (b.handle || ''));
                  if (!bn) return null;
                  return (
                    <div key={bn} className="brand-card">
                      <div className="brand-av">{bn.replace(/^@/, '').slice(0, 1).toUpperCase()}</div>
                      <div className="brand-h">{bn.startsWith('@') ? bn : `@${bn}`}</div>
                    </div>
                  );
                })}
                {brands.length > 8 && (
                  <div className="brand-card">
                    <div className="brand-av">+</div>
                    <div className="brand-h more">+{brands.length - 8} more</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audience Insights */}
          <div className="prof-card">
            <h3>👥 Audience Insights</h3>
            <div className="kv-list">
              <div className="kv"><span className="kv-k">Platform</span><span className="kv-v">{PLATFORM_ICON[inf.platform] || '📸'} {inf.platform || 'Instagram'}</span></div>
              <div className="kv"><span className="kv-k">Primary Location</span><span className="kv-v">{inf.city || '—'}</span></div>
              <div className="kv"><span className="kv-k">Languages</span><span className="kv-v">{(inf.language || []).join(' · ') || '—'}</span></div>
              <div className="kv"><span className="kv-k">Gender</span><span className="kv-v" style={{ textTransform: 'capitalize' }}>{inf.gender || '—'}</span></div>
              <div className="kv"><span className="kv-k">Content Niches</span><span className="kv-v">{niches.slice(0, 3).join(' · ') || '—'}</span></div>
              {useCases.length > 0 && <div className="kv"><span className="kv-k">Use cases</span><span className="kv-v">{useCases.slice(0, 4).join(' · ')}</span></div>}
            </div>
          </div>

          {/* Activity Signal — NEW · only when scraped fields present */}
          {hasActivity && (
            <div className="prof-card">
              <h3>📈 Activity Signal <span className="ind">{isScraped ? 'scraped data' : 'inflx data'}</span></h3>
              <div className="fresh-row">
                <div className="fresh">
                  <div className="fresh-v">{inf.posting_frequency_per_week != null ? Number(inf.posting_frequency_per_week).toFixed(1) : '—'}</div>
                  <div className="fresh-l">posts/wk</div>
                </div>
                <div className="fresh">
                  <div className="fresh-v">{inf.total_posts_90d != null ? fmtNum(inf.total_posts_90d) : '—'}</div>
                  <div className="fresh-l">posts (90d)</div>
                </div>
                <div className="fresh">
                  <div className="fresh-v">{inf.commercial_post_rate != null ? `${Math.round(Number(inf.commercial_post_rate))}%` : '—'}</div>
                  <div className="fresh-l">commercial %</div>
                </div>
              </div>
              <div className="fresh-row">
                <div className="fresh">
                  <div className="fresh-v">{inf.rank_score != null ? Number(inf.rank_score).toFixed(1) : '—'}</div>
                  <div className="fresh-l">rank score</div>
                </div>
                <div className="fresh">
                  <div className="fresh-v green">{inf.growth_potential_score != null ? Math.round(Number(inf.growth_potential_score)) : '—'}</div>
                  <div className="fresh-l">growth /100</div>
                </div>
                <div className="fresh">
                  <div className="fresh-v">{inf.activity_status === 'active' ? '●' : inf.activity_status || '—'}</div>
                  <div className="fresh-l">{inf.activity_status || 'status'}</div>
                </div>
              </div>
              {refreshNote && <div className="fresh-note">{refreshNote}</div>}
            </div>
          )}
        </div>
      </div>

      {/* STICKY BOTTOM CTA */}
      <div className="sticky-cta">
        <div className="sticky-cta-l">Ready to collaborate? <b>{inf.full_name || inf.name || `@${inf.instagram_handle}`}</b> will see your invite in their offer inbox.</div>
        <div className="sticky-cta-r">
          <button className="btn-ghost" onClick={() => router.push('/dashboard/influencers')}>← Back to search</button>
          <button className="btn-ink" onClick={() => setShowInvite(true)}>+ Invite to Campaign</button>
        </div>
      </div>

      {/* Invite Modal — preserved placeholder (no backend mutation today) */}
      {showInvite && (
        <div className="modal-bg" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Invite @{inf.instagram_handle}</h3>
            <p>To invite this influencer to a campaign, go to your campaign wizard and use the influencer search in handpick mode.</p>
            <div className="modal-actions">
              <button className="cancel" onClick={() => setShowInvite(false)}>Close</button>
              <a className="go" href="/dashboard/campaigns">Go to Campaigns</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
