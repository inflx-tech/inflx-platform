'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }
function fmtMoney(p) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p || 0);
}
function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function changeColor(pct) {
  if (pct > 0) return 'text-green-600';
  if (pct < 0) return 'text-red';
  return 'text-t3';
}
function changeArrow(pct) {
  if (pct > 0) return '+';
  if (pct < 0) return '';
  return '';
}

// ── Overview Card ────────────────────────────────────────────────────────────

function OverviewCard({ label, value, change, color = 'navy' }) {
  const colors = { navy: 'text-navy', teal: 'text-teal', orange: 'text-orange', gold: 'text-yellow-600' };
  return (
    <div className="bg-white rounded-xl border border-border p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${colors[color] || 'text-t1'} mb-0.5`}>{value}</div>
      {change !== undefined && (
        <div className={`text-[10px] font-bold ${changeColor(change)}`}>
          {changeArrow(change)}{change}% vs prev period
        </div>
      )}
    </div>
  );
}

// ── Bar Chart (CSS-based) ────────────────────────────────────────────────────

function BarChart({ data, bars, label, maxVal }) {
  if (!data || data.length === 0) return <div className="text-xs text-t3">No data</div>;
  const max = maxVal || Math.max(...data.map(d => bars.reduce((s, b) => s + (d[b.key] || 0), 0)), 1);

  return (
    <div className="space-y-0">
      {/* Legend */}
      <div className="flex gap-3 mb-2">
        {bars.map(b => (
          <div key={b.key} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-sm ${b.color}`} />
            <span className="text-[9px] text-t3 font-medium">{b.label}</span>
          </div>
        ))}
      </div>
      {/* Bars */}
      <div className="flex items-end gap-[2px]" style={{ height: '120px' }}>
        {data.map((d, i) => {
          const total = bars.reduce((s, b) => s + (d[b.key] || 0), 0);
          const pct = max > 0 ? (total / max) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-stretch justify-end h-full group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-navy-deep text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {fmtDate(d.day)}: {bars.map(b => `${b.label} ${d[b.key] || 0}`).join(', ')}
              </div>
              {/* Stacked segments */}
              <div className="flex flex-col justify-end" style={{ height: `${Math.max(pct, 1)}%` }}>
                {bars.map(b => {
                  const segPct = total > 0 ? ((d[b.key] || 0) / total) * 100 : (100 / bars.length);
                  return (
                    <div
                      key={b.key}
                      className={`${b.color} rounded-t-[1px] min-h-[1px]`}
                      style={{ height: `${segPct}%` }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis labels — show every ~5th */}
      <div className="flex gap-[2px] mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            {(i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) ? (
              <span className="text-[8px] text-t3">{fmtDate(d.day)}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal Bar Chart ─────────────────────────────────────────────────────

function HorizontalBarChart({ data, labelKey, valueKey, color = 'bg-teal' }) {
  if (!data || data.length === 0) return <div className="text-xs text-t3">No data</div>;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);

  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-24 text-[10px] text-t2 font-medium truncate capitalize">{d[labelKey]}</div>
          <div className="flex-1 bg-bg rounded-full h-4 overflow-hidden">
            <div
              className={`${color} h-full rounded-full flex items-center justify-end pr-1.5 transition-all`}
              style={{ width: `${Math.max((d[valueKey] / max) * 100, 3)}%` }}
            >
              <span className="text-[9px] text-white font-bold">{d[valueKey]}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Campaign Funnel ──────────────────────────────────────────────────────────

function CampaignFunnel({ funnel }) {
  if (!funnel) return null;
  const stages = [
    { key: 'draft', label: 'Draft', color: 'bg-gray-400' },
    { key: 'published', label: 'Published', color: 'bg-blue-400' },
    { key: 'active', label: 'Active', color: 'bg-teal' },
    { key: 'completed', label: 'Completed', color: 'bg-green-500' },
    { key: 'cancelled', label: 'Cancelled', color: 'bg-red' },
  ];
  const max = Math.max(...stages.map(s => funnel[s.key] || 0), 1);

  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const val = funnel[s.key] || 0;
        const widthPct = Math.max((val / max) * 100, 4);
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div className="w-20 text-[10px] font-medium text-t2">{s.label}</div>
            <div className="flex-1 relative">
              <div
                className={`${s.color} h-6 rounded-md flex items-center px-2 transition-all`}
                style={{ width: `${widthPct}%` }}
              >
                <span className="text-[10px] text-white font-bold">{fmt(val)}</span>
              </div>
            </div>
            {i < stages.length - 2 && (
              <div className="text-[9px] text-t3 w-10 text-right">
                {funnel[stages[i + 1]?.key] > 0 && val > 0
                  ? `${Math.round((funnel[stages[i + 1].key] / val) * 100)}%`
                  : ''}
              </div>
            )}
          </div>
        );
      })}
      <div className="text-[9px] text-t3 mt-1">Total campaigns: {fmt(funnel.total)}</div>
    </div>
  );
}

// ── Period Selector ──────────────────────────────────────────────────────────

function PeriodSelector({ days, onChange }) {
  const options = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
  ];
  return (
    <div className="flex gap-1 bg-bg rounded-lg p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
            days === o.value
              ? 'bg-white text-navy shadow-sm border border-border'
              : 'text-t3 hover:text-t1'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      const res = await adminApi.getAnalytics(days);
      setLoading(false);
      if (res.success) setData(res.data);
      else setError(res.error?.message || 'Failed to load analytics');
    }
    load();
  }, [days]);

  if (loading) {
    return (
      <div className="max-w-5xl">
        <div className="flex items-center justify-center h-40 text-t3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
            Loading analytics...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl">
        <div className="p-4 bg-red-pale rounded-xl text-red text-sm">{error}</div>
      </div>
    );
  }

  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.overview) return null;

  const { overview, comparison, daily_signups, daily_transactions, top_campaigns, top_influencers, categories, funnel } = data;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Analytics</h1>
          <p className="text-xs text-t3 mt-0.5">Platform performance and insights</p>
        </div>
        <PeriodSelector days={days} onChange={setDays} />
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <OverviewCard
          label="Total Revenue"
          value={fmtMoney(overview.total_revenue)}
          change={comparison.revenue?.change}
          color="gold"
        />
        <OverviewCard
          label="Active Campaigns"
          value={fmt(overview.active_campaigns)}
          change={comparison.active_campaigns?.change}
          color="teal"
        />
        <OverviewCard
          label="Total Users"
          value={fmt(overview.total_users)}
          change={comparison.users?.change}
          color="navy"
        />
        <OverviewCard
          label="Conversion Rate"
          value={`${overview.conversion_rate}%`}
          color="orange"
        />
      </div>

      {/* Time-series charts */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Daily signups */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Daily Signups</div>
          <BarChart
            data={daily_signups}
            bars={[
              { key: 'brands', label: 'Brands', color: 'bg-navy' },
              { key: 'influencers', label: 'Influencers', color: 'bg-orange' },
            ]}
          />
        </div>

        {/* Daily revenue */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Daily Platform Revenue</div>
          <BarChart
            data={daily_transactions}
            bars={[
              { key: 'revenue', label: 'Revenue (paise)', color: 'bg-yellow-500' },
            ]}
          />
        </div>
      </div>

      {/* Daily transactions chart — full width */}
      <div className="bg-white rounded-xl border border-border p-4 mb-4">
        <div className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Daily Transactions</div>
        <BarChart
          data={daily_transactions}
          bars={[
            { key: 'transactions', label: 'Transactions', color: 'bg-teal' },
          ]}
        />
      </div>

      {/* Top campaigns & top influencers */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Top campaigns */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Top Campaigns</div>
          {top_campaigns.length === 0 ? (
            <div className="text-xs text-t3">No campaign data yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-t3 uppercase tracking-wider border-b border-border">
                    <th className="text-left pb-1.5 font-bold">Campaign</th>
                    <th className="text-left pb-1.5 font-bold">Brand</th>
                    <th className="text-left pb-1.5 font-bold">Category</th>
                    <th className="text-right pb-1.5 font-bold">Txns</th>
                    <th className="text-right pb-1.5 font-bold">Revenue</th>
                    <th className="text-left pb-1.5 font-bold pl-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {top_campaigns.map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-bg/50">
                      <td className="py-1.5 font-medium text-t1 max-w-[100px] truncate">{c.name}</td>
                      <td className="py-1.5 text-t2 max-w-[80px] truncate">{c.brand_name}</td>
                      <td className="py-1.5 text-t3 capitalize">{c.category || '-'}</td>
                      <td className="py-1.5 text-right font-bold text-navy">{fmt(c.follower_transactions)}</td>
                      <td className="py-1.5 text-right font-bold text-yellow-600">{fmtMoney(c.revenue)}</td>
                      <td className="py-1.5 pl-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase ${
                          c.status === 'live' ? 'bg-green-100 text-green-700' :
                          c.status === 'active' ? 'bg-teal-pale text-teal' :
                          c.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top influencers */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Top Influencers</div>
          {top_influencers.length === 0 ? (
            <div className="text-xs text-t3">No influencer data yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-t3 uppercase tracking-wider border-b border-border">
                    <th className="text-left pb-1.5 font-bold">Name</th>
                    <th className="text-left pb-1.5 font-bold">Handle</th>
                    <th className="text-right pb-1.5 font-bold">Followers</th>
                    <th className="text-right pb-1.5 font-bold">Done</th>
                    <th className="text-right pb-1.5 font-bold">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {top_influencers.map(inf => (
                    <tr key={inf.id} className="border-b border-border/50 hover:bg-bg/50">
                      <td className="py-1.5 font-medium text-t1 max-w-[80px] truncate">{inf.name || '-'}</td>
                      <td className="py-1.5 text-t2">@{inf.handle}</td>
                      <td className="py-1.5 text-right text-t2">{fmt(inf.followers)}</td>
                      <td className="py-1.5 text-right font-bold text-teal">{inf.campaigns_completed}</td>
                      <td className="py-1.5 text-right font-bold text-yellow-600">{fmtMoney(inf.total_earnings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown & campaign funnel */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Category breakdown */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Campaigns by Category</div>
          <HorizontalBarChart
            data={categories}
            labelKey="category"
            valueKey="count"
            color="bg-navy"
          />
        </div>

        {/* Campaign funnel */}
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs font-bold text-t2 uppercase tracking-wider mb-3">Campaign Funnel</div>
          <CampaignFunnel funnel={funnel} />
        </div>
      </div>
    </div>
  );
}
