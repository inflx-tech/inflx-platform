'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { influencerApi, fmtNum, fmtRupees } from '../../../../lib/api';

// ─── Constants — locked palette tier colors ─────────────────────────────────

const TIER_COLOR = {
  nano:      '#52525B',  // muted
  micro:     '#1D4ED8',  // info
  mid:       '#0E7490',  // eng
  macro:     '#7E22CE',  // conv
  mega:      '#FFC107',  // yellow
  celebrity: '#E8401A',  // danger
  unknown:   '#A1A1AA',  // muted-3
};

const VER_COLOR = {
  verified:   '#FFC107',  // yellow
  unverified: '#D4D4D8',  // muted-4
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function initials(handle, name) {
  const src = (name || handle || '??').replace(/^@/, '').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
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

.inf .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.inf .hdr-l h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.inf .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.inf .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:600px;line-height:1.5}
.inf .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}
.inf .btn-ghost{padding:8px 14px;background:var(--white);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}
.inf .btn-ghost:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.inf .btn-ink{padding:8px 14px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.inf .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}

/* Scope filter */
.inf .scope{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:12px 16px;margin-bottom:14px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.inf .scope-l{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.5px;margin-right:6px}
.inf .scope input,.inf .scope select{padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:inherit;outline:none;background:var(--white);color:var(--ink)}
.inf .scope input:focus,.inf .scope select:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.inf .scope-clear{padding:7px 10px;background:transparent;border:0;font-size:11px;font-weight:700;color:var(--muted-2);text-decoration:underline;cursor:pointer;font-family:inherit;margin-left:auto}
.inf .scope-clear:hover{color:var(--danger-text);background:transparent}

/* Stat tiles */
.inf .an-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
@media (max-width: 880px){.inf .an-stats{grid-template-columns:repeat(2,1fr)}}
.inf .an-stat{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.inf .an-stat-l{font-family:'Outfit',sans-serif;font-size:10px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.inf .an-stat-v{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-.3px;margin-top:4px}
.inf .an-stat-v.yel{color:var(--yellow-text)}
.inf .an-stat-v.green{color:var(--success-text)}
.inf .an-stat-s{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);margin-top:4px}

/* Chart card */
.inf .chart{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:14px}
.inf .chart h3{font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:var(--ink);display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px}
.inf .chart h3 .more{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:var(--yellow-text);text-decoration:none;background:var(--yellow-pale);padding:3px 8px;border-radius:6px;border:0;cursor:pointer}
.inf .chart h3 .more:hover:not(:disabled){background:var(--yellow);color:var(--ink)}
.inf .chart .csub{font-size:11px;color:var(--muted-2);margin-bottom:14px}

.inf .row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width: 880px){.inf .row2{grid-template-columns:1fr}}

/* Donut */
.inf .donut-wrap{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.inf .donut{position:relative;width:130px;height:130px;flex-shrink:0}
.inf .donut svg{transform:rotate(-90deg)}
.inf .donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.inf .donut-center-v{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:800;color:var(--ink)}
.inf .donut-center-l{font-family:'Outfit',sans-serif;font-size:9.5px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.inf .donut-legend{flex:1;min-width:160px}
.inf .dl-row{display:flex;align-items:center;gap:7px;padding:4px 0;font-size:11.5px}
.inf .dl-sw{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.inf .dl-lbl{flex:1;color:var(--ink);font-weight:600;text-transform:capitalize}
.inf .dl-n{font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--muted)}
.inf .dl-pct{font-family:'JetBrains Mono',monospace;color:var(--muted-2);width:42px;text-align:right;font-size:10.5px}

/* Bar list */
.inf .bar-row{display:flex;align-items:center;gap:10px;font-size:11.5px;margin-bottom:6px}
.inf .bar-lbl{width:130px;color:var(--ink);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}
.inf .bar-track{flex:1;height:20px;background:var(--bg);border-radius:6px;overflow:hidden;min-width:60px}
.inf .bar-fill{height:100%;background:var(--ink);border-radius:6px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:700;white-space:nowrap}
.inf .bar-fill.yel{background:var(--yellow);color:var(--ink)}
.inf .bar-fill.info{background:var(--info);color:var(--white)}
.inf .bar-fill.conv{background:var(--conv);color:var(--white)}
.inf .bar-fill.green{background:var(--success);color:var(--white)}
.inf .bar-n{width:50px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);font-weight:700;flex-shrink:0}

/* Rate table */
.inf .rt-wrap{overflow-x:auto}
.inf .rt-table{width:100%;border-collapse:collapse;font-size:11.5px;min-width:540px}
.inf .rt-table thead th{text-align:left;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;padding:6px 10px;border-bottom:1px solid var(--border)}
.inf .rt-table tbody td{padding:8px 10px;border-bottom:1px solid var(--border-soft);font-family:'JetBrains Mono',monospace;color:var(--ink);font-weight:700}
.inf .rt-table tbody td:first-child{font-family:inherit;display:flex;align-items:center;gap:6px;text-transform:capitalize}
.inf .rt-table tbody td .dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.inf .rt-table tbody td.muted{color:var(--muted-2);font-weight:600}
.inf .rt-table tbody td.right{text-align:right}

/* Leaderboard */
.inf .lb{display:flex;flex-direction:column;gap:2px}
.inf .lb-row{display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer;background:transparent;border:0;width:100%;text-align:left;font-family:inherit;color:var(--ink)}
.inf .lb-row:hover:not(:disabled){background:var(--bg);color:var(--ink)}
.inf .lb-rank{width:18px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;color:var(--muted-3);flex-shrink:0}
.inf .lb-rank.top{color:var(--yellow-text)}
.inf .lb-av{width:30px;height:30px;border-radius:8px;background:var(--yellow-pale);color:var(--yellow-text);display:flex;align-items:center;justify-content:center;font-family:'Outfit',sans-serif;font-weight:800;font-size:11px;flex-shrink:0;overflow:hidden}
.inf .lb-av img{width:100%;height:100%;object-fit:cover}
.inf .lb-info{flex:1;min-width:0}
.inf .lb-name{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.inf .lb-name .v{color:var(--info)}
.inf .lb-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.inf .lb-metric{text-align:right;flex-shrink:0}
.inf .lb-metric-v{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:800;color:var(--ink)}
.inf .lb-metric-v.yel{color:var(--yellow-text)}
.inf .lb-metric-v.green{color:var(--success-text)}
.inf .lb-metric-v.info{color:var(--info)}
.inf .lb-metric-l{font-family:'Outfit',sans-serif;font-size:9px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}

.inf .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:inf-spin .8s linear infinite;margin:80px auto}
@keyframes inf-spin{to{transform:rotate(360deg)}}
.inf .err{padding:14px 16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;font-size:12.5px;color:var(--muted);margin:60px auto;max-width:480px;text-align:center}
`;

// ─── Donut component ────────────────────────────────────────────────────────

function Donut({ segments, totalLabel = 'creators' }) {
  const radius = 50;
  const C = 2 * Math.PI * radius;  // 314.159…
  const total = segments.reduce((s, x) => s + (x.n || 0), 0);
  let offset = 0;
  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={radius} fill="none" stroke="#F4F4F5" strokeWidth="16" />
          {segments.map(s => {
            const len = total > 0 ? (s.n / total) * C : 0;
            const dash = `${len} ${C - len}`;
            const el = (
              <circle key={s.key} cx="65" cy="65" r={radius} fill="none"
                stroke={s.color} strokeWidth="16"
                strokeDasharray={dash}
                strokeDashoffset={-offset} />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="donut-center">
          <div className="donut-center-v">{fmtNum(total)}</div>
          <div className="donut-center-l">{totalLabel}</div>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map(s => (
          <div key={s.key} className="dl-row">
            <div className="dl-sw" style={{ background: s.color }} />
            <div className="dl-lbl">{s.label}</div>
            <div className="dl-n">{fmtNum(s.n)}</div>
            <div className="dl-pct">{total > 0 ? Math.round((s.n / total) * 100) : 0}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bar row component ──────────────────────────────────────────────────────

function BarRow({ label, value, max, color = '', fmt = fmtNum, prefix = '' }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="bar-row">
      <div className="bar-lbl">{prefix}{label}</div>
      <div className="bar-track">
        <div className={`bar-fill ${color}`} style={{ width: `${pct}%` }}>
          {pct > 22 && fmt(value)}
        </div>
      </div>
      {pct <= 22 && <div className="bar-n">{fmt(value)}</div>}
    </div>
  );
}

// ─── Leaderboard row component ──────────────────────────────────────────────

function LbRow({ rank, c, metric, metricLabel, metricColor = '', router }) {
  const inits = initials(c.ig_handle, c.full_name);
  const dest = `/dashboard/influencers/${c.linked_influencer_id || c.row_id || ''}?handle=${c.ig_handle}`;
  return (
    <button className="lb-row" onClick={() => router.push(dest)}>
      <div className={`lb-rank${rank <= 3 ? ' top' : ''}`}>{rank}</div>
      <div className="lb-av">
        {c.profile_pic_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.profile_pic_url} alt={c.ig_handle} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : inits}
      </div>
      <div className="lb-info">
        <div className="lb-name">
          @{c.ig_handle}
          {c.is_inflx_verified && <span className="v">✓</span>}
        </div>
        <div className="lb-meta">{[c.tier, c.city, c.niche].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="lb-metric">
        <div className={`lb-metric-v ${metricColor}`}>{metric}</div>
        <div className="lb-metric-l">{metricLabel}</div>
      </div>
    </button>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CreatorAnalyticsPage() {
  const router = useRouter();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [city,    setCity]    = useState('');
  const [niche,   setNiche]   = useState('');
  const [tier,    setTier]    = useState('');

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function load() {
    setLoading(true);
    const params = {};
    if (city)  params.city  = city;
    if (niche) params.niche = niche;
    if (tier)  params.tier  = tier;
    const res = await influencerApi.analytics(params);
    setLoading(false);
    if (res.success) setData(res.data);
  }

  // Derived values — safe even before data loads
  const ov = data?.overview;

  const tierSegs = useMemo(() => (data?.tier_distribution || []).map(t => ({
    key: t.tier, label: t.tier, n: t.n, color: TIER_COLOR[t.tier] || TIER_COLOR.unknown,
  })), [data]);

  const verSegs = useMemo(() => ([
    { key: 'verified',   label: 'Verified by Inflx', n: data?.verification_breakdown?.verified   || 0, color: VER_COLOR.verified },
    { key: 'unverified', label: 'Not verified',      n: data?.verification_breakdown?.unverified || 0, color: VER_COLOR.unverified },
  ]), [data]);

  const cityMax   = useMemo(() => Math.max(1, ...((data?.city_distribution     || []).map(r => r.n))), [data]);
  const nicheMax  = useMemo(() => Math.max(1, ...((data?.niche_distribution    || []).map(r => r.n))), [data]);
  const langMax   = useMemo(() => Math.max(1, ...((data?.language_distribution || []).map(r => r.n))), [data]);
  const erMax     = useMemo(() => Math.max(1, ...((data?.er_distribution?.buckets || []).map(r => r.n))), [data]);
  const brandsMax = useMemo(() => Math.max(1, ...((data?.trending_brands || []).map(r => r.creator_count))), [data]);

  if (loading && !data) return (
    <div className="inf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="spinner" />
    </div>
  );
  if (!data) return (
    <div className="inf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="err">Could not load analytics. Try refreshing.</div>
    </div>
  );

  return (
    <div className="inf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="crumb">
        <a onClick={() => router.push('/dashboard')}>/dashboard</a>
        <span className="sep">/</span>
        <a onClick={() => router.push('/dashboard/influencers')}>influencers</a>
        <span className="sep">/</span>
        <b>analytics</b>
      </div>

      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">{fmtNum(ov.total)} creators</span>
          <h1>Creator Market Analytics</h1>
          <div className="rule" />
          <div className="sub">Aggregate stats across the searchable pool — use to scope realistic budgets + spot trends.</div>
        </div>
        <button className="btn-ghost" onClick={() => router.push('/dashboard/influencers')}>← Back to search</button>
      </div>

      {/* SCOPE FILTER */}
      <div className="scope">
        <span className="scope-l">SCOPE</span>
        <input value={city}  onChange={(e) => setCity(e.target.value)}  placeholder="City (e.g. Vijayawada)" style={{ width: 180 }} />
        <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Niche (e.g. food_blogger)" style={{ width: 180 }} />
        <select value={tier} onChange={(e) => setTier(e.target.value)} style={{ textTransform: 'capitalize' }}>
          <option value="">All tiers</option>
          {Object.keys(TIER_COLOR).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn-ink" onClick={load}>Apply</button>
        {(city || niche || tier) && (
          <button className="scope-clear" onClick={() => { setCity(''); setNiche(''); setTier(''); setTimeout(load, 0); }}>Clear all</button>
        )}
      </div>

      {/* 4 STAT TILES */}
      <div className="an-stats">
        <div className="an-stat">
          <div className="an-stat-l">Total Creators</div>
          <div className="an-stat-v">{fmtNum(ov.total)}</div>
          <div className="an-stat-s">{ov.verified} verified · {ov.scraped} scraped · {ov.onboarded} onboarded</div>
        </div>
        <div className="an-stat">
          <div className="an-stat-l">Avg Engagement</div>
          <div className="an-stat-v yel">{ov.avg_view_er ?? 0}%</div>
          <div className="an-stat-s">view-based · across pool</div>
        </div>
        <div className="an-stat">
          <div className="an-stat-l">Distinct Cities</div>
          <div className="an-stat-v">{ov.distinct_cities}</div>
          <div className="an-stat-s">{ov.distinct_niches} niches</div>
        </div>
        <div className="an-stat">
          <div className="an-stat-l">Rate Range</div>
          <div className="an-stat-v green">{ov.min_rate ? `${fmtRupees(ov.min_rate)} – ${fmtRupees(ov.max_rate)}` : '—'}</div>
          <div className="an-stat-s">per post · est.</div>
        </div>
      </div>

      {/* DONUTS */}
      <div className="row2">
        <div className="chart">
          <h3>Tier distribution</h3>
          <div className="csub">Creators by follower tier</div>
          <Donut segments={tierSegs} />
        </div>
        <div className="chart">
          <h3>Verification</h3>
          <div className="csub">Verified by Inflx vs scraped/pending</div>
          <Donut segments={verSegs} />
        </div>
      </div>

      {/* CITY + NICHE BARS */}
      <div className="row2">
        <div className="chart">
          <h3>Top cities</h3>
          <div className="csub">Where creators are based</div>
          {(data.city_distribution || []).length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--muted-2)', padding: '20px 0', textAlign: 'center' }}>No city data yet</div>
          ) : (
            data.city_distribution.map(r => (
              <BarRow key={r.city} label={r.city} value={r.n} max={cityMax} prefix="📍 " />
            ))
          )}
        </div>
        <div className="chart">
          <h3>Top niches</h3>
          <div className="csub">What creators make</div>
          {(data.niche_distribution || []).length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--muted-2)', padding: '20px 0', textAlign: 'center' }}>No niche data yet</div>
          ) : (
            data.niche_distribution.map(r => (
              <BarRow key={r.niche} label={r.niche} value={r.n} max={nicheMax} color="yel" prefix="🎨 " />
            ))
          )}
        </div>
      </div>

      {/* ER + LANGUAGES */}
      <div className="row2">
        <div className="chart">
          <h3>Engagement rate distribution</h3>
          <div className="csub">How creators spread by view-based ER</div>
          {(data.er_distribution?.buckets || []).map(b => (
            <BarRow key={b.label} label={b.label} value={b.n} max={erMax} color={b.label.startsWith('5') || b.label.startsWith('8') ? 'green' : ''} />
          ))}
        </div>
        <div className="chart">
          <h3>Languages</h3>
          <div className="csub">Audience reach by language</div>
          {(data.language_distribution || []).length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--muted-2)', padding: '20px 0', textAlign: 'center' }}>No language data yet</div>
          ) : (
            data.language_distribution.map(r => (
              <BarRow key={r.lang} label={r.lang} value={r.n} max={langMax} color="info" />
            ))
          )}
        </div>
      </div>

      {/* RATE-BY-TIER TABLE */}
      <div className="chart">
        <h3>Pricing benchmarks by tier</h3>
        <div className="csub">Use this to set realistic campaign budgets</div>
        <div className="rt-wrap">
          <table className="rt-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th className="right">Creators</th>
                <th className="right">Avg min ₹</th>
                <th className="right">Avg max ₹</th>
                <th className="right">Median min</th>
                <th className="right">Median max</th>
              </tr>
            </thead>
            <tbody>
              {(data.rate_by_tier || []).map(r => (
                <tr key={r.tier}>
                  <td><span className="dot" style={{ background: TIER_COLOR[r.tier] || TIER_COLOR.unknown }} />{r.tier}</td>
                  <td className="right">{fmtNum(r.n)}</td>
                  <td className="right">{r.avg_min ? fmtRupees(r.avg_min) : '—'}</td>
                  <td className="right">{r.avg_max ? fmtRupees(r.avg_max) : '—'}</td>
                  <td className="right muted">{r.median_min ? fmtRupees(r.median_min) : '—'}</td>
                  <td className="right muted">{r.median_max ? fmtRupees(r.median_max) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEADERBOARDS — RANK + GROWTH */}
      <div className="row2">
        <div className="chart">
          <h3>🏆 Top by rank score <button className="more" onClick={() => router.push('/dashboard/influencers?sort=rank')}>View all →</button></h3>
          <div className="csub">Composite quality ranking — Inflx default sort</div>
          <div className="lb">
            {(data.top_rank || []).map((c, i) => (
              <LbRow key={c.ig_handle} rank={i + 1} c={c}
                metric={(Number(c.rank_score) || 0).toFixed(1)} metricLabel="rank" metricColor="yel" router={router} />
            ))}
            {!(data.top_rank || []).length && <div style={{ fontSize: 11, color: 'var(--muted-2)', padding: '12px 0', textAlign: 'center' }}>No rank data yet</div>}
          </div>
        </div>
        <div className="chart">
          <h3>🚀 Top by growth potential <button className="more" onClick={() => router.push('/dashboard/influencers?sort=growth')}>View all →</button></h3>
          <div className="csub">Creators worth investing in early</div>
          <div className="lb">
            {(data.top_growth || []).map((c, i) => (
              <LbRow key={c.ig_handle} rank={i + 1} c={c}
                metric={c.growth_potential_score} metricLabel="/100" metricColor="green" router={router} />
            ))}
            {!(data.top_growth || []).length && <div style={{ fontSize: 11, color: 'var(--muted-2)', padding: '12px 0', textAlign: 'center' }}>No growth data yet</div>}
          </div>
        </div>
      </div>

      {/* LEADERBOARDS — COST-EFF + CHEAPEST */}
      <div className="row2">
        <div className="chart">
          <h3>💎 Best cost-efficiency <button className="more" onClick={() => router.push('/dashboard/influencers?sort=cheapest')}>View all →</button></h3>
          <div className="csub">Most views per ₹1,000 spent</div>
          <div className="lb">
            {(data.cost_efficient || []).map((c, i) => (
              <LbRow key={c.ig_handle} rank={i + 1} c={c}
                metric={fmtNum(c.views_per_1k_inr)} metricLabel="views/₹1k" metricColor="info" router={router} />
            ))}
            {!(data.cost_efficient || []).length && <div style={{ fontSize: 11, color: 'var(--muted-2)', padding: '12px 0', textAlign: 'center' }}>No rate data yet</div>}
          </div>
        </div>
        <div className="chart">
          <h3>💰 Cheapest creators <button className="more" onClick={() => router.push('/dashboard/influencers?sort=cheapest')}>View all →</button></h3>
          <div className="csub">Lowest est. min rate</div>
          <div className="lb">
            {(data.cheapest || []).map((c, i) => (
              <LbRow key={c.ig_handle} rank={i + 1} c={c}
                metric={fmtRupees(c.estimated_min_rate)} metricLabel="min rate" metricColor="green" router={router} />
            ))}
            {!(data.cheapest || []).length && <div style={{ fontSize: 11, color: 'var(--muted-2)', padding: '12px 0', textAlign: 'center' }}>No rate data yet</div>}
          </div>
        </div>
      </div>

      {/* TRENDING BRANDS */}
      <div className="chart">
        <h3>🔗 Trending brands</h3>
        <div className="csub">Brands most-collabbed across this creator pool</div>
        {(data.trending_brands || []).length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--muted-2)', padding: '20px 0', textAlign: 'center' }}>No collab data yet</div>
        ) : (
          data.trending_brands.map(b => (
            <BarRow key={b.brand_handle} label={`@${b.brand_handle}`} value={b.creator_count} max={brandsMax} color="yel"
              fmt={(v) => `${v} creator${v === 1 ? '' : 's'}`} />
          ))
        )}
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}
